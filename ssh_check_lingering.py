import paramiko
import sys

old_host = "74.81.54.150"
user = "root"
password = "thaikuku1"

def run_ssh(host, cmd):
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(host, username=user, password=password)
    stdin, stdout, stderr = ssh.exec_command(cmd)
    out = stdout.read()
    ssh.close()
    return out.decode('utf-8')

def main():
    cmds = [
        "echo '=== SYSTEMD SERVICES ==='",
        "systemctl list-units --all --type=service | grep -i veo",
        "echo '\n=== CRON JOBS ==='",
        "crontab -l",
        "echo '\n=== NGINX SITES ENABLED ==='",
        "ls -l /etc/nginx/sites-enabled/",
        "echo '\n=== DISK USAGE ==='",
        "du -sh /opt/veo3-web 2>/dev/null || echo 'No /opt/veo3-web'"
    ]
    
    full_out = ""
    for cmd in cmds:
        try:
            full_out += run_ssh(old_host, cmd) + "\n"
        except Exception as e:
            full_out += f"Error running {cmd}: {e}\n"
            
    sys.stdout.buffer.write(full_out.encode('utf-8'))

if __name__ == "__main__":
    main()
