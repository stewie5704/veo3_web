// Build static landing from Landing.tsx + Landing.css
const fs = require('fs');
const path = require('path');

// Read Landing.tsx and extract HTML template
let tsx = fs.readFileSync(path.join(__dirname, '..', 'frontend', 'src', 'pages', 'Landing.tsx'), 'utf8');

// Extract template variables and resolve them
const PLAY = `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>`;
const cell = (seed, tag, hot = false) =>
  `<div class="cell${hot ? ' f' : ''}"><img loading="lazy" src="https://picsum.photos/seed/${seed}/440/300" alt=""><span class="tg">${tag}</span><span class="play">${PLAY}</span></div>`;
const LOGO_SVG = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="6" cy="6" r="2.4"/><circle cx="6" cy="18" r="2.4"/><line x1="8.1" y1="7.6" x2="20" y2="18"/><line x1="8.1" y1="16.4" x2="20" y2="6"/></svg>`;
const CHECK_SVG = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m5 13 4 4L19 7"/></svg>`;
const STAR_SVG = `<svg viewBox="0 0 20 20" fill="currentColor" width="14" height="14"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/></svg>`;
const TESTI = [
  { name: 'Minh Hoàng', role: 'TikTok Creator', col: '#F97316', text: 'AI AutoCut giúp mình tạo hàng chục video mỗi ngày mà không tốn nhiều thời gian. Nhân vật nhất quán xuyên suốt mọi cảnh.' },
  { name: 'Thùy Linh', role: 'Content Creator', col: '#10B981', text: 'Kịch bản hay, giọng đọc tự nhiên, video viral hơn hẳn từ khi dùng AI AutoCut. Không thể thiếu.' },
  { name: 'Anh Tuấn', role: 'Affiliate Marketer', col: '#8B5CF6', text: 'Tăng hiệu quả affiliate lên 300% nhờ video AI. Tiết kiệm cả tuần quay dựng mỗi tháng.' },
  { name: 'Hải Yến', role: 'Giảng viên Online', col: '#3B82F6', text: 'Công cụ quá mạnh cho ai làm coaching như mình. Tạo nội dung khoá học nhanh gấp 5 lần trước đây.' },
  { name: 'Trần Bình', role: 'CEO – BizUp', col: '#EC4899', text: 'Tiết kiệm chi phí sản xuất video đáng kể cho doanh nghiệp. Đáng đầu tư nhất trong năm qua.' },
];
const stars5 = Array(5).fill(STAR_SVG).join('');
const testiHTML = TESTI.map(t =>
  `<div class="tcard"><div class="av-row"><div class="av" style="background:${t.col}">${t.name[0]}</div><div class="tc-meta"><b>${t.name}</b><span>${t.role}</span></div></div><p>${t.text}</p><div class="stars">${stars5}</div></div>`
).join('');

