import psycopg2
conn = psycopg2.connect("postgresql://veo3:iouX-4LBGcp_GxVGdjWYOcxF@localhost:5432/veo3web")
conn.autocommit = True
cur = conn.cursor()
cur.execute("SELECT id, email, is_active, is_banned, hashed_password FROM users WHERE email='thaidem57@gmail.com'")
print(cur.fetchall())
cur.close()
conn.close()
