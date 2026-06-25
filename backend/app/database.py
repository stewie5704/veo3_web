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


def _lightweight_migrate(conn):
    """create_all không ALTER bảng đã có -> tự thêm cột mới còn thiếu (idempotent,
    chạy cho cả SQLite lẫn Postgres). Mỗi dòng = 1 cột thêm sau này."""
    from sqlalchemy import inspect, text
    insp = inspect(conn)
    existing = {t: {c["name"] for c in insp.get_columns(t)} for t in insp.get_table_names()}
    adds = [
        ("characters", "project_id", "VARCHAR(36)"),
        ("projects", "voiceover", "BOOLEAN DEFAULT FALSE"),
        ("projects", "voice", "VARCHAR(40) DEFAULT 'Kore'"),
        ("projects", "stopped", "BOOLEAN DEFAULT FALSE"),
        ("scenes", "voice", "VARCHAR(40) DEFAULT ''"),
    ]
    for table, col, ddl in adds:
        if table in existing and col not in existing[table]:
            conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {col} {ddl}"))
    # index cho cột mới (IF NOT EXISTS chạy được trên cả SQLite & Postgres)
    if "characters" in existing:
        conn.execute(text("CREATE INDEX IF NOT EXISTS ix_characters_project_id ON characters (project_id)"))


async def init_db():
    async with engine.begin() as conn:
        from app.auth.models import User  # noqa: F401
        from app.videos.models import VideoJob  # noqa: F401
        from app.sessions.models import UserSession  # noqa: F401
        from app.projects.models import Project, Scene  # noqa: F401
        from app.characters.models import Character  # noqa: F401
        from app.billing.models import Payment  # noqa: F401
        await conn.run_sync(Base.metadata.create_all)
        await conn.run_sync(_lightweight_migrate)
