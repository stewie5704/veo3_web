"""Integration: nhân vật theo từng project (lai kho chung + riêng project).

Phủ: thêm vào kho chung, clone vào project khi tạo, list theo phạm vi,
copy từ kho qua API, và dọn clone khi xoá project (không đụng kho chung).
"""
from app.characters.router import CHAR_PATH


async def _add_global_char(client, headers, name="hero"):
    r = await client.post(
        "/api/v1/characters/",
        data={"name": name},
        files={"image": (f"{name}.jpg", b"\xff\xd8\xff\xe0fakejpegbytes", "image/jpeg")},
        headers=headers,
    )
    assert r.status_code == 200, r.text
    return r.json()


async def test_add_char_goes_to_kho_chung(client, make_user):
    u = await make_user(google=True, plan="pro")
    c = await _add_global_char(client, u["headers"], "hero")
    assert c["name"] == "hero"
    assert c["project_id"] is None                     # kho chung
    r = await client.get("/api/v1/characters/", headers=u["headers"])
    assert any(x["id"] == c["id"] for x in r.json())


async def test_create_project_clones_char(client, make_user, monkeypatch):
    monkeypatch.setattr("app.projects.router.run_scene_job", lambda *a, **k: None)
    u = await make_user(google=True, plan="pro")
    g = await _add_global_char(client, u["headers"], "hero")

    r = await client.post("/api/v1/projects/", json={
        "name": "p1", "prompts": ["@hero walks"], "character_names": ["hero"],
        "character_ids": [g["id"]], "auto_render": False,
    }, headers=u["headers"])
    assert r.status_code == 200, r.text
    proj = r.json()

    # project có đúng 1 nhân vật riêng, cùng tên, KHÁC id bản gốc (là clone)
    assert len(proj["characters"]) == 1
    clone = proj["characters"][0]
    assert clone["name"] == "hero" and clone["id"] != g["id"]

    # list theo project_id -> chỉ clone
    pr = await client.get(f"/api/v1/characters/?project_id={proj['id']}", headers=u["headers"])
    assert [x["id"] for x in pr.json()] == [clone["id"]]

    # kho chung -> còn bản gốc, KHÔNG có clone
    kids = [x["id"] for x in (await client.get("/api/v1/characters/", headers=u["headers"])).json()]
    assert g["id"] in kids and clone["id"] not in kids

    # file ảnh tách riêng, cả 2 tồn tại; clone.project_id đúng
    from app.database import AsyncSessionLocal
    from app.characters.models import Character
    async with AsyncSessionLocal() as db:
        gc = await db.get(Character, g["id"])
        cc = await db.get(Character, clone["id"])
        assert gc.image_file != cc.image_file
        assert (CHAR_PATH / gc.image_file).exists()
        assert (CHAR_PATH / cc.image_file).exists()
        assert cc.project_id == proj["id"]


async def test_delete_project_removes_clone_keeps_kho(client, make_user, monkeypatch):
    monkeypatch.setattr("app.projects.router.run_scene_job", lambda *a, **k: None)
    u = await make_user(google=True, plan="pro")
    g = await _add_global_char(client, u["headers"], "villain")
    proj = (await client.post("/api/v1/projects/", json={
        "name": "p2", "prompts": ["@villain"], "character_ids": [g["id"]], "auto_render": False,
    }, headers=u["headers"])).json()
    clone_id = proj["characters"][0]["id"]

    from app.database import AsyncSessionLocal
    from app.characters.models import Character
    async with AsyncSessionLocal() as db:
        clone_file = (await db.get(Character, clone_id)).image_file

    d = await client.delete(f"/api/v1/projects/{proj['id']}", headers=u["headers"])
    assert d.status_code == 200

    async with AsyncSessionLocal() as db:
        assert await db.get(Character, clone_id) is None        # clone bị xoá
        assert await db.get(Character, g["id"]) is not None      # bản gốc còn
    assert not (CHAR_PATH / clone_file).exists()                 # file clone bị dọn


async def test_copy_from_kho_into_project(client, make_user, monkeypatch):
    monkeypatch.setattr("app.projects.router.run_scene_job", lambda *a, **k: None)
    u = await make_user(google=True, plan="pro")
    g = await _add_global_char(client, u["headers"], "boss")

    proj = (await client.post("/api/v1/projects/", json={"name": "p3", "auto_render": False},
                              headers=u["headers"])).json()
    assert proj["characters"] == []

    r = await client.post("/api/v1/characters/",
                          data={"name": "boss", "copy_from": g["id"], "project_id": proj["id"]},
                          headers=u["headers"])
    assert r.status_code == 200, r.text
    assert r.json()["project_id"] == proj["id"] and r.json()["id"] != g["id"]

    detail = await client.get(f"/api/v1/projects/{proj['id']}", headers=u["headers"])
    assert len(detail.json()["characters"]) == 1
