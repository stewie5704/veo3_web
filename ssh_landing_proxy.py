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

    client_max_body_size 210M;

    location /api/      { proxy_pass http://127.0.0.1:8000; include /etc/nginx/snippets/veo3-proxy.conf; }
    location /shared/   { proxy_pass http://127.0.0.1:8000; include /etc/nginx/snippets/veo3-proxy.conf; }
    location ~ ^/(uploads|images|audio|merged|thumbnails)/ {
        proxy_pass http://127.0.0.1:8000; include /etc/nginx/snippets/veo3-proxy.conf;
    }

    location / {
        try_files $uri $uri/ /index.html;
    }
}
"""
    cmd = f"""cat << 'EOF' > /etc/nginx/sites-available/veo3-landing
{nginx_conf}
EOF
systemctl reload nginx
"""
    run_ssh_command(cmd)
