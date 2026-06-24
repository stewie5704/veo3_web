"""Visual-style packs (ported từ desktop VEO3_STUDIO). Mỗi data/styles/*.txt là một đoạn
mô tả phong cách dày — được inject làm 'visual_style lock' vào prompt khi viết kịch bản."""
from __future__ import annotations

from functools import lru_cache
from pathlib import Path

STYLES_DIR = Path(__file__).resolve().parent.parent / "data" / "styles"

_ACRONYMS = {"2d": "2D", "3d": "3D", "cgi": "CGI", "cctv": "CCTV", "pov": "POV",
             "tts": "TTS", "ai": "AI", "hd": "HD", "8bit": "8-bit"}


def _slug_to_name(stem: str) -> str:
    """'3d-cartoon-2-2-2-2' -> '3D Cartoon', 'realistic-cgi-cgi-cgi' -> 'Realistic CGI'."""
    out: list[str] = []
    seen: set[str] = set()
    for t in stem.split("-"):
        tl = t.lower()
        if not tl or tl.isdigit() or tl in seen:
            continue
        if out and out[-1].lower().startswith(tl) and tl != out[-1].lower():
            continue
        out.append(t)
        seen.add(tl)
    words = out or stem.split("-")
    return " ".join(_ACRONYMS.get(w.lower(), w.capitalize()) for w in words)


@lru_cache(maxsize=1)
def list_styles() -> list[dict]:
    """[{id, name, description}] cho mọi style pack trên đĩa."""
    out: list[dict] = []
    if not STYLES_DIR.exists():
        return out
    for f in sorted(STYLES_DIR.glob("*.txt")):
        try:
            text = f.read_text(encoding="utf-8", errors="replace").strip()
        except OSError:
            continue
        out.append({"id": f.stem, "name": _slug_to_name(f.stem), "description": text})
    return out


def style_description(style_id: str | None) -> str:
    """Mô tả style theo id (file stem) HOẶC theo tên hiển thị; '' nếu không khớp."""
    if not style_id:
        return ""
    low = style_id.strip().lower()
    for s in list_styles():
        if s["id"].lower() == low or s["name"].lower() == low:
            return s["description"]
    return ""
