"""
Projects + Scenes router — full VEO MAX feature parity.
Supports: Auto Render, Manual prompt-only, Batch, Chain, I2V, Character pick, Import video.
"""
import json
import shutil
import uuid
from datetime import datetime, timezone
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from pydantic import BaseModel

from app.database import get_db
from app.auth.router import get_current_user
from app.auth.models import User
from app.projects.models import Project, Scene, SceneStatus
from app.characters.models import Character
from app.pipeline.runner import run_scene_job
from app.config import UPLOAD_PATH
from app import subscription

router = APIRouter(prefix="/projects", tags=["projects"])

CHAR_PATH = UPLOAD_PATH.parent / "images" / "chars"


async def _clone_chars_into_project(db: AsyncSession, user_id: str, char_ids: list[str], project_id: str) -> list[Character]:
    """Lai-model: copy nhân vật từ kho chung (hoặc bất kỳ) thành bản RIÊNG của project.
    Mỗi bản clone có project_id = project_id, dùng file ảnh copy riêng -> xoá project không đụng kho chung."""
    cloned: list[Character] = []
    for cid in dict.fromkeys(char_ids):  # unique, giữ thứ tự
        src = await db.get(Character, cid)
        if not src or src.user_id != user_id:
            continue
        # Đã thuộc đúng project rồi thì giữ nguyên
        if src.project_id == project_id:
            cloned.append(src)
            continue
        ext = Path(src.image_file).suffix or ".jpg"
        fname = f"{uuid.uuid4().hex[:12]}{ext}"
        srcp = CHAR_PATH / src.image_file
        if srcp.exists():
            shutil.copyfile(srcp, CHAR_PATH / fname)
        else:
            continue
        c = Character(user_id=user_id, name=src.name, image_file=fname, project_id=project_id)
        db.add(c)
        cloned.append(c)
    return cloned


# ── Schemas ───────────────────────────────────────────────────────────────────

class CreateProjectRequest(BaseModel):
    name: str
    idea: str | None = None
    style: str | None = None
    model_key: str = "veo_3_1_t2v_lite_low_priority"
    aspect_ratio: str = "16:9"
    duration_seconds: int = 8
    language: str = "vi"
    prompts: list[str] = []
    narrations: list[str] = []
    auto_render: bool = True        # False = manual (just save prompts, don't render)
    chain_mode: bool = False        # Each scene waits for prev, uses last frame as start
    character_names: list[str] = [] # chars to mention in prompts (for face-lock)
    character_ids: list[str] = []   # id nhân vật (kho chung) -> clone thành nhân vật riêng của project
    start_image: str | None = None  # I2V: uploaded image filename for all scenes
    voiceover: bool = False         # Auto lồng tiếng Việt (TTS đọc thoại + ghép)
    voice: str = "Kore"


class UpdateSceneRequest(BaseModel):
    prompt: str
    narration: str | None = None
    start_image: str | None = None


class SceneResponse(BaseModel):
    id: str
    index: int
    prompt: str
    narration: str | None
    status: str
    error_msg: str | None
    video_file: str | None
    aspect_ratio: str
    duration_seconds: int
    model_key: str
    start_image: str | None
    wait_for_prev: bool

    model_config = {"from_attributes": True}


class ProjectResponse(BaseModel):
    id: str
    name: str
    idea: str | None
    style: str | None
    model_key: str
    aspect_ratio: str
    duration_seconds: int
    language: str
    scene_count: int
    chain_mode: bool
    voiceover: bool = False
    voice: str = "Kore"
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ProjChar(BaseModel):
    id: str
    name: str
    image_url: str

    model_config = {"from_attributes": True}


class ProjectDetailResponse(ProjectResponse):
    scenes: list[SceneResponse] = []
    characters: list[ProjChar] = []


async def _project_chars(db: AsyncSession, project_id: str) -> list[ProjChar]:
    res = await db.execute(select(Character).where(Character.project_id == project_id))
    return [ProjChar(id=c.id, name=c.name, image_url=f"/images/chars/{c.image_file}") for c in res.scalars().all()]


# ── Helpers ────────────────────────────────────────────────────────────────────

def scene_to_resp(s: Scene) -> SceneResponse:
    return SceneResponse(
        id=s.id, index=s.index, prompt=s.prompt,
        narration=s.narration, status=s.status, error_msg=s.error_msg,
        video_file=s.video_file, aspect_ratio=s.aspect_ratio,
        duration_seconds=s.duration_seconds, model_key=s.model_key,
        start_image=s.start_image, wait_for_prev=s.wait_for_prev,
    )


