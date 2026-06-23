"""DEV helper — tự cấp gói + quyền admin cho 1 user để test cục bộ (chưa có cổng thanh toán).

    python dev_grant.py you@email.com           # cấp gói 'pro' + admin
    python dev_grant.py you@email.com basic      # cấp gói khác
"""
import asyncio
import sys

from sqlalchemy import select

from app.database import AsyncSessionLocal
from app.auth.models import User
from app import subscription


async def main():
    if len(sys.argv) < 2:
        print("Dùng: python dev_grant.py <email> [plan=pro]")
        return 1
    email = sys.argv[1]
    plan = sys.argv[2] if len(sys.argv) > 2 else "pro"
    async with AsyncSessionLocal() as db:
        u = (await db.execute(select(User).where(User.email == email))).scalar_one_or_none()
        if not u:
            print(f"❌ Không thấy user {email} — đăng ký trên web trước đã.")
            return 1
        subscription.activate(u, plan)
        u.is_admin = True
        await db.commit()
        print(f"✅ {email}: plan={u.plan}, hết hạn {u.plan_expires_at}, is_admin=True")
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
