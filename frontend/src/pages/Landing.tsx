import './Landing.css'

// Trang chào khách (public). Markup tĩnh -> render thẳng để khỏi convert thuộc tính SVG.
// CTA dùng <a href> thật (full nav sang /login, /register — server SPA fallback xử lý).
const HTML = `
<div class="shell">
  <header><div class="inner"><div class="hrow">
    <div class="brand">
      <span class="logo"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="6" cy="6" r="2.4"/><circle cx="6" cy="18" r="2.4"/><line x1="8.1" y1="7.6" x2="20" y2="18"/><line x1="8.1" y1="16.4" x2="20" y2="6"/></svg></span>
      AI AutoCut
    </div>
    <nav class="links">
      <a href="#features">Tính năng</a>
      <a href="#how">Cách hoạt động</a>
      <a href="#pricing">Bảng giá</a>
    </nav>
    <div class="hright">
      <a class="btn btn-ghost" href="/login">Đăng nhập</a>
      <a class="btn btn-grad" href="/register">Bắt đầu miễn phí</a>
    </div>
  </div></div></header>

  <div class="inner">
    <section class="hero">
      <div>
        <div class="pill"><span class="d"></span>Tạo phim AI bằng Veo 3.1</div>
        <h1>Biến một dòng ý tưởng thành <span class="g">phim AI nhiều cảnh</span>.</h1>
        <p class="lead">AI AutoCut viết kịch bản, giữ nguyên gương mặt nhân vật, render từng cảnh rồi tự ghép thành video hoàn chỉnh. Bạn chỉ cần ý tưởng.</p>
        <div class="cta-row">
          <a class="btn btn-grad btn-lg" href="/register"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4l1.6 5.4L19 11l-5.4 1.6L12 18l-1.6-5.4L5 11l5.4-1.6z"/></svg> Tạo video đầu tiên</a>
          <a class="btn btn-ghost btn-lg" href="#how">Xem cách hoạt động</a>
        </div>
        <div class="caps">
          <span class="cap"><b>Veo 3.1</b> · 4 model</span>
          <span class="cap">Giữ <b>mặt nhân vật</b></span>
          <span class="cap">Tự <b>ghép phim</b></span>
          <span class="cap">Tới <b>60 cảnh</b>/dự án</span>
        </div>
      </div>

      <div class="window">
        <div class="wtop"><i></i><i></i><i></i><span class="url">app.aiautocut.com</span></div>
        <div class="wbody">
          <div class="wpane">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4l1.6 5.4L19 11l-5.4 1.6L12 18l-1.6-5.4L5 11l5.4-1.6z"/></svg>
            <span>Hồ ly chín đuôi tu luyện ngàn năm hóa thành thiếu nữ...</span>
          </div>
          <div class="board">
            <div class="cell f"><span class="tg">01</span><span class="nu">01</span></div>
            <div class="cell"><span class="tg">02</span><span class="nu">02</span></div>
            <div class="cell"><span class="tg">03</span><span class="nu">03</span></div>
            <div class="cell"><span class="tg">04</span><span class="nu">04</span></div>
            <div class="cell"><span class="tg">05</span><span class="nu">05</span></div>
            <div class="cell"><span class="tg">06</span><span class="nu">06</span></div>
          </div>
          <div class="wfoot"><span class="big">1:36</span><span style="color:var(--text3)">· 12×8s ·</span><span class="free">FREE</span><span class="go">Viết kịch bản →</span></div>
        </div>
      </div>
    </section>
  </div>

  <section class="blk" id="features"><div class="inner">
    <div class="eyebrow">Tính năng</div>
    <h2 class="h2">Cả một quy trình làm phim, gói trong một dòng ý tưởng</h2>
    <p class="sub">Không cần biết dựng phim. Bạn mô tả, phần còn lại để AI AutoCut lo.</p>
    <div class="feat">
      <div class="fcard">
        <div class="ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 5h16M4 10h16M4 15h10M4 20h7"/></svg></div>
        <h3>Kịch bản tự động</h3>
        <p>Gõ ý tưởng, AI chia thành nhiều cảnh có lớp lang và viết prompt riêng cho từng cảnh — bạn xem và sửa thoải mái.</p>
      </div>
      <div class="fcard">
        <div class="ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="3.4"/><path d="M5.5 20a6.5 6.5 0 0 1 13 0"/></svg></div>
        <h3>Giữ mặt nhân vật</h3>
        <p>Tải ảnh nhân vật một lần, gắn riêng cho dự án. Gương mặt được giữ nguyên xuyên suốt mọi cảnh, không bị "trôi".</p>
      </div>
      <div class="fcard">
        <div class="ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="6" width="18" height="12" rx="2"/><path d="m10 9 5 3-5 3z"/></svg></div>
        <h3>Render &amp; ghép tự động</h3>
        <p>Mỗi cảnh render bằng Veo 3.1, hệ thống tự nối lại thành một video hoàn chỉnh để bạn tải về ngay.</p>
      </div>
      <div class="fcard">
        <div class="ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M13 3 4 14h7l-1 7 9-11h-7z"/></svg></div>
        <h3>Miễn phí để bắt đầu</h3>
        <p>Dùng model Veo 3.1 Lite miễn phí. Cần chất lượng cao hơn hay làm hàng loạt thì nâng gói khi sẵn sàng.</p>
      </div>
    </div>
  </div></section>

  <section class="blk" id="how"><div class="inner">
    <div class="eyebrow">Cách hoạt động</div>
    <h2 class="h2">Ba bước, từ ý tưởng tới video</h2>
    <p class="sub">Trung bình vài phút cho một video nhiều cảnh hoàn chỉnh.</p>
    <div class="steps">
      <div class="step"><span class="n">01</span><h3>Nhập ý tưởng</h3><p>Mô tả nội dung, chọn số cảnh, thời lượng và phong cách. Chọn nhân vật cần giữ mặt nếu có.</p></div>
      <div class="step"><span class="n">02</span><h3>AI viết kịch bản</h3><p>AI sinh prompt cho từng cảnh. Bạn xem trước trên storyboard và chỉnh sửa tự do.</p></div>
      <div class="step"><span class="n">03</span><h3>Render &amp; ghép</h3><p>Bấm một nút — mọi cảnh được render rồi tự ghép thành phim. Tải về hoặc chia sẻ.</p></div>
    </div>
  </div></section>

  <section class="blk" id="pricing"><div class="inner">
    <div class="eyebrow">Bảng giá</div>
    <h2 class="h2">Bắt đầu miễn phí, nâng gói khi cần</h2>
    <p class="sub">Hủy bất cứ lúc nào. Mọi gói đều dùng được toàn bộ tính năng làm phim.</p>
    <div class="price">
      <div class="pcard">
        <div class="name">Basic</div>
        <div class="amt">99k<small>/tháng</small></div>
        <ul>
          <li><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m5 13 4 4L19 7"/></svg> Tạo dự án không giới hạn</li>
          <li><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m5 13 4 4L19 7"/></svg> Model Veo 3.1 Lite</li>
          <li><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m5 13 4 4L19 7"/></svg> Giữ mặt &amp; tự ghép</li>
        </ul>
        <a class="btn btn-ghost" href="/register">Chọn Basic</a>
      </div>
      <div class="pcard hot">
        <span class="tag">Phổ biến</span>
        <div class="name">Pro</div>
        <div class="amt">199k<small>/tháng</small></div>
        <ul>
          <li><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m5 13 4 4L19 7"/></svg> Mọi thứ ở Basic</li>
          <li><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m5 13 4 4L19 7"/></svg> Model Fast &amp; Quality</li>
          <li><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m5 13 4 4L19 7"/></svg> Render hàng loạt</li>
          <li><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m5 13 4 4L19 7"/></svg> Ưu tiên hàng đợi</li>
        </ul>
        <a class="btn btn-grad" href="/register">Chọn Pro</a>
      </div>
      <div class="pcard">
        <div class="name">Pro năm</div>
        <div class="amt">1.990k<small>/năm</small></div>
        <ul>
          <li><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m5 13 4 4L19 7"/></svg> Mọi thứ ở Pro</li>
          <li><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m5 13 4 4L19 7"/></svg> Tiết kiệm ~17%</li>
          <li><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m5 13 4 4L19 7"/></svg> Thanh toán 1 lần/năm</li>
        </ul>
        <a class="btn btn-ghost" href="/register">Chọn Pro năm</a>
      </div>
    </div>

    <div class="band">
      <h2>Sẵn sàng làm bộ phim AI đầu tiên?</h2>
      <p>Đăng ký miễn phí, có ngay video nhiều cảnh trong vài phút.</p>
      <a class="btn btn-grad btn-lg" href="/register"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4l1.6 5.4L19 11l-5.4 1.6L12 18l-1.6-5.4L5 11l5.4-1.6z"/></svg> Bắt đầu miễn phí</a>
    </div>
  </div></section>

  <footer><div class="inner"><div class="frow">
    <div class="brand"><span class="logo"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="6" cy="6" r="2.4"/><circle cx="6" cy="18" r="2.4"/><line x1="8.1" y1="7.6" x2="20" y2="18"/><line x1="8.1" y1="16.4" x2="20" y2="6"/></svg></span> AI AutoCut</div>
    <span>© 2026 AI AutoCut</span>
    <div class="fl"><a href="#features">Tính năng</a><a href="#pricing">Bảng giá</a><a href="/login">Đăng nhập</a></div>
  </div></div></footer>
</div>
`

export default function Landing() {
  return <div id="lp" dangerouslySetInnerHTML={{ __html: HTML }} />
}
