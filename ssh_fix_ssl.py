import paramiko
import sys

host = "180.93.43.43"
user = "root"
password = "thaikuku1"

def run_ssh_command(cmd):
    print(f"Running: {cmd}")
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(host, username=user, password=password)
    stdin, stdout, stderr = ssh.exec_command(cmd)
    
    out = stdout.read().decode('utf-8', errors='replace')
    err = stderr.read().decode('utf-8', errors='replace')
    
    sys.stdout.buffer.write(b"STDOUT: " + out.encode('utf-8', errors='replace') + b"\n")
    if err:
        sys.stderr.buffer.write(b"STDERR: " + err.encode('utf-8', errors='replace') + b"\n")
    
    ssh.close()
    return out, err

if __name__ == "__main__":
    nginx_conf = """server {
    server_name aiautocut.com www.aiautocut.com;

    root /opt/veo3-web/landing;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }
}
"""
    cmd = f"""cat << 'EOF' > /etc/nginx/sites-available/veo3-landing
{nginx_conf}
EOF
ln -sf /etc/nginx/sites-available/veo3-landing /etc/nginx/sites-enabled/
systemctl reload nginx
certbot --nginx -d aiautocut.com -d www.aiautocut.com --non-interactive --agree-tos -m thaidem@gmail.com
"""
    out, err = run_ssh_command(cmd)
