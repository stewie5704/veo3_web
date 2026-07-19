"""Unit: pure helpers in the Flow pipeline runner (no network)."""
import time

import pytest

from app.pipeline import runner as r
from app.sessions import router as sessions


def test_apply_duration_only_affects_abra():
    assert r._apply_duration("abra_t2v_8s", 10) == "abra_t2v_10s"
    assert r._apply_duration("abra_t2v_8s", 6) == "abra_t2v_6s"
    # veo keys have fixed length → unchanged
    assert r._apply_duration("veo_3_1_t2v_lite_low_priority", 10) == "veo_3_1_t2v_lite_low_priority"


def test_resolve_variant_swaps_mode():
    assert r._resolve_variant("veo_3_1_t2v_lite_low_priority", "i2v") == "veo_3_1_i2v_lite_low_priority"
    assert r._resolve_variant("veo_3_1_t2v_lite_low_priority", "r2v") == "veo_3_1_r2v_lite_low_priority"
    # already the right mode → unchanged
    assert r._resolve_variant("veo_3_1_i2v_lite_low_priority", "i2v") == "veo_3_1_i2v_lite_low_priority"


def test_media_id_from_generate():
    assert r._media_id_from_generate({"media": [{"name": "abc"}]}) == "abc"
    assert r._media_id_from_generate({"workflows": [{"metadata": {"primaryMediaId": "wf1"}}]}) == "wf1"
    assert r._media_id_from_generate({}) is None


def test_build_generate_body_text():
    body = r._build_generate_body("proj1", "a cat surfing", "VIDEO_ASPECT_RATIO_LANDSCAPE",
                                  "veo_3_1_t2v_lite_low_priority", "captcha-tok", 123, None, None)
    assert body["clientContext"]["recaptchaContext"]["token"] == "captcha-tok"
    assert body["clientContext"]["projectId"] == "proj1"
    req = body["requests"][0]
    assert req["videoModelKey"] == "veo_3_1_t2v_lite_low_priority"
    assert req["textInput"]["structuredPrompt"]["parts"][0]["text"] == "a cat surfing"
    assert "startImage" not in req and "referenceImages" not in req
    assert body["mediaGenerationContext"]["audioFailurePreference"] == "RETURN_SILENCED_VIDEOS"


def test_build_generate_body_native_audio_must_not_fallback_to_silent():
    body = r._build_generate_body(
        "proj1", "off-screen narrator reads a line", "VIDEO_ASPECT_RATIO_LANDSCAPE",
        "veo_3_1_t2v_lite_low_priority", "captcha-tok", 123, None, None,
        silent=False,
    )
    assert "audioFailurePreference" not in body["mediaGenerationContext"]


def test_build_generate_body_with_start_and_refs():
    body = r._build_generate_body("p", "x", "VIDEO_ASPECT_RATIO_PORTRAIT", "k", "c", 1,
                                  "start-mid", ["r1", "r2"])
    req = body["requests"][0]
    assert req["startImage"] == {"mediaId": "start-mid"}
    assert [x["mediaId"] for x in req["referenceImages"]] == ["r1", "r2"]


def test_flow_voiceover_keeps_exact_narration_and_is_not_lip_sync():
    prompt = (
        "A still lotus lake. Audio: soft water ambience. No spoken dialogue, no voices, "
        "no narration, no singing. Negative prompt: no text; no dialogue, voiceover, "
        "narration, singing, laughter or studio-audience sounds."
    )
    out = r._to_voiceover(
        prompt,
        "Giọng đọc: Như mặt hồ sau khi thôi tìm kiếm sự yên lặng… tự nó trở nên yên.",
        "Kore",
    )

    assert "Giọng đọc:" not in out
    assert "Như mặt hồ sau khi thôi tìm kiếm sự yên lặng… tự nó trở nên yên." in out
    assert "off-screen narrator" in out
    assert "firm adult female voice" in out
    assert "mouths closed" in out and "no lip-sync" in out
    assert "No spoken dialogue" not in out
    assert "no dialogue, voiceover, narration" not in out


@pytest.mark.asyncio
async def test_api_post_generation_uses_chrome_proxy(monkeypatch):
    called = {}

    async def fake_proxy(user_id, url, body, bearer, captcha_action):
        called.update(user_id=user_id, url=url, body=body, bearer=bearer,
                      captcha_action=captcha_action)
        return 200, {"media": [{"name": "ok"}]}

    monkeypatch.setattr("app.sessions.router.request_flow_api", fake_proxy)
    code, data = await r._api_post(
        "video:batchAsyncGenerateVideoText", {"requests": []}, "ya29.test",
        user_id="u1", captcha_action="VIDEO_GENERATION")

    assert code == 200 and data["media"][0]["name"] == "ok"
    assert called["user_id"] == "u1"
    assert called["url"].startswith("https://aisandbox-pa.googleapis.com/v1/video:")
    assert called["captcha_action"] == "VIDEO_GENERATION"


@pytest.mark.asyncio
async def test_api_post_does_not_fallback_to_vps_when_proxy_drops(monkeypatch):
    async def no_proxy(*_args, **_kwargs):
        return None

    monkeypatch.setattr("app.sessions.router.request_flow_api", no_proxy)
    code, data = await r._api_post(
        "video:batchAsyncGenerateVideoText", {}, "ya29.test",
        user_id="u1", captcha_action="VIDEO_GENERATION")

    assert code == 0
    assert "Bridge v1.4" in data["error"]


def test_flow_proxy_preflight_keeps_active_recaptcha_cooldown(monkeypatch):
    user_id = 'cooldown-user'
    monkeypatch.setitem(sessions._ws_connections, user_id, object())
    monkeypatch.setitem(sessions._extension_caps, user_id, {'flow_api_proxy_v4'})
    monkeypatch.setitem(sessions._api_blocked, user_id, 'cooldown')
    monkeypatch.setitem(sessions._api_blocked_until, user_id, time.monotonic() + 60)

    assert sessions.flow_api_proxy_error(user_id) == 'cooldown'


def test_flow_proxy_preflight_clears_expired_recaptcha_cooldown(monkeypatch):
    user_id = 'expired-user'
    monkeypatch.setitem(sessions._ws_connections, user_id, object())
    monkeypatch.setitem(sessions._extension_caps, user_id, {'flow_api_proxy_v4'})
    monkeypatch.setitem(sessions._api_blocked, user_id, 'cooldown')
    monkeypatch.setitem(sessions._api_blocked_until, user_id, time.monotonic() - 1)

    assert sessions.flow_api_proxy_error(user_id) is None
    assert user_id not in sessions._api_blocked


def test_character_speak_remains_on_screen_lip_sync():
    out = r._to_character_speak(
        "A woman looks at camera. No spoken dialogue, no voices, no narration, no singing.",
        "Lan: Xin chào mọi người.",
        "Aoede",
    )
    assert "off-screen narrator" not in out
    assert "faces the camera" in out
    assert "Accurate natural lip-sync" in out
    assert "Xin chào mọi người." in out
