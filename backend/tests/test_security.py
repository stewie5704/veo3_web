import pytest
from fastapi import HTTPException

from app.auth.utils import AUD_EXT, AUD_WEB, create_access_token, decode_token
from app.security import make_share_token, safe_filename, verify_share_token


def test_safe_filename_rejects_traversal_and_directory_alias():
    for value in ("../secret", "..", ".", "a/b.mp4", "a\\b.mp4", ""):
        with pytest.raises(HTTPException):
            safe_filename(value)
    assert safe_filename("video_01-final.mp4") == "video_01-final.mp4"


def test_share_token_round_trip_and_tamper_rejection():
    token = make_share_token("video_01.mp4")
    assert verify_share_token(token) == "video_01.mp4"
    with pytest.raises(HTTPException) as exc:
        verify_share_token(token + "x")
    assert exc.value.status_code == 404


def test_jwt_audiences_are_separated():
    web = create_access_token({"sub": "u1"}, audience=AUD_WEB)
    ext = create_access_token({"sub": "u1"}, audience=AUD_EXT)

    assert decode_token(web, audiences=(AUD_WEB,))["sub"] == "u1"
    assert decode_token(ext, audiences=(AUD_EXT,))["sub"] == "u1"
    assert decode_token(web, audiences=(AUD_EXT,)) is None
    assert decode_token(ext, audiences=(AUD_WEB,)) is None


async def test_public_share_route_is_registered(client):
    response = await client.get("/shared/not-a-valid-token")
    assert response.status_code == 404


async def test_extension_token_cannot_call_web_api(client, make_user):
    user = await make_user()
    response = await client.post("/api/v1/auth/extension-token", headers=user["headers"])
    assert response.status_code == 200
    ext_headers = {"Authorization": f"Bearer {response.json()['access_token']}"}

    web_response = await client.get("/api/v1/billing/me", headers=ext_headers)
    assert web_response.status_code == 401
