import paramiko
import sys

host = "180.93.43.43"
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
    print(run_ssh(host, "apt-get install -f -y"))
    print(run_ssh(host, "systemctl start postgresql"))
    print(run_ssh(host, "id postgres"))

if __name__ == "__main__":
    main()
