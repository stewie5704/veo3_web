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
    
    out = stdout.read().decode('utf-8', errors='replace')
    err = stderr.read().decode('utf-8', errors='replace')
    
    sys.stdout.buffer.write(b"STDOUT: " + out.encode('utf-8', errors='replace') + b"\n")
    if err:
        sys.stderr.buffer.write(b"STDERR: " + err.encode('utf-8', errors='replace') + b"\n")
    
    ssh.close()
    return out, err

if __name__ == "__main__":
    patch_code = """
import os

file_path = '/opt/veo3-web/backend/app/auth/router.py'
with open(file_path, 'r', encoding='utf-8') as f:
    code = f.read()

# fix case-sensitive email
code = code.replace(
    'result = await db.execute(select(User).where(User.email == body.email))',
    'body.email = body.email.lower()\\n    result = await db.execute(select(User).where(User.email == body.email))'
)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(code)
"""
    with open('patch_auth2.py', 'w') as f:
        f.write(patch_code)
    run_ssh_command("cat << 'EOF' > /opt/veo3-web/backend/patch_auth2.py\n" + patch_code + "EOF")
    run_ssh_command("cd /opt/veo3-web/backend && python3 patch_auth2.py")
    run_ssh_command("systemctl restart veo3-api")
