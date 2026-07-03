import sqlite3
conn = sqlite3.connect('/opt/veo3-web/backend/veo3web.db')
c = conn.cursor()
c.execute('SELECT id, email, is_admin FROM users')
print(c.fetchall())
