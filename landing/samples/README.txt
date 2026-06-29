VIDEO MẪU cho khu "Video từ cộng đồng" trên aiautocut.com
==========================================================

BỎ FILE VÀO ĐÚNG THƯ MỤC NÀY: d:\veo3-web\landing\samples\

LAYOUT HIỆN TẠI: 8 ô = 5 DỌC (9:16) + 3 NGANG (16:9).

ĐẶT TÊN file theo đúng số ô:
    DỌC 9:16  -> v1.mp4  v2.mp4  v3.mp4  v4.mp4  v5.mp4
    NGANG 16:9-> v6.mp4  v7.mp4  v8.mp4               (ô 6-8 đã set sẵn là ngang)
    ảnh bìa   -> v1.jpg  v2.jpg  ...                  (TÙY CHỌN; không có thì dùng khung đầu video)

QUY TẮC:
  - Ô 1-5 là DỌC, ô 6-8 là NGANG — cứ bỏ file đúng số (v1..v8) là khớp, KHÔNG cần thêm gì.
  - Ô ngang (6-8) tự to gấp đôi bề ngang, video hiện đúng tỉ lệ, KHÔNG bị cắt méo.
  - Muốn ÉP 1 ô bất kỳ thành ngang -> thêm chữ 'w' cuối tên (vd v2w.mp4).
  - Ô nào CHƯA có file -> hiện ảnh mẫu tạm (placeholder) + nút play.
  - Tiêu đề / số ô / tỉ lệ sửa trong landing/build.js (mảng SAMPLES) — muốn đổi cứ nhắn.

SAU KHI BỎ FILE: chỉ cần chạy deploy như thường:
    .\deploy.ps1 "them video mau"
  (deploy tự build lại landing -> video lên aiautocut.com ngay)
