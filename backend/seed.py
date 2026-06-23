"""
Seed admin account — chạy 1 lần trước khi dùng:
    cd D:\veo3-web\backend
    python seed.py
"""
import asyncio
from app.database import AsyncSessionLocal, init_db
from app.auth.models import User
from app.auth.utils import hash_password
from app.config import settings
from sqlalchemy import select


async def main():
    await init_db()
    async with AsyncSessionLocal() as db:
        existing = await db.execute(select(User).where(User.email == settings.admin_email))
        if existing.scalar_one_or_none():
            print(f"✅ Admin đã tồn tại: {settings.admin_email}")
            return

        admin = User(
            email=settings.admin_email,
            username="admin",
            hashed_password=hash_password(settings.admin_password),
            is_admin=True,
        )
        db.add(admin)
        await db.commit()
        print(f"✅ Tạo admin thành công!")
        print(f"   Email:    {settings.admin_email}")
        print(f"   Password: {settings.admin_password}")
        print(f"   (Đổi trong file .env: ADMIN_EMAIL, ADMIN_PASSWORD)")


if __name__ == "__main__":
    asyncio.run(main())
