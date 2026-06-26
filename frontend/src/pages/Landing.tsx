import { useEffect } from 'react'
import './Landing.css'

// Trang chào khách (public). Markup tĩnh -> render thẳng. CTA dùng <a href> thật.
const PLAY = `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>`
const cell = (seed: string, tag: string, hot = false) =>
  `<div class="cell${hot ? ' f' : ''}"><img loading="lazy" src="https://picsum.photos/seed/${seed}/440/300" alt=""><span class="tg">${tag}</span><span class="play">${PLAY}</span></div>`

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
      <a href="#guide">Hướng dẫn</a>
      <a href="#pricing">Bảng giá</a>
    </nav>
    <div class="hright">
      <a class="btn btn-ghost" href="/login">Đăng nhập</a>
      <a class="btn btn-grad" href="/register">Bắt đầu miễn phí</a>
    </div>
  </div></div></header>

  <div class="inner">
    <section class="hero">
      <div class="reveal">
        <div class="pill"><span class="d"></span>Tạo phim AI bằng Veo 3.1</div>
        <h1>Một dòng ý tưởng,<br/>thành <span class="g">bộ phim AI</span> hoàn chỉnh.</h1>
        <p class="lead">AI AutoCut tự viết kịch bản, giữ nguyên gương mặt nhân vật qua từng cảnh, render bằng Veo 3.1 rồi ghép thành video. Bạn chỉ cần ý tưởng — phần còn lại để AI lo.</p>
        <div class="cta-row">
          <a class="btn btn-grad btn-lg" href="/register"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4l1.6 5.4L19 11l-5.4 1.6L12 18l-1.6-5.4L5 11l5.4-1.6z"/></svg> Tạo video đầu tiên — miễn phí</a>
          <a class="btn btn-ghost btn-lg" href="#how">Xem cách hoạt động</a>
        </div>
        <div class="stats">
          <div class="stat"><b>Veo 3.1</b><span>engine mới nhất</span></div>
          <div class="stat"><b>Giữ mặt</b><span>xuyên mọi cảnh</span></div>
          <div class="stat"><b>Tự ghép</b><span>ra phim hoàn chỉnh</span></div>
          <div class="stat"><b>~vài phút</b><span>mỗi video</span></div>
        </div>
      </div>

      <div class="window reveal">
        <div class="wtop"><i></i><i></i><i></i><span class="url">app.aiautocut.com</span></div>
        <div class="wbody">
          <div class="wpane">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4l1.6 5.4L19 11l-5.4 1.6L12 18l-1.6-5.4L5 11l5.4-1.6z"/></svg>
            <span>Hồ ly chín đuôi tu luyện ngàn năm hóa thành thiếu nữ...</span>
          </div>
          <div class="board">
            ${cell('aiac-fox1', 'Cảnh 01', true)}
            ${cell('aiac-fox2', 'Cảnh 02')}
            ${cell('aiac-fox3', 'Cảnh 03')}
            ${cell('aiac-fox4', 'Cảnh 04')}
            ${cell('aiac-fox5', 'Cảnh 05')}
            ${cell('aiac-fox6', 'Cảnh 06')}
          </div>
          <div class="wfoot"><span class="big">1:36</span><span style="color:var(--text3)">· 12×8s ·</span><span class="free">FREE</span><span class="go">Viết kịch bản →</span></div>
        </div>
      </div>
    </section>
  </div>

  <section class="blk" id="features"><div class="inner">
    <div class="eyebrow reveal">Tính năng</div>
    <h2 class="h2 reveal">Cả một xưởng phim, gói trong một dòng ý tưởng</h2>
    <p class="sub reveal">Không cần biết dựng phim. Bạn mô tả, phần còn lại để AI AutoCut lo.</p>
    <div class="feat">
      <div class="fcard span2 reveal">
        <div class="fc-text">
          <div class="ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 5h16M4 10h16M4 15h10M4 20h7"/></svg></div>
          <h3>Kịch bản tự động, chia cảnh thông minh</h3>
          <p>Gõ ý tưởng — AI chia thành nhiều cảnh có lớp lang, viết prompt điện ảnh riêng cho từng cảnh. Bạn xem trên storyboard và sửa thoải mái trước khi render.</p>
        </div>
        <div class="fc-shots">
          <img loading="lazy" src="https://picsum.photos/seed/aiac-f1/300/200" alt=""/>
          <img loading="lazy" src="https://picsum.photos/seed/aiac-f2/300/200" alt=""/>
          <img loading="lazy" src="https://picsum.photos/seed/aiac-f3/300/200" alt=""/>
        </div>
      </div>
      <div class="fcard reveal">
        <div class="ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="3.4"/><path d="M5.5 20a6.5 6.5 0 0 1 13 0"/></svg></div>
        <h3>Giữ mặt nhân vật</h3>
        <p>Tải ảnh nhân vật một lần — gương mặt được giữ nguyên xuyên suốt mọi cảnh, kể cả khi làm nhiều phần (Phần 1, Phần 2…).</p>
      </div>
      <div class="fcard reveal">
        <div class="ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="6" width="18" height="12" rx="2"/><path d="m10 9 5 3-5 3z"/></svg></div>
        <h3>Render &amp; ghép tự động</h3>
        <p>Mỗi cảnh render bằng Veo 3.1, hệ thống tự nối thành một video hoàn chỉnh để tải về ngay — không cần phần mềm dựng.</p>
      </div>
    </div>
  </div></section>

  <section class="blk" id="how"><div class="inner">
    <div class="eyebrow reveal">Cách hoạt động</div>
    <h2 class="h2 reveal">Ba bước, từ ý tưởng tới video</h2>
    <p class="sub reveal">Trung bình vài phút cho một video nhiều cảnh hoàn chỉnh.</p>
    <div class="steps">
      <div class="step reveal"><span class="n">01</span><h3>Nhập ý tưởng</h3><p>Mô tả nội dung, chọn số cảnh, thời lượng, tỉ lệ và phong cách. Thêm nhân vật cần giữ mặt nếu có.</p></div>
      <div class="step reveal"><span class="n">02</span><h3>AI viết kịch bản</h3><p>AI sinh prompt cho từng cảnh. Bạn xem trước trên storyboard và chỉnh sửa tự do.</p></div>
      <div class="step reveal"><span class="n">03</span><h3>Render &amp; ghép</h3><p>Bấm một nút — mọi cảnh được render rồi tự ghép thành phim. Tải về hoặc chia sẻ.</p></div>
    </div>
  </div></section>

  <section class="blk" id="guide"><div class="inner">
    <div class="eyebrow reveal">Hướng dẫn bắt đầu</div>
    <h2 class="h2 reveal">Chạy được trong 3 bước</h2>
    <p class="sub reveal">Cần máy tính + trình duyệt Chrome. Làm một lần là xong.</p>
    <div class="guide3">
      <div class="gcard reveal">
        <span class="gn">01</span>
        <div class="gic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="8" height="8" rx="2"/><rect x="13" y="3" width="8" height="8" rx="2"/><rect x="3" y="13" width="8" height="8" rx="2"/><path d="M17 13v4m-2-2h4"/></svg></div>
        <h3>Cài tiện ích Chrome</h3>
        <p>Tải gói tiện ích (có sẵn trong app), bật <b>Developer mode</b> ở <code>chrome://extensions</code> rồi <b>Load unpacked</b>.</p>
      </div>
      <div class="gcard reveal">
        <span class="gn">02</span>
        <div class="gic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M9 7H6a3 3 0 0 0 0 6h3m6 0h3a3 3 0 0 0 0-6h-3M8 10h8"/></svg></div>
        <h3>Kết nối Google Ultra</h3>
        <p>Đăng nhập tài khoản Google có gói Ultra qua tiện ích, mở một tab Flow — badge xanh là sẵn sàng.</p>
      </div>
      <div class="gcard reveal">
        <span class="gn">03</span>
        <div class="gic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4l1.6 5.4L19 11l-5.4 1.6L12 18l-1.6-5.4L5 11l5.4-1.6z"/></svg></div>
        <h3>Tạo video</h3>
        <p>Vào Dự án viết kịch bản, hoặc dùng các Công cụ (Ảnh→Video, Giữ mặt→Video, Tạo ảnh…). Bấm tạo là xong.</p>
      </div>
    </div>
    <div class="ghint reveal">📘 Sau khi đăng nhập, mục <b>Hướng dẫn</b> trong app có chi tiết từng bước + nút tải tiện ích.</div>
  </div></section>

  <section class="blk" id="pricing"><div class="inner">
    <div class="eyebrow reveal">Bảng giá</div>
    <h2 class="h2 reveal">Bắt đầu miễn phí, nâng gói khi cần</h2>
    <p class="sub reveal">Hủy bất cứ lúc nào. Mọi gói đều dùng được toàn bộ tính năng làm phim.</p>
    <div class="price">
      <div class="pcard reveal">
        <div class="name">Basic</div>
        <div class="amt">99k<small>/tháng</small></div>
        <ul>
          <li><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m5 13 4 4L19 7"/></svg> Tạo dự án không giới hạn</li>
          <li><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m5 13 4 4L19 7"/></svg> Model Veo 3.1 Lite</li>
          <li><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m5 13 4 4L19 7"/></svg> Giữ mặt &amp; tự ghép</li>
        </ul>
        <a class="btn btn-ghost" href="/register">Chọn Basic</a>
      </div>
      <div class="pcard hot reveal">
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
      <div class="pcard reveal">
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

    <div class="band reveal">
      <h2>Sẵn sàng làm bộ phim AI đầu tiên?</h2>
      <p>Đăng ký miễn phí, có ngay video nhiều cảnh trong vài phút.</p>
      <a class="btn btn-grad btn-lg" href="/register"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4l1.6 5.4L19 11l-5.4 1.6L12 18l-1.6-5.4L5 11l5.4-1.6z"/></svg> Bắt đầu miễn phí</a>
    </div>
  </div></section>

  <footer><div class="inner"><div class="frow">
    <div class="brand"><span class="logo"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="6" cy="6" r="2.4"/><circle cx="6" cy="18" r="2.4"/><line x1="8.1" y1="7.6" x2="20" y2="18"/><line x1="8.1" y1="16.4" x2="20" y2="6"/></svg></span> AI AutoCut</div>
    <span>© 2026 AI AutoCut</span>
    <div class="fl"><a href="#features">Tính năng</a><a href="#guide">Hướng dẫn</a><a href="#pricing">Bảng giá</a><a href="/login">Đăng nhập</a></div>
  </div></div></footer>
</div>
`

export default function Landing() {
  // Scroll-reveal: phần tử .reveal mờ -> hiện dần khi cuộn tới
  useEffect(() => {
    const els = Array.from(document.querySelectorAll('#lp .reveal'))
    if (!('IntersectionObserver' in window) || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      els.forEach(e => e.classList.add('is-in')); return
    }
    const io = new IntersectionObserver((ents) => {
      ents.forEach(en => { if (en.isIntersecting) { en.target.classList.add('is-in'); io.unobserve(en.target) } })
    }, { threshold: 0.12 })
    els.forEach(e => io.observe(e))
    return () => io.disconnect()
  }, [])
  return <div id="lp" dangerouslySetInnerHTML={{ __html: HTML }} />
}
