import { useEffect } from 'react'
import './Landing.css'

// ============================================
// AI AutoCut Landing — React + Vite Static Export
// Component hóa sạch, dễ bảo trì. Reusable nhỏ.
// Giữ JS tối thiểu: reveal scroll + spotlight hover.
// ============================================

const Logo = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="6" cy="6" r="2.4" />
    <circle cx="6" cy="18" r="2.4" />
    <line x1="8.1" y1="7.6" x2="20" y2="18" />
    <line x1="8.1" y1="16.4" x2="20" y2="6" />
  </svg>
)

const Check = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
    <path d="m5 13 4 4L19 7" />
  </svg>
)

const PlayIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
)

const Star = () => (
  <svg viewBox="0 0 20 20" fill="currentColor" width="14" height="14">
    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
  </svg>
)


// Sample videos (giữ nguyên từ build.js + samples thực tế)
const SAMPLES = [
  { id: 1, dur: '0:15', title: 'Áo trắng tay dài, kính gọng mảnh, nón hồng che nghiêng — vẻ đẹp thanh tao giữa nắng sớm. 🌸', ratio: '9:16', file: 'v1.MP4' },
  { id: 2, dur: '0:12', title: 'Thân hình mảnh mai trong lớp lụa trắng mỏng, tóc búi cao — như tiên tử giáng trần. ✨', ratio: '9:16', file: 'v2.MP4' },
  { id: 3, dur: '0:28', title: 'Đồ ngủ hồng nhẹ nhàng, tay chạm cằm, ánh đèn ấm — một góc khuê phòng yên tĩnh. 🌙', ratio: '9:16', file: 'v3.mp4' },
  { id: 4, dur: '0:13', title: 'Satin đen óng ả, kính gọng mảnh, tóc xõa — khí chất quý phi lạnh lùng. 🖤', ratio: '9:16', file: 'v4.MP4' },
  { id: 5, dur: '0:08', title: 'Mèo nón lá đứng giữa ruộng lúa bậc thang — như linh thú trong tranh sơn thủy. 🐱🌾', ratio: '9:16', file: 'v5.mp4' },
  { id: 6, dur: '0:08', title: 'Mẹ con ngồi bên cửa sổ, cùng xem điện thoại — khoảnh khắc ấm áp như tranh gia đình cổ phong. 👨‍👩‍👦', ratio: '16:9', file: 'v6.mp4' },
  { id: 7, dur: '0:08', title: 'Rắn biển uốn lượn trên nền cát trắng — như giao long ẩn mình giữa biển sâu. 🌊', ratio: '16:9', file: 'v7.mp4' },
  { id: 8, dur: '0:08', title: 'Rùa biển bơi giữa rừng san hô rực rỡ — cảnh tượng tiên cảnh dưới đáy biển. 🐢💙', ratio: '16:9', file: 'v8.mp4' },
]

// Testimonials
const TESTIMONIALS = [
  { name: 'Minh Hoàng', role: 'TikTok Creator', col: '#F97316', text: 'AI AutoCut giúp mình tạo hàng chục video mỗi ngày mà không tốn nhiều thời gian. Nhân vật nhất quán xuyên suốt mọi cảnh.' },
  { name: 'Thùy Linh', role: 'Content Creator', col: '#10B981', text: 'Kịch bản hay, giọng đọc tự nhiên, video viral hơn hẳn từ khi dùng AI AutoCut. Không thể thiếu.' },
  { name: 'Anh Tuấn', role: 'Affiliate Marketer', col: '#8B5CF6', text: 'Tăng hiệu quả affiliate lên 300% nhờ video AI. Tiết kiệm cả tuần quay dựng mỗi tháng.' },
  { name: 'Hải Yến', role: 'Giảng viên Online', col: '#3B82F6', text: 'Công cụ quá mạnh cho ai làm coaching như mình. Tạo nội dung khoá học nhanh gấp 5 lần trước đây.' },
  { name: 'Trần Bình', role: 'CEO – BizUp', col: '#EC4899', text: 'Tiết kiệm chi phí sản xuất video đáng kể cho doanh nghiệp. Đáng đầu tư nhất trong năm qua.' },
]

