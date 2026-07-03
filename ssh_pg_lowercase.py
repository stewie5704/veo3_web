import psycopg2
conn = psycopg2.connect("postgresql://veo3:iouX-4LBGcp_GxVGdjWYOcxF@localhost:5432/veo3web")
conn.autocommit = True
cur = conn.cursor()
cur.execute("UPDATE users SET email = LOWER(email)")
print("Updated all emails to lowercase.")
cur.close()
conn.close()
