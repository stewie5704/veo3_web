# VEO3 Web — Deploy Production (Ubuntu VPS)

Topology (domain riêng, app cùng origin với API → không CORS):
```
aiautocut.com          → marketing tĩnh (Astro, Phase 2)
app.aiautocut.com      → nginx: React build + proxy /api,/ws,/uploads… → gunicorn:8000
license.aiautocut.com  → license server (đã có)
```
> Đổi `aiautocut.com` thành domain mày mua. DNS: trỏ `@`, `www`, `app`, `license` (A record) về IP VPS.

## 1. Cài gói nền
```bash
sudo apt update && sudo apt install -y python3-venv python3-pip postgresql redis-server \
    nginx certbot python3-certbot-nginx git curl
# Node 20 cho build frontend
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo bash - && sudo apt install -y nodejs
```

## 2. Postgres
```bash
sudo -u postgres psql -c "CREATE USER veo3 WITH PASSWORD 'MAT_KHAU';"
sudo -u postgres psql -c "CREATE DATABASE veo3web OWNER veo3;"
```
→ `DATABASE_URL=postgresql+asyncpg://veo3:MAT_KHAU@localhost:5432/veo3web`

## 3. Code + backend
```bash
sudo git clone <repo> /opt/veo3-web   # hoặc scp code lên
sudo chown -R $USER:$USER /opt/veo3-web
cd /opt/veo3-web/backend
python3 -m venv venv && ./venv/bin/pip install -r requirements.txt
cp .env.production.example .env
nano .env     # điền DATABASE_URL, SECRET_KEY (sinh ngẫu nhiên), REDIS_URL, domain, admin
```
**Tạo bảng + admin:** bảng tự tạo khi app khởi động (create_all). Tạo admin:
```bash
./venv/bin/python seed.py        # tạo tài khoản admin từ ADMIN_EMAIL/ADMIN_PASSWORD trong .env
```
> Lưu ý: `migrate.py` chỉ dùng cho SQLite (ALTER). Lên Postgres mới = bảng tạo sạch từ đầu, không cần.

## 4. Chạy API (gunicorn + nhiều worker)
```bash
sudo chown -R www-data:www-data /opt/veo3-web
sudo cp deploy/veo3-api.service /etc/systemd/system/
sudo systemctl daemon-reload && sudo systemctl enable --now veo3-api
curl http://127.0.0.1:8000/api/v1/health    # {"ok":true}
```
Redis đã chạy ⇒ captcha bus hoạt động chéo 4 worker. Xem log: `journalctl -u veo3-api -f`.

## 5. Frontend (React build)
```bash
cd /opt/veo3-web/frontend
npm ci && npm run build      # ra frontend/dist
```
Client gọi `/api/v1` tương đối → cùng origin `app.aiautocut.com`, không cần đổi gì.

## 6. nginx + HTTPS
```bash
# snippet proxy chung
sudo tee /etc/nginx/snippets/veo3-proxy.conf >/dev/null <<'EOF'
proxy_set_header Host $host;
proxy_set_header X-Real-IP $remote_addr;
proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
proxy_set_header X-Forwarded-Proto $scheme;
EOF

sudo cp deploy/nginx-app.conf /etc/nginx/sites-available/veo3-app
sudo nano /etc/nginx/sites-available/veo3-app     # đổi server_name = app.domain
sudo ln -s /etc/nginx/sites-available/veo3-app /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d app.aiautocut.com        # HTTPS
sudo ufw allow 'Nginx Full'
```
(Marketing root làm ở Phase 2 với `deploy/nginx-marketing.conf`.)

## 7. Trỏ extension + (nếu bán desktop) license về domain
- Extension web: server URL = `https://app.aiautocut.com` (WS tự thành `wss://`).
- License server: deploy riêng ở `license.aiautocut.com` (xem `license_server/DEPLOY_VPS.md`).

## 8. Smoke test
- `https://app.aiautocut.com` → load app, đăng ký/đăng nhập.
- Admin cấp gói → tạo video (cần extension + Ultra) → ra video.
- `journalctl -u veo3-api -f` không lỗi.

## Cập nhật về sau (hoặc dùng CD `.github/workflows/deploy.yml`)
```bash
cd /opt/veo3-web && git pull
cd backend && ./venv/bin/pip install -r requirements.txt && sudo systemctl restart veo3-api
cd ../frontend && npm ci && npm run build
```

## Checklist production
- [ ] `SECRET_KEY` ngẫu nhiên (KHÔNG để mặc định), `.env` không commit
- [ ] Postgres + Redis chạy; `veo3-api` enable on-boot
- [ ] HTTPS (certbot auto-renew), `ufw` chỉ mở 80/443 + SSH
- [ ] Đổi `ADMIN_PASSWORD` mạnh
- [ ] Backup định kỳ: Postgres dump + thư mục `uploads/`
