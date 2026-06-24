"""
Tools router: Image generation, TTS, Auto-prompt, Copy Idea.
"""
import asyncio
import json
import logging
import uuid
from pathlib import Path

import httpx
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.database import get_db, AsyncSessionLocal
from app.auth.router import get_current_user
from app.auth.models import User
from app.config import UPLOAD_PATH
from app.crypto import dec
from app import subscription

log = logging.getLogger("veo3.tools")
router = APIRouter(prefix="/tools", tags=["tools"])

IMG_PATH = UPLOAD_PATH.parent / "images"
IMG_PATH.mkdir(parents=True, exist_ok=True)
AUDIO_PATH = UPLOAD_PATH.parent / "audio"
AUDIO_PATH.mkdir(parents=True, exist_ok=True)


# ── Auto-prompt (LLM) ─────────────────────────────────────────────────────────

class AutoPromptRequest(BaseModel):
    idea: str
    scene_count: int = 6
    style: str | None = None
    language: str = "vi"
    aspect_ratio: str = "9:16"


class SceneScript(BaseModel):
    beat: str = ""          # vai trò cảnh: Hook / Nỗi đau / Giải pháp / Twist & CTA...
    image: str = ""         # Mô tả hình ảnh
    action: str = ""        # Hành động
    speaker: str = ""       # ai nói
    dialogue: str = ""      # lời thoại
    prompt: str = ""        # prompt tiếng Anh cho Veo


class AutoPromptResponse(BaseModel):
    prompts: list[str]
    narrations: list[str]
    scenes: list[SceneScript] = []


def _scenes_from_gemini(api_key: str, prompt: str) -> AutoPromptResponse:
    """Gọi Gemini -> parse JSON {scenes:[...]} -> AutoPromptResponse. Dùng chung cho autoprompt + parse-script."""
    import google.generativeai as genai
    genai.configure(api_key=api_key)
    model = genai.GenerativeModel("gemini-2.0-flash")
    resp = model.generate_content(prompt)
    text = resp.text.strip()
    if text.startswith("```"):
        text = text.split("```")[1]
        if text.startswith("json"):
            text = text[4:]
    data = json.loads(text)
    raw = data.get("scenes") or []
    scenes: list[SceneScript] = []
    for s in raw:
        if not isinstance(s, dict):
            continue
        scenes.append(SceneScript(
            beat=str(s.get("beat", "") or ""),
            image=str(s.get("image", "") or ""),
            action=str(s.get("action", "") or ""),
            speaker=str(s.get("speaker", "") or ""),
            dialogue=str(s.get("dialogue", "") or ""),
            prompt=str(s.get("prompt", "") or s.get("image", "") or ""),
        ))
    # Fallback: format phẳng cũ
    if not scenes and (data.get("prompts") or data.get("narrations")):
        ps = data.get("prompts", []) or []
        ns = data.get("narrations", []) or []
        for i, p in enumerate(ps):
            scenes.append(SceneScript(prompt=str(p), dialogue=str(ns[i]) if i < len(ns) else ""))
    prompts = [s.prompt for s in scenes]
    narrations = [((s.speaker + ": ") if s.speaker.strip() else "") + s.dialogue for s in scenes]
    return AutoPromptResponse(prompts=prompts, narrations=narrations, scenes=scenes)


@router.post("/autoprompt", response_model=AutoPromptResponse)
async def autoprompt(
    body: AutoPromptRequest,
    user: User = Depends(get_current_user),
):
    if not user.gemini_api_key:
        raise HTTPException(400, "Cần Gemini API key để dùng Auto-prompt")

    lang_label = "tiếng Việt" if body.language == "vi" else "English"
    style_note = f"Phong cách hình ảnh: {body.style}. " if body.style else ""

    system = f"""Bạn là biên kịch video ngắn chuyên nghiệp (kiểu TikTok / Reels / YouTube Shorts).
Viết KỊCH BẢN CHI TIẾT gồm ĐÚNG {body.scene_count} cảnh cho video tỉ lệ {body.aspect_ratio}, camera cố định, mỗi cảnh vài giây.
Chủ đề / ý tưởng: {body.idea}
{style_note}
Với MỖI cảnh, trả về object JSON gồm:
- "beat": nhãn ngắn vai trò cảnh ({lang_label}) — ví dụ "Hook", "Nỗi đau", "Giải pháp", "Cao trào", "Twist & CTA".
- "image": mô tả hình ảnh chi tiết ({lang_label}) — bối cảnh, nhân vật, trang phục, ánh sáng, cảm xúc.
- "action": mô tả hành động / diễn biến trong cảnh ({lang_label}).
- "speaker": ai nói ({lang_label}, ví dụ "Mẹ", "Con", "Người dẫn") hoặc "" nếu không có thoại.
- "dialogue": câu thoại ({lang_label}).
- "prompt": prompt ĐIỆN ẢNH bằng TIẾNG ANH cho model video AI (Veo) mô tả hình ảnh + hành động của cảnh (camera, bối cảnh, nhân vật, ánh sáng, tâm trạng). LUÔN viết bằng tiếng Anh.
Giữ nhân vật NHẤT QUÁN xuyên suốt (cùng ngoại hình, trang phục, tên gọi).
CHỈ trả về JSON hợp lệ: {{"scenes":[{{...}}, ...]}} — không kèm markdown."""

    try:
        return _scenes_from_gemini(dec(user.gemini_api_key), system)
    except Exception as e:
        log.exception("autoprompt error: %s", e)
        raise HTTPException(500, f"Lỗi tạo prompt: {e}")


