import paramiko
import sys

old_host = "74.81.54.150"
user = "root"
password = "thaikuku1"

def run_ssh_command(cmd):
    print(f"Running: {cmd}")
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(old_host, username=user, password=password)
    stdin, stdout, stderr = ssh.exec_command(cmd)
    
    out = stdout.read().decode('utf-8', errors='replace')
    err = stderr.read().decode('utf-8', errors='replace')
    
    sys.stdout.buffer.write(b"STDOUT: " + out.encode('utf-8', errors='replace') + b"\n")
    if err:
        sys.stderr.buffer.write(b"STDERR: " + err.encode('utf-8', errors='replace') + b"\n")
    
    ssh.close()
    return out, err

if __name__ == "__main__":
    run_ssh_command('ls -l /root/old_db.sql')
    run_ssh_command('head -n 20 /root/old_db.sql')
