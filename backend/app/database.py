from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from app.config import settings

engine = create_async_engine(settings.database_url, echo=False)
AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


async def get_db() -> AsyncSession:
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()


async def init_db():
    async with engine.begin() as conn:
        from app.auth.models import User  # noqa: F401
        from app.videos.models import VideoJob  # noqa: F401
        from app.sessions.models import UserSession  # noqa: F401
        from app.projects.models import Project, Scene  # noqa: F401
        from app.characters.models import Character  # noqa: F401
        from app.billing.models import Payment  # noqa: F401
        await conn.run_sync(Base.metadata.create_all)
