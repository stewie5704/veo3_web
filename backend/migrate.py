"""
Migration script — thêm các cột mới vào DB hiện có.
Chạy 1 lần: python migrate.py
"""
import asyncio
import aiosqlite
import os
from pathlib import Path

# Tìm file DB — thử nhiều path
CANDIDATES = [
    Path(__file__).parent / "veo3web.db",
    Path(__file__).parent / "veo3.db",
    Path("veo3web.db"),
    Path("veo3.db"),
]
DB_PATH = next((str(p) for p in CANDIDATES if p.exists()), str(Path(__file__).parent / "veo3web.db"))


# Danh sách ALTER TABLE cần chạy
MIGRATIONS = [
    # users table
    "ALTER TABLE users ADD COLUMN is_banned BOOLEAN DEFAULT 0",
    "ALTER TABLE users ADD COLUMN has_gemini_key BOOLEAN DEFAULT 0",
    "ALTER TABLE users ADD COLUMN quota_videos INTEGER DEFAULT 100",
    "ALTER TABLE users ADD COLUMN videos_generated INTEGER DEFAULT 0",
    "ALTER TABLE users ADD COLUMN display_name VARCHAR(100)",
    "ALTER TABLE users ADD COLUMN avatar_url VARCHAR(300)",
    "ALTER TABLE users ADD COLUMN plan VARCHAR(20) DEFAULT 'free'",
    "ALTER TABLE users ADD COLUMN plan_expires_at DATETIME",
    # projects table
    "ALTER TABLE projects ADD COLUMN chain_mode BOOLEAN DEFAULT 0",
    "ALTER TABLE projects ADD COLUMN merged_file VARCHAR(300)",
    # scenes table
    "ALTER TABLE scenes ADD COLUMN start_image VARCHAR(300)",
    "ALTER TABLE scenes ADD COLUMN wait_for_prev BOOLEAN DEFAULT 0",
]


async def migrate():
    print(f"DB: {DB_PATH}")
    async with aiosqlite.connect(DB_PATH) as db:
        for sql in MIGRATIONS:
            try:
                await db.execute(sql)
                await db.commit()
                col = sql.split("ADD COLUMN")[1].strip().split()[0]
                print(f"  ✅ {col}")
            except Exception as e:
                if "duplicate column" in str(e).lower():
                    col = sql.split("ADD COLUMN")[1].strip().split()[0]
                    print(f"  ⏭  {col} (đã có)")
                else:
                    print(f"  ❌ {sql[:60]} → {e}")

    print("\n✅ Migration xong!")


if __name__ == "__main__":
    asyncio.run(migrate())
