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
from datetime import datetime, timezone
from typing import Dict

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_db, AsyncSessionLocal
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


@router.websocket("/ws/extension")
async def extension_ws(websocket: WebSocket, token: str = ""):
    """Chrome Extension connects here to push cookies + captcha tokens."""
    payload = decode_token(token)
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
            await websocket.send_json({"type": "connected", "user_id": user_id})

            while True:
                try:
                    data = await asyncio.wait_for(websocket.receive_text(), timeout=60)
                    msg = json.loads(data)
                    msg_type = msg.get("type")

                    if msg_type == "cookies":
                        # Extension sent Google cookies — store encrypted at rest
                        raw_cookies = msg.get("cookies", "")
                        user.google_cookies = enc(raw_cookies)
                        user.google_project_id = msg.get("project_id", "")
                        user.google_connected = bool(raw_cookies)
                        await db.commit()
                        await websocket.send_json({"type": "ok", "action": "cookies_saved"})
                        log.info("Cookies saved for user %s, project=%s", user_id, user.google_project_id)

                    elif msg_type == "captcha":
                        # Extension sent a captcha token
                        _captcha_cache[user_id] = {
                            "token": msg.get("token", ""),
                            "at": datetime.now(timezone.utc).isoformat(),
                        }
                        log.debug("Captcha token received for user %s", user_id)

                    elif msg_type == "ping":
                        await websocket.send_json({"type": "pong"})

                except asyncio.TimeoutError:
                    # Send keepalive ping
                    await websocket.send_json({"type": "ping"})

    except WebSocketDisconnect:
        log.info("Extension disconnected for user %s", user_id)
    except Exception as e:
        log.exception("WS error for user %s: %s", user_id, e)
    finally:
        _ws_connections.pop(user_id, None)


async def _solve_via_local_ws(user_id: str, action: str = "VIDEO_GENERATION") -> str | None:
    """Solve captcha using the extension WS held by THIS process. Returns None if not held
    here (so other processes can answer via the Redis bridge)."""
    ws = _ws_connections.get(user_id)
    if not ws:
        return None
    _captcha_cache.pop(user_id, None)  # force a fresh, single-use token
    try:
        await ws.send_json({"type": "get_captcha", "action": action})
        for _ in range(20):  # up to ~10s
            await asyncio.sleep(0.5)
            cached = _captcha_cache.get(user_id)
            if cached:
                return cached.get("token")
    except Exception:
        pass
    return None


async def request_captcha(user_id: str, action: str = "VIDEO_GENERATION") -> str | None:
    """Fresh captcha token for a user. Local WS first; if it lives on another process,
    route over Redis (no-op fallback when Redis isn't configured → single-process only)."""
    if user_id in _ws_connections:
        return await _solve_via_local_ws(user_id, action)
    from app import captcha_bus
    return await captcha_bus.request_remote(user_id, action)


async def start_captcha_bus():
    """Start the cross-process captcha bridge (called from the app lifespan)."""
    from app import captcha_bus
    await captcha_bus.start(_solve_via_local_ws)


def get_extension_status(user_id: str) -> dict:
    return {
        "connected": user_id in _ws_connections,
        "has_captcha_cache": user_id in _captcha_cache,
    }


@router.get("/sessions/status")
async def session_status(user: User = Depends(get_current_user)):
    """Extension status for the AUTHENTICATED user only (no arbitrary user_id)."""
    return get_extension_status(user.id)
