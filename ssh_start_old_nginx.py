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
    err = stderr.read()
    sys.stdout.buffer.write(b"OUT:\n" + out + b"\nERR:\n" + err)
    ssh.close()

if __name__ == "__main__":
    # Just start nginx first to bring altivoxai.com back online immediately
    run_ssh_command('systemctl enable nginx && systemctl start nginx')
    
    # Check the sites-enabled directory
    run_ssh_command('ls -l /etc/nginx/sites-enabled/')
