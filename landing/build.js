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
  { dur: '0:15', title: 'Áo trắng tay dài, kính gọng mảnh, nón hồng che nghiêng — vẻ đẹp thanh tao giữa nắng sớm. 🌸', seed: 'aiac-vid1', ratio: '9:16' },
  { dur: '0:12', title: 'Thân hình mảnh mai trong lớp lụa trắng mỏng, tóc búi cao — như tiên tử giáng trần. ✨', seed: 'aiac-vid2', ratio: '9:16' },
  { dur: '0:28', title: 'Đồ ngủ hồng nhẹ nhàng, tay chạm cằm, ánh đèn ấm — một góc khuê phòng yên tĩnh. 🌙', seed: 'aiac-vid3', ratio: '9:16' },
  { dur: '0:13', title: 'Satin đen óng ả, kính gọng mảnh, tóc xõa — khí chất quý phi lạnh lùng. 🖤', seed: 'aiac-vid4', ratio: '9:16' },
  { dur: '0:08', title: 'Mèo nón lá đứng giữa ruộng lúa bậc thang — như linh thú trong tranh sơn thủy. 🐱🌾', seed: 'aiac-vid5', ratio: '9:16' },
  // 3 video NGANG 16:9 -> đặt tên file v6.mp4 ... v8.mp4 (card tự to gấp đôi, không cắt)
  { dur: '0:08', title: 'Mẹ con ngồi bên cửa sổ, cùng xem điện thoại — khoảnh khắc ấm áp như tranh gia đình cổ phong. 👨‍👩‍👦', seed: 'aiac-vid6', ratio: '16:9' },
  { dur: '0:08', title: 'Rắn biển uốn lượn trên nền cát trắng — như giao long ẩn mình giữa biển sâu. 🌊', seed: 'aiac-vid7', ratio: '16:9' },
  { dur: '0:08', title: 'Rùa biển bơi giữa rừng san hô rực rỡ — cảnh tượng tiên cảnh dưới đáy biển. 🐢💙', seed: 'aiac-vid8', ratio: '16:9' },
];
// Tự dò file trong landing/samples/. Ưu tiên .mp4 (chạy mọi trình duyệt); nhận thêm .webm/.mov/.m4v nếu có.
// Đọc tên file THẬT (giữ đúng hoa/thường) để không 404 trên Linux VPS (vd v1.MP4 / v3.MOV).
const VEXT = ['mp4', 'webm', 'mov', 'm4v'];
let SFILES = [];
try { SFILES = fs.readdirSync(path.join(__dirname, 'samples')); } catch (e) { SFILES = []; }
const findReal = (name) => { const r = SFILES.find(f => f.toLowerCase() === name.toLowerCase()); return r ? `samples/${r}` : null; };
const findVid = (base) => { for (const e of VEXT) { const hit = findReal(`${base}.${e}`); if (hit) return hit; } return null; };
const mimeOf = (f) => { const l = f.toLowerCase(); return l.endsWith('.webm') ? 'video/webm' : (l.endsWith('.mov') ? 'video/quicktime' : (l.endsWith('.m4v') ? 'video/x-m4v' : 'video/mp4')); };
const cardHTML = (s, i) => {
  const fW = findVid(`v${i + 1}w`);          // file NGANG 16:9 (hậu tố 'w')
  const vfile = fW || findVid(`v${i + 1}`);
  const hasVideo = !!vfile;
  const wide = !!fW || s.ratio === '16:9';   // slot 16:9 luôn ngang (v6.mp4 cũng được); hoặc file có hậu tố 'w'
  const r = wide ? '16:9' : '9:16';
  const poster = findReal(`v${i + 1}.jpg`) || `https://picsum.photos/seed/${s.seed}/${wide ? '640/360' : '360/640'}`;
  const media = hasVideo
    ? `<video poster="${poster}" controls preload="metadata" playsinline><source src="${vfile}" type="${mimeOf(vfile)}"></video>`
    : `<img class="ph${wide ? ' wide' : ''}" loading="lazy" src="${poster}" alt="Video mẫu AI AutoCut: ${s.title}"><span class="play">${PLAY}</span>`;
  return `<div class="svid${wide ? ' wide' : ''}"><span class="ratio">${r}</span>${hasVideo ? '' : `<span class="dur">${s.dur}</span>`}${media}<div class="meta"><div class="t">${s.title}</div><div class="by"><span>AI AutoCut</span><span>720p</span></div></div></div>`;
};
// 2 TẦNG: tầng trên = video DỌC (9:16), tầng dưới = video NGANG (16:9). Giữ index gốc để dò đúng file vN.
const idx = SAMPLES.map((s, i) => ({ s, i }));
const rowVert = idx.filter(x => x.s.ratio !== '16:9').map(x => cardHTML(x.s, x.i)).join('');
const rowHorz = idx.filter(x => x.s.ratio === '16:9').map(x => cardHTML(x.s, x.i)).join('');
const svidHTML = `<div class="srow srow-v">${rowVert}</div>${rowHorz ? `<div class="srow srow-h">${rowHorz}</div>` : ''}`;

