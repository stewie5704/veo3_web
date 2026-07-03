import paramiko
import sys
import os

old_host = "74.81.54.150"
new_host = "180.93.43.43"
user = "root"
password = "thaikuku1"
db_path = "/opt/veo3-web/backend/veo3web.db"
local_db = "old_veo3web.db"

def main():
    print(f"Connecting to old VPS {old_host}...")
    old_ssh = paramiko.SSHClient()
    old_ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    try:
        old_ssh.connect(old_host, username=user, password=password)
    except Exception as e:
        print(f"Failed to connect to old VPS: {e}")
        return

    print("Downloading db from old VPS...")
    sftp = old_ssh.open_sftp()
    try:
        sftp.get(db_path, local_db)
        print("Download complete.")
    except Exception as e:
        print(f"Error downloading: {e}")
        return
    finally:
        sftp.close()
        old_ssh.close()

    print(f"Connecting to new VPS {new_host}...")
    new_ssh = paramiko.SSHClient()
    new_ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    try:
        new_ssh.connect(new_host, username=user, password=password)
    except Exception as e:
        print(f"Failed to connect to new VPS: {e}")
        return

    print("Uploading db to new VPS...")
    sftp = new_ssh.open_sftp()
    try:
        sftp.put(local_db, db_path)
        print("Upload complete.")
    except Exception as e:
        print(f"Error uploading: {e}")
        return
    finally:
        sftp.close()
    
    print("Restarting veo3-api on new VPS...")
    stdin, stdout, stderr = new_ssh.exec_command("systemctl restart veo3-api")
    out = stdout.read().decode('utf-8')
    err = stderr.read().decode('utf-8')
    print("Restart STDOUT:", out)
    print("Restart STDERR:", err)
    new_ssh.close()

    print("Migration complete!")

if __name__ == "__main__":
    main()
