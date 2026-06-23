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

    model_config = {"from_attributes": True}


@router.get("/", response_model=list[CharacterResponse])
async def list_characters(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    res = await db.execute(select(Character).where(Character.user_id == user.id))
    chars = res.scalars().all()
    return [CharacterResponse(id=c.id, name=c.name, image_url=f"/images/chars/{c.image_file}") for c in chars]


@router.post("/", response_model=CharacterResponse)
async def add_character(
    name: str = Form(...),
    image: UploadFile = File(...),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Check duplicate name for this user
    existing = await db.execute(
        select(Character).where(Character.user_id == user.id, Character.name == name)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(400, f"Nhân vật '{name}' đã tồn tại")

    ext = Path(image.filename or "img.jpg").suffix or ".jpg"
    fname = f"{uuid.uuid4().hex[:12]}{ext}"
    fpath = CHAR_PATH / fname
    with open(fpath, "wb") as f:
        shutil.copyfileobj(image.file, f)

    char = Character(user_id=user.id, name=name, image_file=fname)
    db.add(char)
    await db.commit()
    await db.refresh(char)
    return CharacterResponse(id=char.id, name=char.name, image_url=f"/images/chars/{fname}")


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
