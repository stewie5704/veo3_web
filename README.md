# VEO3 Web — SaaS Video Generation Platform

Tạo video bằng AI (Veo/Flow). Backend FastAPI (async) + Postgres, frontend React 18 + Vite.
Bản chạy thật: https://app.aiautocut.com

## Cấu trúc
- `backend/` — FastAPI + SQLAlchemy async (Postgres). Xem `backend/app/`.
- `frontend/` — React + TypeScript + Vite (UI tiếng Việt).
- `landing/` — trang giới thiệu tĩnh (build từ frontend, xem `deploy.ps1`).
- `extension/`, `marketing/` — phụ trợ.

## Chạy dev
```bash
# Backend (cần Postgres đang chạy, mặc định dev :5433/veo3web)
cd backend
python -m venv venv && ./venv/bin/pip install -r requirements.txt
cp .env.production.example .env   # điền DATABASE_URL, SECRET_KEY, ...
./venv/bin/uvicorn app.main:app --reload

# Frontend
cd frontend
npm install
npm run dev
```
Hoặc dùng `dev.bat` (Windows) để chạy cả hai.

## Kiểm tra trước khi deploy
- Frontend: `cd frontend && npm run build` (tsc + vite bắt lỗi TS).
- Backend: `python -m py_compile app/**/router.py` bắt lỗi cú pháp.

## Deploy
Xem [DEPLOY.md](DEPLOY.md). Cách nhanh nhất (từ Windows):
```powershell
$env:VEO3_DEPLOY_TARGET = "root@your-vps" # hoặc deploy@your-vps
.\deploy.ps1                              # backend + build frontend
.\deploy.ps1 -BackendOnly                 # chỉ backend (nhanh)
```
Script chỉ deploy commit đã được review và push. Nó sẽ dừng nếu working tree còn thay đổi
hoặc `HEAD` chưa trùng upstream, sau đó SSH vào VPS để pull đúng commit, cài dependency,
build frontend, restart `veo3-api` và health-check. Script không tự commit/push.

Nếu sửa landing, build và commit artifact trước khi deploy:
```powershell
cd frontend
npm run build:landing
cd ..
git add -p frontend
git add landing
git commit -m "build landing"
git push
```

## Biến môi trường quan trọng
- `SECRET_KEY` — **bắt buộc** đặt riêng ở prod (`APP_ENV=production` sẽ raise nếu còn mặc định).
- `DATABASE_URL` — Postgres (prod :5432, dev :5433).
- `PAYOS_*`, `BINANCE_*`, `RESEND_API_KEY` — cổng thanh toán + email. Để trong `.env` (gitignored).

Tài liệu chi tiết cho dev: [CLAUDE.md](CLAUDE.md). Test: [TESTING.md](TESTING.md).