class ParseScriptRequest(BaseModel):
    script: str
    scene_count: int = 0     # 0 = AI tự suy số cảnh từ kịch bản
    language: str = "vi"
    aspect_ratio: str = "9:16"


@router.post("/parse-script", response_model=AutoPromptResponse)
async def parse_script(
    body: ParseScriptRequest,
    user: User = Depends(get_current_user),
):
    """Người dùng tự dán kịch bản -> AI cấu trúc thành cảnh, GIỮ NGUYÊN lời thoại + tên nhân vật, sinh prompt tiếng Anh cho Veo."""
    if not user.gemini_api_key:
        raise HTTPException(400, "Cần Gemini API key để phân tích kịch bản")
    if not body.script.strip():
        raise HTTPException(400, "Nhập kịch bản trước")

    lang_label = "tiếng Việt" if body.language == "vi" else "English"
    count_note = (f"Chia thành ĐÚNG {body.scene_count} cảnh."
                  if body.scene_count and body.scene_count > 0
                  else "Tự xác định số cảnh theo kịch bản (mỗi 'Scene' / 'Cảnh' = 1 cảnh).")

    system = f"""Đây là KỊCH BẢN do người dùng tự viết cho video tỉ lệ {body.aspect_ratio}, camera cố định.
Hãy chuyển kịch bản thành các cảnh có cấu trúc. {count_note}
GIỮ NGUYÊN lời thoại và TÊN NHÂN VẬT của người dùng — KHÔNG bịa thêm, KHÔNG đổi tên, KHÔNG sửa lời thoại.
Với MỖI cảnh trả về object JSON:
- "beat": nhãn ngắn vai trò cảnh ({lang_label}).
- "image": mô tả hình ảnh ({lang_label}) lấy từ kịch bản.
- "action": hành động / diễn biến ({lang_label}).
- "speaker": tên nhân vật nói (ĐÚNG như trong kịch bản) hoặc "".
- "dialogue": lời thoại ĐÚNG NGUYÊN VĂN của người dùng.
- "prompt": prompt ĐIỆN ẢNH bằng TIẾNG ANH cho model video AI (Veo) diễn tả hình ảnh + hành động của cảnh.
CHỈ trả về JSON hợp lệ: {{"scenes":[{{...}}, ...]}} — không kèm markdown.

KỊCH BẢN:
\"\"\"
{body.script}
\"\"\""""

    try:
        return _scenes_from_gemini(dec(user.gemini_api_key), system)
    except Exception as e:
        log.exception("parse-script error: %s", e)
        raise HTTPException(500, f"Lỗi phân tích kịch bản: {e}")


# ── TTS ───────────────────────────────────────────────────────────────────────

class TTSRequest(BaseModel):
    text: str
    voice: str = "Kore"


class TTSResponse(BaseModel):
    audio_url: str
    filename: str


@router.post("/tts", response_model=TTSResponse)
async def tts(
    body: TTSRequest,
    user: User = Depends(get_current_user),
):
    if not user.gemini_api_key:
        raise HTTPException(400, "Cần Gemini API key để dùng TTS")
    try:
        import google.generativeai as genai
        genai.configure(api_key=dec(user.gemini_api_key))
        model = genai.GenerativeModel("gemini-2.5-flash-preview-tts")
        resp = model.generate_content(
            body.text,
            generation_config={"response_modalities": ["AUDIO"],
                               "speech_config": {"voice_config": {"prebuilt_voice_config": {"voice_name": body.voice}}}},
        )
        audio_data = resp.candidates[0].content.parts[0].inline_data.data
        fname = f"{uuid.uuid4().hex[:12]}.wav"
        fpath = AUDIO_PATH / fname
        import base64
        fpath.write_bytes(base64.b64decode(audio_data))
        return TTSResponse(audio_url=f"/audio/{fname}", filename=fname)
    except Exception as e:
        log.exception("TTS error: %s", e)
        raise HTTPException(500, f"Lỗi TTS: {e}")


