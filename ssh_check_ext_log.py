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
    out = stdout.read()
    ssh.close()
    return out

def main():
    out = run_ssh(host, "journalctl -u veo3-api --no-pager | grep -i 'Extension connected' | tail -n 20")
    sys.stdout.buffer.write(out)

if __name__ == "__main__":
    main()