// Video mẫu (showcase tĩnh). Khi có video thật: set video: 'samples/x.mp4' (hoặc link) -> render <video>.
// ratio: '9:16' (dọc, mặc định) hoặc '16:9' (ngang). 16:9 -> card to gấp đôi, video hiện đúng tỉ lệ, KHÔNG cắt.
const SAMPLES = [
  // 5 video DỌC 9:16  -> đặt tên file v1.mp4 ... v5.mp4
  { dur: '0:48', title: 'Mẹ & Nam mở spa — phim nhiều cảnh', seed: 'aiac-vid1', ratio: '9:16' },
  { dur: '0:32', title: 'Khoe túi xách da — video bán hàng UGC', seed: 'aiac-vid2', ratio: '9:16' },
  { dur: '1:04', title: 'Câu chuyện khởi nghiệp — kịch bản AI', seed: 'aiac-vid3', ratio: '9:16' },
  { dur: '0:24', title: 'Review mỹ phẩm — giữ mặt KOL', seed: 'aiac-vid4', ratio: '9:16' },
  { dur: '0:40', title: 'Phim hoạt hình 3D — nhân vật dễ thương', seed: 'aiac-vid5', ratio: '9:16' },
  // 3 video NGANG 16:9 -> đặt tên file v6.mp4 ... v8.mp4 (card tự to gấp đôi, không cắt)
  { dur: '0:36', title: 'TVC quảng cáo — khung hình ngang', seed: 'aiac-vid6', ratio: '16:9' },
  { dur: '0:52', title: 'Trailer thương hiệu — phong cách điện ảnh', seed: 'aiac-vid7', ratio: '16:9' },
  { dur: '0:28', title: 'Video doanh nghiệp — góc quay rộng', seed: 'aiac-vid8', ratio: '16:9' },
];
// Tự dò file trong landing/samples/: có v{N}.mp4 -> render video thật; có v{N}.jpg -> dùng làm ảnh bìa.
const cardHTML = (s, i) => {
  const v9 = `samples/v${i + 1}.mp4`;
  const vW = `samples/v${i + 1}w.mp4`;          // hậu tố 'w' = video NGANG 16:9
  const hasW = fs.existsSync(path.join(__dirname, vW));
  const hasVideo = hasW || fs.existsSync(path.join(__dirname, v9));
  const vfile = hasW ? vW : v9;
  const wide = hasW || s.ratio === '16:9';   // slot 16:9 luôn ngang (v6.mp4 cũng được); hoặc file có hậu tố 'w'
  const r = wide ? '16:9' : '9:16';
  const pfile = `samples/v${i + 1}.jpg`;
  const poster = fs.existsSync(path.join(__dirname, pfile)) ? pfile : `https://picsum.photos/seed/${s.seed}/${wide ? '640/360' : '360/640'}`;
  const media = hasVideo
    ? `<video src="${vfile}" poster="${poster}" controls preload="metadata" playsinline></video>`
    : `<img class="ph${wide ? ' wide' : ''}" loading="lazy" src="${poster}" alt="Video mẫu AI AutoCut: ${s.title}"><span class="play">${PLAY}</span>`;
  return `<div class="svid${wide ? ' wide' : ''}"><span class="ratio">${r}</span>${hasVideo ? '' : `<span class="dur">${s.dur}</span>`}${media}<div class="meta"><div class="t">${s.title}</div><div class="by"><span>AI AutoCut</span><span>720p</span></div></div></div>`;
};
// 2 TẦNG: tầng trên = video DỌC (9:16), tầng dưới = video NGANG (16:9). Giữ index gốc để dò đúng file vN.
const idx = SAMPLES.map((s, i) => ({ s, i }));
const rowVert = idx.filter(x => x.s.ratio !== '16:9').map(x => cardHTML(x.s, x.i)).join('');
const rowHorz = idx.filter(x => x.s.ratio === '16:9').map(x => cardHTML(x.s, x.i)).join('');
const svidHTML = `<div class="srow srow-v">${rowVert}</div>${rowHorz ? `<div class="srow srow-h">${rowHorz}</div>` : ''}`;

