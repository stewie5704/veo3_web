"""Test harness: isolated temp SQLite (NullPool so it survives per-test event loops),
fixed test secrets, an httpx client bound to the ASGI app, and a user factory.

Env MUST be set before importing any `app.*` module (config reads it at import).
"""
import asyncio
import os
import tempfile
import uuid

_TMP = tempfile.mkdtemp(prefix="veo3test_")
os.environ["DATABASE_URL"] = "sqlite+aiosqlite:///" + (_TMP + "/test.db").replace("\\", "/")
os.environ["SECRET_KEY"] = "test-secret-0123456789abcdef0123456789abcdef"
os.environ["REDIS_URL"] = "redis://127.0.0.1:6399/0"   # unreachable on purpose → bus stays no-op
os.environ["EMAIL_VERIFY_REQUIRED"] = "false"          # test hermetic: KHÔNG phụ thuộc .env của host
os.environ["RESEND_API_KEY"] = ""                      # không gửi mail thật khi test

import app.database as dbmod  # noqa: E402
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker  # noqa: E402
from sqlalchemy.pool import NullPool  # noqa: E402

# NullPool: don't reuse connections across the per-test event loops aiosqlite would choke on.
dbmod.engine = create_async_engine(os.environ["DATABASE_URL"], poolclass=NullPool)
dbmod.AsyncSessionLocal = async_sessionmaker(dbmod.engine, expire_on_commit=False)


async def _create_tables():
    await dbmod.init_db()


asyncio.run(_create_tables())

import pytest_asyncio  # noqa: E402
from httpx import AsyncClient, ASGITransport  # noqa: E402


@pytest_asyncio.fixture
async def client():
    from app.main import app
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        yield c


@pytest_asyncio.fixture
def make_user(client):
    """Register a user via the API; optionally promote to admin / grant a plan / mark
    google-connected (done directly in the DB). Returns dict with token + auth headers."""
    async def _make(*, admin=False, plan=None, google=False, password="Passw0rd!"):
        email = f"{uuid.uuid4().hex[:10]}@t.com"
        username = "u" + uuid.uuid4().hex[:8]
        r = await client.post("/api/v1/auth/register",
                              json={"email": email, "username": username, "password": password})
        assert r.status_code == 200, r.text
        token = r.json()["access_token"]
        from app.database import AsyncSessionLocal
        from app.auth.models import User
        from sqlalchemy import select
        async with AsyncSessionLocal() as db:
            u = (await db.execute(select(User).where(User.email == email))).scalar_one()
            uid = u.id
            if admin:
                u.is_admin = True
            if google:
                u.google_connected = True
                u.google_cookies = "labs_cookie=x"
                u.google_project_id = "proj-test"
            if plan:
                from app import subscription
                subscription.activate(u, plan)
            await db.commit()
        return {"email": email, "username": username, "token": token,
                "user_id": uid, "headers": {"Authorization": f"Bearer {token}"}}
    return _make
