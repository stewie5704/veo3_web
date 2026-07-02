"""
Projects + Scenes router — full VEO MAX feature parity.
Supports: Auto Render, Manual prompt-only, Batch, Chain, I2V, Character pick, Import video.
"""
import json
import random
import shutil
import uuid
import asyncio
import logging
from datetime import datetime, timezone
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, UploadFile, File
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc, delete
from pydantic import BaseModel

from app.database import get_db, AsyncSessionLocal
from app.auth.router import get_current_user
from app.auth.models import User
from app.projects.models import Project, Scene, SceneStatus
from app.characters.models import Character
from app.pipeline.runner import dispatch_scene, generate_images_flow, _try_auto_merge
from app.styles_catalog import style_description
from app.config import UPLOAD_PATH
from app.crypto import dec
from app import subscription

router = APIRouter(prefix="/projects", tags=["projects"])
log = logging.getLogger("veo3.projects")

CHAR_PATH = UPLOAD_PATH.parent / "images" / "chars"


def build_portrait_prompt(c: dict, style_desc: str = "", nationality: str = "") -> str:
    """Prompt sinh CHÂN DUNG AI cho 1 nhân vật (từ bible) — dùng làm reference giữ mặt.
    style_desc = phong cách dự án (realistic/3D…). nationality = quốc tịch ÉP theo ngôn ngữ (vd "Vietnamese")
    -> ảnh chân dung (ref khoá mặt) ra ĐÚNG người Việt, hết cảnh 'chọn tiếng Việt mà ra mặt Tây'."""
    g = lambda k: str(c.get(k, "") or "").strip()
    bits = [x for x in (
        g("anchor"), g("age"), g("gender_presentation"), g("face"), g("eyes"),
        (f"{g('hair')} hair" if g("hair") else ""), (f"{g('skin_tone')} skin" if g("skin_tone") else ""),
        g("build") or g("body_metrics")) if x]
    wear = ", ".join(x for x in (g("wardrobe_top"), g("wardrobe_bottom"), g("footwear"),
                                 g("headwear"), g("accessories")) if x)
    if wear:
        bits.append("wearing " + wear)
    if g("distinguishing_marks"):
        bits.append("distinguishing marks: " + g("distinguishing_marks"))
    desc = ", ".join(bits)
    # Look theo style dự án; mặc định (không chọn style) = ẢNH THẬT, KHÔNG 3D.
    look = style_desc.strip() or (
        "Photorealistic real photograph, natural skin texture, shot on DSLR 85mm, soft studio light. "
        "NOT 3D, NOT CGI, NOT illustration, NOT cartoon.")
    nat = nationality.strip()
    who = f" of a {nat} person" if nat else ""
    nat_lock = f" Ethnicity: {nat}, authentic {nat} facial features (East Asian)." if nat else ""
    return ("Character reference portrait" + who + ", single subject, front-facing, head and shoulders, neutral "
            "studio lighting, plain light-grey background. " + (desc + ". " if desc else "") +
            "Consistent wardrobe." + nat_lock + " Style: " + look + " No text, no watermark, no logo.")


_portrait_inflight: set[str] = set()   # project_id đang sinh chân dung -> single-flight, chống tạo Character trùng

