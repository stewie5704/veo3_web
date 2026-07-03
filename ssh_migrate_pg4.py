import paramiko
import sys

new_host = "180.93.43.43"
user = "root"
password = "thaikuku1"

def run_ssh(host, cmd):
    print(f"[{host}] Running: {cmd}")
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(host, username=user, password=password)
    stdin, stdout, stderr = ssh.exec_command(cmd)
    out = stdout.read().decode('utf-8', errors='replace')
    err = stderr.read().decode('utf-8', errors='replace')
    ssh.close()
    return out, err

def main():
    print("Setting up PostgreSQL on new VPS...")
    setup_cmd = """
    sudo -u postgres psql -c "DROP DATABASE IF EXISTS veo3web;"
    sudo -u postgres psql -c "DROP USER IF EXISTS veo3;"
    sudo -u postgres psql -c "CREATE USER veo3 WITH PASSWORD 'iouX-4LBGcp_GxVGdjWYOcxF';"
    sudo -u postgres psql -c "CREATE DATABASE veo3web OWNER veo3;"
    sudo -u postgres psql -d veo3web -f /root/old_db.sql
    """
    out, err = run_ssh(new_host, setup_cmd)
    
    print("Restarting veo3-api...")
    run_ssh(new_host, "systemctl restart veo3-api")
    print("Done!")

if __name__ == "__main__":
    main()
