# VEO3 Web — Project Context (bàn giao)

> File này là context bàn giao cho Claude Code. KHÔNG bao giờ ghi secret (token, mật khẩu, API key, chuỗi kết nối có mật khẩu) vào đây — nó được commit lên GitHub qua `deploy.ps1` (git add -A).

## Tổng quan
SaaS tạo video bằng AI (Veo/Flow), deploy tại **https://app.aiautocut.com**.
- **backend/** — FastAPI (async) + SQLAlchemy (async). DB là **Postgres** (`localhost:5433/veo3web`), KHÔNG phải file SQLite rỗng trong repo.
- **frontend/** — React 18 + TypeScript + Vite + CSS thuần. Ngôn ngữ UI: **tiếng Việt**. Phong cách "Krea Pro" tối; gradient thương hiệu `--grad: linear-gradient(115deg,#F97316,#EC4899 56%,#A855F7)`; biến chữ `--text` / `--text2` / `--text3`.
- **extension/**, **marketing/** — phụ trợ.

## Deploy (QUAN TRỌNG)
Dùng `deploy.ps1` ở gốc repo (PowerShell):
- `.\deploy.ps1 "commit message"` — deploy đầy đủ (backend + build frontend trên VPS).
- `.\deploy.ps1 "msg" -BackendOnly` — bỏ qua build frontend (nhanh, chỉ backend).
Script: `git add -A` → commit → push → SSH vào VPS (`/opt/veo3-web`) → `git pull` → `pip install -r requirements.txt` → `systemctl restart veo3-api` → (nếu không -BackendOnly) `npm ci && npm run build`. Cấu hình VPS xem trong `deploy.ps1`.
- Kiểm tra sau deploy: `ssh <VPS> "systemctl is-active veo3-api"` và `curl .../api/v1/status` (200).

## Kiểm tra trước khi deploy
- Frontend: `cd frontend && npm run build` (tsc + vite — bắt lỗi TS). Cảnh báo "chunk > 500 kB" là vô hại.
- Backend: `python -m py_compile app/.../router.py` để bắt lỗi cú pháp.

## Các subsystem chính (backend/app/)
- **pipeline/runner.py** — render video qua browser-automation Flow/Veo. `run_scene_job` (cảnh của project) & `run_video_job` (job lẻ) → `_generate_one`. `_resolve_variant` đổi `_t2v_`→`_r2v_`/`_i2v_`; model Veo portrait KHÔNG-lite cần chèn infix `_s_` (vd `veo_3_1_r2v_s_fast_portrait_ultra`). `_try_auto_merge` tự ghép các cảnh thành `merged_file` khi tất cả xong. TTS giọng đọc qua Gemini (`_tts_pcm`).
  - **Model keys & giá:** `veo_3_1_t2v_lite_low_priority`=FREE, `veo_3_1_t2v_lite`=5💎, `veo_3_1_t2v_fast_portrait_ultra`=10💎, `veo_3_1_t2v_portrait`=100💎.
  - **Lite VẪN ra video dọc 9:16** (param aspectRatio chạy). Nếu thấy "ra ngang" → là lỗi CSS preview, KHÔNG phải backend. Luôn `ffprobe` file thật trước khi đoán (file thường 720×1280).
- **projects/router.py** — `create_project` nhận `prompts[]`, `narrations[]`, `chain_mode` (nối khung), `character_ids` (clone ảnh vào project, gắn làm ref MỌI cảnh → khoá mặt/sản phẩm), `character_bible` (text → sinh chân dung AI giữ mặt), `voices[]`/`voice`, `audio_mode`, `aspect_ratio`. `ProjectResponse.merged_file` = video đã ghép. Có `/{id}/portraits`, `/{id}/rerender-batch`, `/{id}/download-merged`.
- **tools/router.py** — trợ lý AI (toàn bộ dùng **Gemini**, helper duy nhất `_gemini_json`; chưa có OpenAI). Endpoint: `autoprompt`, `parse-script`, `sell-prompt`, `sell-script` (kịch bản bán hàng nhiều cảnh, trung tính giới tính + `brief` để bám ý người dùng), `copy-idea`, `tts`, `image` (image dùng Flow + `google_connected`, KHÔNG dùng Gemini key), `product-from-link` (**đã hardening SSRF: allowlist host + check IP public mỗi hop redirect + regex chống ReDoS + giới hạn size + rate-limit — PHẢI giữ nguyên**).
- **characters/** — kho nhân vật chung + theo project; `copy_from` để clone không cần upload lại.
- **auth/**, **billing/** (PayOS + Binance; tặng "assistants" = link ChatGPT custom-GPT, KHÔNG có API), **admin/**, **affiliate/**, **media/**.

## Frontend (frontend/src/)
- `pages/Dashboard.tsx` — layout + sidebar. "Tạo video" (`/projects`) là dropdown 4 tab con: new / batch / copy / sell (`?tab=`). `pushLog(msg, level)` → Nhật ký console dưới đáy.
- `pages/Projects.tsx` — host các tab tạo; tab `sell` render `<SellVideo/>` (full-width).
- `pages/ProjectDetail.tsx` — layout 2 cột (danh sách Phần | cảnh), thẻ cảnh dạng lưới, "Tạo lại tất cả/phần".
- `components/SellVideo.tsx` — **Video bán hàng**: ảnh sản phẩm (+KOL) → dự án nhiều cảnh nối khung, tự ghép, hàng chờ ngay trên tab (poll `projectsApi.get`, lưu id ở localStorage `aiac_sell_ids`). 1 ô đa năng: gõ tiếng Việt → AI tự tạo prompt (sell-script + `brief`); dán prompt/kịch bản sẵn (có "Cảnh/HÌNH ẢNH/LỜI THOẠI" hoặc tiếng Anh) → parse thuần frontend, dùng luôn (không cần Gemini). Luôn gửi `character_bible: []` + `character_ids` (ảnh quyết định 100% diện mạo + giới tính → fix bug "nam ra nữ"). Nút "Lệnh cho GPT" copy câu lệnh để dán vào trợ lý GPT trong gói.
- `components/VideoFeed.tsx` — feed video; **fix tỉ lệ:** `<video onLoadedMetadata>` set `aspect-ratio` theo `videoWidth/videoHeight` + `objectFit:'contain'`. (Lỗi cũ: `.video-preview{aspect-ratio:16/9}` + `cover` cắt video dọc.)
- `components/DownloadMenu.tsx` — tải 720p (gốc) / 1080p (server upscale). Props: `base`, `filename`, `flex`, `iconOnly`.
- `api/client.ts` — axios; `projectsApi`, `toolsApi`, `charactersApi`, `videosApi`, `billingApi`, `adminApi`...

## Quy ước & bài học
- Người dùng nói tiếng Việt; trả lời tiếng Việt, thẳng thắn, không vòng vo.
- KHÔNG tự ý viết lại layout người dùng đã duyệt — chỉ THÊM cái được yêu cầu. Mockup/artifact rời bị từ chối → dựng ngay trong app, tái dùng component/style sẵn có.
- Runner logger không lên journalctl → khó debug qua log; ưu tiên `ffprobe`/kiểm tra file thật.
- Khi đụng DB: dùng venv python + `app.database engine` (Postgres :5433), bảng `video_jobs`; cột `kind` là dẫn xuất (không tồn tại).

## BẢO MẬT — không bao giờ vi phạm
- `backend/.env` (gitignored): chứa key PayOS/Binance, mật khẩu DATABASE_URL — KHÔNG commit, KHÔNG echo giá trị.
- `private_key.b64`, JWT token, mật khẩu/email admin: bí mật — không in ra, không đưa vào file commit.
- Giữ nguyên phần hardening SSRF của `product-from-link`.
- File `config.json` chứa token Google nằm ở project khác (`VEO3_STUDIO`), không thuộc repo này — không bao giờ dán/commit.
