"""Media extras: ZIP download for project, thumbnail gen, shared video view."""
import asyncio
import io
import zipfile
import logging
import uuid
from pathlib import Path

import httpx
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse, StreamingResponse, Response
from pydantic import BaseModel

from app.database import get_db, AsyncSessionLocal
from app.auth.router import get_current_user
from app.auth.models import User
from app.config import UPLOAD_PATH
from app.auth.profile import _share_tokens

log = logging.getLogger("veo3.media2")
router = APIRouter(prefix="/media", tags=["media"])

MERGED_PATH = UPLOAD_PATH.parent / "merged"
MERGED_PATH.mkdir(parents=True, exist_ok=True)
THUMB_PATH = UPLOAD_PATH.parent / "thumbnails"
THUMB_PATH.mkdir(parents=True, exist_ok=True)


# ── Shared video (no auth) ────────────────────────────────────────────────────

@router.get("/shared/{token}", include_in_schema=False)
async def view_shared(token: str):
    video_file = _share_tokens.get(token)
    if not video_file:
        raise HTTPException(404, "Link không hợp lệ hoặc đã hết hạn")
    fpath = UPLOAD_PATH / video_file
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
                fpath = UPLOAD_PATH / s.video_file
                if fpath.exists():
                    zf.write(fpath, f"scene_{s.index + 1:02d}.mp4")
    buf.seek(0)
    zip_name = f"{proj.name.replace(' ', '_')}_videos.zip"
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
    """Extract first frame of a video as thumbnail."""
    video_file = payload.get("video_file", "")
    if not video_file:
        raise HTTPException(400, "video_file required")
    src = UPLOAD_PATH / video_file
    if not src.exists():
        raise HTTPException(404, "File không tồn tại")
    thumb_name = video_file.rsplit(".", 1)[0] + "_thumb.jpg"
    thumb_path = THUMB_PATH / thumb_name
    if not thumb_path.exists():
        proc = await asyncio.create_subprocess_exec(
            "ffmpeg", "-y", "-i", str(src),
            "-vframes", "1", "-q:v", "3", str(thumb_path),
            stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE,
        )
        await asyncio.wait_for(proc.communicate(), timeout=30)
    if not thumb_path.exists():
        raise HTTPException(500, "Tạo thumbnail thất bại")
    return {"thumbnail_url": f"/thumbnails/{thumb_name}"}


# ── Merge + Cut + Download + Credits (moved from media/router.py) ─────────────

class MergeRequest(BaseModel):
    project_id: str


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

    if not scenes:
        raise HTTPException(400, "Chưa có scene nào hoàn thành")
    video_files = [UPLOAD_PATH / s.video_file for s in scenes if s.video_file]
    missing = [str(f) for f in video_files if not f.exists()]
    if missing:
        raise HTTPException(400, f"File không tồn tại: {missing[:2]}")

    out_name = f"final_{body.project_id[:8]}_{uuid.uuid4().hex[:6]}.mp4"
    out_path = MERGED_PATH / out_name
    concat_file = MERGED_PATH / f"concat_{uuid.uuid4().hex[:8]}.txt"
    try:
        with open(concat_file, "w") as f:
            for vf in video_files:
                f.write(f"file '{vf.as_posix()}'\n")
        proc = await asyncio.create_subprocess_exec(
            "ffmpeg", "-y", "-f", "concat", "-safe", "0",
            "-i", str(concat_file), "-c", "copy", str(out_path),
            stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE,
        )
        _, stderr = await asyncio.wait_for(proc.communicate(), timeout=300)
        if proc.returncode != 0:
            raise HTTPException(500, f"FFmpeg: {stderr.decode()[-300:]}")
        return {"ok": True, "filename": out_name, "url": f"/merged/{out_name}"}
    finally:
        if concat_file.exists():
            concat_file.unlink()


class CutRequest(BaseModel):
    filename: str
    mode: str = "split"
    segment: int = 8
    fps: int = 1


@router.post("/cut")
async def cut_video(body: CutRequest, user: User = Depends(get_current_user)):
    src = UPLOAD_PATH / body.filename
    if not src.exists():
        raise HTTPException(404, "File không tồn tại")
    out_dir = UPLOAD_PATH / f"cut_{uuid.uuid4().hex[:8]}"
    out_dir.mkdir(parents=True)
    if body.mode == "frames":
        pattern = str(out_dir / "frame_%04d.jpg")
        cmd = ["ffmpeg", "-y", "-i", str(src), "-vf", f"fps={body.fps}", pattern]
    else:
        pattern = str(out_dir / "seg_%03d.mp4")
        cmd = ["ffmpeg", "-y", "-i", str(src), "-c", "copy", "-map", "0",
               "-segment_time", str(body.segment), "-f", "segment", "-reset_timestamps", "1", pattern]
    proc = await asyncio.create_subprocess_exec(*cmd, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE)
    _, stderr = await asyncio.wait_for(proc.communicate(), timeout=120)
    if proc.returncode != 0:
        raise HTTPException(500, f"FFmpeg: {stderr.decode()[-300:]}")
    files = sorted(out_dir.iterdir())
    return {"ok": True, "count": len(files), "files": [f"/uploads/{out_dir.name}/{f.name}" for f in files]}


class DownloadRequest(BaseModel):
    url: str
    quality: str = "best[ext=mp4]"


@router.post("/download-url")
async def download_from_url(body: DownloadRequest, user: User = Depends(get_current_user)):
    out_name = f"dl_{uuid.uuid4().hex[:10]}.mp4"
    out_path = UPLOAD_PATH / out_name
    cmd = ["yt-dlp", "-f", body.quality, "--no-playlist", "--merge-output-format", "mp4",
           "-o", str(out_path), body.url]
    proc = await asyncio.create_subprocess_exec(*cmd, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE)
    _, stderr = await asyncio.wait_for(proc.communicate(), timeout=300)
    if proc.returncode != 0:
        raise HTTPException(500, f"yt-dlp: {stderr.decode()[-300:]}")
    return {"ok": True, "filename": out_name, "url": f"/uploads/{out_name}"}


@router.get("/credits")
async def get_credits(user: User = Depends(get_current_user)):
    if not user.google_cookies:
        return {"credits": None, "error": "Chưa kết nối Google Ultra"}
    from app.crypto import dec
    cookies = dec(user.google_cookies)
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
    except Exception as e:
        return {"credits": None, "error": str(e)}
