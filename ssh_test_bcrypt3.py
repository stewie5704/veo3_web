import sys
sys.path.append('/opt/veo3-web/backend')
from app.auth.utils import hash_password, verify_password
import psycopg2

h = hash_password("326931")
conn = psycopg2.connect("postgresql://veo3:iouX-4LBGcp_GxVGdjWYOcxF@localhost:5432/veo3web")
conn.autocommit = True
cur = conn.cursor()
cur.execute("UPDATE users SET hashed_password=%s WHERE email='hoangdieu.hui@gmail.com'", (h,))
cur.close()
conn.close()
print("Updated db with new hash!")
