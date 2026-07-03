import psycopg2
conn = psycopg2.connect("postgresql://veo3:iouX-4LBGcp_GxVGdjWYOcxF@localhost:5432/veo3web")
conn.autocommit = True
cur = conn.cursor()
cur.execute("SELECT count(*) FROM users")
print("USERS:", cur.fetchone()[0])
cur.execute("SELECT count(*) FROM projects")
print("PROJECTS:", cur.fetchone()[0])
cur.execute("SELECT count(*) FROM scenes")
print("SCENES:", cur.fetchone()[0])
cur.close()
conn.close()
