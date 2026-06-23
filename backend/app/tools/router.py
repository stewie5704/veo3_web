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


class AutoPromptResponse(BaseModel):
    prompts: list[str]
    narrations: list[str]


@router.post("/autoprompt", response_model=AutoPromptResponse)
async def autoprompt(
    body: AutoPromptRequest,
    user: User = Depends(get_current_user),
):
    if not user.gemini_api_key:
        raise HTTPException(400, "Cần Gemini API key để dùng Auto-prompt")

    lang_note = "in Vietnamese" if body.language == "vi" else "in English"
    style_note = f"Visual style: {body.style}. " if body.style else ""

    system = f"""You are a professional video scriptwriter. Generate exactly {body.scene_count} scenes for a short video.
{style_note}Write all prompts {lang_note} for narrations, but ALWAYS write video prompts in English (they go to an AI video model).

Return a JSON object with two arrays:
- "prompts": list of {body.scene_count} English video prompts for Veo AI model (vivid, cinematic, descriptive)
- "narrations": list of {body.scene_count} narration texts {lang_note} (voiceover script)

Topic/Idea: {body.idea}

Return ONLY valid JSON, no markdown."""

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
        data = json.loads(text)
        return AutoPromptResponse(
            prompts=data.get("prompts", []),
            narrations=data.get("narrations", []),
        )
    except Exception as e:
        log.exception("autoprompt error: %s", e)
        raise HTTPException(500, f"Lỗi tạo prompt: {e}")


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


class ImageGenResponse(BaseModel):
    image_urls: list[str]


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
    try:
        files = await generate_images_flow(
            user_id=user.id, cookies=cookies, project_id=user.google_project_id or "",
            prompt=body.prompt, count=min(body.count, 4), aspect_ratio=body.aspect_ratio,
            out_dir=IMG_PATH, out_prefix=uuid.uuid4().hex[:12],
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
