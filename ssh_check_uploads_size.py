import paramiko
import sys

old_host = "74.81.54.150"
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
    cmd = "du -sh /opt/veo3-web/uploads"
    out, err = run_ssh(old_host, cmd)
    print("STDOUT:", out)
    print("STDERR:", err)

if __name__ == "__main__":
    main()
