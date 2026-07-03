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
    out = stdout.read().decode('utf-8', errors='replace')
    ssh.close()
    return out

def main():
    print(run_ssh(host, 'journalctl -u veo3-api --since "20:13:00" --no-pager | grep -i "login"'))

if __name__ == "__main__":
    main()
