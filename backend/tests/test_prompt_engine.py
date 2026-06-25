"""Prompt-engine assembly (server-side, no network): khối Audio + negative tail nâng cấp +
identity-negative + nhân vật dẫn đầu ('Same' + anchor). Đây là phần ĐẢM BẢO không phụ thuộc model."""
from app.tools.router import CharacterBible, SceneScript, _build_shot_prompt


def test_shot_prompt_leads_identity_has_audio_and_negatives():
    c = CharacterBible(char_key="CHAR_1", name="Minh", anchor="silver locket",
                       hair="black short", wardrobe_top="green field jacket", face="oval face")
    sc = SceneScript(prompt="Minh walks down a rainy alley toward camera.",
                     audio="rain on tin roofs; one puddle splash on his step; tense cello, low and unobtrusive")
    out = _build_shot_prompt([c], sc, "Kodak Portra 400 grade, subtle 35mm grain")

    assert out.startswith("Same ")                       # nhân vật dẫn đầu (Veo nặng token đầu)
    assert "silver locket" in out                        # anchor dẫn đầu mô tả
    assert "Audio: rain on tin roofs" in out             # audio của model được dùng
    assert "No spoken dialogue" in out                   # chặn giọng (TTS ghép riêng)
    assert "Negative prompt:" in out                     # negative tail nâng cấp
    assert "no montage, cutaways" in out                 # narrative negative (clip liên tục)
    assert "Do not change:" in out and "Minh" in out     # identity-negative per nhân vật
    assert "Kodak Portra 400" in out                     # style lock chèn


def test_shot_prompt_audio_fallback_when_model_omits_it():
    c = CharacterBible(char_key="CHAR_1", name="Lan", anchor="red scarf")
    sc = SceneScript(prompt="Lan smiles by a window.", mood="joyful")   # KHÔNG có audio
    out = _build_shot_prompt([c], sc, "")
    assert "Audio:" in out                               # vẫn có khối audio (fallback)
    assert "No spoken dialogue" in out
    assert "Negative prompt:" in out


def test_shot_prompt_no_characters_still_valid():
    sc = SceneScript(prompt="Wide drone shot over misty mountains.", audio="wind, distant birds; ambient drone")
    out = _build_shot_prompt([], sc, "teal grade")
    assert not out.startswith("Same ")                   # không nhân vật -> không 'Same'
    assert "Audio:" in out and "Negative prompt:" in out
