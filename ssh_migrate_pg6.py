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
    print("Fixing permissions and importing DB...")
    setup_cmd = """
    cp /root/old_db.sql /tmp/old_db.sql
    chmod 644 /tmp/old_db.sql
    su - postgres -c "psql -d veo3web -f /tmp/old_db.sql"
    """
    out, err = run_ssh(new_host, setup_cmd)
    print(out, err)

    print("Migrating columns...")
    script = """import psycopg2
conn = psycopg2.connect("postgresql://veo3:iouX-4LBGcp_GxVGdjWYOcxF@localhost:5432/veo3web")
conn.autocommit = True
cur = conn.cursor()

migrations = [
    "ALTER TABLE users ADD COLUMN is_banned BOOLEAN DEFAULT false",
    "ALTER TABLE users ADD COLUMN has_gemini_key BOOLEAN DEFAULT false",
    "ALTER TABLE users ADD COLUMN quota_videos INTEGER DEFAULT 100",
    "ALTER TABLE users ADD COLUMN videos_generated INTEGER DEFAULT 0",
    "ALTER TABLE users ADD COLUMN display_name VARCHAR(100)",
    "ALTER TABLE users ADD COLUMN avatar_url VARCHAR(300)",
    "ALTER TABLE users ADD COLUMN plan VARCHAR(20) DEFAULT 'free'",
    "ALTER TABLE users ADD COLUMN plan_expires_at TIMESTAMP",
    "ALTER TABLE users ADD COLUMN buyer_discount_rate INTEGER DEFAULT 0",
    "ALTER TABLE projects ADD COLUMN chain_mode BOOLEAN DEFAULT false",
    "ALTER TABLE projects ADD COLUMN merged_file VARCHAR(300)",
    "ALTER TABLE scenes ADD COLUMN start_image VARCHAR(300)",
    "ALTER TABLE scenes ADD COLUMN wait_for_prev BOOLEAN DEFAULT false",
    "ALTER TABLE referrals ADD COLUMN buyer_discount_rate INTEGER DEFAULT 0"
]
for sql in migrations:
    try:
        cur.execute(sql)
        print("OK:", sql)
    except Exception as e:
        pass
cur.execute("UPDATE users SET email = LOWER(email)")
print("Updated all emails to lowercase.")
cur.close()
conn.close()
"""
    run_ssh(new_host, "cat << 'EOF' > /opt/veo3-web/backend/pg_migrate.py\n" + script + "\nEOF")
    out, err = run_ssh(new_host, "cd /opt/veo3-web/backend && ./venv/bin/python pg_migrate.py")
    print("Migration output:", out, err)

    print("Restarting veo3-api...")
    run_ssh(new_host, "systemctl restart veo3-api")

if __name__ == "__main__":
    main()
