from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse

from app.config import settings, UPLOAD_PATH
from app.database import init_db
from app.auth.router import router as auth_router
from app.auth.profile import router as profile_router
from app.videos.router import router as videos_router
from app.sessions.router import router as sessions_router
from app.projects.router import router as projects_router
from app.tools.router import router as tools_router
from app.characters.router import router as characters_router
from app.media.router import router as media_router
from app.admin.router import router as admin_router
from app.billing.router import router as billing_router
from app.affiliate_router import router as affiliate_router
from app.auth.router import get_current_user

IMG_PATH = UPLOAD_PATH.parent / "images"
AUDIO_PATH = UPLOAD_PATH.parent / "audio"
MERGED_PATH = UPLOAD_PATH.parent / "merged"
THUMB_PATH = UPLOAD_PATH.parent / "thumbnails"
CHAR_PATH = IMG_PATH / "chars"
for p in [IMG_PATH, AUDIO_PATH, MERGED_PATH, THUMB_PATH, CHAR_PATH]:
    p.mkdir(parents=True, exist_ok=True)


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    from app.sessions.router import start_captcha_bus
    await start_captcha_bus()   # cross-process captcha bridge (no-op without Redis)
    # Phục hồi scene mồ côi: worker trước bị deploy/kill giữa chừng -> scene kẹt 'processing'.
    try:
        from app.pipeline.runner import recover_orphan_scenes
        await recover_orphan_scenes()
    except Exception as e:
        import logging
        logging.getLogger("veo3").warning("recover_orphan_scenes failed: %s", e)
    import asyncio
    renew_task = asyncio.create_task(_auto_renew_loop())
    try:
        yield
    finally:
        renew_task.cancel()


async def _auto_renew_loop():
    """Mỗi 30 phút: gia hạn gói từ ví cho user bật auto-renew & sắp hết hạn."""
    import asyncio, logging
    from app.database import AsyncSessionLocal
    from app.auth.models import User
    from app.billing import gateway
    from sqlalchemy import select
    log = logging.getLogger("veo3.autorenew")
    while True:
        try:
            await asyncio.sleep(1800)
            async with AsyncSessionLocal() as db0:
                ids = (await db0.execute(
                    select(User.id).where(User.auto_renew == True, User.plan != "free")  # noqa: E712
                )).scalars().all()
            # Mỗi user 1 session riêng: lỗi 1 user không làm hỏng cả lượt; vòng lặp đơn
            # luồng nên không có 2 lần gia hạn song song cùng 1 user (đây là path DUY NHẤT).
            for uid in ids:
                try:
                    async with AsyncSessionLocal() as db:
                        u = await db.get(User, uid)
                        if u:
                            await gateway.maybe_auto_renew(db, u)
                except Exception as e:
                    log.warning("auto-renew %s failed: %s", uid, e)
        except asyncio.CancelledError:
            break
        except Exception as e:
            log.warning("auto-renew loop error: %s", e)


app = FastAPI(title="VEO3 Web API", version="2.0.0", lifespan=lifespan)

_origins = [settings.frontend_url, "http://localhost:5173", "http://localhost:3000"]
_origins += [o.strip() for o in settings.cors_origins.split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=sorted(set(_origins)),
    allow_credentials=True, allow_methods=["*"], allow_headers=["*"],
)

# Check banned middleware
@app.middleware("http")
async def ban_check(request: Request, call_next):
    # Skip auth/public endpoints
    path = request.url.path
    if path.startswith("/api/v1/auth") or path.startswith("/media/shared") or not path.startswith("/api"):
        return await call_next(request)
    response = await call_next(request)
    return response

# API Routers
for r in [auth_router, profile_router, videos_router, projects_router,
          tools_router, characters_router, media_router, admin_router, billing_router,
          affiliate_router]:
    app.include_router(r, prefix="/api/v1")
app.include_router(sessions_router)  # WebSocket /ws/extension

# Shared video (no prefix)
@app.get("/shared/{token}", include_in_schema=False)
async def shared_video(token: str):
    from app.auth.profile import _share_tokens
    from fastapi.responses import FileResponse
    video_file = _share_tokens.get(token)
    if not video_file:
        from fastapi import HTTPException
        raise HTTPException(404, "Link không hợp lệ")
    fpath = UPLOAD_PATH / video_file
    if not fpath.exists():
        from fastapi import HTTPException
        raise HTTPException(404, "File không tồn tại")
    return FileResponse(str(fpath), media_type="video/mp4")

# Static files
app.mount("/uploads", StaticFiles(directory=str(UPLOAD_PATH)), name="uploads")
app.mount("/images", StaticFiles(directory=str(IMG_PATH)), name="images")
app.mount("/audio", StaticFiles(directory=str(AUDIO_PATH)), name="audio")
app.mount("/merged", StaticFiles(directory=str(MERGED_PATH)), name="merged")
app.mount("/thumbnails", StaticFiles(directory=str(THUMB_PATH)), name="thumbnails")


@app.get("/api/v1/health")
async def health():
    return {"ok": True, "version": "2.0.0"}


@app.get("/api/v1/extension-status")
async def extension_status_ep(user=Depends(get_current_user)):
    """Trạng thái extension của user (Dashboard poll — KHÔNG mở WS để tránh chiếm kết nối extension)."""
    from app.sessions.router import get_extension_status
    return get_extension_status(user.id)


@app.get("/api/v1/extension/download")
async def download_extension():
    """Tải tiện ích Chrome (zip thư mục extension/ ngay lúc gọi -> luôn bản mới nhất). Public, không cần auth."""
    import io, zipfile
    from pathlib import Path
    from fastapi.responses import StreamingResponse
    from fastapi import HTTPException
    ext_dir = Path(__file__).resolve().parents[2] / "extension"   # <repo>/extension
    if not ext_dir.is_dir():
        raise HTTPException(404, "Không tìm thấy thư mục extension")
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        for p in ext_dir.rglob("*"):
            if p.is_file() and "node_modules" not in p.parts and not p.name.startswith("."):
                zf.write(p, p.relative_to(ext_dir.parent).as_posix())
    buf.seek(0)
    return StreamingResponse(
        buf, media_type="application/zip",
        headers={"Content-Disposition": 'attachment; filename="ai-autocut-extension.zip"'},
    )


@app.get("/api/v1/status")
async def system_status():
    """Worker status — polled by frontend every 5s."""
    from app.pipeline.runner import active_workers
    from app.database import AsyncSessionLocal
    from app.projects.models import Scene, SceneStatus
    from app.videos.models import VideoJob, JobStatus
    from sqlalchemy import select, func

    async with AsyncSessionLocal() as db:
        scene_q = await db.execute(
            select(func.count()).where(Scene.status == SceneStatus.processing)
        )
        job_q = await db.execute(
            select(func.count()).where(VideoJob.status == JobStatus.processing)
        )
        pending_q = await db.execute(
            select(func.count()).where(Scene.status == SceneStatus.pending)
        )
        processing_scenes = scene_q.scalar() or 0
        processing_jobs = job_q.scalar() or 0
        pending_scenes = pending_q.scalar() or 0

    return {
        "active_workers": active_workers,
        "processing": processing_scenes + processing_jobs,
        "pending": pending_scenes,
    }
