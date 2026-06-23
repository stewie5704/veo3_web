"""Integration: auth + ban enforcement (ASGI client)."""


async def test_register_login_flow(client):
    email = "areg@t.com"
    r = await client.post("/api/v1/auth/register",
                          json={"email": email, "username": "areg", "password": "Passw0rd!"})
    assert r.status_code == 200 and r.json()["access_token"]

    # duplicate email rejected
    r2 = await client.post("/api/v1/auth/register",
                           json={"email": email, "username": "areg2", "password": "Passw0rd!"})
    assert r2.status_code == 400

    # login ok / wrong password rejected
    assert (await client.post("/api/v1/auth/login",
            json={"email": email, "password": "Passw0rd!"})).status_code == 200
    assert (await client.post("/api/v1/auth/login",
            json={"email": email, "password": "wrong"})).status_code == 401


async def test_me_requires_token(client, make_user):
    u = await make_user()
    ok = await client.get("/api/v1/auth/me", headers=u["headers"])
    assert ok.status_code == 200 and ok.json()["email"] == u["email"]
    assert (await client.get("/api/v1/auth/me")).status_code in (401, 403)


async def test_banned_user_is_blocked(client, make_user):
    u = await make_user()
    from app.database import AsyncSessionLocal
    from app.auth.models import User
    from sqlalchemy import select
    async with AsyncSessionLocal() as db:
        usr = (await db.execute(select(User).where(User.email == u["email"]))).scalar_one()
        usr.is_banned = True
        await db.commit()
    r = await client.get("/api/v1/auth/me", headers=u["headers"])
    assert r.status_code == 403
