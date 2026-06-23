"""Integration: subscription gating + billing + admin grant."""


async def test_plans_are_public(client):
    r = await client.get("/api/v1/billing/plans")
    assert r.status_code == 200
    ids = [p["id"] for p in r.json()["plans"]]
    assert "basic" in ids and "pro" in ids


async def test_new_user_is_free_inactive(client, make_user):
    u = await make_user()
    r = await client.get("/api/v1/billing/me", headers=u["headers"])
    assert r.status_code == 200
    body = r.json()
    assert body["active"] is False and body["plan"] == "free"


async def test_video_create_blocked_without_plan(client, make_user):
    u = await make_user(google=True)   # google connected but NO active plan
    r = await client.post("/api/v1/videos/create", json={"prompt": "a cat"}, headers=u["headers"])
    assert r.status_code == 402   # Payment Required → "Cần nâng gói"


async def test_video_create_allowed_with_plan(client, make_user, monkeypatch):
    # don't actually call Google — stub the background worker
    monkeypatch.setattr("app.videos.router.run_video_job", lambda *a, **k: None)
    u = await make_user(plan="pro", google=True)
    r = await client.post("/api/v1/videos/create", json={"prompt": "a cat"}, headers=u["headers"])
    assert r.status_code == 200, r.text
    me = await client.get("/api/v1/billing/me", headers=u["headers"])
    assert me.json()["active"] is True


async def test_checkout_creates_pending_order(client, make_user):
    u = await make_user()
    r = await client.post("/api/v1/billing/checkout", json={"plan": "pro"}, headers=u["headers"])
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "pending" and body["pay_url"] is None and body["amount"] > 0


async def test_checkout_rejects_bad_plan(client, make_user):
    u = await make_user()
    r = await client.post("/api/v1/billing/checkout", json={"plan": "nope"}, headers=u["headers"])
    assert r.status_code == 400


async def test_webhook_not_configured_yet(client):
    r = await client.post("/api/v1/billing/webhook/vnpay", json={})
    assert r.status_code == 501


async def test_admin_grant_plan_activates(client, make_user):
    admin = await make_user(admin=True)
    target = await make_user()

    # non-admin is forbidden
    forbidden = await client.patch(f"/api/v1/admin/users/{target['user_id']}",
                                   json={"grant_plan": "pro"}, headers=target["headers"])
    assert forbidden.status_code == 403

    # admin grants → target becomes active
    ok = await client.patch(f"/api/v1/admin/users/{target['user_id']}",
                            json={"grant_plan": "pro"}, headers=admin["headers"])
    assert ok.status_code == 200
    me = await client.get("/api/v1/billing/me", headers=target["headers"])
    assert me.json()["active"] is True
