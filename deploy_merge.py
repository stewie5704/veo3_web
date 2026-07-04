import paramiko
import sys

host = '180.93.43.43'
ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
try:
    ssh.connect(host, username='root', password='thaikuku1')
    
    commands = [
        "cd /root/veo3-web && git pull",
        "cd /root/veo3-web/frontend && npm run build",
        "pm2 restart veo3-backend"
    ]
    
    for cmd in commands:
        print(f"Running: {cmd}")
        stdin, stdout, stderr = ssh.exec_command(cmd)
        print(stdout.read().decode())
        err = stderr.read().decode()
        if err:
            print(f"Error: {err}")
    
    ssh.close()
    print("Deployment successful!")
except Exception as e:
    print(f"Deploy failed: {e}")
