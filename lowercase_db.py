import sqlite3
conn = sqlite3.connect('/opt/veo3-web/backend/veo3web.db')
c = conn.cursor()
c.execute('UPDATE users SET email = lower(email)')
conn.commit()
print("Updated all emails to lowercase.")