async def _gen_portraits_for_bible(project_db_id: str, user_id: str, bible: list) -> int:
    """Sinh CHÂN DUNG AI cho MỖI nhân vật trong bible CHƯA có Character (khớp tên bằng _norm_name — ĐÚNG
    chuẩn hoá của cast-lock) -> lưu Character(project). Nhân vật đã có ảnh (upload/clone/sinh trước) giữ
    NGUYÊN. Trả số chân dung vừa tạo. Cần Google (cookies+gproj); thiếu -> 0 (fallback text-only).
    Single-flight theo project: nếu đang chạy cho project này thì bỏ qua (tránh đua tạo Character trùng tên)."""
    from ..tools.router import _norm_name   # cùng chuẩn hoá tên với cast-lock (NFC + bỏ dấu câu + casefold)
    if project_db_id in _portrait_inflight:
        return 0
    _portrait_inflight.add(project_db_id)
    made = 0
    try:
        async with AsyncSessionLocal() as db:
            user = await db.get(User, user_id)
            cookies = (dec(user.google_cookies) if user and user.google_cookies else "") or ""
            gproj = (user.google_project_id if user else "") or ""
            res = await db.execute(select(Character).where(Character.project_id == project_db_id))
            existing = {_norm_name(c.name) for c in res.scalars().all()}
            proj = await db.get(Project, project_db_id)
            style_desc = style_description(proj.style if proj else None)   # chân dung sinh theo style dự án
            nat = "Vietnamese" if (proj and (proj.language or "vi") == "vi") else ""   # ép quốc tịch khớp ngôn ngữ
        # nhân vật còn thiếu ảnh, khử trùng tên NGAY trong lô (tránh sinh 2 lần cùng người)
        need: list[dict] = []
        seen = set(existing)
        for c in (bible or []):
            if not isinstance(c, dict):
                continue
            nm = str(c.get("name") or "").strip()
            nk = _norm_name(nm)
            if nm and nk not in seen:
                seen.add(nk)
                need.append(c)
        if not (cookies and gproj and need):
            return 0

        async def _one(ch: dict):
            nonlocal made
            name = str(ch.get("name") or "").strip()
            try:
                files = await generate_images_flow(
                    user_id=user_id, cookies=cookies, project_id=gproj,
                    prompt=build_portrait_prompt(ch, style_desc, nationality=nat), count=1, aspect_ratio="1:1",
                    out_dir=CHAR_PATH, out_prefix=f"port_{uuid.uuid4().hex[:8]}")
                if files:
                    async with AsyncSessionLocal() as db:
                        db.add(Character(user_id=user_id, name=name, image_file=files[0],
                                         project_id=project_db_id))
                        await db.commit()
                    made += 1
                    log.info("portrait ok: %s -> %s", name, files[0])
            except Exception as e:
                log.warning("portrait gen failed for %s: %s", name, e)
        # TUẦN TỰ + giãn cách ngẫu nhiên (KHÔNG bắn 8 ảnh/giây như gather cũ) -> tránh reCAPTCHA
        # gắn cờ 'UNUSUAL_ACTIVITY' (403). Chậm hơn vài giây/nhân vật, đổi lại không bị Google chặn.
        for i, c in enumerate(need[:8]):
            if i:
                await asyncio.sleep(2.5 + random.uniform(0.0, 2.5))
            await _one(c)
    except Exception as e:
        log.error("gen portraits failed (project %s): %s", project_db_id, e)
    finally:
        _portrait_inflight.discard(project_db_id)
    return made


async def _prep_portraits_and_dispatch(project_db_id: str, user_id: str, bible: list, scene_ids: list):
    """2b (tạo dự án): bù chân dung cho từng nhân vật bible CHƯA có ảnh -> run_scene_job tự đính làm
    reference MỌI cảnh (giữ mặt + đồng bộ). (Trước đây bỏ qua TẤT CẢ nếu dự án đã có 1 nhân vật bất kỳ
    -> nhân vật AI mất chân dung; nay bù theo từng tên.) Rồi dispatch cảnh."""
    await _gen_portraits_for_bible(project_db_id, user_id, bible)
    for sid in scene_ids:
        dispatch_scene(sid, user_id)


async def _prep_new_portraits_and_dispatch(project_db_id: str, user_id: str, bible: list, scene_ids: list):
    """Thêm phần mới: bù chân dung cho nhân vật còn THIẾU ảnh (mới, hoặc cũ chưa kịp sinh ở phần trước)
    -> nhân vật cũ đã có ảnh giữ NGUYÊN => mặt khớp xuyên phần. Rồi dispatch cảnh mới."""
    await _gen_portraits_for_bible(project_db_id, user_id, bible)
    for sid in scene_ids:
        dispatch_scene(sid, user_id)


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
    audio_mode: str = "voiceover"   # 'voiceover' (TTS ghép) | 'character_speak' (Veo nhân vật tự nói) | 'off'
    voiceover: bool = False         # legacy
    voice: str = "Kore"             # giọng mặc định (fallback)
    voices: list[str] = []          # giọng RIÊNG theo từng cảnh (song song prompts; "" = dùng mặc định)
    character_bible: list[dict] = [] # hồ sơ nhân vật (từ autoprompt) -> sinh chân dung AI giữ mặt mọi cảnh
    i2v_fix: bool = False           # Tự sinh ảnh sản phẩm trước để giữ chi tiết (I2V)


