VIDEO MẪU cho khu "Video từ cộng đồng" trên aiautocut.com
==========================================================

BỎ FILE VÀO ĐÚNG THƯ MỤC NÀY: d:\veo3-web\landing\samples\

ĐẶT TÊN file theo thứ tự muốn hiển thị (5 ô):
    v1.mp4   v2.mp4   v3.mp4   v4.mp4   v5.mp4      <- video (dọc 9:16 là đẹp nhất)
    v1.jpg   v2.jpg   ...                            <- (TÙY CHỌN) ảnh bìa; không có thì dùng khung đầu video

QUY TẮC:
  - Ô nào CÓ file vN.mp4  -> tự thành video xem được.
  - Ô nào CHƯA có         -> hiện ảnh mẫu tạm (placeholder) + nút play.
  - Tiêu đề từng ô sửa trong landing/build.js (mảng SAMPLES) — muốn đổi cứ nhắn.

SAU KHI BỎ FILE: chỉ cần chạy deploy như thường:
    .\deploy.ps1 "them video mau"
  (deploy tự build lại landing -> video lên aiautocut.com ngay)
