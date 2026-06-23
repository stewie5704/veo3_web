"""Unit: pure helpers in the Flow pipeline runner (no network)."""
from app.pipeline import runner as r


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


def test_build_generate_body_with_start_and_refs():
    body = r._build_generate_body("p", "x", "VIDEO_ASPECT_RATIO_PORTRAIT", "k", "c", 1,
                                  "start-mid", ["r1", "r2"])
    req = body["requests"][0]
    assert req["startImage"] == {"mediaId": "start-mid"}
    assert [x["mediaId"] for x in req["referenceImages"]] == ["r1", "r2"]
