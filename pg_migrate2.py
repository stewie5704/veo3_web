import asyncio
from sqlalchemy.ext.asyncio import create_async_engine
from app.config import settings
from sqlalchemy import text

async def run():
    print('Connecting to:', settings.database_url)
    engine = create_async_engine(settings.database_url)
    async with engine.begin() as conn:
        try:
            await conn.execute(text("ALTER TABLE users ADD COLUMN extra_storage_gb INTEGER DEFAULT 0;"))
            print('Added extra_storage_gb')
        except Exception as e:
            print('Error (might already exist):', e)
    await engine.dispose()

asyncio.run(run())
