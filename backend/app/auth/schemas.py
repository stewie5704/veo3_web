from pydantic import BaseModel, EmailStr


class RegisterRequest(BaseModel):
    email: EmailStr
    username: str
    password: str
    ref: str | None = None   # affiliate referral code (from ?ref= on the signup link)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserResponse(BaseModel):
    id: str
    email: str
    username: str
    is_admin: bool
    google_connected: bool
    google_project_id: str | None
    has_gemini_key: bool
    plan: str = "free"
    plan_active: bool = False
    referred_by: str | None = None   # id người giới thiệu (đã có -> không cho đổi)

    model_config = {"from_attributes": True}


class UpdateGeminiKey(BaseModel):
    api_key: str


class ApplyRefRequest(BaseModel):
    ref: str   # mã giới thiệu nhập sau khi đăng ký (trang Hồ sơ)
