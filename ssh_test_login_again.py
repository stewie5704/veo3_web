import sys
sys.path.append('/opt/veo3-web/backend')
import psycopg2
from app.auth.utils import verify_password

conn = psycopg2.connect("postgresql://veo3:iouX-4LBGcp_GxVGdjWYOcxF@localhost:5432/veo3web")
conn.autocommit = True
cur = conn.cursor()

cur.execute("SELECT hashed_password FROM users WHERE email='thaidem57@gmail.com'")
row = cur.fetchone()
print("DB Hash:", row[0])

is_valid = verify_password("Thaikuku@1", row[0])
print("Verify with string 'Thaikuku@1':", is_valid)

cur.close()
conn.close()
