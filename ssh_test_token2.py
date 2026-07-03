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
    out = stdout.read()
    err = stderr.read()
    ssh.close()
    return out, err

def main():
    cmd = """
cat << 'EOF' > /tmp/test_token.py
import sys
sys.path.append('/opt/veo3-web/backend')
from app.auth.utils import decode_token
from app.config import settings
print('SECRET_KEY:', settings.secret_key)
token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3NWIzMmE2Yi1jMDZkLTRhN2ItYjVmNC1iZTU0MzNiMDhjYWUiLCJleHQiOnRydWUsImV4cCI6MTc4NTY1NzAwOH0.RS4j7s2PIvDo6tduZXaaxjwvwTGlFhGYgPeKHUBeCYI'
print('DECODE:', decode_token(token))
EOF
/opt/veo3-web/backend/venv/bin/python /tmp/test_token.py
    """
    out, err = run_ssh(host, cmd)
    sys.stdout.buffer.write(b"OUT: " + out + b"\n")
    sys.stdout.buffer.write(b"ERR: " + err + b"\n")

if __name__ == "__main__":
    main()
