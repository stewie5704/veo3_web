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
import os
import random
import re
import time
import uuid
from datetime import datetime, timezone
from pathlib import Path

import httpx

from app.config import UPLOAD_PATH, settings
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

# Render concurrency PER USER: how many scenes generate at once for ONE Ultra account.
# The captcha lock already serializes the ~few-second token grab; this caps the long
# poll loops that overlap. 3 = matches the desktop tool's small pool (safe for 1 ext).
SCENE_CONCURRENCY = 3
_user_sems: dict[str, asyncio.Semaphore] = {}
_inflight_tasks: set = set()        # keep create_task refs alive (else GC may cancel mid-render)
_inflight_scene_ids: set = set()    # single-flight: chống 2 task cùng 1 scene (resume/rerender khi đang chạy)
_merge_locks: dict[str, asyncio.Lock] = {}  # 1 merge/project tại 1 thời điểm (chống double-merge)


def _user_sem(user_id: str) -> asyncio.Semaphore:
    sem = _user_sems.get(user_id)
    if sem is None:
        sem = asyncio.Semaphore(SCENE_CONCURRENCY)
        _user_sems[user_id] = sem
    return sem


def _merge_lock(project_id: str) -> asyncio.Lock:
    lock = _merge_locks.get(project_id)
    if lock is None:
        lock = asyncio.Lock()
        _merge_locks[project_id] = lock
    return lock


def dispatch_scene(scene_id: str, user_id: str) -> None:
    """Fire a scene render as a REAL concurrent task. Do NOT use FastAPI BackgroundTasks
    for this — Starlette awaits added tasks one-after-another, so each scene's full
    poll loop (up to ~10 min) would block the next scene from even starting. Here every
    scene starts immediately; the per-user semaphore in run_scene_job caps how many hit
    Google's render queue at once.

    Single-flight: nếu scene đang chạy thì bỏ qua (resume/rerender/retry bấm trùng sẽ KHÔNG
    tạo task thứ 2 -> tránh render đôi = tốn gấp đôi credit Google + status loạn)."""
    if scene_id in _inflight_scene_ids:
        log.info("Scene %s đang chạy -> bỏ qua dispatch trùng", scene_id)
        return
    _inflight_scene_ids.add(scene_id)
    task = asyncio.create_task(run_scene_job(scene_id, user_id))
    _inflight_tasks.add(task)

    def _done(t):
        _inflight_tasks.discard(t)
        _inflight_scene_ids.discard(scene_id)
    task.add_done_callback(_done)


async def recover_orphan_scenes() -> int:
    """Chạy lúc khởi động: worker cũ bị kill/deploy giữa chừng -> task asyncio chết, để lại
    scene kẹt 'processing' (video chưa có) vĩnh viễn — UI hiển thị "đang render" mãi mãi.

    Chỉ RESET các scene đó về 'pending' để xoá trạng thái giả; KHÔNG dispatch lại ở đây vì hàm
    này chạy trước `yield` (server chưa phục vụ -> extension chưa kết nối -> captcha sẽ fail).
    User bấm 'Tiếp tục' khi extension đã lên (route /resume re-dispatch các scene video=NULL).
    Project đang 'Dừng' để nguyên."""
    from app.projects.models import Scene, SceneStatus, Project
    from sqlalchemy import select
    n = 0
    async with AsyncSessionLocal() as db:
        res = await db.execute(select(Scene).where(
            Scene.status == SceneStatus.processing, Scene.video_file.is_(None)))
        for s in res.scalars().all():
            proj = await db.get(Project, s.project_id)
            if proj and getattr(proj, "stopped", False):
                continue  # project đang Dừng -> để nguyên
            s.status = SceneStatus.pending
            s.error_msg = None
            n += 1
        if n:
            await db.commit()
    if n:
        log.info("Reset %d scene mồ côi ('processing'->'pending') sau restart", n)
    return n


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


# Báo lỗi rõ ràng khi phiên Google hết hạn (token cần refresh) — thay cho raw "401 {...}".
SESSION_EXPIRED_MSG = (
    "Phiên Google hết hạn (token cần làm mới). Mở lại tab Flow (labs.google) trên Chrome "
    "cho đúng tài khoản Ultra, bấm Kết nối lại trong extension, rồi Tạo lại."
)


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
    # Phiên báo lỗi (vd ACCESS_TOKEN_REFRESH_NEEDED) => access_token trả về đã CHẾT -> đừng dùng,
    # nếu không mọi cảnh sẽ 401. Trả None để caller báo "phiên hết hạn" rõ ràng.
    if isinstance(data, dict) and data.get("error"):
        log.warning("Google session needs refresh: error=%s expires=%s", data.get("error"), data.get("expires"))
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


