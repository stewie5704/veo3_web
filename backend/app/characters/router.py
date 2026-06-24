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
    fpath = CHAR_PATH / char.image_file
    if fpath.exists():
        fpath.unlink()
    await db.delete(char)
    await db.commit()
    return {"ok": True}
