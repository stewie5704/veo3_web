import paramiko
import sys

host = "180.93.43.43"
user = "root"
password = "thaikuku1"

def run_ssh_command(cmd):
    print(f"Running: {cmd}")
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(host, username=user, password=password)
    stdin, stdout, stderr = ssh.exec_command(cmd)
    
    out = stdout.read().decode('utf-8')
    err = stderr.read().decode('utf-8')
    print("STDOUT:", out)
    if err:
        print("STDERR:", err)
    
    ssh.close()
    return out, err

if __name__ == "__main__":
    script = """import sys
sys.path.insert(0, '/opt/veo3-web/backend')
from app.auth.utils import verify_password
import sqlite3
conn = sqlite3.connect('/opt/veo3-web/backend/veo3web.db')
c = conn.cursor()
c.execute('SELECT hashed_password FROM users WHERE email="thaidem@gmail.com"')
hashed = c.fetchone()[0]
print("hashed length:", len(hashed))
print("verify_password:", verify_password("Thaikuku@1", hashed))
"""
    with open('test_auth.py', 'w') as f:
        f.write(script)
    
    run_ssh_command("cat << 'EOF' > /opt/veo3-web/backend/test_auth.py\n" + script + "\nEOF")
    run_ssh_command("cd /opt/veo3-web/backend && ./venv/bin/python test_auth.py")