async def _resolve_char_ref_ids(prompt: str, user_id: str, token: str, project_id: str,
                                char_project_id: str | None = None) -> list[str]:
    """Parse @Name mentions -> upload each character's image to Flow -> media ids (R2V).
    Lai-model: ưu tiên nhân vật RIÊNG của project (char_project_id), nếu không có thì
    fallback nhân vật kho chung (project_id IS NULL). Dùng .first() để không crash khi
    user lỡ có cùng tên ở cả 2 phạm vi."""
    mentions = re.findall(r"@(\w+)", prompt)
    if not mentions:
        return []
    from app.characters.models import Character
    from sqlalchemy import select
    ids: list[str] = []
    async with AsyncSessionLocal() as db:
        for name in dict.fromkeys(mentions):  # unique, order-preserving
            base = select(Character).where(Character.user_id == user_id, Character.name == name)
            char = None
            if char_project_id:
                res = await db.execute(base.where(Character.project_id == char_project_id))
                char = res.scalars().first()
            if char is None:  # fallback kho chung
                res = await db.execute(base.where(Character.project_id.is_(None)))
                char = res.scalars().first()
            if char is None:  # cuối cùng: bất kỳ bản nào cùng tên
                res = await db.execute(base)
                char = res.scalars().first()
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
    """Swap the t2v key to its i2v/r2v sibling.
    - lite / lite_low_priority + abra: thay `_t2v_` thẳng là ĐÚNG (vd veo_3_1_r2v_lite_low_priority).
    - veo NON-lite (portrait / fast_portrait_ultra): key thật có infix `_s_`
      (vd veo_3_1_r2v_s_fast_portrait_ultra / veo_3_1_i2v_s_portrait) -> PHẢI chèn `_s_`,
      nếu không Flow nhận key sai rồi FALLBACK về model NGANG (mất 9:16)."""
    if f"_{mode}_" in model_key:
        return model_key
    key = model_key.replace("_t2v_", f"_{mode}_")
    if key.startswith("veo_") and "lite" not in key and f"_{mode}_s_" not in key:
        key = key.replace(f"_{mode}_", f"_{mode}_s_", 1)
    return key