// Build the body HTML (same as Landing.tsx template)
const bodyHTML = `
<div class="shell">
  <header><div class="inner"><div class="hrow">
    <div class="brand">
      <span class="logo">${LOGO_SVG}</span>
      AI AutoCut
    </div>
    <nav class="links">
      <a href="#features">Tính năng</a>
      <a href="#how">Cách hoạt động</a>
      <a href="#samples">Video mẫu</a>
      <a href="#guide">Hướng dẫn</a>
      <a href="#pricing">Bảng giá</a>
    </nav>
    <div class="hright">
      <a class="btn btn-ghost" href="https://app.aiautocut.com/login">Đăng nhập</a>
      <a class="btn btn-grad" href="https://app.aiautocut.com/register">Bắt đầu miễn phí</a>
    </div>
  </div></div></header>

  <div class="inner">
    <section class="hero">
      <div class="reveal">
        <div class="pill"><span class="d"></span>🎁 Dùng thử miễn phí 24h · Veo 3.1</div>
        <h1>Một dòng ý tưởng,<br/>thành <span class="g">bộ phim AI</span> hoàn chỉnh.</h1>
        <p class="lead">AI AutoCut tự viết kịch bản, giữ nguyên gương mặt nhân vật qua từng cảnh, render bằng Veo 3.1 rồi ghép thành video. Bạn chỉ cần ý tưởng — phần còn lại để AI lo.</p>
        <div class="cta-row">
          <a class="btn btn-grad btn-lg" href="https://app.aiautocut.com/register"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4l1.6 5.4L19 11l-5.4 1.6L12 18l-1.6-5.4L5 11l5.4-1.6z"/></svg> Tạo video đầu tiên — miễn phí</a>
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

  <section class="blk" id="samples"><div class="inner">
    <div class="eyebrow reveal">Video mẫu</div>
    <h2 class="h2 reveal">Video từ cộng đồng</h2>
    <p class="sub reveal">Vài video do AI AutoCut tạo — nhân vật giữ mặt xuyên cảnh, nối khung mượt, lồng tiếng Việt tự nhiên.</p>
    <div class="samples reveal">${svidHTML}</div>
  </div></section>

  <section class="blk" id="testimonials"><div class="inner">
    <div class="eyebrow reveal">Người dùng nói gì</div>
    <h2 class="h2 reveal">Hàng nghìn creator đang tạo phim với AI AutoCut</h2>
    <div class="testi reveal">${testiHTML}</div>
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
    <h2 class="h2 reveal">Dùng thử miễn phí, nâng Pro khi cần</h2>
    <p class="sub reveal">Mở tài khoản là có ngay <b>24 giờ tạo video miễn phí</b> — không cần thẻ. Thích thì nâng Pro chỉ từ <b>249k/tháng</b>.</p>
    <div class="price">
      <div class="pcard reveal">
        <span class="tag" style="background:rgba(249,115,22,.14);color:var(--accent);border:1px solid var(--line2)">DÙNG THỬ</span>
        <div class="name">Miễn phí</div>
        <div class="amt">0đ<small>/24 giờ đầu</small></div>
        <ul>
          <li>${CHECK_SVG} <b>24 giờ</b> tạo video thả ga</li>
          <li>${CHECK_SVG} Model Veo 3.1 Lite — <b>FREE</b></li>
          <li>${CHECK_SVG} Giữ mặt &amp; tự ghép phim</li>
          <li>${CHECK_SVG} 150MB lưu trữ</li>
        </ul>
        <a class="btn btn-ghost" href="https://app.aiautocut.com/register">Dùng thử miễn phí</a>
      </div>
      <div class="pcard hot reveal">
        <span class="tag">Phổ biến nhất</span>
        <div class="name">Pro</div>
        <div class="amt">249k<small>/tháng</small></div>
        <ul>
          <li>${CHECK_SVG} Tạo video <b>không giới hạn</b></li>
          <li>${CHECK_SVG} <b>Tất cả</b> model: Lite · Fast · Quality</li>
          <li>${CHECK_SVG} Render hàng loạt + ưu tiên hàng đợi</li>
          <li>${CHECK_SVG} <b>1GB</b> lưu trữ</li>
          <li>${CHECK_SVG} Hỗ trợ ưu tiên (Telegram/Zalo)</li>
        </ul>
        <a class="btn btn-grad" href="https://app.aiautocut.com/register">Nâng Pro ngay</a>
      </div>
      <div class="pcard reveal">
        <span class="tag" style="background:rgba(16,185,129,.14);color:var(--green);border:1px solid var(--line2)">TIẾT KIỆM 13%</span>
        <div class="name">Pro · 12 tháng</div>
        <div class="amt">2.599k<small>/năm</small></div>
        <ul>
          <li>${CHECK_SVG} Mọi thứ ở gói Pro</li>
          <li>${CHECK_SVG} Chỉ <b>~217k/tháng</b> — rẻ hơn 13%</li>
          <li>${CHECK_SVG} Thanh toán 1 lần, dùng cả năm</li>
        </ul>
        <a class="btn btn-ghost" href="https://app.aiautocut.com/register">Chọn gói năm</a>
      </div>
    </div>
    <p class="sub reveal" style="margin-top:16px;font-size:13px">Còn gói <b>6 tháng — 1.419k</b> (tiết kiệm 5%). Mọi gói Pro đều <b>1GB</b> lưu trữ &amp; full tính năng. Hủy bất cứ lúc nào.</p>

    <div class="band reveal">
      <div class="band-left">
        <h2>Bắt đầu tạo video của bạn<br/>ngay hôm nay</h2>
        <p>Mở tài khoản nhận ngay <b>24h tạo video miễn phí</b> — không cần thẻ tín dụng.</p>
        <div class="band-form">
          <input class="band-input" type="text" placeholder="Nhập ý tưởng của bạn..." onclick="window.location='https://app.aiautocut.com/register'" readonly />
          <a class="btn btn-grad" href="https://app.aiautocut.com/register">Tạo video ngay</a>
        </div>
      </div>
      <div class="band-right">
        <img loading="lazy" src="https://picsum.photos/seed/aiac-cta2/500/340" alt="AI AutoCut video preview" />
      </div>
    </div>
  </div></section>

  <footer><div class="inner">
    <div class="foot-top">
      <div class="foot-brand">
        <div class="brand"><span class="logo">${LOGO_SVG}</span> AI AutoCut</div>
        <p class="foot-desc">Nền tảng AI tạo video giúp bạn biến ý tưởng thành những video chuyên nghiệp trong vài phút.</p>
      </div>
      <div class="fcol"><b>Sản phẩm</b><a href="#features">Tính năng</a><a href="#pricing">Bảng giá</a><a href="#">API</a><a href="#">Blog</a></div>
      <div class="fcol"><b>Hỗ trợ</b><a href="https://app.aiautocut.com/guide">Hướng dẫn</a><a href="https://t.me/thaidem57" target="_blank" rel="noreferrer">Telegram</a><a href="https://zalo.me/0366566303" target="_blank" rel="noreferrer">Zalo: 0366566303</a></div>
      <div class="fcol"><b>Công ty</b><a href="#">Về chúng tôi</a><a href="#">Blog</a><a href="#">Tuyển dụng</a></div>
      <div class="fcol"><b>Chính sách</b><a href="#">Điều khoản sử dụng</a><a href="#">Chính sách bảo mật</a><a href="#">Tiếng Việt</a></div>
    </div>
    <div class="foot-bottom"><span>© 2026 AI AutoCut. All rights reserved.</span></div>
  </div></footer>
</div>
`;

