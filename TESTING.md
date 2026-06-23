# VEO3 Web — Test Plan & QA

Tài liệu kiểm thử cho nền tảng SaaS tạo video AI (FastAPI + React). Mô tả chiến lược test,
phạm vi, cách chạy, và bộ test tự động + CI/CD.

## 1. Chiến lược (test pyramid)
- **Unit** — logic thuần, không I/O: mã hóa secret, logic gói (subscription), helper pipeline (build payload, resolve model key).
- **Integration (API)** — gọi thật vào ASGI app qua `httpx.AsyncClient`, DB SQLite tạm (NullPool, cô lập từng lần chạy): đăng ký/đăng nhập, phân quyền, chặn theo gói, billing, admin.
- **E2E / thủ công** — phần phụ thuộc Google Flow thật (tạo video, captcha qua extension) không tự động hóa được trong CI → có checklist thủ công ở §6.

Nguyên tắc: **không gọi mạng ngoài trong CI** (Google/Redis được mock hoặc no-op) ⇒ test nhanh, ổn định, xanh tin cậy.

## 2. Cách chạy
```bash
cd backend
pip install -r requirements.txt -r requirements-dev.txt
pytest                       # chạy toàn bộ
pytest --cov=app --cov-report=term-missing   # kèm coverage
pytest tests/test_api_billing.py -v          # 1 file
```
Env test (DB tạm + secret cố định) được set tự động trong `tests/conftest.py`.

## 3. Bộ test tự động (25 test, đều xanh)
| File | Loại | Bao phủ |
|---|---|---|
| `test_crypto.py` | Unit | Mã hóa cookie/API key at-rest (Fernet): roundtrip, tương thích plaintext cũ, rỗng/None |
| `test_subscription.py` | Unit | Gói theo thời gian: active/hết hạn, kích hoạt, **mua thêm = gia hạn cộng dồn**, chặn 402, gói lạ |
| `test_runner_helpers.py` | Unit | Pipeline Flow: `_apply_duration` (abra), `_resolve_variant` (i2v/r2v), parse media id, dựng body generate (recaptcha/model/start/ref) |
| `test_api_auth.py` | API | Đăng ký (chặn trùng email), đăng nhập (sai mật khẩu 401), `/me` cần token, **user bị ban → 403** |
| `test_api_billing.py` | API | `/billing/plans` public; user mới = free/inactive; **tạo video không gói → 402**; có gói → 200; checkout tạo đơn pending; webhook chưa cấu hình → 501; **admin cấp gói → user active**; non-admin → 403 |

**Coverage:** ~45% tổng (lõi nghiệp vụ — auth, subscription, billing, crypto — phủ cao; phần gọi Google Flow trong `pipeline/runner.py` test bằng E2E thủ công nên kéo tổng xuống).

## 4. Kỹ thuật test đáng chú ý
- **Cô lập DB**: mỗi lần chạy dùng SQLite ở thư mục tạm, `NullPool` để không kẹt connection giữa các event loop của pytest-asyncio.
- **Mock worker**: test "tạo video có gói" `monkeypatch` `run_video_job` thành no-op → kiểm tra luồng cho phép mà **không gọi Google thật**.
- **Factory user**: fixture `make_user(admin=, plan=, google=)` dựng nhanh user ở mọi trạng thái.

## 5. CI/CD (GitHub Actions)
- **`.github/workflows/ci.yml`** — mỗi push/PR: cài deps → `ruff` lint (non-blocking) → `pytest --cov` (backend) + `npm run build` (frontend). PR đỏ nếu test fail.
- **`.github/workflows/deploy.yml`** — push `main` (hoặc bấm tay): SSH vào VPS → pull → migrate → restart `veo3-api` → build frontend. Cần secrets `VPS_HOST/VPS_USER/VPS_SSH_KEY/APP_DIR`.

## 6. Checklist E2E thủ công (phần cần Google Ultra thật)
Chạy khi deploy lên staging, với 1 tài khoản Ultra + extension đã cài:
- [ ] Cài extension → popup hiện 🟢 đã kết nối + ✅ cookie + ✅ project.
- [ ] Mua/được cấp gói → trạng thái `active`.
- [ ] Tạo 1 video T2V → poll → tải về xem được.
- [ ] Tạo video kèm `@Tên` nhân vật → giữ đúng mặt (R2V).
- [ ] Dự án nhiều cảnh + chain → tự ghép `final.mp4`.
- [ ] Tạo ảnh (Nano Banana) → ra ảnh.
- [ ] Hết hạn gói → các nút tạo bị chặn (402).
- [ ] Ban user (admin) → user không gọi được API (403).

## 7. Việc QA tiếp theo (roadmap)
- Thêm test cho `projects`/`characters`/`media` router.
- E2E tự động bằng Playwright (UI: đăng nhập, điều hướng, form) — chạy trên staging.
- Tăng coverage lõi pipeline bằng cách mock lớp HTTP (respx) cho `submit`/`poll`/`download`.