def _build_generate_body(project_id: str, prompt: str, aspect: str, model_key: str,
                         recaptcha: str, seed: int, start_image_id: str | None,
                         ref_ids: list[str] | None, silent: bool = True, voice_name: str = "", dialogue: str = "") -> dict:
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
        
    if voice_name:
        req["referenceAudio"] = [{"mediaId": voice_name.lower()}]

    body = {
        "mediaGenerationContext": {
            "batchId": str(uuid.uuid4()), 
            "audioFailurePreference": "RETURN_SILENCED_VIDEOS"
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
    return body


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
        raise RuntimeError(SESSION_EXPIRED_MSG)
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
    # 401/403 ở đây thường là reCAPTCHA bị từ chối ("evaluation failed"/UNUSUAL_ACTIVITY) HOẶC bearer
    # hết hạn. Captcha là SINGLE-USE → gửi lại token cũ chắc chắn fail; phải lấy captcha MỚI + làm mới
    # bearer, giãn cách (backoff + jitter, kiểu người dùng) rồi thử lại tối đa 2 lần. cctx dùng chung
    # object với reqs+body nên ghi token mới vào cctx là tự lan sang toàn bộ request.
    for attempt in range(2):
        if code not in (401, 403):
            break
        await asyncio.sleep(2.0 + random.uniform(0.0, 2.5) * (attempt + 1))
        new_token = await _get_bearer_token(cookies)
        if new_token:
            token = new_token
        fresh = await request_captcha(user_id, "IMAGE_GENERATION")
        if fresh:
            cctx["recaptchaContext"]["token"] = fresh
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
def _to_character_speak(prompt: str, dialogue: str, voice_name: str = "") -> str:
    """Chế độ NHÂN VẬT TỰ NÓI (nhép miệng): gỡ phần chặn giọng + audio-negative đã chèn, rồi thêm
    câu thoại để Veo cho nhân vật nói bằng giọng native (mồm khớp) thay vì chồng TTS."""
    spoken = re.sub(r"^\s*[^:\n]{1,24}:\s*", "", dialogue or "").strip()
    p = prompt.replace(" No spoken dialogue, no voices, no narration, no singing.", "")
    p = p.replace("; no dialogue, voiceover, narration, singing, laughter or studio-audience sounds.", ".")
    if spoken:
        v_hint = ""
        if voice_name:
            v_hint = " using a female voice" if voice_name in ("Kore", "Aoede", "Leda") else " using a male voice"
        p += f' The speaker faces the camera and clearly says{v_hint}, in Vietnamese: "{spoken}". Accurate natural lip-sync, clear speech.'
    return p


class _ProminentBlocked(Exception):
    """Render bị bộ lọc người (PROMINENT_PEOPLE) chặn — thường là dương-tính-giả, đổi seed render
    lại hay qua. Bắt riêng để retry thay vì fail luôn."""


def _stable_seed(s: str) -> int:
    """Seed ổn định suy từ chuỗi (vd project id) — dùng cho dự án cũ chưa có Project.seed,
    để mọi cảnh vẫn dùng chung 1 seed => mặt nhân vật nhất quán."""
    import hashlib
    return int(hashlib.md5((s or "x").encode()).hexdigest()[:8], 16) % (2 ** 31 - 1) + 1


async def _is_stopped(project_db_id: str) -> bool:
    """Người dùng đã bấm 'Dừng dự án'? (đọc cờ Project.stopped)."""
    try:
        from app.projects.models import Project
        async with AsyncSessionLocal() as db:
            p = await db.get(Project, project_db_id)
            return bool(p and getattr(p, "stopped", False))
    except Exception:
        return False


# ─────────────────────────────────────────────────────────────────────────────
# On-demand 1080p upscale — used at DOWNLOAD time, NOT during render. Generation
# stays at the model's native 720p; the user opts into 1080p only when downloading.
# Result is cached next to the source so repeat downloads are instant.
# ─────────────────────────────────────────────────────────────────────────────
_UPSCALE_DIMS = {"16:9": (1920, 1080), "9:16": (1080, 1920), "1:1": (1080, 1080),
                 "4:3": (1440, 1080), "3:4": (1080, 1440)}


async def ensure_1080(src: Path, aspect_ratio: str = "16:9") -> Path | None:
    """Return a cached 1080p version of `src`, creating it with ffmpeg if needed.
    NON-destructive: the original is never modified. Returns None on failure (caller
    then serves the original 720p)."""
    if (settings.upscale_mode or "hybrid").lower() == "off" or not src.exists():
        return None
    cache = src.with_name(src.stem + "__1080" + src.suffix)
    try:
        if cache.exists() and cache.stat().st_size > 0 and cache.stat().st_mtime >= src.stat().st_mtime:
            return cache   # already upscaled this exact source
    except OSError:
        pass
    w, h = _UPSCALE_DIMS.get(aspect_ratio, (1920, 1080))
    tmp = cache.with_suffix(".tmp.mp4")
    try:
        proc = await asyncio.create_subprocess_exec(
            "ffmpeg", "-y", "-i", str(src),
            "-vf", f"scale={w}:{h}:flags=lanczos",
            "-c:v", "libx264", "-preset", "veryfast", "-crf", "18", "-pix_fmt", "yuv420p",
            "-c:a", "copy", str(tmp),
            stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE,
        )
        _, err = await asyncio.wait_for(proc.communicate(), timeout=600)
        if proc.returncode == 0 and tmp.exists() and tmp.stat().st_size > 0:
            os.replace(tmp, cache)
            log.info("1080p ready -> %s", cache.name)
            return cache
        log.warning("ffmpeg 1080p rc=%s: %s", proc.returncode, (err or b"")[-300:])
    except Exception as e:
        log.warning("ensure_1080 error: %s", e)
    try:
        tmp.unlink(missing_ok=True)
    except OSError:
        pass
    return None


def _strip_face_for_ref(prompt: str) -> str:
    """Khi có ảnh reference (giữ mặt), Veo dựa vào ẢNH để nhận dạng.
    Mô tả chi tiết mặt/mắt/da bằng text ĐẦU NHAU với ảnh + hay kích filter
    'prominent person' → Veo fallback render kiểu 3D/CGI thay vì realistic.
    Strip: tuổi, face, eyes, skin, build, distinguishing marks khỏi block 'Same Name (...)'.
    Giữ lại: tên, anchor, hair, trang phục, palette (đủ để phân biệt ai-là-ai)."""
    # Xử lý block "Same Name (anchor; 24; oval face, defined jaw; ... hair; dark brown eyes; warm light skin; height=175cm...)."
    # Bỏ các segment: tuổi thuần số, face descriptor, eyes, skin tone, build/height, distinguishing marks
    def _clean_block(m):
        prefix = m.group(1)  # "Same Name ("
        inner = m.group(2)   # nội dung bên trong ngoặc
        suffix = m.group(3)  # ")"
        parts = [p.strip() for p in inner.split(";")]
        keep = []
        for p in parts:
            pl = p.lower()
            # Bỏ tuổi thuần số
            if re.fullmatch(r'\d{1,3}', p.strip()):
                continue
            # Bỏ face descriptors
            if any(w in pl for w in ('face', 'jaw', 'cheekbone', 'forehead', 'chin')):
                continue
            # Bỏ eyes
            if pl.endswith('eyes') or 'almond-shaped' in pl or 'eye' in pl.split(',')[0]:
                continue
            # Bỏ skin tone
            if 'skin' in pl and ('tone' in pl or 'light' in pl or 'warm' in pl or 'dark' in pl or 'fair' in pl or 'tan' in pl or 'medium' in pl or 'olive' in pl):
                continue
            # Bỏ build/height
            if 'height=' in pl or 'build=' in pl or pl.startswith('build'):
                continue
            # Bỏ distinguishing marks
            if 'distinguishing' in pl or 'scar' in pl or 'mole' in pl or 'freckle' in pl or 'birthmark' in pl:
                continue
            if p.strip():
                keep.append(p.strip())
        return prefix + "; ".join(keep) + suffix if keep else prefix.rstrip(" (") + suffix.lstrip(")")

    return re.sub(r'(Same\s+\w[^(]{0,40}\()([^)]{5,800})(\))', _clean_block, prompt)


# Lưới chất lượng áp LÚC RENDER cho mọi video CHƯA có khối negative (video bán hàng, job lẻ, prompt
# người dùng tự gõ — các path không đi qua _build_shot_prompt). Mỏ neo chuyển động + dẹp artifact Veo
# 3.1 hay dính. Trùng nội dung với _MOTION_ANCHOR/_NEG_TAIL bên tools.router (chủ đích lặp — tránh phụ
# thuộc chéo module). KHÔNG áp cho chế độ nhân vật tự nói (cần giữ phần thoại/giọng).
_RENDER_QUALITY_TAIL = (
    " Smooth, coherent motion throughout; lighting and exposure stay consistent for the whole shot."
    " Negative prompt: full-frame edge-to-edge, no borders/letterbox/pillarbox, no on-screen text, "
    "subtitles, captions, logos or watermark; no face distortion, warping, morphing, extra fingers, "
    "duplicate limbs or plastic skin; no flickering, strobing, frame jitter or temporal popping; no "
    "unintended slow-motion, speed ramps or stutter; no oversaturated HDR halos, colour banding or "
    "oversharpening; a single continuous shot — no montage, cutaways, jump cuts or scene transitions; "
    "no dialogue, voiceover, narration, singing, laughter or studio-audience sounds.")


async def _generate_one(*, user_id: str, cookies: str, project_id: str, prompt: str,
                        aspect_ratio: str, duration_seconds: int, model_key: str,
                        out_stem: str, start_image_path: Path | None = None,
                        char_project_id: str | None = None,
                        seed: int | None = None,
                        extra_ref_paths: list[str] | None = None,
                        dialogue: str = "", character_speak: bool = False, voice_name: str = "") -> str:
    """Generate ONE video on Flow and download it (native 720p — 1080p is an
    opt-in upscale at download time). Returns the filename relative to UPLOAD_PATH."""
    from app.sessions.router import request_captcha

    token = await _get_bearer_token(cookies)
    if not token:
        raise RuntimeError(SESSION_EXPIRED_MSG)

    recaptcha = await request_captcha(user_id)   # VIDEO_GENERATION, single-use, local-or-Redis
    if not recaptcha:
        raise RuntimeError("Extension chưa kết nối / không lấy được captcha")

    # Reference identity: @mention (cũ) + ảnh nhân vật RIÊNG của project đính MỌI cảnh
    # (giữ mặt + đồng bộ, không cần user gõ @). Cap 3 = giới hạn referenceImages của Veo.
    ref_ids = await _resolve_char_ref_ids(prompt, user_id, token, project_id, char_project_id)
    for rp in (extra_ref_paths or []):
        if len(ref_ids) >= 3:
            break
        mid = await _upload_image(token, project_id, Path(rp))
        if mid and mid not in ref_ids:
            ref_ids.append(mid)
    ref_ids = ref_ids[:3]

    start_id = None
    if start_image_path:
        start_id = await _upload_image(token, project_id, start_image_path)
        if not start_id:
            raise RuntimeError("Upload ảnh gốc (I2V) thất bại")

    aspect = ASPECT_MAP.get(aspect_ratio, "VIDEO_ASPECT_RATIO_LANDSCAPE")
    key = _apply_duration((model_key or "veo_3_1_t2v_lite_low_priority").strip(), duration_seconds)
    
    if start_id:
        # Nếu có start_image (nối khung/I2V), luôn dùng endpoint I2V để đảm bảo liên tục.
        # Nếu có thêm ref_ids, req["referenceImages"] vẫn được gửi để giữ nhân vật.
        endpoint = "video:batchAsyncGenerateVideoStartImage"
        key = _resolve_variant(key, "i2v")
    elif ref_ids or voice_name:
        endpoint = "video:batchAsyncGenerateVideoReferenceImages"
        key = _resolve_variant(key, "r2v")
    else:
        endpoint = "video:batchAsyncGenerateVideoText"

    # Bám reference: nhắc Veo giữ đúng mặt/tóc/trang phục theo ảnh tham chiếu (cho giống hơn).
    # Strip mô tả mặt/mắt/da chi tiết: có ẢNH rồi thì text chi tiết chỉ gây xung đột + kích filter.
    if ref_ids:
        prompt = _strip_face_for_ref(prompt)
        prompt += " Keep each person's face, hairstyle and outfit identical to the provided reference image(s)."
        # Có sản phẩm trong cảnh (video bán hàng) -> khoá luôn diện mạo SẢN PHẨM theo ảnh ref, xuyên MỌI
        # cảnh (giống cách giữ mặt nhân vật). Chỉ thêm khi prompt nhắc 'product' => không đụng dự án kể chuyện.
        # MASTER product lock: chỉ thêm khi cảnh có 'product' và CHƯA bị khoá (dedup theo 'exact same item'
        # — đã chèn từ sell_script/SellVideo) -> đúng 1 khoá mạnh/cảnh, không bloat, đồng bộ xuyên mọi cảnh.
        if re.search(r"\bproducts?\b", prompt, re.I) and "exact same item" not in prompt.lower():
            prompt += (" Product lock: keep the product the EXACT same item as the reference image — identical "
                       "colour, material and finish, surface pattern/print, logo and on-pack text (same wording, "
                       "font and placement), label, shape and proportions; NEVER recolour, restyle, relabel, "
                       "resize, swap, distort, morph or regenerate it, and never add or remove any text or logo; "
                       "keep it identical in every frame and angle.")
    silent = True
    if character_speak:   # NHÂN VẬT TỰ NÓI: đưa thoại vào prompt + cho Veo sinh tiếng (nhép miệng)
        prompt = _to_character_speak(prompt, dialogue, voice_name)
        silent = False
    elif "negative prompt:" not in prompt.lower():
        prompt += _RENDER_QUALITY_TAIL   # lưới chất lượng cho path không qua _build_shot_prompt

    use_seed = seed if (seed is not None and seed > 0) else random.randint(1, 2 ** 31 - 1)
    body = _build_generate_body(project_id, prompt, aspect, key, recaptcha,
                                use_seed, start_id, ref_ids or None, silent=silent, voice_name=voice_name, dialogue=dialogue)

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
    for _i in range(POLL_MAX_TRIES):
        await asyncio.sleep(POLL_INTERVAL)
        if char_project_id and _i % 2 == 1 and await _is_stopped(char_project_id):
            raise RuntimeError("⏸ Đã dừng")   # người dùng bấm Dừng dự án
        code, poll = await _api_post("video:batchCheckAsyncVideoGenerationStatus", poll_body, token)
        if code != 200 or not isinstance(poll, dict):
            continue
        items = poll.get("media") or []
        if not items:
            continue
        status = (((items[0].get("mediaMetadata") or {}).get("mediaStatus") or {})
                  .get("mediaGenerationStatus") or "").upper()
        if any(h in status for h in FAIL_HINTS):
            ms = ((items[0].get("mediaMetadata") or {}).get("mediaStatus") or {})
            reasons = [str(r).upper() for r in (ms.get("failureReasons") or [])]
            emsg = ((ms.get("error") or {}).get("message") or "")
            log.error("Generation FAILED (user %s, key %s) reasons=%s err=%s — item: %s",
                      user_id, key, reasons, emsg, str(items[0])[:1500])
            if any("PROMINENT" in r for r in reasons) or "PROMINENT_PEOPLE" in emsg.upper():
                raise _ProminentBlocked()   # caller đổi seed retry (thường dương-tính-giả)
            raise RuntimeError(f"Render thất bại: {emsg or (', '.join(reasons)) or status}")
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
            # Tool lẻ I2V / R2V: ảnh khung đầu / ảnh tham chiếu giữ mặt
            start_image = getattr(job, "start_image", None)
            ref_images = json.loads(getattr(job, "ref_images", None) or "[]")

        if not cookies or not project_id:
            await _update_job(job_id, status=JobStatus.failed, error_msg="Chưa kết nối Google Ultra")
            return

        start_path = Path(start_image) if start_image else None
        extra_ref_paths = ref_images or None

        await _update_job(job_id, status=JobStatus.processing, progress=5)
        outputs: list[str] = []
        last_err = ""
        for i in range(count):
            seed0 = random.randint(1, 2 ** 31 - 1)

            async def _gen(sd):
                return await _generate_one(
                    user_id=user_id, cookies=cookies, project_id=project_id, prompt=prompt,
                    aspect_ratio=aspect_ratio, duration_seconds=duration_seconds,
                    model_key=model_key, out_stem=f"{job_id}_{i}", start_image_path=start_path,
                    extra_ref_paths=extra_ref_paths, seed=sd)
            try:
                try:
                    fname = await _gen(seed0)
                except _ProminentBlocked:   # ảnh giữ mặt: dương-tính-giả -> đổi seed thử lại 1 lần
                    fname = await _gen((seed0 * 1103515245 + 12345) % (2 ** 31 - 1) + 1)
                outputs.append(fname)
            except _ProminentBlocked:
                last_err = ("Google chặn ảnh tham chiếu: người NỔI TIẾNG hoặc lọc nhầm "
                            "(mặt thường vẫn qua). Đổi ảnh nhân vật AI khác.")
                log.warning("job %s variant %d PROMINENT", job_id, i)
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


def _pcm_to_wav(pcm: bytes, path: Path, *, rate: int = 24000, channels: int = 1, bits: int = 16) -> None:
    """Bọc PCM little-endian thô vào WAV header chuẩn (Gemini TTS = 24kHz mono s16) — y cách VEO Max."""
    import struct
    byte_rate = rate * channels * bits // 8
    block_align = channels * bits // 8
    header = b"RIFF" + struct.pack("<I", 36 + len(pcm)) + b"WAVE"
    header += b"fmt " + struct.pack("<IHHIIHH", 16, 1, channels, rate, byte_rate, block_align, bits)
    header += b"data" + struct.pack("<I", len(pcm))
    path.write_bytes(header + pcm)


def _tts_pcm(api_key: str, text: str, voice: str):
    """Gemini TTS -> (audio_bytes, is_wav). is_wav=True nếu có RIFF header; else raw PCM s16le 24kHz mono."""
    import base64
    import google.generativeai as genai
    genai.configure(api_key=api_key)
    m = genai.GenerativeModel("gemini-2.5-flash-preview-tts")
    resp = m.generate_content(text, generation_config={
        "response_modalities": ["AUDIO"],
        "speech_config": {"voice_config": {"prebuilt_voice_config": {"voice_name": voice or "Kore"}}},
    })
    data = resp.candidates[0].content.parts[0].inline_data.data
    raw = base64.b64decode(data) if isinstance(data, str) else bytes(data)
    return raw, raw[:4] == b"RIFF"


async def _voice_over(video_fname: str, narration: str, voice: str, api_key: str) -> str | None:
    """Tạo giọng đọc tiếng Việt cho thoại của cảnh rồi ghép vào video. Trả tên file mới (hoặc None nếu lỗi)."""
    spoken = re.sub(r"^\s*[^:\n]{1,24}:\s*", "", narration or "").strip() or (narration or "").strip()
    if not spoken:
        return None
    try:
        out = await asyncio.to_thread(_tts_pcm, api_key, spoken, voice)
    except Exception as e:
        log.warning("TTS failed: %s", e)
        return None
    if not out:
        return None
    raw, is_wav = out
    stem = Path(video_fname).stem
    audio_path = UPLOAD_PATH / f"{stem}.tts.wav"
    if is_wav:
        audio_path.write_bytes(raw)
    else:
        _pcm_to_wav(raw, audio_path)   # bọc WAV header chuẩn (giống VEO Max) -> khỏi méo tiếng
    voiced = UPLOAD_PATH / f"{stem}_vi.mp4"
    vin = str(UPLOAD_PATH / video_fname)
    # Trộn: giữ NỀN âm thanh Veo (ambient/foley/nhạc) ducked xuống dưới giọng đọc tiếng Việt
    # -> điện ảnh hơn hẳn so với thay sạch. Clip câm (Veo silent) thì fallback chỉ-giọng-đọc.
    mix_cmd = ["ffmpeg", "-y", "-i", vin, "-i", str(audio_path), "-filter_complex",
               "[0:a]volume=0.28[bg];[bg][1:a]amix=inputs=2:duration=first:dropout_transition=2[a]",
               "-map", "0:v:0", "-map", "[a]", "-c:v", "copy", "-c:a", "aac", "-shortest", str(voiced)]
    repl_cmd = ["ffmpeg", "-y", "-i", vin, "-i", str(audio_path),
                "-map", "0:v:0", "-map", "1:a:0", "-c:v", "copy", "-c:a", "aac", "-shortest", str(voiced)]

    async def _run(cmd) -> bool:
        try:
            proc = await asyncio.create_subprocess_exec(*cmd, stdout=asyncio.subprocess.PIPE,
                                                        stderr=asyncio.subprocess.PIPE)
            await asyncio.wait_for(proc.communicate(), timeout=120)
            return proc.returncode == 0 and voiced.exists()
        except Exception as e:
            log.warning("ffmpeg voiceover failed: %s", e)
            return False

    try:
        ok = await _run(mix_cmd) or await _run(repl_cmd)
    finally:
        try:
            audio_path.unlink()
        except Exception:
            pass
    return voiced.name if (ok and voiced.exists()) else None


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
            # Auto lồng tiếng Việt (TTS) — bật theo project
            narration = scene.narration or ""
            # audio_mode: 'voiceover' (TTS ghép) | 'character_speak' (Veo tự nói) | 'off'
            audio_mode = (getattr(proj, "audio_mode", "") or
                          ("voiceover" if getattr(proj, "voiceover", False) else "off")) if proj else "off"
            voice = (getattr(proj, "voice", "") or "Kore") if proj else "Kore"
            scene_voice = getattr(scene, "voice", "") or ""   # giọng riêng theo nhân vật nói
            gemini_key = dec(user.gemini_api_key) if user.gemini_api_key else ""
            proj_stopped = bool(getattr(proj, "stopped", False)) if proj else False
            proj_seed = int(getattr(proj, "seed", 0) or 0)
            # Ảnh nhân vật RIÊNG của project -> reference giữ mặt cho MỌI cảnh (không cần @mention).
            # Veo cap 3 ref: ưu tiên nhân vật CÓ MẶT trong cảnh (tên xuất hiện ở prompt/thoại),
            # rồi mới tới còn lại -> mỗi cảnh đính đúng nhân vật của nó khi dự án có >3 người.
            from app.characters.models import Character
            res_ch = await db.execute(select(Character).where(Character.project_id == scene.project_id))
            all_chars = [c for c in res_ch.scalars().all() if c.image_file]
            _hay = f"{scene.prompt or ''} {scene.narration or ''}".lower()

            def _present(nm: str) -> bool:
                nm = (nm or "").strip().lower()
                # tên ngắn (<3) dễ dính nhầm trong từ thường (An trong "bàn") -> xếp vào 'others';
                # tên dài hơn match theo BIÊN TỪ (Unicode-aware) thay vì substring thô.
                return len(nm) >= 3 and re.search(rf"(?<!\w){re.escape(nm)}(?!\w)", _hay) is not None

            present = [c for c in all_chars if _present(c.name)]
            others = [c for c in all_chars if c not in present]
            char_ref_files = [c.image_file for c in (present + others)]

        extra_ref_paths = [str(CHAR_PATH / f) for f in char_ref_files]
        base_seed = proj_seed or _stable_seed(project_db_id)
        # Rerender (scene đã có video trước đó): ĐỔI seed để Veo tạo video KHÁC.
        # Lần render đầu dùng seed cố định (nhân vật nhất quán); rerender cần kết quả mới.
        is_rerender = bool(scene.video_file)
        use_seed = random.randint(1, 2 ** 31 - 1) if is_rerender else base_seed

        if proj_stopped:
            await _update_scene(status=SceneStatus.failed, error_msg="⏸ Đã dừng")
            return
        if not cookies or not project_id:
            await _update_scene(status=SceneStatus.failed, error_msg="Chưa kết nối Google Ultra")
            return

        # Chain mode: wait for the previous scene, then use its last frame as the start image.
        # KHÔNG đặt đồng hồ timeout cứng 30' từ lúc dispatch: prev có thể đang xếp hàng sau
        # semaphore (vẫn pending/processing) -> chờ tiếp, không fail giả. Chỉ fail khi prev
        # thực sự lỗi, biến mất hẳn, hoặc treo bất động quá lâu. Cap tuyệt đối ~3h là backstop.
        if wait_for_prev and scene_index > 0:
            ok_prev = False
            stale = 0  # số vòng prev biến mất / không nhúc nhích
            for _ in range(2160):  # backstop ~3h (sleep 5s); restart sẽ tự phục hồi nếu treo thật
                await asyncio.sleep(5)
                if await _is_stopped(project_db_id):
                    await _update_scene(status=SceneStatus.failed, error_msg="⏸ Đã dừng")
                    return
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
                # prev pending/processing = đang xếp hàng hoặc đang render -> chờ tiếp.
                # Chỉ bỏ cuộc nếu prev biến mất hẳn (~1 phút) — dữ liệu hỏng/đã xoá.
                if prev is None:
                    stale += 1
                    if stale >= 12:
                        break
                else:
                    stale = 0
            if not ok_prev:
                await _update_scene(status=SceneStatus.failed, error_msg="Timeout chờ scene trước")
                return

        # Giữ slot render PER-USER chỉ quanh lúc gen thật. Cảnh đang chờ scene trước (ở trên)
        # KHÔNG chiếm slot -> cảnh đầu luôn có slot, chain không deadlock; tối đa
        # SCENE_CONCURRENCY cảnh bắn lên Google cùng lúc.
        async with _user_sem(user_id):
            if await _is_stopped(project_db_id):   # user có thể bấm Dừng trong lúc xếp hàng
                await _update_scene(status=SceneStatus.failed, error_msg="⏸ Đã dừng")
                return
            await _update_scene(status=SceneStatus.processing)
            start_path = (UPLOAD_PATH / start_image_file) if start_image_file else None

            char_speak = audio_mode == "character_speak"   # Veo cho nhân vật tự nói (nhép miệng)

            async def _gen(sd):
                return await _generate_one(
                    user_id=user_id, cookies=cookies, project_id=project_id, prompt=prompt,
                    aspect_ratio=aspect_ratio, duration_seconds=duration_seconds,
                    model_key=model_key, out_stem=f"scene_{scene_id[:8]}", start_image_path=start_path,
                    char_project_id=project_db_id, seed=sd, extra_ref_paths=extra_ref_paths,
                    dialogue=(narration if char_speak else ""), character_speak=char_speak,
                    voice_name=(scene_voice or voice if char_speak else ""))

            try:
                try:
                    fname = await _gen(use_seed)
                except _ProminentBlocked:
                    # bộ lọc người thường là dương-tính-giả -> đổi seed render lại 1 lần (hay qua).
                    # Ảnh ref khoá danh tính nên đổi seed không lệch mặt.
                    log.warning("scene %s PROMINENT -> thử lại seed mới", scene_id)
                    fname = await _gen((use_seed * 1103515245 + 12345) % (2 ** 31 - 1) + 1)
            except _ProminentBlocked:
                await _update_scene(status=SceneStatus.failed, error_msg=(
                    "Google chặn ảnh giữ mặt: thường do người NỔI TIẾNG hoặc bộ lọc nhận nhầm "
                    "(mặt người thường vẫn qua — đã thử lại). Đổi ảnh nhân vật AI khác, hoặc bỏ giữ mặt."))
                return
            except Exception as e:
                await _update_scene(status=SceneStatus.failed, error_msg=str(e))
                return

            # Lồng tiếng Việt (chỉ chế độ 'voiceover'): TTS đọc thoại + ghép. 'character_speak' thì
            # Veo đã tự nói trong clip rồi -> KHÔNG chồng TTS nữa.
            if audio_mode == "voiceover" and narration.strip() and gemini_key:
                try:
                    voiced = await _voice_over(fname, narration, scene_voice or voice, gemini_key)
                    if voiced:
                        fname = voiced
                        log.info("Scene %s voiced (vi) -> %s", scene_id, voiced)
                except Exception as e:
                    log.warning("voiceover scene %s failed: %s", scene_id, e)

            await _update_scene(status=SceneStatus.done, video_file=fname)
            log.info("Scene %s done", scene_id)
        await _try_auto_merge(project_db_id)
    except asyncio.CancelledError:
        # Worker shutdown/deploy: KHÔNG ghi DB (event loop đang đóng), để nguyên trạng thái và
        # để recover_orphan_scenes() phục hồi ở lần khởi động sau. Re-raise đúng chuẩn asyncio.
        log.warning("Scene %s bị huỷ (shutdown/deploy?) — sẽ phục hồi khi khởi động lại", scene_id)
        raise
    except Exception as e:
        log.exception("Scene %s crashed: %s", scene_id, e)
        await _update_scene(status=SceneStatus.failed, error_msg=str(e))
    finally:
        active_workers = max(0, active_workers - 1)


async def _try_auto_merge(project_id: str):
    """If all scenes are done, concat them into final.mp4.

    Single-flight + idempotent: nhiều scene xong gần như cùng lúc đều gọi hàm này. Lock
    per-project + check merged_file đảm bảo CHỈ 1 ffmpeg chạy cho 1 project (trước đây 2 scene
    cùng thấy 'all done' -> 2 ffmpeg ghi đè cùng final.mp4 -> video cuối hỏng). Ghi ra file tạm
    rồi rename nguyên tử để người xem không bao giờ thấy file ghi dở."""
    from sqlalchemy import select
    from app.projects.models import Scene, SceneStatus, Project
    import tempfile, os
    async with _merge_lock(project_id):
        async with AsyncSessionLocal() as db:
            res = await db.execute(select(Scene).where(Scene.project_id == project_id))
            scenes = res.scalars().all()
            if not scenes or not all(s.status == SceneStatus.done for s in scenes):
                return
            proj0 = await db.get(Project, project_id)
            if proj0 and proj0.merged_file:   # đã ghép rồi -> bỏ qua (idempotent)
                return
            video_files = [s.video_file for s in sorted(scenes, key=lambda s: s.index) if s.video_file]
        if not video_files:
            return

        log.info("Auto-merging project %s (%d scenes)", project_id, len(video_files))
        out_name = f"final_{project_id[:8]}.mp4"
        out_path = UPLOAD_PATH / out_name
        tmp_path = UPLOAD_PATH / f"final_{project_id[:8]}.tmp.mp4"
        list_path = None
        try:
            with tempfile.NamedTemporaryFile(mode="w", suffix=".txt", delete=False, encoding="utf-8") as f:
                for vf in video_files:
                    f.write(f"file '{str(UPLOAD_PATH / vf)}'\n")
                list_path = f.name
            proc = await asyncio.create_subprocess_exec(
                "ffmpeg", "-y", "-f", "concat", "-safe", "0", "-i", list_path,
                # Video: copy (mọi cảnh cùng 720×1280 / 24fps / h264 → ghép lossless, nhanh).
                # Audio: PHẢI re-encode về 1 luồng AAC liền mạch. Concat "-c copy" nhiều file AAC
                # tạo frame hỏng ở mối nối (channel element not allocated / Invalid data) → pop /
                # mất tiếng trên web/mobile. -ar/-ac ép đồng nhất; +faststart cho phát web mượt.
                "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-ac", "2",
                "-movflags", "+faststart", str(tmp_path),
                stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE,
            )
            await asyncio.wait_for(proc.communicate(), timeout=600)
            if tmp_path.exists():
                os.replace(tmp_path, out_path)   # rename nguyên tử
                async with AsyncSessionLocal() as db:
                    proj = await db.get(Project, project_id)
                    if proj:
                        proj.merged_file = out_name
                        await db.commit()
                log.info("Auto-merge done: %s", out_name)
        except Exception as e:
            log.warning("Auto-merge failed: %s", e)
        finally:
            for p in (list_path, str(tmp_path)):
                try:
                    if p and os.path.exists(p):
                        os.remove(p)
                except OSError:
                    pass
