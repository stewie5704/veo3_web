# VEO3 Web Bridge — Chrome Extension

Cầu nối giữa **tài khoản Google Ultra của khách** và **VEO3 Web server**. Nó:
1. Đọc cookie `labs.google` của khách (kể cả cookie httpOnly) → gửi lên server để mint token tạo video.
2. Giải **reCAPTCHA** (action `VIDEO_GENERATION`) khi server yêu cầu, qua tab labs.google đang đăng nhập.
3. Tự động kết nối lại + làm mới cookie (session-token xoay vòng).

Khác với bản desktop (nói chuyện với bridge chạy local), bản này nối **thẳng tới server** qua WebSocket `/ws/extension`.

## Cài cho khách
1. Khách phải **đăng nhập Google Ultra trên labs.google** trong Chrome (và mở 1 project Flow để lấy `project_id`).
2. Vào `chrome://extensions` → bật **Developer mode** → **Load unpacked** → chọn thư mục `extension/`.
   *(Khi bán: nên đóng gói + đưa lên Chrome Web Store, hoặc phát file .crx + hướng dẫn.)*
3. Bấm icon extension → nhập **Server** (URL backend, vd `https://api.tên-miền.com`), **Email + mật khẩu** tài khoản VEO3 Web → **Đăng nhập & Kết nối**.
4. Popup hiện:
   - 🟢 Đã kết nối server
   - ✅ đã gửi cookie Google
   - ✅ project: `xxxxxxxx…`
   → là xong, khách vào web bấm tạo video bình thường.

## Quyền (manifest)
- `cookies` + host `labs.google` → đọc cookie phiên Google.
- `tabs` + `scripting` + host `google.com`/`gstatic.com` → chạy grecaptcha trong tab labs.google.
- `https://*/*` + `http://*/*` → mở WebSocket tới server của bạn. *(Có thể thu hẹp thành đúng domain server của bạn để giảm cảnh báo quyền khi cài.)*

## Khắc phục sự cố
| Triệu chứng | Cách xử lý |
|---|---|
| "Mất kết nối" / "Token hết hạn" | Mở popup đăng nhập lại (token VEO3 Web hết hạn). |
| "chưa lấy được cookie" | Khách chưa đăng nhập labs.google trong Chrome này. |
| "chưa mở project Flow" | Mở 1 project trên labs.google (URL có `/project/<id>`). |
| Tạo video báo "Extension chưa kết nối" | Mở popup, kiểm tra 🟢 + ✅; đảm bảo cùng 1 Chrome đang đăng nhập labs.google. |

## File
- `manifest.json` — khai báo quyền + service worker + popup
- `background.js` — WebSocket, đọc cookie, giải captcha
- `popup.html` / `popup.js` — đăng nhập + xem trạng thái
