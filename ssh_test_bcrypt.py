import sys
sys.path.append('/opt/veo3-web/backend')
from app.auth.utils import hash_password, verify_password

h = hash_password("Thaikuku@1")
print("New Hash:", h)
print("Verify:", verify_password("Thaikuku@1", h))

import psycopg2
conn = psycopg2.connect("postgresql://veo3:iouX-4LBGcp_GxVGdjWYOcxF@localhost:5432/veo3web")
conn.autocommit = True
cur = conn.cursor()
cur.execute("UPDATE users SET hashed_password=%s WHERE email='thaidem57@gmail.com'", (h,))
cur.close()
conn.close()
print("Updated db with new hash!")