class AddScenesRequest(BaseModel):
    """Thêm 1 KỊCH BẢN/PHẦN mới vào dự án đang có (nối tiếp cảnh + giữ nhân vật)."""
    idea: str = ""                   # kịch bản/ý tưởng phần này -> lưu để hiện trên đầu cảnh của phần
    prompts: list[str] = []
    narrations: list[str] = []
    model_key: str | None = None     # None = giữ model của dự án
    duration_seconds: int | None = None
    audio_mode: str | None = None    # None = giữ audio_mode của dự án
    voices: list[str] = []
    chain_mode: bool = False
    character_ids: list[str] = []    # thêm nhân vật kho chung vào dự án (giữ mặt)
    character_bible: list[dict] = [] # nhân vật MỚI từ kịch bản phần này -> sinh chân dung (cũ giữ nguyên)
    auto_render: bool = True


class UpdateSceneRequest(BaseModel):
    prompt: str
    narration: str | None = None
    start_image: str | None = None


class SceneResponse(BaseModel):
    id: str
    index: int
    part: int = 1
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
    part_scripts: dict = {}   # {"2": "kịch bản phần 2", ...} (phần 1 = idea)
    audio_mode: str = "voiceover"
    voiceover: bool = False
    voice: str = "Kore"
    stopped: bool = False
    merged_file: str | None = None   # video đã ghép (final.mp4) khi mọi cảnh xong -> hiện ở feed
    character_bible: list = []   # dàn nhân vật đã khóa -> gửi lại làm cast khi thêm phần
    created_at: datetime
    updated_at: datetime
    i2v_fix: bool = False

    model_config = {"from_attributes": True}


class ProjChar(BaseModel):
    id: str
    name: str
    image_url: str

    model_config = {"from_attributes": True}


class ProjectDetailResponse(ProjectResponse):
    scenes: list[SceneResponse] = []
    characters: list[ProjChar] = []


def _safe_bible(raw) -> list:
    try:
        b = json.loads(raw or "[]")
    except (ValueError, TypeError):
        return []
    return b if isinstance(b, list) else []


async def _project_chars(db: AsyncSession, project_id: str) -> list[ProjChar]:
    res = await db.execute(select(Character).where(Character.project_id == project_id))
    return [ProjChar(id=c.id, name=c.name, image_url=f"/images/chars/{c.image_file}") for c in res.scalars().all()]


async def _invalidate_merge(db: AsyncSession, project_id: str) -> None:
    """A scene is being re-rendered/replaced → the old merged final.mp4 is now stale.
    Clear it so _try_auto_merge re-runs once all scenes are done again."""
    proj = await db.get(Project, project_id)
    if proj and proj.merged_file:
        proj.merged_file = None


# ── Helpers ────────────────────────────────────────────────────────────────────

