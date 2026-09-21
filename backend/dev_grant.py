"""DEV helper — cấp gói cho 1 USER thường để test tạo video (chưa có cổng thanh toán).
Không đụng quyền admin (admin tạo bằng make_admin.py).

    python dev_grant.py you@email.com           # cấp gói 'pro'
    python dev_grant.py you@email.com basic      # cấp gói khác
"""
import asyncio
import sys

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

from sqlalchemy import select

from app.database import AsyncSessionLocal
from app.auth.models import User
from app import subscription


async def main():
    if len(sys.argv) < 2:
        print("Dùng: python dev_grant.py <email> [plan=pro]")
        return 1
    email = sys.argv[1]
    raw_plan = sys.argv[2] if len(sys.argv) > 2 else "m1"
    aliases = {"pro": "m1", "basic": "m1", "yearly": "m12", "1m": "m1", "6m": "m6", "12m": "m12"}
    plan = aliases.get(raw_plan.lower(), raw_plan)
    async with AsyncSessionLocal() as db:
        u = (await db.execute(select(User).where(User.email == email))).scalar_one_or_none()
        if not u:
            print(f"❌ Không thấy user {email} — đăng ký trên web trước đã.")
            return 1
        subscription.activate(u, plan)
        await db.commit()
        print(f"✅ {email}: plan={u.plan}, hết hạn {u.plan_expires_at} (user thường, để test tạo video)")
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