// "Không cần" cards
const NO_NEED = [
  { thing: 'biết Prompt', d: 'Gõ ý tưởng bằng tiếng Việt — AI tự viết prompt điện ảnh cho từng cảnh.' },
  { thing: 'giỏi công nghệ', d: 'Giao diện gọn gàng, bấm là chạy. Không thuật ngữ, không thiết lập rối rắm.' },
  { thing: 'nhiều AI tốn phí', d: 'Một nền tảng lo trọn: kịch bản · giọng đọc · render · ghép phim.' },
  { thing: 'cài đặt vào máy', d: 'Chạy ngay trên trình-browser — không tải về, không ngốn ổ cứng.' },
]

// How steps
const STEPS = [
  { n: '01', h: 'Nhập ý tưởng', p: 'Mô tả nội dung, chọn số cảnh, thời lượng, tỉ lệ và phong cách. Thêm nhân vật cần giữ mặt nếu có.' },
  { n: '02', h: 'AI viết kịch bản', p: 'AI sinh prompt cho từng cảnh. Bạn xem trước trên storyboard và chỉnh sửa tự do.' },
  { n: '03', h: 'Render & ghép', p: 'Bấm một nút — mọi cảnh được render rồi tự ghép thành phim. Tải về hoặc chia sẻ.' },
]

// Features
const FEATURES = [
  { icon: 'script', title: 'Kịch bản tự động, chia cảnh thông minh', desc: 'Gõ ý tưởng — AI chia thành nhiều cảnh có lớp lang, viết prompt điện ảnh riêng cho từng cảnh. Bạn xem trên storyboard và sửa thoải mái trước khi render.' },
  { icon: 'face', title: 'Giữ mặt nhân vật', desc: 'Tải ảnh nhân vật một lần — gương mặt được giữ nguyên xuyên suốt mọi cảnh, kể cả khi làm nhiều phần (Phần 1, Phần 2…).' },
  { icon: 'merge', title: 'Render & ghép tự động', desc: 'Mỗi cảnh render bằng Veo 3.1, hệ thống tự nối thành một video hoàn chỉnh để tải về ngay — không cần phần mềm dựng.' },
]

// Guide steps
const GUIDES = [
  { n: '01', title: 'Cài tiện ích Chrome', desc: 'Tải gói tiện ích (có sẵn trong app), bật Developer mode ở chrome://extensions rồi Load unpacked.' },
  { n: '02', title: 'Kết nối Google Ultra', desc: 'Đăng nhập tài khoản Google có gói Ultra qua tiện ích, mở một tab Flow — badge xanh là sẵn sàng.' },
  { n: '03', title: 'Tạo video', desc: 'Vào Dự án viết kịch bản, hoặc dùng các Công cụ (Ảnh→Video, Giữ mặt→Video, Tạo ảnh…). Bấm tạo là xong.' },
]

