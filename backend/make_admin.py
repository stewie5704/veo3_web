"""Tạo (hoặc nâng) 1 tài khoản ADMIN. Admin chỉ quản lý hệ thống/người dùng — KHÔNG tạo
video nên KHÔNG cần gói.

    python make_admin.py <email> <password>

- Nếu email chưa có → tạo user mới.
- Nếu đã có → set lại mật khẩu + bật admin.
"""
import asyncio
import sys
import uuid

from sqlalchemy import select

from app.database import AsyncSessionLocal
from app.auth.models import User
from app.auth.utils import hash_password


async def main():
    if len(sys.argv) < 3:
        print("Dùng: python make_admin.py <email> <password>")
        return 1
    email, password = sys.argv[1], sys.argv[2]
    async with AsyncSessionLocal() as db:
        u = (await db.execute(select(User).where(User.email == email))).scalar_one_or_none()
        if u:
            u.hashed_password = hash_password(password)
            print(f"User {email} đã tồn tại → cập nhật mật khẩu + bật admin")
        else:
            username = email.split("@")[0]
            if (await db.execute(select(User).where(User.username == username))).scalar_one_or_none():
                username = f"{username}_{uuid.uuid4().hex[:4]}"
            u = User(email=email, username=username, hashed_password=hash_password(password))
            db.add(u)
            print(f"Tạo user mới {email} (username={username})")
        u.is_admin = True
        u.is_active = True
        u.is_banned = False
        await db.commit()
        print(f"✅ {email}: admin=True (quản lý hệ thống, không cần gói)")
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
