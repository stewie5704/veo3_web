"""Integration: subscription gating + billing + admin grant."""


async def test_plans_are_public(client):
    r = await client.get("/api/v1/billing/plans")
    assert r.status_code == 200
    ids = [p["id"] for p in r.json()["plans"]]
    assert "m1" in ids and "m12" in ids


async def test_new_user_is_free_inactive(client, make_user):
    u = await make_user()
    r = await client.get("/api/v1/billing/me", headers=u["headers"])
    assert r.status_code == 200
    body = r.json()
    assert body["active"] is False and body["plan"] == "free"


async def test_video_create_blocked_without_plan(client, make_user):
    u = await make_user(google=True)   # google connected but NO active plan
    # phải hết 24h dùng thử thì mới thực sự bị chặn (user mới mặc định đang trial)
    from datetime import datetime, timezone, timedelta
    from sqlalchemy import select
    from app.database import AsyncSessionLocal
    from app.auth.models import User
    async with AsyncSessionLocal() as db:
        usr = (await db.execute(select(User).where(User.id == u["user_id"]))).scalar_one()
        usr.created_at = (datetime.now(timezone.utc) - timedelta(hours=48)).replace(tzinfo=None)
        await db.commit()
    r = await client.post("/api/v1/videos/create", json={"prompt": "a cat"}, headers=u["headers"])
    assert r.status_code == 402   # Payment Required → "Cần nâng gói"


async def test_video_create_allowed_with_plan(client, make_user, monkeypatch):
    # don't actually call Google — stub the background worker
    monkeypatch.setattr("app.videos.router.run_video_job", lambda *a, **k: None)
    u = await make_user(plan="m1", google=True)
    r = await client.post("/api/v1/videos/create", json={"prompt": "a cat"}, headers=u["headers"])
    assert r.status_code == 200, r.text
    me = await client.get("/api/v1/billing/me", headers=u["headers"])
    assert me.json()["active"] is True


async def test_checkout_creates_pending_order(client, make_user):
    u = await make_user()
    r = await client.post("/api/v1/billing/checkout", json={"plan": "m1"}, headers=u["headers"])
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["order_id"] and body["amount"] > 0 and body["currency"] == "VND"


async def test_checkout_rejects_bad_plan(client, make_user):
    u = await make_user()
    r = await client.post("/api/v1/billing/checkout", json={"plan": "nope"}, headers=u["headers"])
    assert r.status_code == 400


async def test_webhook_unknown_provider_404(client):
    r = await client.post("/api/v1/billing/webhook/vnpay", json={})
    assert r.status_code == 404   # chỉ hỗ trợ payos/binance


async def test_admin_grant_plan_activates(client, make_user):
    admin = await make_user(admin=True)
    target = await make_user()

    # non-admin is forbidden
    forbidden = await client.patch(f"/api/v1/admin/users/{target['user_id']}",
                                   json={"grant_plan": "m1"}, headers=target["headers"])
    assert forbidden.status_code == 403

    # admin grants → target becomes active
    ok = await client.patch(f"/api/v1/admin/users/{target['user_id']}",
                            json={"grant_plan": "m1"}, headers=admin["headers"])
    assert ok.status_code == 200
    me = await client.get("/api/v1/billing/me", headers=target["headers"])
    assert me.json()["active"] is True
