import paramiko
import sys

old_host = "74.81.54.150"
user = "root"
password = "thaikuku1"

def run_ssh_command(cmd):
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(old_host, username=user, password=password)
    stdin, stdout, stderr = ssh.exec_command(cmd)
    
    out = stdout.read()
    sys.stdout.buffer.write(out)
    
    ssh.close()

if __name__ == "__main__":
    run_ssh_command('cat /etc/systemd/system/veo3-api.service')
