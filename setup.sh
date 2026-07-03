set -e
export DEBIAN_FRONTEND=noninteractive
apt-get update
apt-get install -y git nginx certbot python3-venv ffmpeg curl docker.io sshpass

# Start Postgres and Redis
docker run -d --name veo3-pg -e POSTGRES_PASSWORD=iouX-4LBGcp_GxVGdjWYOcxF -e POSTGRES_USER=veo3 -e POSTGRES_DB=veo3web -p 5433:5432 --restart always postgres:16
docker run -d --name veo3-redis -p 6379:6379 --restart always redis:7-alpine

mkdir -p /opt/veo3-web
git clone https://github.com/stewie5704/veo3_web.git /opt/veo3-web || true

cd /opt/veo3-web/backend
python3 -m venv venv
./venv/bin/pip install -r requirements.txt

cat << 'EOF' > /etc/systemd/system/veo3-api.service
[Unit]
Description=VEO3 Web API
After=network.target docker.service

[Service]
User=root
WorkingDirectory=/opt/veo3-web/backend
Environment="PATH=/opt/veo3-web/backend/venv/bin"
ExecStart=/opt/veo3-web/backend/venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8000 --workers 4
Restart=always

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable veo3-api
