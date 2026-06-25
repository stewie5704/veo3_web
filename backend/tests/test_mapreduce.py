"""Map-reduce script generation orchestration (mocked Gemini) — no network, no DB.
Kiểm tra: đúng số cảnh, bible+style đông cứng & chèn vào MỌI cảnh, chunk lỗi vẫn lấp đủ count."""
import asyncio
from app.tools import router


def test_mapreduce_keeps_count_and_injects_bible_style(monkeypatch):
    N = 50  # > MAPREDUCE_THRESHOLD

    def fake_outline(api_key, source, n, lang_label, aspect, parse_mode):
        assert n == N
        return {
            "summary": "s", "suggested_style": "cinematic",
            "style_lock": "35mm film grain, warm teal-orange grade",
            "characters": [
                {"name": "Minh", "gender_presentation": "male", "face": "oval face",
                 "distinguishing_marks": "scar above left eyebrow"},
                {"name": "Lan", "gender_presentation": "female", "face": "round face",
                 "distinguishing_marks": "mole on cheek"},
            ],
            "beats": [{"beat": f"b{i}", "chars": ["CHAR_1"], "intent": f"intent {i}"} for i in range(n)],
        }

    def fake_expand(api_key, beats_slice, start_index, style_lock, bible_blob, lang_label, aspect, parse_mode):
        # the frozen bible MUST be handed to every expand call
        assert "Minh" in bible_blob and "Lan" in bible_blob
        assert "35mm film grain" in style_lock
        return {"scenes": [
            {"beat": b["beat"], "chars": b["chars"], "action": b.get("intent", ""),
             "prompt": f"raw scene {start_index + j}", "speaker": "CHAR_1", "dialogue": "xin chào"}
            for j, b in enumerate(beats_slice)]}

    monkeypatch.setattr(router, "_mr_outline", fake_outline)
    monkeypatch.setattr(router, "_mr_expand", fake_expand)

    resp = asyncio.run(router._scenes_mapreduce("k", "idea", N, None, False, "tiếng Việt", "16:9"))

    assert len(resp.scenes) == N                       # đúng số cảnh
    assert len(resp.characters) == 2                   # bible đông cứng từ outline
    # style_lock + tên nhân vật được CHÈN VẬT LÝ vào prompt MỌI cảnh (đồng bộ không phụ thuộc model)
    assert all("35mm film grain" in s.prompt for s in resp.scenes)
    assert all("Minh" in s.prompt for s in resp.scenes)
    assert all(s.prompt.strip() for s in resp.scenes)


def test_mapreduce_fills_failed_chunk(monkeypatch):
    N = 40

    def fake_outline(api_key, source, n, lang_label, aspect, parse_mode):
        return {"style_lock": "soft grade", "suggested_style": "x",
                "characters": [{"name": "A", "gender_presentation": "male"}],
                "beats": [{"beat": f"b{i}", "chars": ["CHAR_1"], "intent": f"i{i}"} for i in range(N)]}

    def fake_expand(api_key, beats_slice, start_index, *a, **k):
        if start_index == 0:        # chunk đầu lỗi -> phải tự lấp từ beats
            raise RuntimeError("boom")
        return {"scenes": [{"beat": b["beat"], "chars": b["chars"], "prompt": f"s{start_index + j}"}
                           for j, b in enumerate(beats_slice)]}

    monkeypatch.setattr(router, "_mr_outline", fake_outline)
    monkeypatch.setattr(router, "_mr_expand", fake_expand)

    resp = asyncio.run(router._scenes_mapreduce("k", "idea", N, None, False, "tiếng Việt", "16:9"))
    assert len(resp.scenes) == N   # số cảnh được giữ nguyên dù 1 chunk lỗi


def test_small_count_still_uses_single_call_path():
    # n <= threshold không đụng map-reduce (giữ luồng cũ) — chỉ kiểm hằng số
    assert router.MAPREDUCE_THRESHOLD == router.MAX_SCENES
    assert router.MAX_SCENES_MR > router.MAPREDUCE_THRESHOLD
