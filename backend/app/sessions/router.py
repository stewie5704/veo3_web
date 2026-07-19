"""
WebSocket endpoint for the Chrome Extension.

Flow:
  1. Extension connects: ws://server/ws/extension?token=<jwt>
  2. Extension sends: {"type": "cookies", "cookies": "...", "project_id": "..."}
  3. Extension sends: {"type": "captcha", "token": "..."}
  4. Server saves cookies to DB, caches captcha tokens in memory
  5. Pipeline runner requests captcha: GET /sessions/{user_id}/captcha
"""
import asyncio
import json
import logging
import uuid
from datetime import datetime, timezone
from typing import Dict

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends

from app.database import AsyncSessionLocal
from app.auth.utils import decode_token
from app.auth.models import User
from app.auth.router import get_current_user
from app.crypto import enc

log = logging.getLogger("veo3.sessions")
router = APIRouter(tags=["sessions"])

# In-memory: user_id -> latest captcha token + expiry
_captcha_cache: Dict[str, dict] = {}
# In-memory: user_id -> WebSocket (for sending requests to extension)
_ws_connections: Dict[str, WebSocket] = {}
# Per-user lock: chỉ giải 1 captcha tại 1 thời điểm (auto-render bắn nhiều scene cùng lúc
# sẽ dồn captcha vào 1 extension -> timeout + 403; lock này xếp hàng cho giải tuần tự).
_captcha_locks: Dict[str, asyncio.Lock] = {}
_extension_caps: Dict[str, set[str]] = {}
_ws_send_locks: Dict[str, asyncio.Lock] = {}
_api_waiters: Dict[str, tuple[str, asyncio.Future]] = {}
_api_last_submit: Dict[str, float] = {}


async def _send_ws(user_id: str, ws: WebSocket, payload: dict) -> None:
    """Do not overlap Starlette WebSocket writes from worker/keepalive tasks."""
    lock = _ws_send_locks.setdefault(user_id, asyncio.Lock())
    async with lock:
        await ws.send_json(payload)


@router.websocket("/ws/extension")
async def extension_ws(websocket: WebSocket, token: str = ""):
    """Chrome Extension connects here to push cookies + captcha tokens."""
    payload = decode_token(token, audiences=("ext",))
    if not payload:
        await websocket.close(code=4001, reason="Invalid token")
        return

    user_id = payload.get("sub")
    await websocket.accept()
    _ws_connections[user_id] = websocket
    log.info("Extension connected for user %s", user_id)

    try:
        async with AsyncSessionLocal() as db:
            user = await db.get(User, user_id)
            if not user or not user.is_active or user.is_banned:
                await websocket.close(code=4002, reason="User not allowed")
                return

            # Tell extension it's connected
            await _send_ws(user_id, websocket, {"type": "connected", "user_id": user_id})

            while True:
                try:
                    data = await asyncio.wait_for(websocket.receive_text(), timeout=60)
                    msg = json.loads(data)
                    msg_type = msg.get("type")

                    if msg_type == "hello":
                        _extension_caps[user_id] = {
                            str(x) for x in (msg.get("capabilities") or []) if isinstance(x, str)
                        }
                        log.info("Extension bridge %s capabilities=%s for user %s",
                                 msg.get("bridge_version") or "legacy",
                                 sorted(_extension_caps[user_id]), user_id)

                    elif msg_type == "cookies":
                        # Extension sent Google cookies — store encrypted at rest
                        raw_cookies = msg.get("cookies", "")
                        user.google_cookies = enc(raw_cookies)
                        user.google_project_id = msg.get("project_id", "")
                        user.google_connected = bool(raw_cookies)
                        _extension_caps[user_id] = {
                            str(x) for x in (msg.get("capabilities") or []) if isinstance(x, str)
                        }
                        await db.commit()
                        await _send_ws(user_id, websocket, {"type": "ok", "action": "cookies_saved"})
                        log.info("Cookies saved for user %s, project=%s", user_id, user.google_project_id)

                    elif msg_type == "captcha":
                        # Extension sent a captcha token
                        _captcha_cache[user_id] = {
                            "token": msg.get("token", ""),
                            "at": datetime.now(timezone.utc).isoformat(),
                        }
                        log.debug("Captcha token received for user %s", user_id)

                    elif msg_type == "api_response":
                        request_id = str(msg.get("request_id") or "")
                        pending = _api_waiters.pop(request_id, None)
                        if pending and pending[0] == user_id:
                            future = pending[1]
                            if not future.done():
                                status = int(msg.get("status") or 0)
                                data = msg.get("data")
                                if not isinstance(data, dict):
                                    data = {"_raw": str(data or "")[:2000]}
                                future.set_result((status, data))

                    elif msg_type == "ping":
                        await _send_ws(user_id, websocket, {"type": "pong"})

                except asyncio.TimeoutError:
                    # Send keepalive ping
                    await _send_ws(user_id, websocket, {"type": "ping"})

    except WebSocketDisconnect:
        log.info("Extension disconnected for user %s", user_id)
    except Exception as e:
        log.exception("WS error for user %s: %s", user_id, e)
    finally:
        # A fast extension reload may connect the new socket before the old socket's
        # finally runs. The old connection must not erase the new live connection.
        if _ws_connections.get(user_id) is websocket:
            _ws_connections.pop(user_id, None)
            _extension_caps.pop(user_id, None)
            _ws_send_locks.pop(user_id, None)
            _api_last_submit.pop(user_id, None)
            for request_id, (owner_id, future) in list(_api_waiters.items()):
                if owner_id == user_id:
                    _api_waiters.pop(request_id, None)
                    if not future.done():
                        future.set_result(None)


