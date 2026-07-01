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
        ("projects", "seed", "INTEGER DEFAULT 0"),
        ("projects", "audio_mode", "VARCHAR(20) DEFAULT 'voiceover'"),
        ("scenes", "voice", "VARCHAR(40) DEFAULT ''"),
        ("scenes", "part", "INTEGER DEFAULT 1"),
        ("projects", "part_scripts", "TEXT"),
        ("video_jobs", "start_image", "VARCHAR(500)"),
        ("video_jobs", "ref_images", "TEXT"),
        ("payments", "expires_at", "TIMESTAMP"),
        ("video_jobs", "hd", "BOOLEAN DEFAULT FALSE"),
        ("scenes", "hd", "BOOLEAN DEFAULT FALSE"),
        ("projects", "hd", "BOOLEAN DEFAULT FALSE"),
        ("users", "referral_code", "VARCHAR(16)"),
        ("users", "referred_by", "VARCHAR(36)"),
        ("users", "is_affiliate", "BOOLEAN DEFAULT FALSE"),
        ("users", "affiliate_rate", "INTEGER DEFAULT 20"),
        ("users", "images_generated", "INTEGER DEFAULT 0"),
        ("users", "affiliate_rate_locked", "BOOLEAN DEFAULT FALSE"),
        ("users", "wallet_balance", "INTEGER DEFAULT 0"),
        ("users", "auto_renew", "BOOLEAN DEFAULT FALSE"),
        ("users", "email_verified", "BOOLEAN DEFAULT FALSE"),
        ("users", "email_verify_code", "VARCHAR(8)"),
        ("users", "email_verify_sent_at", "TIMESTAMP"),
        ("projects", "character_bible", "TEXT"),
        ("commissions", "level", "INTEGER DEFAULT 1"),
        ("projects", "i2v_fix", "BOOLEAN DEFAULT FALSE"),
    ]
    for table, col, ddl in adds:
        if table in existing and col not in existing[table]:
            conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {col} {ddl}"))
    # Affiliate 2 tầng: bảng commissions trước đây unique(payment_id) = 1 hoa hồng/đơn. Giờ cho phép
    # F1 (level 1) + F2 (level 2) cùng 1 đơn -> BỎ ràng buộc unique đơn-cột cũ, thay bằng unique
    # (payment_id, level). Drop động theo tên thật (Postgres tự đặt tên) để chắc tay, tránh F2 insert
    # đụng ràng buộc cũ -> rollback nuốt luôn việc kích hoạt gói.
    if "commissions" in existing and conn.dialect.name == "postgresql":
        ucons = conn.execute(text(
            "SELECT con.conname FROM pg_constraint con "
            "JOIN pg_class rel ON rel.oid = con.conrelid "
            "WHERE rel.relname = 'commissions' AND con.contype = 'u'")).fetchall()
        for (cname,) in ucons:
            cols = {r[0] for r in conn.execute(text(
                "SELECT a.attname FROM pg_constraint con "
                "JOIN pg_attribute a ON a.attrelid = con.conrelid AND a.attnum = ANY(con.conkey) "
                "WHERE con.conname = :n"), {"n": cname}).fetchall()}
            if cols == {"payment_id"}:   # chỉ drop unique CHỈ gồm payment_id, không đụng cái khác
                conn.execute(text(f'ALTER TABLE commissions DROP CONSTRAINT IF EXISTS "{cname}"'))
    if "commissions" in existing:
        conn.execute(text("CREATE UNIQUE INDEX IF NOT EXISTS ix_commissions_payment_level "
                          "ON commissions (payment_id, level)"))
    # index cho cột mới (IF NOT EXISTS chạy được trên cả SQLite & Postgres)
    if "characters" in existing:
        conn.execute(text("CREATE INDEX IF NOT EXISTS ix_characters_project_id ON characters (project_id)"))
    # referral_code: model khai unique=True nhưng ALTER ADD COLUMN không tạo ràng buộc đó
    # -> tự tạo unique index để khớp DB fresh (NULL được phép trùng trên cả SQLite & Postgres)
    if "users" in existing:
        conn.execute(text("CREATE UNIQUE INDEX IF NOT EXISTS ix_users_referral_code ON users (referral_code)"))
    # Grandfather: user tồn tại TRƯỚC khi có xác minh email -> coi như đã xác minh (chỉ chạy 1 lần, lúc cột vừa thêm).
    if "users" in existing and "email_verified" not in existing["users"]:
        conn.execute(text("UPDATE users SET email_verified = TRUE"))


async def init_db():
    async with engine.begin() as conn:
        from app.auth.models import User  # noqa: F401
        from app.videos.models import VideoJob  # noqa: F401
        from app.sessions.models import UserSession  # noqa: F401
        from app.projects.models import Project, Scene  # noqa: F401
        from app.characters.models import Character  # noqa: F401
        from app.billing.models import Payment, AssistantGift, Commission, WalletTxn  # noqa: F401
        await conn.run_sync(Base.metadata.create_all)
        await conn.run_sync(_lightweight_migrate)
