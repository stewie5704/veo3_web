import sys
sys.path.insert(0, '/opt/veo3-web/backend')
from app.auth.utils import verify_password
import sqlite3
conn = sqlite3.connect('/opt/veo3-web/backend/veo3web.db')
c = conn.cursor()
c.execute('SELECT hashed_password FROM users WHERE email="thaidem@gmail.com"')
hashed = c.fetchone()[0]
print("hashed length:", len(hashed))
print("verify_password:", verify_password("Thaikuku@1", hashed))
