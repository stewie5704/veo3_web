import paramiko
import sys

host = "180.93.43.43"
user = "root"
password = "thaikuku1"

def run_ssh(host, cmd):
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(host, username=user, password=password)
    stdin, stdout, stderr = ssh.exec_command(cmd)
    out = stdout.read().decode('utf-8', errors='replace')
    ssh.close()
    return out

def main():
    script = """import sys
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
"""
    with open('ssh_test_bcrypt.py', 'w') as f:
        f.write(script)
    run_ssh(host, f"cat << 'EOF' > /opt/veo3-web/backend/test_bcrypt.py\n{script}\nEOF")
    print(run_ssh(host, "cd /opt/veo3-web/backend && ./venv/bin/python test_bcrypt.py"))

if __name__ == "__main__":
    main()
