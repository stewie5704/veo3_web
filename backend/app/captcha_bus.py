"""Cross-process captcha bridge over Redis pub/sub.

Problem: a user's extension WebSocket lives in ONE uvicorn process, but a generation job
may run in ANOTHER (--workers > 1 / multi-host). This routes a captcha request from any
process to the process holding that user's WS, and the token back.

Degrades gracefully: if Redis is unavailable, `request_remote` returns None — single-process
deployments keep working via the in-process path in sessions/router.py.

Protocol:
  requester -> publish REQ_CHANNEL {req_id, user_id, action}
  holder    -> (if it owns the user's WS) solve, publish RESP_CHANNEL {req_id, token}
  requester -> resolves its pending future for req_id
"""
from __future__ import annotations

import asyncio
import json
import logging
import uuid

from app.config import settings

log = logging.getLogger("veo3.captcha_bus")

REQ_CHANNEL = "veo3:captcha:req"
RESP_CHANNEL = "veo3:captcha:resp"

_redis = None            # None=not tried, False=tried&unavailable, else client
_started = False
_pending: dict[str, asyncio.Future] = {}   # req_id -> future (this process is the requester)


async def _get_redis():
    global _redis
    if _redis is None:
        try:
            import redis.asyncio as aioredis
            client = aioredis.from_url(settings.redis_url, decode_responses=True)
            await client.ping()
            _redis = client
            log.info("captcha bus: Redis connected (%s)", settings.redis_url)
        except Exception as e:  # noqa: BLE001
            log.warning("captcha bus: Redis unavailable, staying single-process (%s)", e)
            _redis = False
    return _redis or None


async def start(solve_local):
    """Begin listening. `solve_local(user_id, action) -> token|None` must return None when
    this process does NOT hold the user's WS (so other processes can answer instead)."""
    global _started
    if _started:
        return
    r = await _get_redis()
    if not r:
        return  # no Redis → in-process only; nothing to listen for
    _started = True
    asyncio.create_task(_listen_requests(r, solve_local))
    asyncio.create_task(_listen_responses(r))
    log.info("captcha bus: listeners started")


async def _listen_requests(r, solve_local):
    pubsub = r.pubsub()
    await pubsub.subscribe(REQ_CHANNEL)
    try:
        async for msg in pubsub.listen():
            if msg.get("type") != "message":
                continue
            try:
                d = json.loads(msg["data"])
            except Exception:  # noqa: BLE001
                continue
            try:
                token = await solve_local(d["user_id"], d.get("action", "VIDEO_GENERATION"))
            except Exception as e:  # noqa: BLE001
                log.warning("solve_local failed: %s", e)
                token = None
            if token:  # only the process that owns the WS answers
                await r.publish(RESP_CHANNEL, json.dumps({"req_id": d["req_id"], "token": token}))
    except Exception as e:  # noqa: BLE001
        log.warning("captcha req listener stopped: %s", e)


async def _listen_responses(r):
    pubsub = r.pubsub()
    await pubsub.subscribe(RESP_CHANNEL)
    try:
        async for msg in pubsub.listen():
            if msg.get("type") != "message":
                continue
            try:
                d = json.loads(msg["data"])
            except Exception:  # noqa: BLE001
                continue
            fut = _pending.get(d.get("req_id"))
            if fut and not fut.done():
                fut.set_result(d.get("token"))
    except Exception as e:  # noqa: BLE001
        log.warning("captcha resp listener stopped: %s", e)


async def request_remote(user_id: str, action: str, timeout: float = 18.0) -> str | None:
    """Ask other processes (via Redis) to solve captcha for a user whose WS we don't hold."""
    r = await _get_redis()
    if not r:
        return None
    req_id = uuid.uuid4().hex
    loop = asyncio.get_running_loop()
    fut = loop.create_future()
    _pending[req_id] = fut
    try:
        await r.publish(REQ_CHANNEL, json.dumps({"req_id": req_id, "user_id": user_id, "action": action}))
        return await asyncio.wait_for(fut, timeout)
    except asyncio.TimeoutError:
        return None
    except Exception as e:  # noqa: BLE001
        log.warning("request_remote failed: %s", e)
        return None
    finally:
        _pending.pop(req_id, None)
