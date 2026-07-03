
import re

with open('/opt/veo3-web/backend/app/auth/router.py', 'r', encoding='utf-8') as f:
    code = f.read()

# patch login
old_login = '''@router.post("/login", response_model=TokenResponse)
async def login(body: LoginRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == body.email))'''

new_login = '''@router.post("/login", response_model=TokenResponse)
async def login(body: LoginRequest, db: AsyncSession = Depends(get_db)):
    body.email = body.email.lower()
    result = await db.execute(select(User).where(User.email == body.email))'''

# patch register
old_reg = '''@router.post("/register", response_model=TokenResponse)
async def register(body: RegisterRequest, db: AsyncSession = Depends(get_db)):
    # Check email exists'''

new_reg = '''@router.post("/register", response_model=TokenResponse)
async def register(body: RegisterRequest, db: AsyncSession = Depends(get_db)):
    body.email = body.email.lower()
    # Check email exists'''

code = code.replace(old_login, new_login)
code = code.replace(old_reg, new_reg)

with open('/opt/veo3-web/backend/app/auth/router.py', 'w', encoding='utf-8') as f:
    f.write(code)

print("Patched!")
