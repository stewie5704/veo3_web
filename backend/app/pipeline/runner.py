"""
Video generation pipeline runner — ported to the VERIFIED labs.google Flow protocol
(aisandbox-pa), the same one the desktop app uses end-to-end.

Per video:
  1. bearer = ya29 token minted from the user's labs.google cookies (auth/session)
  2. recaptcha token fetched on demand from the user's Chrome extension (over WebSocket)
  3. local images (start frame / @mention faces) uploaded to Flow -> media ids
  4. POST /video:batchAsyncGenerateVideo{Text|StartImage|ReferenceImages}
        with recaptcha in clientContext.recaptchaContext.token + videoModelKey
  5. poll /video:batchCheckAsyncVideoGenerationStatus until SUCCESSFUL
  6. download via media.getMediaUrlRedirect?name=<id> (COOKIE auth, not bearer)

Supports: Text2Video, I2V (start_image), Chain mode, @mention face-lock (R2V).
"""
import asyncio
import base64
import json
import logging
import random
import re
import time
import uuid
from datetime import datetime, timezone
from pathlib import Path

import httpx

from app.config import UPLOAD_PATH
from app.database import AsyncSessionLocal
from app.auth.models import User
from app.videos.models import VideoJob, JobStatus
from app.crypto import dec

log = logging.getLogger("veo3.pipeline")

API_BASE = "https://aisandbox-pa.googleapis.com/v1"
AUTH_SESSION_URL = "https://labs.google/fx/api/auth/session"
MEDIA_REDIRECT_URL = "https://labs.google/fx/api/trpc/media.getMediaUrlRedirect"
CHAR_PATH = UPLOAD_PATH.parent / "images" / "chars"

UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36")
PAYGATE_TIER = "PAYGATE_TIER_TWO"
REFERENCE_USAGE_TYPE = "IMAGE_USAGE_TYPE_ASSET"
ASPECT_MAP = {
    "16:9": "VIDEO_ASPECT_RATIO_LANDSCAPE",
    "9:16": "VIDEO_ASPECT_RATIO_PORTRAIT",
    "1:1": "VIDEO_ASPECT_RATIO_SQUARE",
}
DONE_HINTS = ("SUCCE", "COMPLETE", "DONE", "READY", "FINISH")
FAIL_HINTS = ("FAIL", "ERROR", "REJECT", "CANCEL")
POLL_INTERVAL = 10
POLL_MAX_TRIES = 60

active_workers: int = 0


# ─────────────────────────────────────────────────────────────────────────────
# Credentials / HTTP
# ─────────────────────────────────────────────────────────────────────────────
def _extract_token(data) -> str | None:
    """Find the first ya29.* access token anywhere in the session JSON."""
    found: list[str] = []

    def walk(x):
        if isinstance(x, str):
            if x.startswith("ya29.") or x.startswith("ya29_"):
                found.append(x)
        elif isinstance(x, dict):
            for v in x.values():
                walk(v)
        elif isinstance(x, list):
            for v in x:
                walk(v)

    walk(data)
    return found[0] if found else None


async def _get_bearer_token(cookies: str) -> str | None:
    try:
        async with httpx.AsyncClient(timeout=20) as client:
            r = await client.get(AUTH_SESSION_URL, headers={
                "cookie": cookies, "user-agent": UA, "accept": "application/json",
                "referer": "https://labs.google/",
            })
            data = r.json()
    except Exception as e:
        log.warning("Failed to get bearer: %s", e)
        return None
    # The token can sit under various keys; scan for ya29.* and fall back to common names.
    return _extract_token(data) or data.get("accessToken") or data.get("token")


