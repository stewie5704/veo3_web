import paramiko
import sys

host = '180.93.43.43'
user = 'root'
password = 'thaikuku1'

def run_ssh(host, cmd):
    print(f"--- Running on {host} ---")
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    try:
        ssh.connect(host, username=user, password=password)
        stdin, stdout, stderr = ssh.exec_command(cmd)
        
        while True:
            line = stdout.readline()
            if not line:
                break
            # Use ascii to ignore checkmarks and other unicode chars that windows terminal crashes on
            sys.stdout.write(line.encode('ascii', errors='ignore').decode('ascii'))
            
        err = stderr.read().decode('ascii', errors='ignore')
        if err:
            print("STDERR:", err)
            
        status = stdout.channel.recv_exit_status()
        return status
    finally:
        ssh.close()

def main():
    cmd = """
    cd /opt/veo3-web
    git reset --hard HEAD
    git pull origin main
    
    cd /opt/veo3-web/frontend
    npm run build
    
    cd /opt/veo3-web/backend
    source /opt/veo3-web/venv/bin/activate
    python migrate.py
    
    systemctl restart veo3-api
    """
    sys.exit(run_ssh(host, cmd))

if __name__ == "__main__":
    main()
