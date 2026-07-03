import paramiko

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
    script = """import sqlite3
conn = sqlite3.connect('/opt/veo3-web/backend/veo3web.db')
c = conn.cursor()
c.execute('SELECT id, email, is_admin FROM users')
print(c.fetchall())
"""
    with open('test2.py', 'w') as f:
        f.write(script)
    
    run_ssh_command('python3 -c "import sqlite3; conn = sqlite3.connect(\'/opt/veo3-web/backend/veo3web.db\'); c = conn.cursor(); c.execute(\'SELECT id, email, is_admin FROM users\'); print(c.fetchall())"')