async def _api_post(endpoint: str, body: dict, token: str) -> tuple[int, dict]:
    headers = {
        "authorization": f"Bearer {token}",
        "content-type": "text/plain;charset=UTF-8",
        "accept": "*/*",
        "origin": "https://labs.google",
        "referer": "https://labs.google/",
        "user-agent": UA,
        "x-browser-channel": "stable",
        "x-browser-year": "2026",
    }
    async with httpx.AsyncClient(timeout=60.0) as client:
        r = await client.post(f"{API_BASE}/{endpoint}", headers=headers, content=json.dumps(body))
        try:
            return r.status_code, r.json()
        except Exception:
            return r.status_code, {"_raw": r.text[:600]}


# ─────────────────────────────────────────────────────────────────────────────
# Image upload (start frame + reference faces) -> Flow media id
# ─────────────────────────────────────────────────────────────────────────────
_UUID_RE = re.compile(r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$", re.I)


def _media_id_from_upload(resp) -> str | None:
    if not isinstance(resp, dict):
        return None
    inner = resp.get("media") or resp.get("image") or {}
    if isinstance(inner, list):
        inner = inner[0] if inner else {}
    for src in (resp, inner if isinstance(inner, dict) else {}):
        for k in ("mediaId", "name", "id", "mediaGenerationId"):
            v = src.get(k)
            if isinstance(v, str) and _UUID_RE.match(v):
                return v
    return None


async def _upload_image(token: str, project_id: str, path: Path) -> str | None:
    try:
        raw = path.read_bytes()
    except OSError as e:
        log.warning("cannot read image %s: %s", path, e)
        return None
    body = {"clientContext": {"projectId": project_id, "tool": "PINHOLE"},
            "imageBytes": base64.b64encode(raw).decode()}
    try:
        code, resp = await _api_post("flow/uploadImage", body, token)
    except Exception as e:
        log.warning("uploadImage failed: %s", e)
        return None
    if code != 200:
        log.warning("uploadImage HTTP %s: %s", code, resp)
        return None
    return _media_id_from_upload(resp)


async def _resolve_char_ref_ids(prompt: str, user_id: str, token: str, project_id: str) -> list[str]:
    """Parse @Name mentions -> upload each character's image to Flow -> media ids (R2V)."""
    mentions = re.findall(r"@(\w+)", prompt)
    if not mentions:
        return []
    from app.characters.models import Character
    from sqlalchemy import select
    ids: list[str] = []
    async with AsyncSessionLocal() as db:
        for name in dict.fromkeys(mentions):  # unique, order-preserving
            res = await db.execute(
                select(Character).where(Character.user_id == user_id, Character.name == name)
            )
            char = res.scalar_one_or_none()
            if not char:
                continue
            img_path = CHAR_PATH / char.image_file
            mid = await _upload_image(token, project_id, img_path)
            if mid:
                ids.append(mid)
            else:
                log.warning("could not upload character @%s", name)
    return ids


# ─────────────────────────────────────────────────────────────────────────────
# Request body + model-key variants
# ─────────────────────────────────────────────────────────────────────────────
def _apply_duration(model_key: str, duration: int) -> str:
    """Only abra_* keys encode duration in the key (abra_*_4s/6s/8s/10s). veo keys are fixed."""
    if model_key.startswith("abra_") and duration in (4, 6, 8, 10):
        return re.sub(r"_\d+s$", f"_{duration}s", model_key)
    return model_key


def _resolve_variant(model_key: str, mode: str) -> str:
    """Swap the t2v key to its i2v/r2v sibling. Correct for the FREE lite/lite_low_priority
    keys + abra (the SaaS default). Paid non-lite variants use a `_s_` infix that needs the
    live catalog to resolve — extend here if you sell those tiers."""
    if f"_{mode}_" in model_key:
        return model_key
    return model_key.replace("_t2v_", f"_{mode}_")


def _build_generate_body(project_id: str, prompt: str, aspect: str, model_key: str,
                         recaptcha: str, seed: int, start_image_id: str | None,
                         ref_ids: list[str] | None) -> dict:
    req: dict = {
        "aspectRatio": aspect,
        "textInput": {"structuredPrompt": {"parts": [{"text": prompt}]}},
        "videoModelKey": model_key,
        "seed": seed,
        "metadata": {},
    }
    if start_image_id:
        req["startImage"] = {"mediaId": start_image_id}
    if ref_ids:
        req["referenceImages"] = [{"mediaId": m, "imageUsageType": REFERENCE_USAGE_TYPE} for m in ref_ids]
    return {
        "mediaGenerationContext": {
            "batchId": str(uuid.uuid4()),
            "audioFailurePreference": "RETURN_SILENCED_VIDEOS",
        },
        "clientContext": {
            "projectId": project_id,
            "tool": "PINHOLE",
            "userPaygateTier": PAYGATE_TIER,
            "sessionId": f";{int(time.time() * 1000)}",
            "recaptchaContext": {"token": recaptcha, "applicationType": "RECAPTCHA_APPLICATION_TYPE_WEB"},
        },
        "requests": [req],
        "useV2ModelConfig": True,
    }


def _media_id_from_generate(resp: dict) -> str | None:
    media = resp.get("media") or []
    if media and media[0].get("name"):
        return media[0]["name"]
    wf = resp.get("workflows") or []
    if wf:
        return (wf[0].get("metadata") or {}).get("primaryMediaId")
    return None


# ─────────────────────────────────────────────────────────────────────────────
# Download (cookie-authed redirect, NOT the bearer host)
# ─────────────────────────────────────────────────────────────────────────────
_VIDEO_URL_FALLBACKS = ("", "MEDIA_URL_TYPE_FIFE_URL", "MEDIA_URL_TYPE_VIDEO",
                        "MEDIA_URL_TYPE_RAW", "MEDIA_URL_TYPE_DOWNLOAD")


async def _download_video(media_id: str, cookies: str, project_id: str, out_path: Path) -> bool:
    headers = {
        "accept": "*/*", "cookie": cookies, "origin": "https://labs.google",
        "referer": f"https://labs.google/fx/vi/tools/flow/project/{project_id}", "user-agent": UA,
    }
    async with httpx.AsyncClient(timeout=300.0, follow_redirects=True) as dl:
        for mtype in _VIDEO_URL_FALLBACKS:
            url = f"{MEDIA_REDIRECT_URL}?name={media_id}" + (f"&mediaUrlType={mtype}" if mtype else "")
            try:
                async with dl.stream("GET", url, headers=headers) as r:
                    if r.status_code != 200:
                        continue
                    ctype = r.headers.get("content-type", "")
                    if "image" in ctype or "json" in ctype or "html" in ctype:
                        continue   # that's the thumbnail / an error page, not the video
                    with open(out_path, "wb") as f:
                        async for chunk in r.aiter_bytes(8192):
                            f.write(chunk)
                    return True
            except Exception as e:
                log.warning("download attempt (%s) failed: %s", mtype or "bare", e)
    return False


# ─────────────────────────────────────────────────────────────────────────────
# Image generation — Nano Banana (GEM_PIX_2) via Flow flowMedia:batchGenerateImages
# ─────────────────────────────────────────────────────────────────────────────
IMG_ASPECT_MAP = {
    "16:9": "IMAGE_ASPECT_RATIO_LANDSCAPE", "9:16": "IMAGE_ASPECT_RATIO_PORTRAIT",
    "1:1": "IMAGE_ASPECT_RATIO_SQUARE", "4:3": "IMAGE_ASPECT_RATIO_LANDSCAPE",
    "3:4": "IMAGE_ASPECT_RATIO_PORTRAIT",
}
IMAGE_MODEL = "GEM_PIX_2"   # Nano Banana 2 (free on Ultra via Flow)


async def _download_image(media_id: str, cookies: str, project_id: str, out_path: Path) -> bool:
    headers = {
        "accept": "*/*", "cookie": cookies, "origin": "https://labs.google",
        "referer": f"https://labs.google/fx/vi/tools/flow/project/{project_id}", "user-agent": UA,
    }
    url = f"{MEDIA_REDIRECT_URL}?name={media_id}"
    async with httpx.AsyncClient(timeout=120, follow_redirects=True) as dl:
        for _ in range(6):
            try:
                async with dl.stream("GET", url, headers=headers) as r:
                    if r.status_code == 200 and "image" in r.headers.get("content-type", ""):
                        with open(out_path, "wb") as f:
                            async for chunk in r.aiter_bytes(8192):
                                f.write(chunk)
                        return True
            except Exception as e:
                log.warning("image download retry: %s", e)
            await asyncio.sleep(3)
    return False


async def generate_images_flow(*, user_id: str, cookies: str, project_id: str, prompt: str,
                               count: int, aspect_ratio: str, out_dir: Path, out_prefix: str,
                               reference_image_paths: list[str] | None = None) -> list[str]:
    """Generate image(s) with Nano Banana via Flow (FREE on Ultra). Returns output filenames."""
    from app.sessions.router import request_captcha

    token = await _get_bearer_token(cookies)
    if not token:
        raise RuntimeError("Không lấy được token (cookie Google hết hạn?)")
    recaptcha = await request_captcha(user_id, "IMAGE_GENERATION")   # image action ≠ video's
    if not recaptcha:
        raise RuntimeError("Extension chưa kết nối / không lấy được captcha")

    ref_ids: list[str] = []
    for rp in (reference_image_paths or []):
        mid = await _upload_image(token, project_id, Path(rp))
        if mid:
            ref_ids.append(mid)
    image_inputs = [{"imageInputType": "IMAGE_INPUT_TYPE_REFERENCE", "name": m} for m in ref_ids]

    aspect = IMG_ASPECT_MAP.get(aspect_ratio, "IMAGE_ASPECT_RATIO_SQUARE")
    base_seed = random.randint(1, 2 ** 31 - 1)
    cctx = {
        "recaptchaContext": {"token": recaptcha, "applicationType": "RECAPTCHA_APPLICATION_TYPE_WEB"},
        "projectId": project_id, "tool": "PINHOLE", "sessionId": f";{int(time.time() * 1000)}",
    }
    reqs = [{
        "clientContext": cctx, "imageModelName": IMAGE_MODEL, "imageAspectRatio": aspect,
        "structuredPrompt": {"parts": [{"text": prompt}]},
        "seed": base_seed + i, "imageInputs": image_inputs,
    } for i in range(max(1, count))]
    body = {"clientContext": cctx, "mediaGenerationContext": {"batchId": str(uuid.uuid4())},
            "useNewMedia": True, "requests": reqs}

    endpoint = f"projects/{project_id}/flowMedia:batchGenerateImages"
    code, resp = await _api_post(endpoint, body, token)
    if code in (401, 403):
        token = await _get_bearer_token(cookies)
        if token:
            code, resp = await _api_post(endpoint, body, token)
    if code != 200 or not isinstance(resp, dict):
        raise RuntimeError(f"API tạo ảnh HTTP {code}: {str(resp)[:200]}")

    ids = [m["name"] for m in (resp.get("media") or [])
           if isinstance(m, dict) and isinstance(m.get("name"), str) and _UUID_RE.match(m["name"])]
    if not ids:
        raise RuntimeError(f"Không có media id trong response: {str(resp)[:200]}")

    out_dir.mkdir(parents=True, exist_ok=True)
    out_files: list[str] = []
    for j, mid in enumerate(ids):
        dest = out_dir / f"{out_prefix}_{j}.jpg"
        if await _download_image(mid, cookies, project_id, dest):
            out_files.append(dest.name)
    if not out_files:
        raise RuntimeError("Tạo ảnh xong nhưng tải về thất bại")
    return out_files


# ─────────────────────────────────────────────────────────────────────────────
# One generation (shared by job + scene runners)
# ─────────────────────────────────────────────────────────────────────────────
async def _generate_one(*, user_id: str, cookies: str, project_id: str, prompt: str,
                        aspect_ratio: str, duration_seconds: int, model_key: str,
                        out_stem: str, start_image_path: Path | None = None) -> str:
    """Generate ONE video on Flow and download it. Returns the output filename
    (relative to UPLOAD_PATH). Raises RuntimeError with a human message on failure."""
    from app.sessions.router import request_captcha

    token = await _get_bearer_token(cookies)
    if not token:
        raise RuntimeError("Không lấy được token (cookie Google hết hạn?)")

    recaptcha = await request_captcha(user_id)   # VIDEO_GENERATION, single-use, local-or-Redis
    if not recaptcha:
        raise RuntimeError("Extension chưa kết nối / không lấy được captcha")

    # Upload reference faces (@mentions) and the start frame (I2V) -> Flow media ids
    ref_ids = await _resolve_char_ref_ids(prompt, user_id, token, project_id)
    start_id = None
    if start_image_path:
        start_id = await _upload_image(token, project_id, start_image_path)
        if not start_id:
            raise RuntimeError("Upload ảnh gốc (I2V) thất bại")

    aspect = ASPECT_MAP.get(aspect_ratio, "VIDEO_ASPECT_RATIO_LANDSCAPE")
    key = _apply_duration((model_key or "veo_3_1_t2v_lite_low_priority").strip(), duration_seconds)
    if ref_ids:
        endpoint = "video:batchAsyncGenerateVideoReferenceImages"
        key = _resolve_variant(key, "r2v")
    elif start_id:
        endpoint = "video:batchAsyncGenerateVideoStartImage"
        key = _resolve_variant(key, "i2v")
    else:
        endpoint = "video:batchAsyncGenerateVideoText"

    body = _build_generate_body(project_id, prompt, aspect, key, recaptcha,
                                random.randint(1, 2 ** 31 - 1), start_id, ref_ids or None)

    code, resp = await _api_post(endpoint, body, token)
    if code in (401, 403):                       # token expired mid-flight → refresh once
        token = await _get_bearer_token(cookies)
        if token:
            code, resp = await _api_post(endpoint, body, token)
    if code != 200 or not isinstance(resp, dict):
        raise RuntimeError(f"API generate HTTP {code}: {str(resp)[:200]}")

    media_id = _media_id_from_generate(resp)
    if not media_id:
        raise RuntimeError(f"Không có media id trong response: {str(resp)[:200]}")
    log.info("scheduled media %s (user %s)", media_id, user_id)

    # Poll
    poll_body = {"media": [{"name": media_id, "projectId": project_id}]}
    for _ in range(POLL_MAX_TRIES):
        await asyncio.sleep(POLL_INTERVAL)
        code, poll = await _api_post("video:batchCheckAsyncVideoGenerationStatus", poll_body, token)
        if code != 200 or not isinstance(poll, dict):
            continue
        items = poll.get("media") or []
        if not items:
            continue
        status = (((items[0].get("mediaMetadata") or {}).get("mediaStatus") or {})
                  .get("mediaGenerationStatus") or "").upper()
        if any(h in status for h in FAIL_HINTS):
            raise RuntimeError(f"Render thất bại: {status}")
        if any(h in status for h in DONE_HINTS):
            break
    else:
        raise RuntimeError("Hết thời gian chờ render")

    fname = f"{out_stem}.mp4"
    if not await _download_video(media_id, cookies, project_id, UPLOAD_PATH / fname):
        raise RuntimeError("Render xong nhưng tải video thất bại")
    return fname


# ─────────────────────────────────────────────────────────────────────────────
# Quick single-job runner (for /videos/create) — honours `count`
# ─────────────────────────────────────────────────────────────────────────────
async def _update_job(job_id: str, **kwargs):
    async with AsyncSessionLocal() as db:
        job = await db.get(VideoJob, job_id)
        if job:
            for k, v in kwargs.items():
                setattr(job, k, v)
            await db.commit()


async def run_video_job(job_id: str, user_id: str):
    log.info("Starting job %s for user %s", job_id, user_id)
    global active_workers
    active_workers += 1
    try:
        async with AsyncSessionLocal() as db:
            job = await db.get(VideoJob, job_id)
            user = await db.get(User, user_id)
            if not job or not user:
                return
            cookies = dec(user.google_cookies) or ""
            project_id = user.google_project_id or ""
            prompt, aspect_ratio = job.prompt, job.aspect_ratio
            duration_seconds, count, model_key = job.duration_seconds, max(1, job.count), job.model_key

        if not cookies or not project_id:
            await _update_job(job_id, status=JobStatus.failed, error_msg="Chưa kết nối Google Ultra")
            return

        await _update_job(job_id, status=JobStatus.processing, progress=5)
        outputs: list[str] = []
        last_err = ""
        for i in range(count):
            try:
                fname = await _generate_one(
                    user_id=user_id, cookies=cookies, project_id=project_id, prompt=prompt,
                    aspect_ratio=aspect_ratio, duration_seconds=duration_seconds,
                    model_key=model_key, out_stem=f"{job_id}_{i}")
                outputs.append(fname)
            except Exception as e:
                last_err = str(e)
                log.warning("job %s variant %d failed: %s", job_id, i, e)
            await _update_job(job_id, progress=min(95, int(5 + 90 * (i + 1) / count)))

        if not outputs:
            await _update_job(job_id, status=JobStatus.failed, error_msg=last_err or "No videos")
            return
        await _update_job(job_id, status=JobStatus.done, progress=100,
                          output_files=json.dumps(outputs), thumbnails=json.dumps([]),
                          error_msg=(last_err or None),
                          completed_at=datetime.now(timezone.utc).replace(tzinfo=None))
        log.info("Job %s done: %d/%d videos", job_id, len(outputs), count)
    except Exception as e:
        log.exception("Job %s crashed: %s", job_id, e)
        await _update_job(job_id, status=JobStatus.failed, error_msg=str(e))
    finally:
        active_workers = max(0, active_workers - 1)


# ─────────────────────────────────────────────────────────────────────────────
# Scene runner (projects — I2V, chain, @mention)
# ─────────────────────────────────────────────────────────────────────────────
async def _extract_last_frame(video_path: Path) -> Path | None:
    out = video_path.with_suffix(".last_frame.jpg")
    try:
        proc = await asyncio.create_subprocess_exec(
            "ffmpeg", "-y", "-sseof", "-0.5", "-i", str(video_path),
            "-vframes", "1", "-q:v", "2", str(out),
            stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE,
        )
        await asyncio.wait_for(proc.communicate(), timeout=30)
        return out if out.exists() else None
    except Exception as e:
        log.warning("extract_last_frame failed: %s", e)
        return None


async def run_scene_job(scene_id: str, user_id: str):
    from app.projects.models import Scene, SceneStatus, Project
    from sqlalchemy import select

    async def _update_scene(**kwargs):
        async with AsyncSessionLocal() as db:
            s = await db.get(Scene, scene_id)
            if s:
                for k, v in kwargs.items():
                    setattr(s, k, v)
                await db.commit()

    log.info("Starting scene %s", scene_id)
    global active_workers
    active_workers += 1
    try:
        async with AsyncSessionLocal() as db:
            scene = await db.get(Scene, scene_id)
            user = await db.get(User, user_id)
            if not scene or not user:
                return
            proj = await db.get(Project, scene.project_id)
            prompt, aspect_ratio = scene.prompt, scene.aspect_ratio
            duration_seconds, model_key = scene.duration_seconds, scene.model_key
            cookies = dec(user.google_cookies) or ""
            project_id = user.google_project_id or ""
            start_image_file = scene.start_image
            wait_for_prev = scene.wait_for_prev
            chain_mode = proj.chain_mode if proj else False
            scene_index = scene.index
            project_db_id = scene.project_id

        if not cookies or not project_id:
            await _update_scene(status=SceneStatus.failed, error_msg="Chưa kết nối Google Ultra")
            return

        # Chain mode: wait for the previous scene, then use its last frame as the start image.
        if wait_for_prev and scene_index > 0:
            ok_prev = False
            for _ in range(360):  # up to 30 min
                await asyncio.sleep(5)
                async with AsyncSessionLocal() as db:
                    res = await db.execute(select(Scene).where(
                        Scene.project_id == project_db_id, Scene.index == scene_index - 1))
                    prev = res.scalar_one_or_none()
                if prev and prev.status == SceneStatus.done:
                    if prev.video_file:
                        frame = await _extract_last_frame(UPLOAD_PATH / prev.video_file)
                        if frame:
                            start_image_file = frame.name
                    ok_prev = True
                    break
                if prev and prev.status == SceneStatus.failed:
                    await _update_scene(status=SceneStatus.failed, error_msg="Scene trước bị lỗi")
                    return
            if not ok_prev:
                await _update_scene(status=SceneStatus.failed, error_msg="Timeout chờ scene trước")
                return

        await _update_scene(status=SceneStatus.processing)
        start_path = (UPLOAD_PATH / start_image_file) if start_image_file else None
        try:
            fname = await _generate_one(
                user_id=user_id, cookies=cookies, project_id=project_id, prompt=prompt,
                aspect_ratio=aspect_ratio, duration_seconds=duration_seconds,
                model_key=model_key, out_stem=f"scene_{scene_id[:8]}", start_image_path=start_path)
        except Exception as e:
            await _update_scene(status=SceneStatus.failed, error_msg=str(e))
            return

        await _update_scene(status=SceneStatus.done, video_file=fname)
        log.info("Scene %s done", scene_id)
        await _try_auto_merge(project_db_id)
    except Exception as e:
        log.exception("Scene %s crashed: %s", scene_id, e)
        await _update_scene(status=SceneStatus.failed, error_msg=str(e))
    finally:
        active_workers = max(0, active_workers - 1)


async def _try_auto_merge(project_id: str):
    """If all scenes are done, concat them into final.mp4."""
    from sqlalchemy import select
    from app.projects.models import Scene, SceneStatus, Project
    async with AsyncSessionLocal() as db:
        res = await db.execute(select(Scene).where(Scene.project_id == project_id))
        scenes = res.scalars().all()
        if not scenes or not all(s.status == SceneStatus.done for s in scenes):
            return
        video_files = [s.video_file for s in sorted(scenes, key=lambda s: s.index) if s.video_file]
    if not video_files:
        return

    log.info("Auto-merging project %s (%d scenes)", project_id, len(video_files))
    out_name = f"final_{project_id[:8]}.mp4"
    out_path = UPLOAD_PATH / out_name
    import tempfile, os
    list_path = None
    try:
        with tempfile.NamedTemporaryFile(mode="w", suffix=".txt", delete=False, encoding="utf-8") as f:
            for vf in video_files:
                f.write(f"file '{str(UPLOAD_PATH / vf)}'\n")
            list_path = f.name
        proc = await asyncio.create_subprocess_exec(
            "ffmpeg", "-y", "-f", "concat", "-safe", "0", "-i", list_path,
            "-c", "copy", str(out_path),
            stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE,
        )
        await asyncio.wait_for(proc.communicate(), timeout=600)
        if out_path.exists():
            async with AsyncSessionLocal() as db:
                from app.projects.models import Project
                proj = await db.get(Project, project_id)
                if proj:
                    proj.merged_file = out_name
                    await db.commit()
            log.info("Auto-merge done: %s", out_name)
    except Exception as e:
        log.warning("Auto-merge failed: %s", e)
    finally:
        if list_path:
            try:
                os.unlink(list_path)
            except OSError:
                pass
