"""Media extras: ZIP download for project, thumbnail gen, shared video view."""
import io
import logging
import re
import uuid
import zipfile
from pathlib import Path
from urllib.parse import urlparse

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import FileResponse, StreamingResponse
from pydantic import BaseModel, Field

from app.database import AsyncSessionLocal
from app.auth.router import get_current_user
from app.auth.models import User
from app.config import UPLOAD_PATH
from app.security import (
    client_ip,
    check_media_filename,
    host_is_public,
    resolve_within,
    ffmpeg_run,
    yt_dlp_run,
    rate_limit,
    verify_share_token,
)

log = logging.getLogger("veo3.media2")
router = APIRouter(prefix="/media", tags=["media"])
public_router = APIRouter(tags=["media"])

MERGED_PATH = UPLOAD_PATH.parent / "merged"
MERGED_PATH.mkdir(parents=True, exist_ok=True)
THUMB_PATH = UPLOAD_PATH.parent / "thumbnails"
THUMB_PATH.mkdir(parents=True, exist_ok=True)


# ── Shared video (no auth) ────────────────────────────────────────────────────

@public_router.get("/shared/{token}", include_in_schema=False)
async def view_shared(token: str, request: Request):
    # Rate-limit theo IP để chống scrape: 60 lượt/phút.
    ip = client_ip(request)
    rate_limit(f"shared:{ip}", limit=60, window=60)

    video_file = verify_share_token(token)
    fpath = resolve_within(UPLOAD_PATH, video_file)
    if not fpath.exists():
        raise HTTPException(404, "File không tồn tại")
    return FileResponse(str(fpath), media_type="video/mp4")


# ── ZIP download project ──────────────────────────────────────────────────────

@router.get("/project/{project_id}/zip")
async def download_project_zip(
    project_id: str,
    user: User = Depends(get_current_user),
):
    from app.projects.models import Project, Scene, SceneStatus
    from sqlalchemy import select
    async with AsyncSessionLocal() as db:
        proj = await db.get(Project, project_id)
        if not proj or proj.user_id != user.id:
            raise HTTPException(404, "Không tìm thấy dự án")
        res = await db.execute(
            select(Scene).where(
                Scene.project_id == project_id,
                Scene.status == SceneStatus.done
            ).order_by(Scene.index)
        )
        scenes = res.scalars().all()

    if not scenes:
        raise HTTPException(400, "Chưa có scene nào hoàn thành")

    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        for s in scenes:
            if s.video_file:
                try:
                    fpath = resolve_within(UPLOAD_PATH, s.video_file)
                except HTTPException:
                    continue
                if fpath.exists():
                    zf.write(fpath, f"scene_{s.index + 1:02d}.mp4")
    buf.seek(0)
    safe_name = re.sub(r"[^A-Za-z0-9._-]+", "_", proj.name or "project")[:80]
    zip_name = f"{safe_name}_videos.zip"
    return StreamingResponse(
        buf,
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="{zip_name}"'},
    )


# ── Thumbnail generation ──────────────────────────────────────────────────────

@router.post("/thumbnail")
async def gen_thumbnail(
    payload: dict,
    user: User = Depends(get_current_user),
):
    """Extract first frame of a video as thumbnail.
    Chỉ cho phép tên file nằm trong UPLOAD_PATH và thuộc user gọi."""
    video_file = payload.get("video_file", "")
    if not video_file:
        raise HTTPException(400, "video_file required")
    # Path traversal fix: verify tên file + resolve trong UPLOAD_PATH.
    check_media_filename(video_file)
    src = resolve_within(UPLOAD_PATH, video_file)
    if not src.exists():
        raise HTTPException(404, "File không tồn tại")

    # Ownership: file phải thuộc scene của user (hoặc là merged_file của project user).
    from app.projects.models import Scene, Project
    from sqlalchemy import select
    async with AsyncSessionLocal() as db:
        owns = (await db.execute(
            select(Scene.id)
            .join(Project, Project.id == Scene.project_id)
            .where(Project.user_id == user.id, Scene.video_file == video_file)
            .limit(1)
        )).first()
        if not owns:
            owns = (await db.execute(
                select(Project.id).where(Project.user_id == user.id, Project.merged_file == video_file).limit(1)
            )).first()
        if not owns:
            raise HTTPException(403, "Không có quyền với file này")

    thumb_name = video_file.rsplit(".", 1)[0] + "_thumb.jpg"
    thumb_path = THUMB_PATH / thumb_name
    if not thumb_path.exists():
        rc, _out, err = await ffmpeg_run(
            ["-y", "-i", str(src), "-vframes", "1", "-q:v", "3", str(thumb_path)],
            timeout=30,
        )
        if rc != 0:
            log.warning("thumbnail ffmpeg failed: %s", err[-200:])
    if not thumb_path.exists():
        raise HTTPException(500, "Tạo thumbnail thất bại")
    return {"thumbnail_url": f"/thumbnails/{thumb_name}"}


