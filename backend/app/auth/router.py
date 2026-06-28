from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from datetime import datetime, timezone, timedelta

from app.database import get_db
from app.auth.models import User
from app.auth.schemas import RegisterRequest, LoginRequest, TokenResponse, UserResponse, UpdateGeminiKey, ApplyRefRequest
from app.auth.utils import hash_password, verify_password, create_access_token, decode_token
from app.crypto import enc
from app import subscription

router = APIRouter(prefix="/auth", tags=["auth"])
bearer = HTTPBearer()


async def get_current_user(
    cred: HTTPAuthorizationCredentials = Depends(bearer),
    db: AsyncSession = Depends(get_db),
) -> User:
    payload = decode_token(cred.credentials)
    if not payload:
        raise HTTPException(status_code=401, detail="Token không hợp lệ")
    user = await db.get(User, payload.get("sub"))
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="User không tồn tại")
    if user.is_banned:
        raise HTTPException(status_code=403, detail="Tài khoản đã bị khóa")
    return user


@router.post("/register", response_model=TokenResponse)
async def register(body: RegisterRequest, db: AsyncSession = Depends(get_db)):
    # Check email exists
    existing = await db.execute(select(User).where(User.email == body.email))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Email đã tồn tại")

    # Check username
    existing_u = await db.execute(select(User).where(User.username == body.username))
    if existing_u.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Username đã tồn tại")

    user = User(
        email=body.email,
        username=body.username,
        hashed_password=hash_password(body.password),
    )
    db.add(user)
    await db.flush()   # assign user.id before generating code / linking referrer

    from app.affiliate import ensure_referral_code, attach_referrer
    await ensure_referral_code(db, user)
    await attach_referrer(db, user, body.ref)

    try:
        await db.commit()
    except IntegrityError:
        # Concurrent signup won the race on a unique column (email / username / referral_code)
        await db.rollback()
        raise HTTPException(status_code=400, detail="Email hoặc username đã tồn tại")
    await db.refresh(user)

    token = create_access_token({"sub": user.id})
    return TokenResponse(access_token=token)


@router.post("/login", response_model=TokenResponse)
async def login(body: LoginRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == body.email))
    user = result.scalar_one_or_none()
    if not user or not verify_password(body.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Email hoặc mật khẩu không đúng")

    user.last_login = datetime.now(timezone.utc).replace(tzinfo=None)  # cột là TIMESTAMP WITHOUT TZ (Postgres)
    await db.commit()

    token = create_access_token({"sub": user.id})
    return TokenResponse(access_token=token)


@router.post("/extension-token", response_model=TokenResponse)
async def extension_token(user: User = Depends(get_current_user)):
    """Token sống lâu (30 ngày) cho Chrome extension — chỉ cấp cho user ĐÃ đăng nhập (token 24h).
    Extension cắm WebSocket lâu dài; web app vẫn dùng token 24h như cũ -> không yếu bảo mật web."""
    token = create_access_token({"sub": user.id, "ext": True}, expires_delta=timedelta(days=30))
    return TokenResponse(access_token=token)


@router.get("/me", response_model=UserResponse)
async def me(user: User = Depends(get_current_user)):
    return UserResponse(
        id=user.id,
        email=user.email,
        username=user.username,
        is_admin=user.is_admin,
        google_connected=user.google_connected,
        google_project_id=user.google_project_id,
        has_gemini_key=bool(user.gemini_api_key),
        plan=user.plan,
        plan_active=subscription.is_active(user),
        referred_by=user.referred_by,
    )


@router.post("/apply-ref")
async def apply_ref(
    body: ApplyRefRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Nhập mã giới thiệu SAU khi đăng ký (trang Hồ sơ). Chỉ áp được khi CHƯA có người giới thiệu."""
    if user.referred_by:
        raise HTTPException(status_code=400, detail="Bạn đã có người giới thiệu rồi, không thể đổi.")
    code = (body.ref or "").strip().upper()
    if not code:
        raise HTTPException(status_code=400, detail="Nhập mã giới thiệu.")
    from app.affiliate import attach_referrer
    await attach_referrer(db, user, code)
    if not user.referred_by:
        raise HTTPException(status_code=404, detail="Mã giới thiệu không tồn tại hoặc không hợp lệ.")
    await db.commit()
    return {"ok": True, "referred_by": user.referred_by}


@router.post("/gemini-key")
async def save_gemini_key(
    body: UpdateGeminiKey,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    user.gemini_api_key = enc(body.api_key)
    await db.commit()
    return {"ok": True, "message": "Đã lưu Gemini API key"}
