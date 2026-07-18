from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
import secrets
from datetime import datetime, timezone, timedelta

from app.database import get_db
from app.auth.models import User
from app.auth.schemas import (
    RegisterRequest, LoginRequest, TokenResponse, UserResponse,
    UpdateGeminiKey, ApplyRefRequest, VerifyEmailRequest
)
from app.auth.utils import hash_password, verify_password, create_access_token, decode_token
from app.crypto import enc
from app.config import settings
from app.email import send_verification_email
from app.security import client_ip, rate_limit
from app import subscription

router = APIRouter(prefix="/auth", tags=["auth"])
bearer = HTTPBearer()


def _gen_code() -> str:
    return f"{secrets.randbelow(900000) + 100000}"   # mã 6 chữ số (100000–999999)


def _naive_utc() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


async def get_current_user(
    cred: HTTPAuthorizationCredentials = Depends(bearer),
    db: AsyncSession = Depends(get_db),
) -> User:
    payload = decode_token(cred.credentials, audiences=("web",))
    if not payload:
        raise HTTPException(status_code=401, detail="Token không hợp lệ")
    user = await db.get(User, payload.get("sub"))
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="User không tồn tại")
    if user.is_banned:
        raise HTTPException(status_code=403, detail="Tài khoản đã bị khóa")
    return user


async def get_current_user_ext(
    cred: HTTPAuthorizationCredentials = Depends(bearer),
    db: AsyncSession = Depends(get_db),
) -> User:
    """Dùng cho endpoint mà Chrome extension gọi — chỉ chấp nhận token có aud='ext'
    (token 30 ngày). Token web 24h KHÔNG dùng thay được → giới hạn thiệt hại khi token web lộ."""
    payload = decode_token(cred.credentials, audiences=("ext",))
    if not payload:
        raise HTTPException(status_code=401, detail="Token không hợp lệ")
    user = await db.get(User, payload.get("sub"))
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="User không tồn tại")
    if user.is_banned:
        raise HTTPException(status_code=403, detail="Tài khoản đã bị khóa")
    return user


# Bearer OPTIONAL — cho phép cả header Authorization LẪN ?token= trong query.
# Dùng cho endpoint tải file: <a href download> không gửi được header, phải nhét
# token vào URL. Video 200MB+ không thể buffer qua axios blob, browser sẽ hủy giữa
# chừng (ERR_FAILED) → phải stream thẳng ra disk bằng anchor tag.
_bearer_opt = HTTPBearer(auto_error=False)


async def get_current_user_download(
    cred: HTTPAuthorizationCredentials | None = Depends(_bearer_opt),
    token: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
) -> User:
    tk = (cred.credentials if cred else None) or token
    if not tk:
        raise HTTPException(status_code=401, detail="Thiếu token")
    # Chấp nhận cả token phiên 'web' (tương thích cũ) LẪN token tải ngắn hạn 'dl'.
    # Token 'dl' hết hạn sau ~5 phút -> nếu lộ vào access-log/URL share cũng vô hại nhanh.
    payload = decode_token(tk, audiences=("web", "dl"))
    if not payload:
        raise HTTPException(status_code=401, detail="Token không hợp lệ")
    user = await db.get(User, payload.get("sub"))
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="User không tồn tại")
    if user.is_banned:
        raise HTTPException(status_code=403, detail="Tài khoản đã bị khóa")
    return user


@router.post("/register", response_model=TokenResponse)
async def register(body: RegisterRequest, request: Request, db: AsyncSession = Depends(get_db)):
    # Rate-limit tạo tài khoản: chống spam tài khoản + brute-force account-enum theo email.
    rate_limit(f"register:{client_ip(request)}", limit=8, window=3600)
    rate_limit(f"register-email:{body.email.lower()}", limit=3, window=3600)
    body.email = body.email.lower()
    # Check email exists
    existing = await db.execute(select(User).where(User.email == body.email))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Email đã tồn tại")

    # Check username
    existing_u = await db.execute(select(User).where(User.username == body.username))
    if existing_u.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Username đã tồn tại")

    code = _gen_code()
    user = User(
        email=body.email,
        username=body.username,
        hashed_password=hash_password(body.password),
        email_verified=False,
        email_verify_code=code,
        email_verify_sent_at=_naive_utc(),
    )
    db.add(user)
    await db.flush()   # assign user.id before generating code / linking referrer

    from app.affiliate import ensure_referral_code, attach_referrer
    await ensure_referral_code(db, user)

    # Determine which ref to use and whether discount is voided
    actual_ref = body.ref or body.cookie_ref
    
    # If they didn't explicitly type a code, but there's a cookie,
    # we still credit the referrer, but the user doesn't get the discount.
    if body.cookie_ref and not body.ref:
        user.ref_discount_voided = True

    await attach_referrer(db, user, actual_ref)

    try:
        await db.commit()
    except IntegrityError:
        # Concurrent signup won the race on a unique column (email / username / referral_code)
        await db.rollback()
        raise HTTPException(status_code=400, detail="Email hoặc username đã tồn tại")
    await db.refresh(user)

    # Gửi mã xác minh (best-effort — KHÔNG để lỗi gửi mail làm hỏng đăng ký)
    await send_verification_email(user.email, code)
    token = create_access_token({"sub": user.id})
    return TokenResponse(access_token=token)


