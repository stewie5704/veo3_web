import sys
sys.path.append('/opt/veo3-web/backend')
import psycopg2
from app.auth.security import get_password_hash

conn = psycopg2.connect("postgresql://veo3:iouX-4LBGcp_GxVGdjWYOcxF@localhost:5432/veo3web")
conn.autocommit = True
cur = conn.cursor()

hashed = get_password_hash("Thaikuku@1")

cur.execute("SELECT id FROM users WHERE email='thaidem57@gmail.com'")
row = cur.fetchone()

if row:
    print("User exists. Updating password.")
    cur.execute("UPDATE users SET hashed_password=%s WHERE email='thaidem57@gmail.com'", (hashed,))
else:
    print("User does not exist. Creating...")
    cur.execute(
        "INSERT INTO users (email, hashed_password, is_active, is_banned, quota_videos, plan) VALUES (%s, %s, true, false, 100, 'free')",
        ("thaidem57@gmail.com", hashed)
    )

cur.close()
conn.close()
print("Done!")
