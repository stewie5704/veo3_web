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
    cmds = [
        "sed -i 's/--workers 4/--workers 1/g' /etc/systemd/system/veo3-api.service",
        "systemctl daemon-reload",
        "systemctl restart veo3-api"
    ]
    for cmd in cmds:
        out = run_ssh(host, cmd)
        sys.stdout.buffer.write(out)

if __name__ == "__main__":
    main()