export default function Landing() {
  useEffect(() => {
    const els = Array.from(document.querySelectorAll('#lp .reveal'))
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    if (reduce) {
      els.forEach(e => e.classList.add('is-in'))
    } else {
      const io = new IntersectionObserver((ents) => {
        ents.forEach(en => {
          if (en.isIntersecting) {
            en.target.classList.add('is-in')
            io.unobserve(en.target)
          }
        })
      }, { threshold: 0.12 })
      els.forEach(e => io.observe(e))
    }

    // Spotlight (gradient theo chuột trên thẻ)
    let raf = 0
    const onMove = (e: MouseEvent) => {
      if (raf) return
      raf = requestAnimationFrame(() => {
        raf = 0
        const el = (e.target as HTMLElement)?.closest?.('.fcard, .pcard, .gcard, .step, .nocard') as HTMLElement | null
        if (!el) return
        const r = el.getBoundingClientRect()
        el.style.setProperty('--mx', `${e.clientX - r.left}px`)
        el.style.setProperty('--my', `${e.clientY - r.top}px`)
      })
    }
    if (!reduce) window.addEventListener('mousemove', onMove, { passive: true })

    return () => {
      window.removeEventListener('mousemove', onMove)
      if (raf) cancelAnimationFrame(raf)
    }
  }, [])

  // Helper icon gradient (dùng trong cap + nocard)
  const GradIcon = ({ children }: { children: React.ReactNode }) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="url(#aiacg)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      {children}
    </svg>
  )

  const renderSample = (s: typeof SAMPLES[0], idx: number) => {
    const isWide = s.ratio === '16:9'
    const src = `samples/${s.file}`
    const poster = `https://picsum.photos/seed/aiac-vid${s.id}/${isWide ? '640/360' : '360/640'}`

    return (
      <div key={idx} className={`svid${isWide ? ' wide' : ''}`}>
        <span className="ratio">{s.ratio}</span>
        <video
          poster={poster}
          controls
          preload="metadata"
          playsInline
          onError={(e) => {
            // Fallback thành poster nếu video 404 (dev hoặc chưa copy samples)
            const t = e.currentTarget
            t.style.display = 'none'
            const img = document.createElement('img')
            img.src = poster
            img.className = 'ph' + (isWide ? ' wide' : '')
            img.alt = s.title
            t.parentElement?.insertBefore(img, t)
          }}
        >
          <source src={src} type="video/mp4" />
        </video>
        <div className="meta">
          <div className="t">{s.title}</div>
          <div className="by"><span>AI AutoCut</span><span>720p</span></div>
        </div>
      </div>
    )
  }

  return (
    <div id="lp">
      {/* Gradient def cho icon */}
      <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
        <defs>
          <linearGradient id="aiacg" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#F97316" />
            <stop offset=".56" stopColor="#EC4899" />
            <stop offset="1" stopColor="#A855F7" />
          </linearGradient>
        </defs>
      </svg>

      <div className="shell">
        {/* HEADER */}
        <header>
          <div className="inner">
            <div className="hrow">
              <div className="brand">
                <span className="logo"><Logo /></span>
                AI AutoCut
              </div>
              <nav className="links">
                <a href="#features">Tính năng</a>
                <a href="#how">Cách hoạt động</a>
                <a href="#samples">Video mẫu</a>
                <a href="#guide">Hướng dẫn</a>
                <a href="#pricing">Bảng giá</a>
              </nav>
              <div className="hright">
                <a className="btn btn-ghost" href="https://app.aiautocut.com/login">Đăng nhập</a>
                <a className="btn btn-grad" href="https://app.aiautocut.com/register">Bắt đầu miễn phí</a>
              </div>
            </div>
          </div>
        </header>

        {/* HERO */}
        <div className="inner">
          <section className="hero">
            <div className="reveal">
              <div className="pill"><span className="d"></span>🎁 Dùng thử miễn phí 24h · Veo 3.1</div>
              <h1>Một dòng ý tưởng,<br />thành <span className="g">bộ phim AI</span> hoàn chỉnh.</h1>
              <p className="lead">AI AutoCut tự viết kịch bản, giữ nguyên gương mặt nhân vật qua từng cảnh, render bằng Veo 3.1 rồi ghép thành video. Bạn chỉ cần ý tưởng — phần còn lại để AI lo.</p>
              <div className="cta-row">
                <a className="btn btn-grad btn-lg" href="https://app.aiautocut.com/register">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M12 4l1.6 5.4L19 11l-5.4 1.6L12 18l-1.6-5.4L5 11l5.4-1.6z"/></svg>
                  Tạo video đầu tiên — miễn phí
                </a>
                <a className="btn btn-ghost btn-lg" href="#how">Xem cách hoạt động</a>
              </div>

              <div className="stats">
                <div className="stat"><b>Veo 3.1</b><span>engine mới nhất</span></div>
                <div className="stat"><b>Giữ mặt</b><span>xuyên mọi cảnh</span></div>
                <div className="stat"><b>Tự ghép</b><span>ra phim hoàn chỉnh</span></div>
                <div className="stat"><b>~vài phút</b><span>mỗi video</span></div>
              </div>
            </div>

            <div className="window reveal">
              <div className="wtop"><i></i><i></i><i></i><span className="url">app.aiautocut.com</span></div>
              <div className="wbody">
                <div className="wpane">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M12 4l1.6 5.4L19 11l-5.4 1.6L12 18l-1.6-5.4L5 11l5.4-1.6z"/></svg>
                  <span>Hồ ly chín đuôi tu luyện ngàn năm hóa thành thiếu nữ...</span>
                </div>
                <div className="board">
                  {[1,2,3,4,5,6].map(i => (
                    <div key={i} className={`cell${i === 1 ? ' f' : ''}`}>
                      <img loading="lazy" src={`https://picsum.photos/seed/aiac-fox${i}/440/300`} alt="" />
                      <span className="tg">Cảnh 0{i}</span>
                      <span className="play"><PlayIcon /></span>
                    </div>
                  ))}
                </div>
                <div className="wfoot">
                  <span className="big">1:36</span>
                  <span style={{ color: 'var(--text3)' }}>· 12×8s ·</span>
                  <span className="free">FREE</span>
                  <span className="go">Viết kịch bản →</span>
                </div>
              </div>
            </div>
          </section>
        </div>

        {/* SAMPLES */}
        <section className="blk" id="samples">
          <div className="inner">
            <div className="eyebrow reveal">Video mẫu</div>
            <h2 className="h2 reveal">Video từ cộng đồng</h2>
            <p className="sub reveal">Vài video do AI AutoCut tạo — nhân vật giữ mặt xuyên cảnh, nối khung mượt, lồng tiếng Việt tự nhiên.</p>

            <div className="samples reveal">
              <div className="srow srow-v">
                {SAMPLES.slice(0, 5).map((s, i) => renderSample(s, i))}
              </div>
              <div className="srow srow-h">
                {SAMPLES.slice(5).map((s, i) => renderSample(s, i + 5))}
              </div>
            </div>
          </div>
        </section>

        {/* FEATURES */}
        <section className="blk" id="features">
          <div className="inner">
            <div className="eyebrow reveal">Tính năng</div>
            <h2 className="h2 reveal">Cả một xưởng phim, gói trong một dòng ý tưởng</h2>
            <p className="sub reveal">Không cần biết dựng phim. Bạn mô tả, phần còn lại để AI AutoCut lo.</p>

            <div className="feat">
              <div className="fcard span2 reveal">
                <div className="fc-text">
                  <div className="ic">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M4 5h16M4 10h16M4 15h10M4 20h7"/></svg>
                  </div>
                  <h3>{FEATURES[0].title}</h3>
                  <p>{FEATURES[0].desc}</p>
                </div>
                <div className="fc-shots">
                  {[1,2,3].map(k => <img key={k} loading="lazy" src={`https://picsum.photos/seed/aiac-f${k}/300/200`} alt="" />)}
                </div>
              </div>

              {FEATURES.slice(1).map((f, idx) => (
                <div key={idx} className="fcard reveal">
                  <div className="ic">
                    {idx === 0 ? (
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="3.4"/><path d="M5.5 20a6.5 6.5 0 0 1 13 0"/></svg>
                    ) : (
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="6" width="18" height="12" rx="2"/><path d="m10 9 5 3-5 3z"/></svg>
                    )}
                  </div>
                  <h3>{f.title}</h3>
                  <p>{f.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* HOW IT WORKS */}
        <section className="blk" id="how">
          <div className="inner">
            <div className="eyebrow reveal">Cách hoạt động</div>
            <h2 className="h2 reveal">Ba bước, từ ý tưởng tới video</h2>
            <p className="sub reveal">Trung bình vài phút cho một video nhiều cảnh hoàn chỉnh.</p>
            <div className="steps">
              {STEPS.map((st, i) => (
                <div key={i} className="step reveal">
                  <span className="n">{st.n}</span>
                  <h3>{st.h}</h3>
                  <p>{st.p}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* WHY / NO NEED */}
        <section className="blk" id="why">
          <div className="inner">
            <div className="eyebrow reveal">Đơn giản tới mức khó tin</div>
            <h2 className="h2 reveal">Một cú click — ra video AI <span className="g">hoàn chỉnh</span></h2>
            <p className="sub reveal">Một dòng ý tưởng bằng tiếng Việt. Mọi thứ rắc rối còn lại, để AI AutoCut lo trọn.</p>

            <div className="nocards">
              {NO_NEED.map((n, i) => (
                <div key={i} className="nocard reveal">
                  <span className="nc-ic"><GradIcon><path d={i===0 ? "M5 7h12M5 12h8M5 17h5" : i===1 ? "M12 3v2.4M12 18.6V21M3 12h2.4M18.6 12H21M5.6 5.6l1.7 1.7M16.7 16.7l1.7 1.7M18.4 5.6l-1.7 1.7M7.3 16.7l-1.7 1.7" : i===2 ? "m3.6 12.4 8-8.4H20a.5.5 0 0 1 .5.5v8.4l-8 8z" : "M7.5 18a4 4 0 0 1 .4-8 5.5 5.5 0 0 1 10.6 1.5A3.5 3.5 0 0 1 17.5 18z"} /></GradIcon></span>
                  <h4>Không cần <em>{n.thing}</em></h4>
                  <p>{n.d}</p>
                </div>
              ))}
            </div>

            <div className="device-banner reveal">
              <div className="db-left">
                <span className="db-ic">
                  <GradIcon><circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><path d="M12 3c2.6 2.4 2.6 15.6 0 18M12 3c-2.6 2.4-2.6 15.6 0 18"/></GradIcon>
                </span>
                <div>
                  <h3>Chạy thẳng trên web — không cài gì cả</h3>
                  <p>Mở trình duyệt là tạo video ngay. Không tải app, không cấu hình, không tốn ổ cứng.</p>
                </div>
              </div>
              <div className="db-devices">
                <span className="db-dev">
                  <svg viewBox="0 0 24 24" fill="none" stroke="url(#aiacg)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="7" y="3" width="10" height="18" rx="2.4"/><path d="M11 18h2"/></svg>
                  Điện thoại
                </span>
                <span className="db-dev">
                  <svg viewBox="0 0 24 24" fill="none" stroke="url(#aiacg)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="3" width="14" height="18" rx="2.2"/><path d="M11 18h2"/></svg>
                  Máy tính bảng
                </span>
                <span className="db-dev">
                  <svg viewBox="0 0 24 24" fill="none" stroke="url(#aiacg)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="5" width="16" height="11" rx="1.6"/><path d="M2 20h20"/></svg>
                  Laptop / PC
                </span>
              </div>
            </div>
          </div>
        </section>


        {/* TESTIMONIALS */}
        <section className="blk" id="testimonials">
          <div className="inner">
            <div className="eyebrow reveal">Người dùng nói gì</div>
            <h2 className="h2 reveal">Hàng nghìn creator đang tạo phim với AI AutoCut</h2>
            <div className="testi reveal">
              {TESTIMONIALS.map((t, i) => (
                <div key={i} className="tcard">
                  <div className="av-row">
                    <div className="av" style={{ background: t.col }}>{t.name[0]}</div>
                    <div className="tc-meta">
                      <b>{t.name}</b>
                      <span>{t.role}</span>
                    </div>
                  </div>
                  <p>{t.text}</p>
                  <div className="stars">{Array.from({ length: 5 }).map((_, k) => <Star key={k} />)}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* GUIDE */}
        <section className="blk" id="guide">
          <div className="inner">
            <div className="eyebrow reveal">Hướng dẫn bắt đầu</div>
            <h2 className="h2 reveal">Chạy được trong 3 bước</h2>
            <p className="sub reveal">Cần máy tính + trình duyệt Chrome. Làm một lần là xong.</p>

            <div className="guide3">
              {GUIDES.map((g, i) => (
                <div key={i} className="gcard reveal">
                  <span className="gn">{g.n}</span>
                  <div className="gic">
                    {i === 0 && <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="8" height="8" rx="2"/><rect x="13" y="3" width="8" height="8" rx="2"/><rect x="3" y="13" width="8" height="8" rx="2"/><path d="M17 13v4m-2-2h4"/></svg>}
                    {i === 1 && <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M9 7H6a3 3 0 0 0 0 6h3m6 0h3a3 3 0 0 0 0-6h-3M8 10h8"/></svg>}
                    {i === 2 && <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M12 4l1.6 5.4L19 11l-5.4 1.6L12 18l-1.6-5.4L5 11l5.4-1.6z"/></svg>}
                  </div>
                  <h3>{g.title}</h3>
                  <p>{g.desc}</p>
                </div>
              ))}
            </div>

            <div className="ghint reveal">📘 Sau khi đăng nhập, mục <b>Hướng dẫn</b> trong app có chi tiết từng bước + nút tải tiện ích.</div>
          </div>
        </section>

        {/* PRICING */}
        <section className="blk" id="pricing">
          <div className="inner">
            <div className="eyebrow reveal">Bảng giá</div>
            <h2 className="h2 reveal">Dùng thử miễn phí, nâng Pro khi cần</h2>
            <p className="sub reveal">Mở tài khoản là có ngay <b>24 giờ tạo video miễn phí</b> — không cần thẻ. Thích thì nâng Pro chỉ từ <b>249k/tháng</b>.</p>

            <div className="price">
              {/* Free */}
              <div className="pcard reveal">
                <span className="tag" style={{ background: 'rgba(249,115,22,.14)', color: 'var(--accent)', border: '1px solid var(--line2)' }}>DÙNG THỬ</span>
                <div className="name">Miễn phí</div>
                <div className="amt">0đ<small>/24 giờ đầu</small></div>
                <ul>
                  <li>{Check()} <b>24 giờ</b> tạo video thả ga</li>
                  <li>{Check()} Model Veo 3.1 Lite — <b>FREE</b></li>
                  <li>{Check()} Giữ mặt &amp; tự ghép phim</li>
                  <li>{Check()} 150MB lưu trữ</li>
                </ul>
                <a className="btn btn-ghost" href="https://app.aiautocut.com/register">Dùng thử miễn phí</a>
              </div>

              {/* Pro */}
              <div className="pcard hot reveal">
                <span className="tag">Phổ biến nhất</span>
                <div className="name">Pro</div>
                <div className="amt">249k<small>/tháng</small></div>
                <ul>
                  <li>{Check()} Tạo video <b>không giới hạn</b></li>
                  <li>{Check()} <b>Tất cả</b> model: Lite · Fast · Quality</li>
                  <li>{Check()} Render hàng loạt + ưu tiên hàng đợi</li>
                  <li>{Check()} <b>1GB</b> lưu trữ</li>
                  <li>{Check()} Hỗ trợ ưu tiên (Telegram/Zalo)</li>
                </ul>
                <a className="btn btn-grad" href="https://app.aiautocut.com/register">Nâng Pro ngay</a>
              </div>

              {/* Yearly */}
              <div className="pcard reveal">
                <span className="tag" style={{ background: 'rgba(16,185,129,.14)', color: 'var(--green)', border: '1px solid var(--line2)' }}>TIẾT KIỆM 13%</span>
                <div className="name">Pro · 12 tháng</div>
                <div className="amt">2.599k<small>/năm</small></div>
                <ul>
                  <li>{Check()} Mọi thứ ở gói Pro</li>
                  <li>{Check()} Chỉ <b>~217k/tháng</b> — rẻ hơn 13%</li>
                  <li>{Check()} Thanh toán 1 lần, dùng cả năm</li>
                </ul>
                <a className="btn btn-ghost" href="https://app.aiautocut.com/register">Chọn gói năm</a>
              </div>
            </div>

            <p className="sub reveal" style={{ marginTop: 16, fontSize: 13 }}>Còn gói <b>6 tháng — 1.419k</b> (tiết kiệm 5%). Mọi gói Pro đều <b>1GB</b> lưu trữ &amp; full tính năng. Hủy bất cứ lúc nào.</p>

            {/* Final CTA band */}
            <div className="band reveal">
              <div className="band-left">
                <h2>Bắt đầu tạo video của bạn<br />ngay hôm nay</h2>
                <p>Mở tài khoản nhận ngay <b>24h tạo video miễn phí</b> — không cần thẻ tín dụng.</p>
                <div className="band-form">
                  <input className="band-input" type="text" placeholder="Nhập ý tưởng của bạn..." readOnly onClick={() => window.location.href = 'https://app.aiautocut.com/register'} />
                  <a className="btn btn-grad" href="https://app.aiautocut.com/register">Tạo video ngay</a>
                </div>
              </div>
              <div className="band-right">
                <img loading="lazy" src="https://picsum.photos/seed/aiac-cta2/500/340" alt="AI AutoCut video preview" />
              </div>
            </div>
          </div>
        </section>

        {/* FOOTER */}
        <footer>
          <div className="inner">
            <div className="foot-top">
              <div className="foot-brand">
                <div className="brand"><span className="logo"><Logo /></span> AI AutoCut</div>
                <p className="foot-desc">Nền tảng AI tạo video giúp bạn biến ý tưởng thành những video chuyên nghiệp trong vài phút.</p>
              </div>
              <div className="fcol">
                <b>Sản phẩm</b>
                <a href="#features">Tính năng</a>
                <a href="#pricing">Bảng giá</a>
                <a href="#">API</a>
                <a href="#">Blog</a>
              </div>
              <div className="fcol">
                <b>Hỗ trợ</b>
                <a href="https://app.aiautocut.com/guide">Hướng dẫn</a>
                <a href="https://t.me/thaidem57" target="_blank" rel="noreferrer">Telegram</a>
                <a href="https://zalo.me/0366566303" target="_blank" rel="noreferrer">Zalo: 0366566303</a>
              </div>
              <div className="fcol">
                <b>Công ty</b>
                <a href="#">Về chúng tôi</a>
                <a href="#">Blog</a>
                <a href="#">Tuyển dụng</a>
              </div>
              <div className="fcol">
                <b>Chính sách</b>
                <a href="#">Điều khoản sử dụng</a>
                <a href="#">Chính sách bảo mật</a>
                <a href="#">Tiếng Việt</a>
              </div>
            </div>
            <div className="foot-bottom"><span>© 2026 AI AutoCut. All rights reserved.</span></div>
          </div>
        </footer>
      </div>
    </div>
  )
}
