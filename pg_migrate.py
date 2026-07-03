import asyncio
from sqlalchemy.ext.asyncio import create_async_engine
from app.config import settings
from sqlalchemy import text

async def run():
    print('Connecting to:', settings.database_url)
    engine = create_async_engine(settings.database_url)
    async with engine.begin() as conn:
        try:
            await conn.execute(text("ALTER TABLE users ADD COLUMN ref_discount_voided BOOLEAN DEFAULT False;"))
            print('Added ref_discount_voided')
        except Exception as e:
            print('Error (might already exist):', e)
    await engine.dispose()

asyncio.run(run())