def scene_to_resp(s: Scene) -> SceneResponse:
    return SceneResponse(
        id=s.id, index=s.index, part=getattr(s, "part", 1) or 1, prompt=s.prompt,
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
        part_scripts=json.loads(getattr(p, "part_scripts", None) or "{}"),
        audio_mode=getattr(p, "audio_mode", "voiceover") or "voiceover",
        voiceover=bool(getattr(p, "voiceover", False)),
        voice=getattr(p, "voice", "Kore") or "Kore",
        stopped=bool(getattr(p, "stopped", False)),
        merged_file=getattr(p, "merged_file", None),
        character_bible=_safe_bible(getattr(p, "character_bible", None)),
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
    subscription.ensure_can_generate(user)   # 402 nếu hết hạn dùng thử & chưa có gói
    await subscription.ensure_storage(db, user)   # 402 nếu đầy dung lượng
    if not user.google_connected and not user.gemini_api_key:
        raise HTTPException(400, "Cần kết nối Google Ultra hoặc Gemini API key")

    proj = Project(
        user_id=user.id, name=body.name, idea=body.idea,
        style=body.style, model_key=body.model_key,
        aspect_ratio=body.aspect_ratio, duration_seconds=body.duration_seconds,
        language=body.language, scene_count=len(body.prompts),
        chain_mode=body.chain_mode,
        audio_mode=body.audio_mode or "voiceover",
        voiceover=(body.audio_mode or "voiceover") == "voiceover",
        voice=body.voice or "Kore",
        character_bible=json.dumps(body.character_bible, ensure_ascii=False) if body.character_bible else None,
        i2v_fix=body.i2v_fix,
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
            voice=(body.voices[i] if i < len(body.voices) else ""),  # giọng riêng cảnh (theo nhân vật nói)
        )
        db.add(s)
        scenes.append(s)

    await db.commit()
    await db.refresh(proj)

    if body.auto_render:
        scene_ids = [s.id for s in scenes]
        # 2b: nếu có bible nhân vật -> sinh chân dung AI trước rồi mới dispatch
        # (kể cả khi đã có character_ids là sản phẩm, ta vẫn cần sinh mặt AI ảo nếu thiếu)
        if body.character_bible:
            asyncio.create_task(_prep_portraits_and_dispatch(proj.id, user.id, body.character_bible, scene_ids))
        else:
            # Không có bible -> dispatch ngay.
            for sid in scene_ids:
                dispatch_scene(sid, user.id)

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

    # 1) Dọn FILE trên đĩa: video từng cảnh (+ bản lồng tiếng), ảnh nhân vật riêng, final đã ghép.
    res = await db.execute(select(Scene).where(Scene.project_id == project_id))
    for s in res.scalars().all():
        if s.video_file:
            try:
                fp = UPLOAD_PATH / s.video_file
                if fp.exists():
                    fp.unlink()
            except OSError:
                pass
    res = await db.execute(select(Character).where(Character.project_id == project_id))
    for c in res.scalars().all():   # nhân vật riêng (clone) — KHÔNG đụng kho chung (project_id=NULL)
        try:
            fp = CHAR_PATH / c.image_file
            if c.image_file and fp.exists():
                fp.unlink()
        except OSError:
            pass
    if proj.merged_file:
        try:
            fp = UPLOAD_PATH / proj.merged_file
            if fp.exists():
                fp.unlink()
        except OSError:
            pass

    # 2) Xoá DB theo ĐÚNG thứ tự con-trước-cha bằng bulk DELETE thực thi ngay. Không dùng ORM
    #    db.delete() loop nữa: unit-of-work gom vào 1 commit và sắp xếp lại -> xoá project trước
    #    scenes -> ForeignKeyViolationError (scenes_project_id_fkey). Bulk delete chạy tuần tự,
    #    chắc chắn FK-safe.
    await db.execute(delete(Scene).where(Scene.project_id == project_id))
    await db.execute(delete(Character).where(Character.project_id == project_id))
    await db.execute(delete(Project).where(Project.id == project_id))
    await db.commit()
    return {"ok": True}


class RenameProjectRequest(BaseModel):
    name: str


class PartScriptRequest(BaseModel):
    part: int = 1
    idea: str = ""


@router.patch("/{project_id}/part-script", response_model=ProjectResponse)
async def update_part_script(
    project_id: str,
    body: PartScriptRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Sửa/thêm kịch bản hiển thị cho 1 phần (Phần 1 = idea; Phần >=2 = part_scripts[part])."""
    proj = await db.get(Project, project_id)
    if not proj or proj.user_id != user.id:
        raise HTTPException(404, "Không tìm thấy dự án")
    text = (body.idea or "").strip()
    if body.part <= 1:
        proj.idea = text
    else:
        try:
            ps = json.loads(proj.part_scripts or "{}")
        except (ValueError, TypeError):
            ps = {}
        if text:
            ps[str(body.part)] = text
        else:
            ps.pop(str(body.part), None)
        proj.part_scripts = json.dumps(ps, ensure_ascii=False)
    await db.commit()
    await db.refresh(proj)
    return proj_to_resp(proj)


@router.patch("/{project_id}", response_model=ProjectResponse)
async def rename_project(
    project_id: str,
    body: RenameProjectRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    proj = await db.get(Project, project_id)
    if not proj or proj.user_id != user.id:
        raise HTTPException(404, "Không tìm thấy dự án")
    if body.name.strip():
        proj.name = body.name.strip()
    await db.commit()
    await db.refresh(proj)
    return proj_to_resp(proj)


@router.post("/{project_id}/stop")
async def stop_project(
    project_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Dừng dự án: runner bỏ qua các cảnh chưa/đang render (đang render sẽ tự huỷ ở vòng poll kế)."""
    proj = await db.get(Project, project_id)
    if not proj or proj.user_id != user.id:
        raise HTTPException(404, "Không tìm thấy dự án")
    proj.stopped = True
    res = await db.execute(select(Scene).where(
        Scene.project_id == project_id,
        Scene.status.in_([SceneStatus.pending, SceneStatus.processing])))
    n = 0
    for s in res.scalars().all():
        s.status = SceneStatus.failed
        s.error_msg = "⏸ Đã dừng"
        n += 1
    await db.commit()
    return {"ok": True, "stopped_scenes": n}


@router.post("/{project_id}/resume")
async def resume_project(
    project_id: str,
    background_tasks: BackgroundTasks,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Tiếp tục: render lại các cảnh chưa có video (failed/pending)."""
    proj = await db.get(Project, project_id)
    if not proj or proj.user_id != user.id:
        raise HTTPException(404, "Không tìm thấy dự án")
    subscription.ensure_can_generate(user)
    await subscription.ensure_storage(db, user)
    proj.stopped = False
    proj.merged_file = None   # scene set changing → old concat is stale, force re-merge
    res = await db.execute(select(Scene).where(
        Scene.project_id == project_id, Scene.video_file.is_(None)).order_by(Scene.index))
    todo = res.scalars().all()
    for s in todo:
        s.status = SceneStatus.pending
        s.error_msg = None
    await db.commit()
    for s in todo:
        await db.refresh(s)
        dispatch_scene(s.id, user.id)
    return {"ok": True, "resumed": len(todo)}


@router.post("/{project_id}/rerender-batch")
async def rerender_batch(
    project_id: str,
    part: int | None = None,
    failed_only: bool = False,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Tạo lại HÀNG LOẠT: reset & render lại nhiều cảnh trong 1 lần (để áp ảnh giữ mặt / kịch bản mới
    cho cả cảnh ĐÃ xong). part=None -> toàn dự án; part=N -> chỉ phần đó. Bỏ qua cảnh đang render."""
    proj = await db.get(Project, project_id)
    if not proj or proj.user_id != user.id:
        raise HTTPException(404, "Không tìm thấy dự án")
    subscription.ensure_can_generate(user)
    await subscription.ensure_storage(db, user)
    res = await db.execute(select(Scene).where(
        Scene.project_id == project_id, Scene.status != SceneStatus.processing).order_by(Scene.index))
    # lọc theo phần ở Python để khớp cảnh cũ có part=None (=1), như frontend (s.part || 1)
    todo = [s for s in res.scalars().all() if part is None or (getattr(s, "part", 1) or 1) == part]
    if failed_only:
        todo = [s for s in todo if s.status == SceneStatus.failed]
    if not todo:
        return {"ok": True, "rerendered": 0}
    proj.stopped = False
    proj.merged_file = None   # render lại -> concat cũ thành stale
    for s in todo:
        s.status = SceneStatus.pending
        s.error_msg = None
    await db.commit()
    for s in todo:
        await db.refresh(s)
        dispatch_scene(s.id, user.id)
    return {"ok": True, "rerendered": len(todo)}


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


@router.delete("/{project_id}/scenes/{scene_id}")
async def delete_scene(
    project_id: str, scene_id: str,
    background_tasks: BackgroundTasks,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Xoá hẳn 1 cảnh khỏi dự án. index là GLOBAL toàn dự án nên re-index 0..n-1 cho liền mạch
    (nhãn "Cảnh N" gọn + ghép đúng thứ tự). Mọi cảnh còn lại đã xong -> ghép lại final.mp4 ngay."""
    scene = await db.get(Scene, scene_id)
    if not scene or scene.project_id != project_id or scene.user_id != user.id:
        raise HTTPException(404, "Không tìm thấy scene")
    if scene.status == SceneStatus.processing:
        raise HTTPException(400, "Cảnh đang render — dừng hoặc đợi xong rồi mới xoá được")
    res0 = await db.execute(select(Scene).where(Scene.project_id == project_id).order_by(Scene.index))
    all_scenes = res0.scalars().all()
    if len(all_scenes) <= 1:
        raise HTTPException(400, "Không thể xoá cảnh cuối cùng — hãy xoá cả dự án nếu muốn")
    await db.delete(scene)
    await db.flush()
    remaining = [s for s in all_scenes if s.id != scene_id]
    for i, s in enumerate(remaining):
        if s.index != i:
            s.index = i
    await _invalidate_merge(db, project_id)
    all_done = bool(remaining) and all(s.status == SceneStatus.done for s in remaining)
    await db.commit()
    if all_done:
        background_tasks.add_task(_try_auto_merge, project_id)
    return {"ok": True}


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
    await subscription.ensure_storage(db, user)
    scene.status = SceneStatus.pending
    scene.error_msg = None
    await _invalidate_merge(db, project_id)
    await db.commit()
    dispatch_scene(scene_id, user.id)
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
    await subscription.ensure_storage(db, user)
    scene.status = SceneStatus.pending
    scene.error_msg = None
    await _invalidate_merge(db, project_id)
    await db.commit()
    dispatch_scene(scene_id, user.id)
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
    await _invalidate_merge(db, project_id)
    await db.commit()
    return {"ok": True, "video_file": fname}


@router.get("/{project_id}/scenes/{scene_id}/download")
async def download_scene(
    project_id: str, scene_id: str,
    res: str = "720",   # "720" = original | "1080" = upscale on demand
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    scene = await db.get(Scene, scene_id)
    if not scene or scene.project_id != project_id or scene.user_id != user.id:
        raise HTTPException(404, "Không tìm thấy scene")
    if not scene.video_file:
        raise HTTPException(404, "Cảnh chưa có video")
    path = UPLOAD_PATH / scene.video_file
    if not path.exists():
        raise HTTPException(404, "File đã bị xóa")
    tag = "720p"
    if res == "1080":
        from app.pipeline.runner import ensure_1080
        hd = await ensure_1080(path, scene.aspect_ratio)
        if hd:
            path, tag = hd, "1080p"
    return FileResponse(str(path), filename=f"canh_{scene.index + 1}_{tag}.mp4", media_type="video/mp4")


@router.get("/{project_id}/download-merged")
async def download_merged(
    project_id: str,
    res: str = "720",
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    proj = await db.get(Project, project_id)
    if not proj or proj.user_id != user.id:
        raise HTTPException(404, "Không tìm thấy dự án")
    if not proj.merged_file:
        raise HTTPException(404, "Dự án chưa được ghép")
    path = UPLOAD_PATH / proj.merged_file
    if not path.exists():
        raise HTTPException(404, "File đã bị xóa")
    tag = "720p"
    if res == "1080":
        from app.pipeline.runner import ensure_1080
        hd = await ensure_1080(path, proj.aspect_ratio)
        if hd:
            path, tag = hd, "1080p"
    return FileResponse(str(path), filename=f"phim_{tag}.mp4", media_type="video/mp4")


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


@router.post("/{project_id}/portraits")
async def gen_portraits(
    project_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Tạo (bù) ảnh CHÂN DUNG GIỮ MẶT cho các nhân vật của dự án còn thiếu ảnh — để mọi cảnh được đính
    reference, giữ mặt đồng bộ xuyên các phần. Chạy nền; sau đó render lại cảnh để áp ảnh mới."""
    from ..tools.router import _norm_name   # dedup tên đồng nhất với cast-lock
    proj = await db.get(Project, project_id)
    if not proj or proj.user_id != user.id:
        raise HTTPException(404, "Không tìm thấy dự án")
    # google_connected & google_project_id set độc lập -> kiểm cả hai, tránh hứa 'đang tạo' mà tạo 0 ảnh
    if not (user.google_connected and user.google_cookies and user.google_project_id):
        raise HTTPException(400, "Phiên Google chưa đầy đủ — kết nối lại Google Ultra (extension) rồi thử lại")
    bible = _safe_bible(proj.character_bible)
    if not bible:
        raise HTTPException(400, "Dự án chưa có hồ sơ nhân vật để tạo chân dung")
    res = await db.execute(select(Character).where(Character.project_id == project_id))
    existing = {_norm_name(c.name) for c in res.scalars().all()}
    missing, seen = [], set(existing)
    for c in bible:
        if not isinstance(c, dict):
            continue
        nm = str(c.get("name") or "").strip()
        nk = _norm_name(nm)
        if nm and nk not in seen:
            seen.add(nk); missing.append(c)
    if not missing:
        return {"generating": 0, "detail": "Mọi nhân vật đã có ảnh chân dung"}
    if project_id in _portrait_inflight:
        return {"generating": 0, "detail": "Đang tạo ảnh chân dung, đợi chút rồi tải lại trang"}
    asyncio.create_task(_gen_portraits_for_bible(project_id, user.id, bible))
    return {"generating": min(len(missing), 8)}


@router.post("/{project_id}/add-scenes", response_model=ProjectDetailResponse)
async def add_scenes(
    project_id: str,
    body: AddScenesRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Thêm 1 phần/kịch bản mới vào dự án: nối cảnh tiếp index, gán Part mới, giữ nguyên nhân vật +
    seed của dự án (=> mặt khớp xuyên suốt), khoá tỉ lệ khung hình theo dự án (=> ghép phim liền mạch)."""
    proj = await db.get(Project, project_id)
    if not proj or proj.user_id != user.id:
        raise HTTPException(404, "Không tìm thấy dự án")
    subscription.ensure_can_generate(user)
    await subscription.ensure_storage(db, user)
    if not user.google_connected and not user.gemini_api_key:
        raise HTTPException(400, "Cần kết nối Google Ultra hoặc Gemini API key")
    prompts = [p for p in (body.prompts or []) if (p or "").strip()]
    if not prompts:
        raise HTTPException(400, "Chưa có cảnh nào để thêm")

    # index nối tiếp + part mới (max part hiện có + 1)
    res = await db.execute(select(Scene).where(Scene.project_id == project_id))
    cur = res.scalars().all()
    next_index = (max((s.index for s in cur), default=-1)) + 1
    next_part = (max((getattr(s, "part", 1) or 1 for s in cur), default=0)) + 1

    # Thêm nhân vật kho chung (nếu chọn) -> clone riêng cho dự án (giữ mặt)
    if body.character_ids:
        await _clone_chars_into_project(db, user.id, body.character_ids, project_id)

    # Cập nhật setting dự án theo lựa chọn phần mới (audio_mode là cấp dự án).
    # Tỉ lệ khung hình KHÔNG đổi (giữ theo dự án để ghép phim không lệch khung).
    model_key = body.model_key or proj.model_key
    duration = body.duration_seconds or proj.duration_seconds
    if body.audio_mode:
        proj.audio_mode = body.audio_mode
        proj.voiceover = body.audio_mode == "voiceover"

    # Lưu kịch bản của phần này -> hiện trên đầu nhóm cảnh của phần đó
    if (body.idea or "").strip():
        try:
            ps = json.loads(proj.part_scripts or "{}")
        except (ValueError, TypeError):
            ps = {}
        ps[str(next_part)] = body.idea.strip()
        proj.part_scripts = json.dumps(ps, ensure_ascii=False)

    # Gộp bible: giữ NGUYÊN mô tả nhân vật cũ, chỉ thêm nhân vật mới (theo tên) -> KHÓA xuyên phần
    if body.character_bible:
        try:
            old = json.loads(proj.character_bible or "[]")
        except (ValueError, TypeError):
            old = []
        if not isinstance(old, list):   # cột chứa JSON hợp lệ nhưng không phải list (null/dict/số) -> reset
            old = []
        seen = {str(c.get("name", "")).strip().lower() for c in old if isinstance(c, dict)}
        for c in body.character_bible:
            nm = str(c.get("name", "")).strip().lower()
            if nm and nm not in seen:
                old.append(c); seen.add(nm)
        proj.character_bible = json.dumps(old, ensure_ascii=False)

    new_scenes = []
    for i, p in enumerate(prompts):
        s = Scene(
            project_id=project_id, user_id=user.id, index=next_index + i, part=next_part,
            prompt=p,
            narration=body.narrations[i] if i < len(body.narrations) else None,
            model_key=model_key, aspect_ratio=proj.aspect_ratio, duration_seconds=duration,
            wait_for_prev=body.chain_mode and i > 0,
            voice=(body.voices[i] if i < len(body.voices) else ""),
        )
        db.add(s)
        new_scenes.append(s)

    proj.scene_count = len(cur) + len(new_scenes)
    proj.stopped = False
    await db.commit()
    for s in new_scenes:
        await db.refresh(s)

    if body.auto_render:
        scene_ids = [s.id for s in new_scenes]
        # Sinh chân dung cho nhân vật MỚI (cũ giữ nguyên) rồi dispatch — chạy nền.
        if body.character_bible:
            asyncio.create_task(_prep_new_portraits_and_dispatch(project_id, user.id, body.character_bible, scene_ids))
        else:
            for sid in scene_ids:
                dispatch_scene(sid, user.id)

    # Trả về dự án đầy đủ (gồm cảnh mới) để frontend cập nhật ngay
    res = await db.execute(select(Scene).where(Scene.project_id == project_id).order_by(Scene.index))
    all_scenes = res.scalars().all()
    await db.refresh(proj)
    return ProjectDetailResponse(
        **proj_to_resp(proj).__dict__,
        scenes=[scene_to_resp(s) for s in all_scenes],
        characters=await _project_chars(db, project_id),
    )
