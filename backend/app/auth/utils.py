from datetime import datetime, timedelta, timezone
from typing import Iterable

import bcrypt
import jwt  # PyJWT (thay python-jose vì python-jose có CVE + không bảo trì)
from app.config import settings

# Audience: buộc token web KHÔNG dùng lại được nơi token extension và ngược lại.
AUD_WEB = "web"
AUD_EXT = "ext"
# Token tải file: sống ngắn (vài phút), CHỈ dùng cho endpoint download (nhét vào ?token= của
# <a download>). Rò rỉ vào nginx access-log thì cũng hết hạn ngay -> không phải JWT phiên 24h.
AUD_DOWNLOAD = "dl"


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode(), hashed.encode())
    except Exception:
        return False


def create_access_token(data: dict, expires_delta: timedelta | None = None,
                        audience: str = AUD_WEB) -> str:
    """Ký JWT HS256 kèm `aud`. Mọi caller cũ tự động lấy AUD_WEB (tương thích lịch sử);
    endpoint /extension-token chuyển audience thành AUD_EXT."""
    to_encode = dict(data)
    to_encode.setdefault("aud", audience)
    expire = datetime.now(timezone.utc) + (
        expires_delta or timedelta(minutes=settings.access_token_expire_minutes)
    )
    to_encode["exp"] = expire
    return jwt.encode(to_encode, settings.secret_key, algorithm=settings.algorithm)


def decode_token(token: str, audiences: Iterable[str] = (AUD_WEB, AUD_EXT)) -> dict | None:
    """Verify + decode. `audiences` = danh sách audience được chấp nhận.
    Trả về payload hoặc None nếu token hỏng / hết hạn / sai audience."""
    auds = list(audiences)
    # Token cũ (chưa có aud) — hỗ trợ backward-compat: thử không verify aud.
    try:
        return jwt.decode(
            token, settings.secret_key, algorithms=[settings.algorithm],
            audience=auds,
        )
    except jwt.MissingRequiredClaimError:
        # Legacy token chưa có aud — thử decode không verify aud (sẽ được thay khi user login lại).
        try:
            return jwt.decode(
                token, settings.secret_key, algorithms=[settings.algorithm],
                options={"verify_aud": False},
            )
        except jwt.PyJWTError:
            return None
    except jwt.PyJWTError:
        return None

