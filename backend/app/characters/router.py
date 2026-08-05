import uuid
import shutil
from pathlib import Path
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel

from app.database import get_db
from app.auth.router import get_current_user
from app.auth.models import User
from app.characters.models import Character
from app.styles_catalog import style_description
from app.config import UPLOAD_PATH

router = APIRouter(prefix="/characters", tags=["characters"])
CHAR_PATH = UPLOAD_PATH.parent / "images" / "chars"
CHAR_PATH.mkdir(parents=True, exist_ok=True)


class CharacterResponse(BaseModel):
    id: str
    name: str
    image_url: str
    project_id: str | None = None

    model_config = {"from_attributes": True}


def _char_resp(c: Character) -> CharacterResponse:
    return CharacterResponse(id=c.id, name=c.name, image_url=f"/images/chars/{c.image_file}", project_id=c.project_id)


@router.get("/", response_model=list[CharacterResponse])
async def list_characters(
    project_id: str | None = None,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """project_id rỗng -> kho chung (nhân vật dùng lại được). Có project_id -> nhân vật riêng của project đó."""
    q = select(Character).where(Character.user_id == user.id)
    q = q.where(Character.project_id == project_id) if project_id else q.where(Character.project_id.is_(None))
    res = await db.execute(q)
    return [_char_resp(c) for c in res.scalars().all()]


@router.post("/", response_model=CharacterResponse)
async def add_character(
    name: str = Form(...),
    image: UploadFile | None = File(None),
    project_id: str | None = Form(None),   # gắn nhân vật vào 1 project; rỗng = kho chung
    copy_from: str | None = Form(None),    # id nhân vật nguồn để CLONE (lấy từ kho vào project)
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    scope = project_id or None
    # Trùng tên trong CÙNG phạm vi (cùng kho chung, hoặc cùng 1 project) mới chặn
    existing = await db.execute(
        select(Character).where(
            Character.user_id == user.id, Character.name == name,
            Character.project_id == scope if scope else Character.project_id.is_(None),
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(400, f"Nhân vật '{name}' đã tồn tại")

    ext = ".jpg"
    if copy_from:
        # Clone từ nhân vật đã có (vd kho chung -> project): copy file sang tên mới
        src = await db.get(Character, copy_from)
        if not src or src.user_id != user.id:
            raise HTTPException(404, "Không tìm thấy nhân vật nguồn")
        ext = Path(src.image_file).suffix or ".jpg"
        fname = f"{uuid.uuid4().hex[:12]}{ext}"
        srcp = CHAR_PATH / src.image_file
        if srcp.exists():
            shutil.copyfile(srcp, CHAR_PATH / fname)
        else:
            raise HTTPException(404, "Ảnh nhân vật nguồn không tồn tại")
    else:
        if image is None:
            raise HTTPException(400, "Cần ảnh nhân vật")
        ext = Path(image.filename or "img.jpg").suffix or ".jpg"
        fname = f"{uuid.uuid4().hex[:12]}{ext}"
        with open(CHAR_PATH / fname, "wb") as f:
            shutil.copyfileobj(image.file, f)

    char = Character(user_id=user.id, name=name, image_file=fname, project_id=scope)
    db.add(char)
    await db.commit()
    await db.refresh(char)
    return _char_resp(char)


@router.delete("/{char_id}")
async def delete_character(
    char_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    char = await db.get(Character, char_id)
    if not char or char.user_id != user.id:
        raise HTTPException(404, "Không tìm thấy nhân vật")
    if char.image_file:
        p = CHAR_PATH / char.image_file
        if p.exists():
            p.unlink()
    await db.delete(char)
    await db.commit()
    return {"status": "ok"}


async def _generate_one_portrait(user: User, ch: dict, overwrite: bool = False,
                                 style: str = "", allow_duplicate: bool = False) -> CharacterResponse | None:
    """Sinh 1 ảnh chân dung + lưu vào DB. Trả về CharacterResponse khi xong, raise nếu lỗi.
    Được dùng bởi 2 endpoint: batch (legacy) và single (FE gọi song song từng nhân vật)."""
    from app.projects.router import build_portrait_prompt
    from app.pipeline.runner import generate_images_flow
    from app.crypto import dec
    from app.database import AsyncSessionLocal

    name = str(ch.get("name") or "").strip()
    if not name:
        raise HTTPException(400, "Nhân vật thiếu name")

    cookies = (dec(user.google_cookies) if user and user.google_cookies else "") or ""
    gproj = (user.google_project_id if user else "") or ""
    if not (cookies and gproj):
        raise HTTPException(400, "Cần kết nối Google Flow (Nano Banana Pro) trong Cài đặt để tạo chân dung tự động.")

    files = await generate_images_flow(
        user_id=user.id, cookies=cookies, project_id=gproj,
        prompt=build_portrait_prompt(ch, style_description(style), nationality="Vietnamese"), count=1, aspect_ratio="16:9",
        out_dir=CHAR_PATH, out_prefix=f"port_{uuid.uuid4().hex[:8]}",
    )
    if not files:
        raise HTTPException(502, f"Flow không trả về ảnh cho '{name}'")

    async with AsyncSessionLocal() as db:
        existing = await db.execute(select(Character).where(
            Character.user_id == user.id, Character.name == name, Character.project_id.is_(None)))
        char = existing.scalars().first()
        if char and not overwrite and not allow_duplicate:
            # Đã có -> xóa ảnh mới sinh cho gọn, trả về nhân vật cũ
            p = CHAR_PATH / files[0]
            if p.exists():
                try: p.unlink()
                except OSError: pass
            return _char_resp(char)
        if char and overwrite:
            if char.image_file:
                p = CHAR_PATH / char.image_file
                if p.exists():
                    try: p.unlink()
                    except OSError: pass
            char.image_file = files[0]
        else:
            char = Character(user_id=user.id, name=name, image_file=files[0], project_id=None)
            db.add(char)
        await db.commit()
        await db.refresh(char)
        return _char_resp(char)


@router.post("/generate-ai-portrait", response_model=CharacterResponse)
async def generate_ai_portrait_one(
    character: dict,
    overwrite: bool = False,
    style: str = "",
    allow_duplicate: bool = False,
    user: User = Depends(get_current_user),
):
    """Sinh 1 ảnh chân dung cho 1 nhân vật (FE gọi song song từng nhân vật để tạo grid loading UX).
    Lỗi được trả 4xx/5xx với chi tiết — KHÔNG nuốt exception im lặng nữa."""
    try:
        return await _generate_one_portrait(user, character, overwrite, style, allow_duplicate)
    except HTTPException:
        raise
    except Exception as exc:
        from app.pipeline.runner import FlowBridgeUnavailableError
        if isinstance(exc, FlowBridgeUnavailableError):
            raise HTTPException(status_code=409, detail=str(exc)) from exc
        raise


@router.post("/generate-ai-portraits", response_model=list[CharacterResponse])
async def generate_ai_portraits(
    characters: list[dict],
    overwrite: bool = False,
    user: User = Depends(get_current_user),
):
    """Legacy batch endpoint: sinh nhiều nhân vật SONG SONG (hạn chế đồng thời để tránh
    quá tải Flow). Không còn cap 8 nhân vật. Lỗi lẻ được log, các nhân vật khác vẫn tiếp tục."""
    import asyncio
    import logging
    log = logging.getLogger("veo3.characters")

    if not characters:
        return []
    # Xác nhận sớm Google Flow đã kết nối để trả 400 rõ ràng thay vì fail im lặng.
    cookies = user.google_cookies or ""
    gproj = user.google_project_id or ""
    if not (cookies and gproj):
        raise HTTPException(400, "Cần kết nối Google Flow (Nano Banana Pro) trong Cài đặt để tạo chân dung tự động.")

    sem = asyncio.Semaphore(3)  # 3 song song — cân bằng tốc độ vs rate-limit Flow

    async def _do(ch: dict):
        async with sem:
            try:
                return await _generate_one_portrait(user, ch, overwrite)
            except HTTPException as e:
                log.warning("portrait '%s' lỗi: %s", ch.get("name"), e.detail)
                return None
            except Exception as e:
                log.exception("portrait '%s' lỗi bất ngờ: %s", ch.get("name"), e)
                return None

    results = await asyncio.gather(*[_do(c) for c in characters])
    return [r for r in results if r is not None]
