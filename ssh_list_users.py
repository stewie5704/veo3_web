import sqlite3
conn = sqlite3.connect('/opt/veo3-web/backend/veo3web.db')
c = conn.cursor()
c.execute('SELECT email FROM users')
print([x[0] for x in c.fetchall()])
