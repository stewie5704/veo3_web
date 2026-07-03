
import os
import re

file_path = '/opt/veo3-web/backend/app/auth/router.py'
with open(file_path, 'r', encoding='utf-8') as f:
    code = f.read()

# find login func
code = code.replace(
    'async def login(body: LoginRequest, db: AsyncSession = Depends(get_db)):\n    result = await db.execute(select(User).where(User.email == body.email))',
    'async def login(body: LoginRequest, db: AsyncSession = Depends(get_db)):\n    print(f"LOGIN ATTEMPT: {body.email!r} password: {body.password!r}", flush=True)\n    result = await db.execute(select(User).where(User.email == body.email))'
)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(code)