# ── Merge + Cut + Download + Credits ──────────────────────────────────────────

class MergeRequest(BaseModel):
    project_id: str
    part: int | None = None


@router.post("/merge")
async def merge_project(body: MergeRequest, user: User = Depends(get_current_user)):
    from app.projects.models import Project, Scene, SceneStatus
    from sqlalchemy import select
    async with AsyncSessionLocal() as db:
        proj = await db.get(Project, body.project_id)
        if not proj or proj.user_id != user.id:
            raise HTTPException(404, "Không tìm thấy dự án")
        res = await db.execute(
            select(Scene).where(Scene.project_id == body.project_id, Scene.status == SceneStatus.done)
            .order_by(Scene.index)
        )
        scenes = res.scalars().all()

    if body.part is not None:
        scenes = [s for s in scenes if (getattr(s, "part", 1) or 1) == body.part]

    if not scenes:
        raise HTTPException(400, "Chưa có scene nào hoàn thành")

    video_files: list[Path] = []
    for s in scenes:
        if not s.video_file:
            continue
        try:
            video_files.append(resolve_within(UPLOAD_PATH, s.video_file))
        except HTTPException:
            log.warning("merge: skip suspicious video_file=%r on scene %s", s.video_file, s.id)
    missing = [str(f) for f in video_files if not f.exists()]
    if missing:
        raise HTTPException(400, f"File không tồn tại: {missing[:2]}")

    out_name = f"final_{body.project_id[:8]}_{uuid.uuid4().hex[:6]}.mp4"
    out_path = MERGED_PATH / out_name
    concat_file = MERGED_PATH / f"concat_{uuid.uuid4().hex[:8]}.txt"
    try:
        with open(concat_file, "w", encoding="utf-8") as f:
            for vf in video_files:
                f.write(f"file '{vf.as_posix()}'\n")
        rc, _out, err = await ffmpeg_run(
            ["-y", "-f", "concat", "-safe", "0", "-i", str(concat_file),
             # Audio re-encode → 1 luồng AAC sạch (concat "-c copy" nhiều AAC = frame hỏng ở mối
             # nối → pop/mất tiếng). Video copy vì mọi cảnh cùng thông số. +faststart cho web.
             "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-ac", "2",
             "-movflags", "+faststart", str(out_path)],
            timeout=300,
        )
        if rc != 0:
            log.warning("merge ffmpeg fail rc=%s err=%s", rc, err[-200:])
            raise HTTPException(500, "Ghép video thất bại")

        # Cập nhật proj.merged_file để nút "Tải về" trả đúng file mới nhất
        # (copy vào UPLOAD_PATH vì download-merged serve từ UPLOAD_PATH)
        import shutil
        upload_copy = UPLOAD_PATH / out_name
        shutil.copy2(out_path, upload_copy)

        # Chỉ cập nhật proj.merged_file nếu ghép TOÀN BỘ phim (không phải ghép phần)
        if body.part is None:
            async with AsyncSessionLocal() as db2:
                proj2 = await db2.get(Project, body.project_id)
                if proj2:
                    # Xoá file ghép cũ (nếu tên hợp lệ)
                    if proj2.merged_file and proj2.merged_file != out_name:
                        try:
                            check_media_filename(proj2.merged_file)
                            for old_dir in (UPLOAD_PATH, MERGED_PATH):
                                old_f = old_dir / proj2.merged_file
                                if old_f.exists():
                                    try:
                                        old_f.unlink()
                                    except OSError:
                                        pass
                        except HTTPException:
                            pass
                    proj2.merged_file = out_name
                    await db2.commit()
        return {"ok": True, "filename": out_name, "url": f"/merged/{out_name}"}
    finally:
        if concat_file.exists():
            try:
                concat_file.unlink()
            except OSError:
                pass


class CutRequest(BaseModel):
    filename: str = Field(..., max_length=200)
    mode: str = "split"
    segment: int = Field(8, ge=1, le=600)
    fps: int = Field(1, ge=1, le=60)


