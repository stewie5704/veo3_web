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
    return out

def main():
    cmd = """
cat << 'EOF' > /etc/nginx/sites-available/veo3-app
server {
    listen 80;
    server_name app.aiautocut.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    server_name app.aiautocut.com;

    ssl_certificate /etc/letsencrypt/live/app.aiautocut.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/app.aiautocut.com/privkey.pem;

    location / {
        proxy_pass https://180.93.43.43:443;
        proxy_ssl_server_name on;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /ws/ {
        proxy_pass https://180.93.43.43:443;
        proxy_ssl_server_name on;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
    }
}
EOF
systemctl reload nginx
    """
    out = run_ssh(old_host, cmd)
    sys.stdout.buffer.write(b"OUT: " + out + b"\n")

if __name__ == "__main__":
    main()
