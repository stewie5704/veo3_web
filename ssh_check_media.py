import paramiko
import sys

old_host = "74.81.54.150"
user = "root"
password = "thaikuku1"

def run_ssh(host, cmd):
    print(f"[{host}] Running: {cmd}")
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    try:
        ssh.connect(host, username=user, password=password)
        stdin, stdout, stderr = ssh.exec_command(cmd)
        out = stdout.read().decode('utf-8', errors='replace')
        err = stderr.read().decode('utf-8', errors='replace')
        ssh.close()
        return out, err
    except Exception as e:
        return "", str(e)

def main():
    cmd = "ls -la /opt/veo3-web/uploads /opt/veo3-web/images /opt/veo3-web/audio /opt/veo3-web/merged /opt/veo3-web/thumbnails"
    out, err = run_ssh(old_host, cmd)
    print("STDOUT:", out)
    print("STDERR:", err)

    # Also check what folders exist in /opt/veo3-web/
    out, err = run_ssh(old_host, "ls -la /opt/veo3-web/")
    print("STDOUT2:", out)

if __name__ == "__main__":
    main()
