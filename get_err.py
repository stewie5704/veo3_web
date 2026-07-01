import asyncio
import asyncpg
async def run():
    conn = await asyncpg.connect('postgresql://veo3:iouX-4LBGcp_GxVGdjWYOcxF@localhost:5433/veo3web')
    rows = await conn.fetch("SELECT error_msg FROM scenes WHERE status='failed' ORDER BY created_at DESC LIMIT 15")
    for r in rows: print(r['error_msg'])
asyncio.run(run())