// ===== Dải "năng lực" + "số liệu" dưới hero (re-design theo phong cách thương hiệu mình) =====
// Icon đổ gradient cam->hồng->tím dùng chung 1 def SVG (#aiacg).
const GRAD_DEF = `<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs><linearGradient id="aiacg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#F97316"/><stop offset=".56" stop-color="#EC4899"/><stop offset="1" stop-color="#A855F7"/></linearGradient></defs></svg>`;
const capIcon = (p) => `<svg viewBox="0 0 24 24" fill="none" stroke="url(#aiacg)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`;
const CAPS = [
  { t: 'Text to Video', d: 'Biến văn bản thành video sống động', ic: `<path d="M5 7h12M5 12h8M5 17h5"/><path d="m15 11 6 3.5-6 3.5z"/>` },
  { t: 'Image to Video', d: 'Biến hình ảnh thành video chuyên nghiệp', ic: `<rect x="3" y="4.5" width="18" height="15" rx="2.2"/><circle cx="8.4" cy="10" r="1.7"/><path d="m4 17 5-4 4 3 3-2 4 3"/>` },
  { t: 'Kịch bản (Story)', d: 'Tạo video dạng câu chuyện cuốn hút', ic: `<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M7 5v14M17 5v14M3 9.5h4M3 14.5h4M17 9.5h4M17 14.5h4"/>` },
  { t: 'Đồng nhất nhân vật', d: 'Giữ nhân vật nhất quán giữa các cảnh', ic: `<circle cx="9" cy="9" r="2.6"/><path d="M4 19a5 5 0 0 1 10 0"/><path d="M15.6 7.3a2.6 2.6 0 0 1 0 4.5"/><path d="M16.2 14.6a5 5 0 0 1 3.8 4.4"/>` },
  { t: 'Sao chép phong cách', d: 'Tái hiện phong cách video bạn thích', ic: `<rect x="8.5" y="8.5" width="11" height="11" rx="2"/><path d="M15.5 8.5V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v7.5a2 2 0 0 0 2 2h2.5"/>` },
  { t: 'Thư viện Prompt', d: 'Hàng trăm mẫu prompt để tham khảo', ic: `<path d="M4 20h16"/><path d="M6.5 20V9M10.5 20V5M14.5 20v-7M18.5 20V11"/>` },
  { t: 'Check thương hiệu', d: 'Soi logo, watermark trong hình ảnh', ic: `<path d="M12 3.5 5 6v5c0 4.3 2.9 7.4 7 8.8 4.1-1.4 7-4.5 7-8.8V6z"/><path d="m9.2 11.8 2 2 3.6-3.8"/>` },
];
const capsHTML = CAPS.map(c => `<div class="cap"><span class="ci">${capIcon(c.ic)}</span><h4>${c.t}</h4><p>${c.d}</p></div>`).join('');
const SPARK = `<svg viewBox="0 0 24 24" fill="url(#aiacg)"><path d="M12 3l1.7 5.8L20 11l-6.3 2.2L12 21l-1.7-7.8L4 11l6.3-2.2z"/></svg>`;
// ⚠️ SỐ LIỆU marketing — sửa cho ĐÚNG thực tế của mình (đây là số khởi điểm theo mẫu).
const NUMS = [
  { n: '2.1M+', l: 'Video đã tạo' },
  { n: '12.000+', l: 'Creator tin dùng' },
  { n: '4.8M+ phút', l: 'Thời gian tiết kiệm' },
  { n: '48+', l: 'Quốc gia sử dụng' },
  { n: 'Hàng ngày', l: 'Nội dung mới từ cộng đồng' },
];
const numsHTML = NUMS.map(s => `<div class="snum"><span class="si">${SPARK}</span><div class="sx"><b>${s.n}</b><span>${s.l}</span></div></div>`).join('');

