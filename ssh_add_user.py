import sys
import asyncio
sys.path.append('/opt/veo3-web/backend')

from app.database import async_session
from app.auth.models import User
from app.auth.security import get_password_hash
from sqlalchemy.future import select

async def create():
    async with async_session() as session:
        result = await session.execute(select(User).where(User.email == "thaidem57@gmail.com"))
        user = result.scalars().first()
        if user:
            print("User already exists, updating password.")
            user.hashed_password = get_password_hash("Thaikuku@1")
        else:
            print("Creating new user thaidem57@gmail.com")
            user = User(
                email="thaidem57@gmail.com",
                hashed_password=get_password_hash("Thaikuku@1"),
                is_active=True,
                is_banned=False,
                quota_videos=100,
                plan='free'
            )
            session.add(user)
        await session.commit()
        print("Done!")

if __name__ == "__main__":
    asyncio.run(create())
