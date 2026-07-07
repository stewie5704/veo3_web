import json
import asyncio
from typing import AsyncGenerator
from fastapi import Request
import redis.asyncio as aioredis
from app.config import settings
import logging

log = logging.getLogger(__name__)

# Singleton redis client for pub/sub
_redis = None

async def get_redis_client():
    global _redis
    if _redis is None:
        try:
            _redis = aioredis.from_url(settings.redis_url, decode_responses=True)
            # test connection
            await _redis.ping()
        except Exception as e:
            log.error(f"Failed to connect to Redis for SSE: {e}")
            _redis = False
    return _redis or None

async def publish_project_event(project_id: str, event_type: str, data: dict):
    """Publish an event to the Redis channel for a specific project."""
    r = await get_redis_client()
    if not r:
        return
    channel = f"project_events:{project_id}"
    message = json.dumps({"type": event_type, "data": data})
    try:
        await r.publish(channel, message)
    except Exception as e:
        log.warning(f"Error publishing to {channel}: {e}")

async def sse_event_generator(project_id: str, request: Request) -> AsyncGenerator[str, None]:
    """Yields SSE formatted strings from Redis PubSub."""
    r = await get_redis_client()
    if not r:
        yield f"data: {json.dumps({'type': 'error', 'data': 'Redis not available'})}\n\n"
        return

    pubsub = r.pubsub()
    channel = f"project_events:{project_id}"
    await pubsub.subscribe(channel)
    log.info(f"Subscribed to SSE channel: {channel}")
    
    try:
        while True:
            if await request.is_disconnected():
                break
                
            message = await pubsub.get_message(ignore_subscribe_messages=True, timeout=1.0)
            if message:
                try:
                    payload = json.loads(message['data'])
                    evt_type = payload.get("type", "message")
                    data_str = json.dumps(payload.get("data", {})) if isinstance(payload.get("data"), (dict, list)) else str(payload.get("data"))
                    yield f"event: {evt_type}\ndata: {data_str}\n\n"
                except Exception as e:
                    log.error(f"Error parsing SSE message: {e}")
            else:
                # Send a comment to keep connection alive
                yield ": keep-alive\n\n"
    except asyncio.CancelledError:
        pass
    except Exception as e:
        log.error(f"SSE Error on {channel}: {e}")
    finally:
        await pubsub.unsubscribe(channel)
        log.info(f"Unsubscribed from SSE channel: {channel}")