// Read CSS
const css = fs.readFileSync(path.join(__dirname, '..', 'frontend', 'src', 'pages', 'Landing.css'), 'utf8');

// Build full HTML page
const html = `<!DOCTYPE html>
<html lang="vi">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>AI AutoCut — Tạo video AI từ ý tưởng, giữ mặt nhân vật, ghép phim tự động</title>
<meta name="description" content="AI AutoCut tự viết kịch bản, giữ nguyên gương mặt nhân vật qua từng cảnh, render bằng Veo 3.1 rồi ghép thành video hoàn chỉnh. Dùng thử miễn phí 24h.">
<meta name="keywords" content="AI video, tạo video AI, Veo 3.1, giữ mặt nhân vật, video TikTok, AI AutoCut">
<meta property="og:title" content="AI AutoCut — Biến ý tưởng thành phim AI">
<meta property="og:description" content="Tự viết kịch bản, giữ mặt, render và ghép phim tự động bằng Veo 3.1. Dùng thử miễn phí 24h.">
<meta property="og:type" content="website">
<meta property="og:url" content="https://aiautocut.com">
<link rel="canonical" href="https://aiautocut.com">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<style>html,body{margin:0;padding:0;background:#0B0911;min-height:100vh}
${css}</style>
</head>
<body>
<div id="lp">${bodyHTML}</div>
<script>
(function(){
  var els=document.querySelectorAll('#lp .reveal');
  var rm=window.matchMedia('(prefers-reduced-motion:reduce)').matches;
  if(rm){els.forEach(function(e){e.classList.add('is-in')});return}
  var io=new IntersectionObserver(function(ents){ents.forEach(function(en){if(en.isIntersecting){en.target.classList.add('is-in');io.unobserve(en.target)}})},{threshold:.12});
  els.forEach(function(e){io.observe(e)});
  var raf=0;
  window.addEventListener('mousemove',function(e){
    if(raf)return;
    raf=requestAnimationFrame(function(){raf=0;
      var el=e.target.closest('.fcard,.pcard,.gcard,.step');
      if(!el)return;var r=el.getBoundingClientRect();
      el.style.setProperty('--mx',(e.clientX-r.left)+'px');
      el.style.setProperty('--my',(e.clientY-r.top)+'px');
    });
  },{passive:true});
})();
</script>
</body>
</html>`;

// Write output
fs.writeFileSync(path.join(__dirname, 'index.html'), html, 'utf8');
console.log('✅ Built landing/index.html from Landing.tsx + Landing.css');
console.log('   All CTA links → app.aiautocut.com');