# ── Image generation ──────────────────────────────────────────────────────────

class ImageGenRequest(BaseModel):
    prompt: str
    count: int = 1
    aspect_ratio: str = "1:1"
    char_ids: list[str] = []   # nhân vật "Giữ mặt" được chọn (id)


class ImageGenResponse(BaseModel):
    image_urls: list[str]


async def _resolve_char_ref_paths(prompt: str, char_ids: list[str], user_id: str) -> list[str]:
    """Gom ảnh tham chiếu giữ mặt: theo char_ids đã chọn + theo @Tên gõ trong prompt."""
    import re
    from app.characters.models import Character
    from app.pipeline.runner import CHAR_PATH
    from sqlalchemy import select

    mention_names = set(re.findall(r"@(\w+)", prompt or ""))
    ids = set(char_ids or [])
    paths: list[str] = []
    async with AsyncSessionLocal() as db:
        res = await db.execute(select(Character).where(Character.user_id == user_id))
        for c in res.scalars().all():
            if c.id in ids or c.name in mention_names:
                p = CHAR_PATH / c.image_file
                if p.exists():
                    paths.append(str(p))
    return paths


@router.post("/image", response_model=ImageGenResponse)
async def gen_image(
    body: ImageGenRequest,
    user: User = Depends(get_current_user),
):
    if not user.google_connected:
        raise HTTPException(400, "Cần kết nối Google Ultra để tạo ảnh")
    subscription.ensure_can_generate(user)

    from app.pipeline.runner import generate_images_flow
    cookies = dec(user.google_cookies) or ""
    ref_paths = await _resolve_char_ref_paths(body.prompt, body.char_ids, user.id)  # giữ mặt
    log.info("gen_image: char_ids=%s -> %d ref path(s): %s", body.char_ids, len(ref_paths), ref_paths)
    try:
        files = await generate_images_flow(
            user_id=user.id, cookies=cookies, project_id=user.google_project_id or "",
            prompt=body.prompt, count=min(body.count, 4), aspect_ratio=body.aspect_ratio,
            out_dir=IMG_PATH, out_prefix=uuid.uuid4().hex[:12],
            reference_image_paths=ref_paths or None,
        )
    except Exception as e:
        log.exception("Image gen error: %s", e)
        raise HTTPException(500, str(e))
    return ImageGenResponse(image_urls=[f"/images/{f}" for f in files])


# ── Copy Idea (analyze video URL) ─────────────────────────────────────────────

class CopyIdeaRequest(BaseModel):
    url: str
    style: str | None = None
    scene_count: int = 6


class CopyIdeaResponse(BaseModel):
    title: str
    prompts: list[str]
    narrations: list[str]


@router.post("/copy-idea", response_model=CopyIdeaResponse)
async def copy_idea(
    body: CopyIdeaRequest,
    user: User = Depends(get_current_user),
):
    if not user.gemini_api_key:
        raise HTTPException(400, "Cần Gemini API key để dùng Copy Idea")

    # Download video info via yt-dlp
    try:
        import subprocess, json as _json
        result = subprocess.run(
            ["yt-dlp", "--dump-json", "--no-playlist", body.url],
            capture_output=True, text=True, timeout=30
        )
        if result.returncode != 0:
            raise HTTPException(400, f"Không tải được info video: {result.stderr[:200]}")
        info = _json.loads(result.stdout)
        title = info.get("title", "Unknown")
        description = info.get("description", "")[:1000]
        tags = ", ".join(info.get("tags", [])[:20])
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(400, f"Lỗi yt-dlp: {e}")

    style_note = f"Visual style: {body.style}. " if body.style else ""
    system = f"""Analyze this video and create {body.scene_count} scene prompts to recreate a similar video.
{style_note}
Video title: {title}
Description: {description}
Tags: {tags}

Return JSON with:
- "title": short project name
- "prompts": list of {body.scene_count} English video prompts for Veo AI
- "narrations": list of {body.scene_count} Vietnamese narrations

Return ONLY valid JSON."""

    try:
        import google.generativeai as genai
        genai.configure(api_key=dec(user.gemini_api_key))
        model = genai.GenerativeModel("gemini-2.0-flash")
        resp = model.generate_content(system)
        text = resp.text.strip()
        if text.startswith("```"):
            text = text.split("```")[1]
            if text.startswith("json"):
                text = text[4:]
        data = _json.loads(text)
        return CopyIdeaResponse(
            title=data.get("title", title),
            prompts=data.get("prompts", []),
            narrations=data.get("narrations", []),
        )
    except Exception as e:
        raise HTTPException(500, f"Lỗi phân tích: {e}")