def proj_to_resp(p: Project) -> ProjectResponse:
    return ProjectResponse(
        id=p.id, name=p.name, idea=p.idea, style=p.style,
        model_key=p.model_key, aspect_ratio=p.aspect_ratio,
        duration_seconds=p.duration_seconds, language=p.language,
        scene_count=p.scene_count, chain_mode=p.chain_mode,
        voiceover=bool(getattr(p, "voiceover", False)),
        voice=getattr(p, "voice", "Kore") or "Kore",
        created_at=p.created_at, updated_at=p.updated_at,
    )


# ── Routes ─────────────────────────────────────────────────────────────────────

@router.post("/", response_model=ProjectDetailResponse)
async def create_project(
    body: CreateProjectRequest,
    background_tasks: BackgroundTasks,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    subscription.ensure_can_generate(user)   # 402 nếu chưa có gói còn hạn
    if not user.google_connected and not user.gemini_api_key:
        raise HTTPException(400, "Cần kết nối Google Ultra hoặc Gemini API key")

    proj = Project(
        user_id=user.id, name=body.name, idea=body.idea,
        style=body.style, model_key=body.model_key,
        aspect_ratio=body.aspect_ratio, duration_seconds=body.duration_seconds,
        language=body.language, scene_count=len(body.prompts),
        chain_mode=body.chain_mode,
        voiceover=body.voiceover, voice=body.voice or "Kore",
    )
    db.add(proj)
    await db.flush()

    # Lai-model: clone nhân vật được chọn (kho chung) thành nhân vật riêng của project.
    # Phải xong TRƯỚC khi kick off auto-render để resolver @mention tìm được.
    if body.character_ids:
        await _clone_chars_into_project(db, user.id, body.character_ids, proj.id)

    scenes = []
    for i, p in enumerate(body.prompts):
        s = Scene(
            project_id=proj.id, user_id=user.id, index=i,
            prompt=p,
            narration=body.narrations[i] if i < len(body.narrations) else None,
            model_key=body.model_key,
            aspect_ratio=body.aspect_ratio,
            duration_seconds=body.duration_seconds,
            start_image=body.start_image,           # I2V: same start for all
            wait_for_prev=body.chain_mode and i > 0, # Chain: wait for previous
        )
        db.add(s)
        scenes.append(s)

    await db.commit()
    await db.refresh(proj)

    if body.auto_render:
        for s in scenes:
            await db.refresh(s)
            if body.chain_mode:
                # Chain: only kick off scene 0 immediately; rest will wait
                if s.index == 0:
                    background_tasks.add_task(run_scene_job, s.id, user.id)
                else:
                    background_tasks.add_task(run_scene_job, s.id, user.id)
            else:
                background_tasks.add_task(run_scene_job, s.id, user.id)

    return ProjectDetailResponse(
        **proj_to_resp(proj).__dict__,
        scenes=[scene_to_resp(s) for s in scenes],
        characters=await _project_chars(db, proj.id),
    )


@router.get("/", response_model=list[ProjectResponse])
async def list_projects(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    res = await db.execute(
        select(Project).where(Project.user_id == user.id)
        .order_by(desc(Project.updated_at)).limit(50)
    )
    return [proj_to_resp(p) for p in res.scalars().all()]


@router.get("/{project_id}", response_model=ProjectDetailResponse)
async def get_project(
    project_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    proj = await db.get(Project, project_id)
    if not proj or proj.user_id != user.id:
        raise HTTPException(404, "Không tìm thấy dự án")
    res = await db.execute(
        select(Scene).where(Scene.project_id == project_id).order_by(Scene.index)
    )
    scenes = res.scalars().all()
    return ProjectDetailResponse(
        **proj_to_resp(proj).__dict__,
        scenes=[scene_to_resp(s) for s in scenes],
        characters=await _project_chars(db, project_id),
    )


@router.delete("/{project_id}")
async def delete_project(
    project_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    proj = await db.get(Project, project_id)
    if not proj or proj.user_id != user.id:
        raise HTTPException(404, "Không tìm thấy dự án")
    # Dọn nhân vật riêng của project (clone) + file ảnh; KHÔNG đụng kho chung
    res = await db.execute(select(Character).where(Character.project_id == project_id))
    for c in res.scalars().all():
        fp = CHAR_PATH / c.image_file
        if fp.exists():
            fp.unlink()
        await db.delete(c)
    # Dọn scenes (không có ON DELETE CASCADE)
    res = await db.execute(select(Scene).where(Scene.project_id == project_id))
    for s in res.scalars().all():
        await db.delete(s)
    await db.delete(proj)
    await db.commit()
    return {"ok": True}


@router.put("/{project_id}/scenes/{scene_id}", response_model=SceneResponse)
async def update_scene(
    project_id: str, scene_id: str,
    body: UpdateSceneRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    scene = await db.get(Scene, scene_id)
    if not scene or scene.project_id != project_id or scene.user_id != user.id:
        raise HTTPException(404, "Không tìm thấy scene")
    scene.prompt = body.prompt
    if body.narration is not None:
        scene.narration = body.narration
    if body.start_image is not None:
        scene.start_image = body.start_image
    await db.commit()
    return scene_to_resp(scene)


@router.post("/{project_id}/scenes/{scene_id}/rerender")
async def rerender_scene(
    project_id: str, scene_id: str,
    background_tasks: BackgroundTasks,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    scene = await db.get(Scene, scene_id)
    if not scene or scene.project_id != project_id or scene.user_id != user.id:
        raise HTTPException(404, "Không tìm thấy scene")
    subscription.ensure_can_generate(user)
    scene.status = SceneStatus.pending
    scene.error_msg = None
    await db.commit()
    background_tasks.add_task(run_scene_job, scene_id, user.id)
    return {"ok": True}


@router.post("/{project_id}/scenes/{scene_id}/render")
async def render_scene(
    project_id: str, scene_id: str,
    background_tasks: BackgroundTasks,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Manually trigger render for a scene (for manual-mode projects)."""
    scene = await db.get(Scene, scene_id)
    if not scene or scene.project_id != project_id or scene.user_id != user.id:
        raise HTTPException(404, "Không tìm thấy scene")
    if scene.status == SceneStatus.processing:
        raise HTTPException(400, "Scene đang được render")
    subscription.ensure_can_generate(user)
    scene.status = SceneStatus.pending
    scene.error_msg = None
    await db.commit()
    background_tasks.add_task(run_scene_job, scene_id, user.id)
    return {"ok": True}


@router.post("/{project_id}/scenes/{scene_id}/import-video")
async def import_video(
    project_id: str, scene_id: str,
    video: UploadFile = File(...),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Upload a video file manually for a scene (replaces rendered video)."""
    scene = await db.get(Scene, scene_id)
    if not scene or scene.project_id != project_id or scene.user_id != user.id:
        raise HTTPException(404, "Không tìm thấy scene")

    ext = Path(video.filename or "video.mp4").suffix or ".mp4"
    fname = f"scene_{scene_id[:8]}_import{ext}"
    fpath = UPLOAD_PATH / fname
    with open(fpath, "wb") as f:
        shutil.copyfileobj(video.file, f)

    scene.video_file = fname
    scene.status = SceneStatus.done
    scene.error_msg = None
    await db.commit()
    return {"ok": True, "video_file": fname}


@router.post("/{project_id}/scenes/{scene_id}/set-start-image")
async def set_start_image(
    project_id: str, scene_id: str,
    image: UploadFile = File(...),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Upload a start image for I2V on a specific scene."""
    scene = await db.get(Scene, scene_id)
    if not scene or scene.project_id != project_id or scene.user_id != user.id:
        raise HTTPException(404, "Không tìm thấy scene")

    ext = Path(image.filename or "img.jpg").suffix or ".jpg"
    fname = f"i2v_{scene_id[:8]}{ext}"
    fpath = UPLOAD_PATH / fname
    with open(fpath, "wb") as f:
        shutil.copyfileobj(image.file, f)

    scene.start_image = fname
    await db.commit()
    return {"ok": True, "start_image": fname}


@router.get("/{project_id}/export-prompts")
async def export_prompts(
    project_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    proj = await db.get(Project, project_id)
    if not proj or proj.user_id != user.id:
        raise HTTPException(404, "Không tìm thấy dự án")
    res = await db.execute(
        select(Scene).where(Scene.project_id == project_id).order_by(Scene.index)
    )
    scenes = res.scalars().all()
    lines = [f"=== {proj.name} ===\n"]
    for s in scenes:
        lines.append(f"\n--- Scene {s.index + 1} ---")
        lines.append(s.prompt)
        if s.narration:
            lines.append(f"[Narration: {s.narration}]")
    return {"text": "\n".join(lines), "scene_count": len(scenes)}
