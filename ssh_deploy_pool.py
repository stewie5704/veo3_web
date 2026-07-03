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
    
    # Read output line by line as it comes in
    for line in iter(stdout.readline, ""):
        sys.stdout.write(line)
        sys.stdout.flush()
    for line in iter(stderr.readline, ""):
        sys.stderr.write(line)
        sys.stderr.flush()
    
    status = stdout.channel.recv_exit_status()
    ssh.close()
    return status

def main():
    cmd = """
cd /opt/veo3-web
git pull origin main
cd frontend && npm install && npm run build
systemctl restart veo3-api
    """
    sys.exit(run_ssh(host, cmd))

if __name__ == "__main__":
    main()
