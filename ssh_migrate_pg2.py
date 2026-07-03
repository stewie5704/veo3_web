import paramiko
import sys
import time

old_host = "74.81.54.150"
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
    print("Dumping Postgres from old VPS via Docker...")
    cmd_dump = "docker exec veo3-pg pg_dump -U veo3 veo3web > /root/old_db.sql"
    out, err = run_ssh(old_host, cmd_dump)
    if err:
        print("Error dumping:", err)
    
    print("Downloading old_db.sql...")
    old_ssh = paramiko.SSHClient()
    old_ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    old_ssh.connect(old_host, username=user, password=password)
    sftp = old_ssh.open_sftp()
    sftp.get('/root/old_db.sql', 'old_db.sql')
    sftp.close()
    old_ssh.close()

    print("Uploading old_db.sql to new VPS...")
    new_ssh = paramiko.SSHClient()
    new_ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    new_ssh.connect(new_host, username=user, password=password)
    sftp = new_ssh.open_sftp()
    sftp.put('old_db.sql', '/root/old_db.sql')
    sftp.close()
    new_ssh.close()

    print("Setting up PostgreSQL on new VPS...")
    setup_cmd = """
    sudo -u postgres psql -c "DROP DATABASE IF EXISTS veo3web;"
    sudo -u postgres psql -c "DROP USER IF EXISTS veo3;"
    sudo -u postgres psql -c "CREATE USER veo3 WITH PASSWORD 'iouX-4LBGcp_GxVGdjWYOcxF';"
    sudo -u postgres psql -c "CREATE DATABASE veo3web OWNER veo3;"
    sudo -u postgres psql -d veo3web -f /root/old_db.sql
    """
    out, err = run_ssh(new_host, setup_cmd)
    print("Setup output:", out, err)

    fix_env_cmd = "sed -i 's/:5433/:5432/g' /opt/veo3-web/backend/.env"
    run_ssh(new_host, fix_env_cmd)

    print("Restarting veo3-api...")
    run_ssh(new_host, "systemctl restart veo3-api")
    print("Migration complete!")

if __name__ == "__main__":
    main()