async def _solve_via_local_ws(user_id: str, action: str = "VIDEO_GENERATION") -> str | None:
    """Solve captcha using the extension WS held by THIS process. Returns None if not held
    here (so other processes can answer via the Redis bridge)."""
    ws = _ws_connections.get(user_id)
    if not ws:
        return None
    _captcha_cache.pop(user_id, None)  # force a fresh, single-use token
    try:
        await _send_ws(user_id, ws, {"type": "get_captcha", "action": action})
        for _ in range(60):  # up to ~30s (extension có thể phải mở tab Flow + chờ grecaptcha)
            await asyncio.sleep(0.5)
            cached = _captcha_cache.get(user_id)
            if cached:
                return cached.get("token")
    except Exception:
        pass
    return None


async def request_captcha(user_id: str, action: str = "VIDEO_GENERATION") -> str | None:
    """Fresh captcha token for a user. Local WS first; if it lives on another process,
    route over Redis (no-op fallback when Redis isn't configured → single-process only).
    Xếp hàng theo user: 1 captcha tại 1 thời điểm (tránh dồn nhiều scene → timeout/403)."""
    lock = _captcha_locks.setdefault(user_id, asyncio.Lock())
    async with lock:
        if user_id in _ws_connections:
            return await _solve_via_local_ws(user_id, action)
        from app import captcha_bus
        return await captcha_bus.request_remote(user_id, action)


def has_flow_api_proxy(user_id: str) -> bool:
    return user_id in _ws_connections and "flow_api_proxy" in _extension_caps.get(user_id, set())


async def request_flow_api(user_id: str, url: str, body: dict, bearer: str,
                           captcha_action: str | None = None) -> tuple[int, dict] | None:
    """Run a Flow API request in Chrome, optionally minting captcha just before fetch."""
    if not has_flow_api_proxy(user_id):
        return None
    ws = _ws_connections.get(user_id)
    if not ws:
        return None

    async def _request() -> tuple[int, dict] | None:
        request_id = str(uuid.uuid4())
        future = asyncio.get_running_loop().create_future()
        _api_waiters[request_id] = (user_id, future)
        try:
            await _send_ws(user_id, ws, {
                "type": "api_request",
                "request_id": request_id,
                "url": url,
                "body": body,
                "bearer": bearer,
                "captcha_action": captcha_action or "",
            })
            result = await asyncio.wait_for(future, timeout=90)
            return result if isinstance(result, tuple) else None
        except Exception as exc:
            log.warning("Flow API proxy failed for user %s: %s", user_id, exc)
            return None
        finally:
            _api_waiters.pop(request_id, None)

    if captcha_action:
        lock = _captcha_locks.setdefault(user_id, asyncio.Lock())
        async with lock:
            # Human-paced submit spacing. A batch of scenes must not look like a
            # burst even though their long render polls may run concurrently.
            elapsed = asyncio.get_running_loop().time() - _api_last_submit.get(user_id, 0.0)
            if elapsed < 1.5:
                await asyncio.sleep(1.5 - elapsed)
            result = await _request()
            _api_last_submit[user_id] = asyncio.get_running_loop().time()
            return result
    return await _request()


async def start_captcha_bus():
    """Start the cross-process captcha bridge (called from the app lifespan)."""
    from app import captcha_bus
    await captcha_bus.start(_solve_via_local_ws)


def get_extension_status(user_id: str) -> dict:
    return {
        "connected": has_flow_api_proxy(user_id),
        "socket_connected": user_id in _ws_connections,
        "has_captcha_cache": user_id in _captcha_cache,
        "flow_api_proxy": has_flow_api_proxy(user_id),
    }


@router.get("/sessions/status")
async def session_status(user: User = Depends(get_current_user)):
    """Extension status for the AUTHENTICATED user only (no arbitrary user_id)."""
    return get_extension_status(user.id)
