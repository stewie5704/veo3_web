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
    # 1. Dump Postgres from old VPS
    print("Dumping Postgres from old VPS...")
    # Note: password is in connection string or .pgpass, let's use the connection string directly
    # pg_dump -d postgresql://veo3:iouX-4LBGcp_GxVGdjWYOcxF@localhost:5433/veo3web > old_db.sql
    cmd_dump = "pg_dump -d postgresql://veo3:iouX-4LBGcp_GxVGdjWYOcxF@localhost:5433/veo3web -f /root/old_db.sql"
    out, err = run_ssh(old_host, cmd_dump)
    if err:
        print("Error dumping:", err)
    
    # 2. Download from old VPS
    print("Downloading old_db.sql...")
    old_ssh = paramiko.SSHClient()
    old_ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    old_ssh.connect(old_host, username=user, password=password)
    sftp = old_ssh.open_sftp()
    sftp.get('/root/old_db.sql', 'old_db.sql')
    sftp.close()
    old_ssh.close()

    # 3. Install Postgres on new VPS
    print("Installing PostgreSQL on new VPS...")
    run_ssh(new_host, "apt-get update && apt-get install -y postgresql")

    # 4. Upload to new VPS
    print("Uploading old_db.sql to new VPS...")
    new_ssh = paramiko.SSHClient()
    new_ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    new_ssh.connect(new_host, username=user, password=password)
    sftp = new_ssh.open_sftp()
    sftp.put('old_db.sql', '/root/old_db.sql')
    
    # Also upload the old .env so we don't lose env vars
    old_ssh = paramiko.SSHClient()
    old_ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    old_ssh.connect(old_host, username=user, password=password)
    sftp_old = old_ssh.open_sftp()
    sftp_old.get('/opt/veo3-web/backend/.env', 'old_env')
    sftp_old.close()
    old_ssh.close()
    
    sftp.put('old_env', '/opt/veo3-web/backend/.env')
    sftp.close()
    new_ssh.close()

    # 5. Setup Postgres DB and User on new VPS
    print("Setting up PostgreSQL on new VPS...")
    setup_cmd = """
    sudo -u postgres psql -c "CREATE USER veo3 WITH PASSWORD 'iouX-4LBGcp_GxVGdjWYOcxF';"
    sudo -u postgres psql -c "CREATE DATABASE veo3web OWNER veo3;"
    sudo -u postgres psql -d veo3web -f /root/old_db.sql
    """
    out, err = run_ssh(new_host, setup_cmd)
    print("Setup output:", out, err)

    # Note: The old VPS used port 5433, but the new VPS will use default 5432.
    # We must fix the DATABASE_URL in .env
    fix_env_cmd = "sed -i 's/:5433/:5432/g' /opt/veo3-web/backend/.env"
    run_ssh(new_host, fix_env_cmd)

    # Install psycopg2/asyncpg if missing
    run_ssh(new_host, "cd /opt/veo3-web/backend && ./venv/bin/pip install asyncpg psycopg2-binary")

    # 6. Restart veo3-api
    print("Restarting veo3-api...")
    run_ssh(new_host, "systemctl restart veo3-api")

    print("Migration complete!")

if __name__ == "__main__":
    main()