// ===== Section "Không cần..." (chốt sale) + banner đa thiết bị =====
const NOCARDS = [
  { thing: 'biết Prompt', d: 'Gõ ý tưởng bằng tiếng Việt — AI tự viết prompt điện ảnh cho từng cảnh.', ic: `<path d="M5 7h12M5 12h8M5 17h5"/>` },
  { thing: 'giỏi công nghệ', d: 'Giao diện gọn gàng, bấm là chạy. Không thuật ngữ, không thiết lập rối rắm.', ic: `<circle cx="12" cy="12" r="3.2"/><path d="M12 3v2.4M12 18.6V21M3 12h2.4M18.6 12H21M5.6 5.6l1.7 1.7M16.7 16.7l1.7 1.7M18.4 5.6l-1.7 1.7M7.3 16.7l-1.7 1.7"/>` },
  { thing: 'nhiều AI tốn phí', d: 'Một nền tảng lo trọn: kịch bản · giọng đọc · render · ghép phim.', ic: `<path d="m3.6 12.4 8-8.4H20a.5.5 0 0 1 .5.5v8.4l-8 8z"/><circle cx="15.4" cy="8.6" r="1.4"/>` },
  { thing: 'cài đặt vào máy', d: 'Chạy ngay trên trình duyệt — không tải về, không ngốn ổ cứng.', ic: `<path d="M7.5 18a4 4 0 0 1 .4-8 5.5 5.5 0 0 1 10.6 1.5A3.5 3.5 0 0 1 17.5 18z"/>` },
];
const nocardsHTML = NOCARDS.map(c => `<div class="nocard reveal"><span class="nc-ic">${capIcon(c.ic)}</span><h4>Không cần <em>${c.thing}</em></h4><p>${c.d}</p></div>`).join('');
const DEVS = [
  { t: 'Điện thoại', ic: `<rect x="7" y="3" width="10" height="18" rx="2.4"/><path d="M11 18h2"/>` },
  { t: 'Máy tính bảng', ic: `<rect x="5" y="3" width="14" height="18" rx="2.2"/><path d="M11 18h2"/>` },
  { t: 'Laptop / PC', ic: `<rect x="4" y="5" width="16" height="11" rx="1.6"/><path d="M2 20h20"/>` },
];
const devsHTML = DEVS.map(d => `<span class="db-dev"><svg viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${d.ic}</svg>${d.t}</span>`).join('');
const GLOBE = `<svg viewBox="0 0 24 24" fill="none" stroke="url(#aiacg)" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><path d="M12 3c2.6 2.4 2.6 15.6 0 18M12 3c-2.6 2.4-2.6 15.6 0 18"/></svg>`;

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

  <div class="inner caps-wrap reveal">
    ${GRAD_DEF}
    <div class="capstrip">${capsHTML}</div>
    <div class="statstrip">${numsHTML}</div>
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

  <section class="blk" id="why"><div class="inner">
    <div class="eyebrow reveal">Đơn giản tới mức khó tin</div>
    <h2 class="h2 reveal">Một cú click — ra video AI <span class="g">hoàn chỉnh</span></h2>
    <p class="sub reveal">Một dòng ý tưởng bằng tiếng Việt. Mọi thứ rắc rối còn lại, để AI AutoCut lo trọn.</p>
    <div class="nocards">${nocardsHTML}</div>
    <div class="device-banner reveal">
      <div class="db-left">
        <span class="db-ic">${GLOBE}</span>
        <div><h3>Chạy thẳng trên web — không cài gì cả</h3><p>Mở trình duyệt là tạo video ngay. Không tải app, không cấu hình, không tốn ổ cứng.</p></div>
      </div>
      <div class="db-devices">${devsHTML}</div>
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
