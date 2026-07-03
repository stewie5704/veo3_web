
import os

file_path = '/opt/veo3-web/backend/app/auth/router.py'
with open(file_path, 'r', encoding='utf-8') as f:
    code = f.read()

# fix case-sensitive email
code = code.replace(
    'result = await db.execute(select(User).where(User.email == body.email))',
    'body.email = body.email.lower()\n    result = await db.execute(select(User).where(User.email == body.email))'
)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(code)