@router.post("/cut")
async def cut_video(body: CutRequest, user: User = Depends(get_current_user)):
    # Path traversal fix + ownership check.
    check_media_filename(body.filename)
    src = resolve_within(UPLOAD_PATH, body.filename)
    if not src.exists():
        raise HTTPException(404, "File không tồn tại")

    from app.projects.models import Scene, Project
    from sqlalchemy import select
    async with AsyncSessionLocal() as db:
        owns = (await db.execute(
            select(Scene.id)
            .join(Project, Project.id == Scene.project_id)
            .where(Project.user_id == user.id, Scene.video_file == body.filename)
            .limit(1)
        )).first()
        if not owns:
            owns = (await db.execute(
                select(Project.id).where(Project.user_id == user.id, Project.merged_file == body.filename).limit(1)
            )).first()
        if not owns:
            raise HTTPException(403, "Không có quyền với file này")

    if body.mode not in ("split", "frames"):
        raise HTTPException(400, "mode phải là 'split' hoặc 'frames'")

    out_dir = UPLOAD_PATH / f"cut_{uuid.uuid4().hex[:8]}"
    out_dir.mkdir(parents=True)
    if body.mode == "frames":
        pattern = str(out_dir / "frame_%04d.jpg")
        cmd = ["-y", "-i", str(src), "-vf", f"fps={body.fps}", pattern]
    else:
        pattern = str(out_dir / "seg_%03d.mp4")
        cmd = ["-y", "-i", str(src), "-c", "copy", "-map", "0",
               "-segment_time", str(body.segment), "-f", "segment", "-reset_timestamps", "1", pattern]
    rc, _out, err = await ffmpeg_run(cmd, timeout=180)
    if rc != 0:
        log.warning("cut ffmpeg fail rc=%s err=%s", rc, err[-200:])
        raise HTTPException(500, "Cắt video thất bại")
    files = sorted(out_dir.iterdir())
    return {"ok": True, "count": len(files), "files": [f"/uploads/{out_dir.name}/{f.name}" for f in files]}


class DownloadRequest(BaseModel):
    url: str = Field(..., max_length=2000)
    quality: str = Field("best[ext=mp4]", max_length=100)


_DOWNLOAD_ALLOWED_HOSTS = (
    "youtube.com", "youtu.be", "tiktok.com", "facebook.com", "fb.watch",
    "instagram.com", "vimeo.com", "twitter.com", "x.com",
)


def _download_host_allowed(host: str) -> bool:
    h = (host or "").lower()
    return any(h == d or h.endswith("." + d) for d in _DOWNLOAD_ALLOWED_HOSTS)


# yt-dlp quality string chỉ cho phép các ký tự an toàn (không có shell meta).
_QUALITY_RE = re.compile(r"^[A-Za-z0-9\[\]=+/,.<>*_() -]{1,100}$")


@router.post("/download-url")
async def download_from_url(
    body: DownloadRequest,
    user: User = Depends(get_current_user),
):
    # Rate-limit theo user: 5 lượt/phút, 30/giờ.
    rate_limit(f"dl-url:{user.id}", limit=5, window=60)
    rate_limit(f"dl-url-h:{user.id}", limit=30, window=3600)

    # SSRF hardening: allowlist host + IP public + scheme.
    parsed = urlparse(body.url.strip())
    if parsed.scheme not in ("http", "https") or not parsed.hostname:
        raise HTTPException(400, "URL không hợp lệ")
    if not _download_host_allowed(parsed.hostname):
        raise HTTPException(400, "Chỉ hỗ trợ link YouTube / TikTok / Facebook / Instagram / Vimeo / Twitter")
    if not host_is_public(parsed.hostname):
        raise HTTPException(400, "URL không hợp lệ")

    if not _QUALITY_RE.match(body.quality or ""):
        raise HTTPException(400, "Quality string không hợp lệ")

    out_name = f"dl_{uuid.uuid4().hex[:10]}.mp4"
    out_path = UPLOAD_PATH / out_name
    rc, _out, err = await yt_dlp_run(
        ["-f", body.quality, "--no-playlist", "--merge-output-format", "mp4",
         "-o", str(out_path), body.url],
        timeout=300,
    )
    if rc != 0:
        log.warning("yt-dlp fail rc=%s err=%s", rc, err[-300:])
        # KHÔNG echo stderr ra client (có thể chứa URL nội bộ / cookie).
        raise HTTPException(400, "Không tải được video từ link này")
    return {"ok": True, "filename": out_name, "url": f"/uploads/{out_name}"}


@router.get("/credits")
async def get_credits(user: User = Depends(get_current_user)):
    if not user.google_cookies:
        return {"credits": None, "error": "Chưa kết nối Google Ultra"}
    from app.crypto import dec
    try:
        cookies = dec(user.google_cookies)
    except Exception:
        return {"credits": None, "error": "Cookie đã hỏng, vui lòng kết nối lại"}
    try:
        from app.pipeline.runner import _get_bearer_token
        bearer = await _get_bearer_token(cookies)
        if not bearer:
            return {"credits": None, "error": "Không lấy được token"}
        async with httpx.AsyncClient(timeout=10) as client:
            r = await client.get(
                "https://aisandbox-pa.googleapis.com/v1/credits",
                headers={"Authorization": f"Bearer {bearer}", "Cookie": cookies},
            )
            if r.status_code == 200:
                data = r.json()
                return {"credits": data.get("credits") or data.get("balance") or data.get("remainingCredits")}
            return {"credits": None, "error": f"API {r.status_code}"}
    except Exception:
        # KHÔNG echo str(e) — có thể lộ URL Google / bearer.
        log.exception("get_credits error")
        return {"credits": None, "error": "Không truy vấn được credits"}