@router.post("/login", response_model=TokenResponse)
async def login(body: LoginRequest, request: Request, db: AsyncSession = Depends(get_db)):
    # Rate-limit login: chống brute-force cả theo IP lẫn theo email.
    rate_limit(f"login:{client_ip(request)}", limit=20, window=300)
    rate_limit(f"login-email:{body.email.lower()}", limit=10, window=300)
    body.email = body.email.lower()
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
    Extension cắm WebSocket lâu dài; web app vẫn dùng token 24h như cũ -> không yếu bảo mật web.
    audience='ext' -> KHÔNG dùng được cho endpoint web (get_current_user chỉ nhận aud='web').
    Chống trường hợp XSS lấy được token 24h rồi tự đổi thành token 30 ngày dùng như session vĩnh viễn."""
    token = create_access_token({"sub": user.id, "aud": "ext"}, expires_delta=timedelta(days=30))
    return TokenResponse(access_token=token)


@router.post("/download-token", response_model=TokenResponse)
async def download_token(user: User = Depends(get_current_user)):
    """Token sống ngắn (2 phút, aud='dl') chỉ để tải file qua <a download> (?token=...).
    Không dùng được cho API khác; rò rỉ vào nginx log cũng hết hạn ngay -> không phải JWT phiên."""
    from app.auth.utils import AUD_DOWNLOAD
    token = create_access_token({"sub": user.id}, expires_delta=timedelta(minutes=2),
                                audience=AUD_DOWNLOAD)
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
        email_verified=bool(user.email_verified),
        email_verify_required=settings.email_verify_required,
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


def _sent_aware(user) -> datetime | None:
    s = user.email_verify_sent_at
    return s.replace(tzinfo=timezone.utc) if (s and s.tzinfo is None) else s


# Brute-force lockout cho verify-email: mã 6 số chỉ 1 triệu tổ hợp,
# không giới hạn attempts thì thử vét cạn <10 phút. Sau 8 lần sai trong 15 phút
# khoá theo user id (không dò được email valid vì phải có token đăng nhập).
_verify_attempts: dict[str, list[float]] = {}


def _check_verify_bruteforce(user_id: str) -> None:
    import time
    now = time.time()
    win = _verify_attempts.setdefault(user_id, [])
    _verify_attempts[user_id] = [t for t in win if now - t < 900]   # 15 phút
    if len(_verify_attempts[user_id]) >= 8:
        raise HTTPException(429, "Sai mã quá nhiều lần. Đợi 15 phút hoặc gửi lại mã.")


def _register_verify_failure(user_id: str) -> None:
    import time
    _verify_attempts.setdefault(user_id, []).append(time.time())


@router.post("/verify-email")
async def verify_email(
    body: VerifyEmailRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if user.email_verified:
        return {"ok": True, "already": True}
    _check_verify_bruteforce(user.id)
    sent = _sent_aware(user)
    if not sent or datetime.now(timezone.utc) - sent > timedelta(minutes=15):
        raise HTTPException(status_code=400, detail="Mã đã hết hạn. Bấm gửi lại mã.")
    if not user.email_verify_code or (body.code or "").strip() != user.email_verify_code:
        _register_verify_failure(user.id)
        raise HTTPException(status_code=400, detail="Mã không đúng.")
    user.email_verified = True
    user.email_verify_code = None
    _verify_attempts.pop(user.id, None)
    await db.commit()
    return {"ok": True}


@router.post("/resend-verification")
async def resend_verification(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if user.email_verified:
        return {"ok": True, "already": True}
    sent = _sent_aware(user)
    if sent and datetime.now(timezone.utc) - sent < timedelta(seconds=60):
        raise HTTPException(status_code=429, detail="Vui lòng đợi 60 giây rồi gửi lại.")
    code = _gen_code()
    user.email_verify_code = code
    user.email_verify_sent_at = _naive_utc()
    await db.commit()
    if not await send_verification_email(user.email, code):
        raise HTTPException(status_code=502, detail="Gửi email thất bại, thử lại sau.")
    return {"ok": True}


@router.post("/gemini-key")
async def save_gemini_key(
    body: UpdateGeminiKey,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    keys = [k.strip() for k in (body.api_key or "").split(",") if k.strip()]
    user.gemini_api_key = enc(",".join(keys)) if keys else None
    user.has_gemini_key = bool(keys)
    await db.commit()
    return {"ok": True, "count": len(keys), "message": f"Đã lưu {len(keys)} API Key vào Pool cá nhân"}
