import paramiko

host = "180.93.43.43"
user = "root"
password = "thaikuku1"

def run_ssh_command(cmd):
    print(f"Running: {cmd}")
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(host, username=user, password=password)
    stdin, stdout, stderr = ssh.exec_command(cmd)
    
    out = stdout.read().decode('utf-8')
    err = stderr.read().decode('utf-8')
    print("STDOUT:", out)
    if err:
        print("STDERR:", err)
    
    ssh.close()
    return out, err

if __name__ == "__main__":
    out, err = run_ssh_command('ls -la /etc/nginx/sites-available')
