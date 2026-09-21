import { useState, useEffect } from 'react'
import './Landing.css'
import { useT, LangSwitch } from '../i18n'
import {
  Sparkles, Play, Check, ShieldCheck, Zap, Film, ShoppingBag, Clapperboard,
  Users, Layers, ArrowRight, ChevronDown, ChevronUp, Star, Laptop, Smartphone,
  ExternalLink, CheckCircle2, XCircle, Volume2, Maximize2
} from 'lucide-react'

// ============================================
// AI AutoCut Landing Page — React 18 + Vite
// Modern Krea Pro / Dark Cyber-Cinema Design
// ============================================

const Logo = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="6" cy="6" r="2.4" />
    <circle cx="6" cy="18" r="2.4" />
    <line x1="8.1" y1="7.6" x2="20" y2="18" />
    <line x1="8.1" y1="16.4" x2="20" y2="6" />
  </svg>
)

// Sample videos từ thư mục samples
const SAMPLES = [
  { id: 1, category: 'sell', dur: '0:15', title: 'Review thời trang áo dài thanh lịch giữa phố sáng 🌸', ratio: '9:16', file: 'v1.MP4' },
  { id: 2, category: 'movie', dur: '0:12', title: 'Tiên hiệp cổ phong: Diễn viên giữ mặt qua từng cảnh ✨', ratio: '9:16', file: 'v2.MP4' },
  { id: 3, category: 'sell', dur: '0:28', title: 'Video review đồ ngủ lụa satin ấm áp góc phòng ngủ 🌙', ratio: '9:16', file: 'v3.mp4' },
  { id: 4, category: 'sell', dur: '0:13', title: 'Quảng cáo kính gọng mảnh & trang phục quý phái 🖤', ratio: '9:16', file: 'v4.MP4' },
  { id: 5, category: 'movie', dur: '0:08', title: 'Mèo nón lá giữa ruộng bậc thang Tây Bắc 🐱🌾', ratio: '9:16', file: 'v5.mp4' },
  { id: 6, category: 'cinema', dur: '0:08', title: 'Phim gia đình: Khoảnh khắc ấm áp bên cửa sổ 👨‍👩‍👦', ratio: '16:9', file: 'v6.mp4' },
  { id: 7, category: 'cinema', dur: '0:08', title: 'Giao long biển sâu uốn lượn rạn san hô 🌊', ratio: '16:9', file: 'v7.mp4' },
  { id: 8, category: 'cinema', dur: '0:08', title: 'Kỳ quan thủy cung: Rùa biển lướt qua rạn san hô 🐢💙', ratio: '16:9', file: 'v8.mp4' },
]

// Testimonials từ creator & marketer
const TESTIMONIALS = [
  { name: 'Minh Hoàng', role: 'TikTok Shop Creator (500k followers)', col: '#F97316', text: 'Nhờ tính năng video bán hàng khóa mặt KOL và sản phẩm, mình lên 20 video affiliate mỗi ngày. Doanh thu affiliate tháng vừa rồi tăng hơn gấp 3 lần.' },
  { name: 'Thùy Linh', role: 'Chủ shop thời trang & Mỹ phẩm', col: '#EC4899', text: 'Trước đây thuê mẫu và quay dựng mất 5 triệu mỗi buổi. Bây giờ chỉ cần chụp ảnh sản phẩm đưa vào AI AutoCut là có video review lung linh đăng TikTok, Shopee.' },
  { name: 'Anh Tuấn', role: 'Nhà sản xuất nội dung Phim AI', col: '#8B5CF6', text: 'Tính năng giữ mặt nhân vật xuyên suốt 10 phần phim của AI AutoCut thật sự là phép màu. Không còn cảnh tập 1 một mặt, tập 2 mặt người khác.' },
  { name: 'Hải Yến', role: 'Giảng viên & Content Creator', col: '#3B82F6', text: 'Giao diện trực quan, gõ tiếng Việt là ra prompt chuẩn Veo 3.1. Rất phù hợp cho người không rành kỹ thuật máy tính như mình.' },
]

export default function Landing() {
  const t = useT()
  const isSameOrigin = typeof window !== 'undefined' && (
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1' ||
    window.location.hostname.endsWith('trycloudflare.com') ||
    window.location.hostname.endsWith('ngrok-free.app') ||
    window.location.hostname === 'app.aiautocut.com'
  )
  const loginHref = isSameOrigin ? '/login' : 'https://app.aiautocut.com/login'
  const registerHref = isSameOrigin ? '/register' : 'https://app.aiautocut.com/register'

  // Tab video mẫu: 'all' | 'sell' | 'movie' | 'cinema'
  const [sampleTab, setSampleTab] = useState<'all' | 'sell' | 'movie' | 'cinema'>('all')

  // FAQ Accordion
  const [openFaq, setOpenFaq] = useState<number | null>(0)
  const toggleFaq = (idx: number) => setOpenFaq(openFaq === idx ? null : idx)

  // Demo mockup tab trong Hero
  const [demoTab, setDemoTab] = useState<'sell' | 'film'>('sell')

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
      }, { threshold: 0.1 })
      els.forEach(e => io.observe(e))
    }

    // Spotlight hover theo chuột
    let raf = 0
    const onMove = (e: MouseEvent) => {
      if (raf) return
      raf = requestAnimationFrame(() => {
        raf = 0
        const el = (e.target as HTMLElement)?.closest?.('.fcard, .pcard, .gcard, .step, .vscard, .mock-card') as HTMLElement | null
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

  const filteredSamples = sampleTab === 'all' ? SAMPLES : SAMPLES.filter(s => s.category === sampleTab)

  const renderSample = (s: typeof SAMPLES[0], idx: number) => {
    const isWide = s.ratio === '16:9'
    const src = `/samples/${s.file}`
    const poster = `https://picsum.photos/seed/aiac-vid${s.id}/${isWide ? '640/360' : '360/640'}`

    return (
      <div key={s.id || idx} className={`svid${isWide ? ' wide' : ''}`}>
        <span className="ratio-tag">{s.ratio}</span>
        <video
          poster={poster}
          controls
          preload="metadata"
          playsInline
          onError={(e) => {
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
          <div className="by">
            <span className="tag-model">Veo 3.1</span>
            <span>720p / 1080p</span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div id="lp">
      {/* SVG Gradient Definition */}
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
        {/* ── HEADER ── */}
        <header>
          <div className="inner">
            <div className="hrow">
              <a href="#" className="brand">
                <span className="logo"><Logo /></span>
                <span className="brand-text">AI AutoCut</span>
              </a>
              <nav className="links">
                <a href="#features">{t('landing.nav_features')}</a>
                <a href="#sell-video">{t('landing.nav_sell')}</a>
                <a href="#samples">{t('landing.nav_samples')}</a>
                <a href="#how">{t('landing.nav_how')}</a>
                <a href="#pricing">{t('landing.nav_pricing')}</a>
                <a href="#faq">{t('landing.nav_faq')}</a>
              </nav>
              <div className="hright">
                <LangSwitch compact />
                <a className="btn btn-ghost" href={loginHref}>{t('landing.login')}</a>
                <a className="btn btn-grad" href={registerHref}>
                  <Sparkles size={14} />
                  {t('landing.start_free')}
                </a>
              </div>
            </div>
          </div>
        </header>

        {/* ── HERO SECTION ── */}
        <div className="inner">
          <section className="hero">
            <div className="hero-content reveal">
              <div className="pill">
                <span className="d"></span>
                {t('landing.hero_badge') || '✨ ĐỘT PHÁ GOOGLE VEO 3.1 & FACE-LOCK ĐỘC QUYỀN'}
              </div>

              <h1>
                {t('landing.hero_title_1')}<br />
                {t('landing.hero_title_2')} <span className="g">{t('landing.hero_title_highlight')}</span> {t('landing.hero_title_3')}
              </h1>

              <p className="lead">{t('landing.hero_lead')}</p>

              <div className="cta-row">
                <a className="btn btn-grad btn-lg" href={registerHref}>
                  <Zap size={18} />
                  {t('landing.hero_cta')}
                </a>
                <a className="btn btn-ghost btn-lg" href="#samples">
                  <Play size={16} />
                  {t('landing.hero_cta2')}
                </a>
              </div>

              <div className="stats">
                <div className="stat">
                  <b>Veo 3.1</b>
                  <span>{t('landing.stat_engine')}</span>
                </div>
                <div className="stat">
                  <b>{t('landing.stat_face')} 100%</b>
                  <span>{t('landing.stat_face_desc')}</span>
                </div>
                <div className="stat">
                  <b>{t('landing.stat_merge')}</b>
                  <span>{t('landing.stat_merge_desc')}</span>
                </div>
                <div className="stat">
                  <b>~3 phút</b>
                  <span>{t('landing.stat_time_desc')}</span>
                </div>
              </div>
            </div>

            {/* Live Interactive Studio Mockup */}
            <div className="hero-mockup reveal">
              <div className="mock-window">
                <div className="mock-top">
                  <div className="dots"><i></i><i></i><i></i></div>
                  <div className="mock-tabs">
                    <button
                      className={`mock-tab ${demoTab === 'sell' ? 'active' : ''}`}
                      onClick={() => setDemoTab('sell')}
                    >
                      🛍️ Video Bán Hàng UGC
                    </button>
                    <button
                      className={`mock-tab ${demoTab === 'film' ? 'active' : ''}`}
                      onClick={() => setDemoTab('film')}
                    >
                      🎬 Phim Ngắn AI (Multi-Scene)
                    </button>
                  </div>
                  <span className="mock-url">app.aiautocut.com</span>
                </div>

                <div className="mock-body">
                  {demoTab === 'sell' ? (
                    <div className="mock-composer">
                      <div className="mock-left">
                        <div className="mock-badge">✨ Sell Mode — Strict Visual Lock</div>
                        <div className="mock-input-preview">
                          <div className="mock-img-box">
                            <span className="mock-tag">Ảnh sản phẩm (Ref)</span>
                            <div className="mock-img-ph">💄 Son lì cao cấp</div>
                          </div>
                          <div className="mock-img-box">
                            <span className="mock-tag">Ảnh KOL (Mặt)</span>
                            <div className="mock-img-ph">👩 Diễn viên nữ</div>
                          </div>
                        </div>
                        <div className="mock-prompt-box">
                          <b>Kịch bản tự động (4 cảnh):</b>
                          <p>KOL cầm son trên phố cafe, thoa lên môi mướt mịn, test nước không trôi, cười tươi giới thiệu...</p>
                        </div>
                      </div>

                      <div className="mock-right">
                        <div className="mock-scenes-grid">
                          <div className="mock-scene done">
                            <span className="snum">Cảnh 1</span>
                            <span className="stxt">Cận cảnh mở nắp son</span>
                            <span className="scheck">✓ Đã xong</span>
                          </div>
                          <div className="mock-scene active">
                            <span className="snum">Cảnh 2</span>
                            <span className="stxt">Thoa son mướt mịn</span>
                            <span className="srun">⚡ Đang render</span>
                          </div>
                          <div className="mock-scene wait">
                            <span className="snum">Cảnh 3</span>
                            <span className="stxt">Test nước không lem</span>
                            <span className="swait">Chờ nối khung</span>
                          </div>
                          <div className="mock-scene wait">
                            <span className="snum">Cảnh 4</span>
                            <span className="stxt">Nụ cười rạng rỡ chào</span>
                            <span className="swait">Chờ nối khung</span>
                          </div>
                        </div>
                        <div className="mock-bar">
                          <span>🎬 Tự động ghép: <b>final_sell.mp4</b></span>
                          <span className="badge-free">9:16 Dọc · 1080p</span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="mock-composer">
                      <div className="mock-left">
                        <div className="mock-badge">👑 Face-Lock Cinema Series</div>
                        <div className="mock-prompt-box" style={{ height: '100%' }}>
                          <b>Ý tưởng phim ngắn:</b>
                          <p>Nữ kiếm hiệp bạch y phiêu bạt giang hồ, chiến đấu trên đỉnh núi mây mù, tìm lại thanh bảo kiếm gia truyền...</p>
                          <div style={{ marginTop: 12, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                            <span className="pill-mini">Giữ mặt diễn viên</span>
                            <span className="pill-mini">Lồng tiếng Việt</span>
                            <span className="pill-mini">16:9 Cinematic</span>
                          </div>
                        </div>
                      </div>
                      <div className="mock-right">
                        <div className="mock-scenes-grid">
                          {[1, 2, 3, 4].map(k => (
                            <div key={k} className="mock-scene done">
                              <span className="snum">Cảnh 0{k}</span>
                              <span className="stxt">Cảnh quay điện ảnh #{k}</span>
                              <span className="scheck">✓ Ready</span>
                            </div>
                          ))}
                        </div>
                        <div className="mock-bar">
                          <span>⏱️ 4 cảnh × 8s = <b>32s Phim</b></span>
                          <span className="badge-free">Auto Merge ✓</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </section>
        </div>

        {/* ── PROBLEM VS SOLUTION (SO SÁNH CÁCH CŨ VS AI AUTOCUT) ── */}
        <section className="blk" id="comparison">
          <div className="inner">
            <div className="eyebrow reveal">{t('landing.vs_eyebrow')}</div>
            <h2 className="h2 reveal">{t('landing.vs_title')}</h2>
            <p className="sub reveal">{t('landing.vs_desc')}</p>

            <div className="vs-grid reveal">
              {/* Cột cũ */}
              <div className="vscard old">
                <div className="vs-head">
                  <XCircle size={24} color="#f87171" />
                  <h3>{t('landing.vs_old_title')}</h3>
                </div>
                <ul className="vs-list">
                  <li>
                    <span className="vs-x">✕</span>
                    <div>
                      <b>{t('landing.vs_old_1')}</b>
                      <p>Rất tốn kém, không phù hợp cho người làm affiliate hoặc shop nhỏ.</p>
                    </div>
                  </li>
                  <li>
                    <span className="vs-x">✕</span>
                    <div>
                      <b>{t('landing.vs_old_2')}</b>
                      <p>Mất nhiều thời gian cắt ghép, lồng tiếng, tìm hiệu ứng âm thanh.</p>
                    </div>
                  </li>
                  <li>
                    <span className="vs-x">✕</span>
                    <div>
                      <b>{t('landing.vs_old_3')}</b>
                      <p>Dùng các tool AI thông thường mỗi cảnh ra một mặt người hoàn toàn khác nhau.</p>
                    </div>
                  </li>
                  <li>
                    <span className="vs-x">✕</span>
                    <div>
                      <b>{t('landing.vs_old_4')}</b>
                      <p>Phải có card đồ họa RTX chuyên dụng mới render nổi.</p>
                    </div>
                  </li>
                </ul>
              </div>

              {/* Cột mới */}
              <div className="vscard new">
                <div className="vs-badge">ĐƯỢC KHUYÊN DÙNG</div>
                <div className="vs-head">
                  <CheckCircle2 size={24} color="#34d399" />
                  <h3>{t('landing.vs_new_title')}</h3>
                </div>
                <ul className="vs-list">
                  <li>
                    <span className="vs-check">✓</span>
                    <div>
                      <b>{t('landing.vs_new_1')}</b>
                      <p>Dùng thử 24h miễn phí, nâng Pro chỉ 249k tạo video cả tháng thả ga.</p>
                    </div>
                  </li>
                  <li>
                    <span className="vs-check">✓</span>
                    <div>
                      <b>{t('landing.vs_new_2')}</b>
                      <p>Chỉ cần 1 bức ảnh và 1 dòng mô tả, AI tự động lo từ A đến Z.</p>
                    </div>
                  </li>
                  <li>
                    <span className="vs-check">✓</span>
                    <div>
                      <b>{t('landing.vs_new_3')}</b>
                      <p>Thuật toán Face-Lock & Product Lock giữ nhân vật & sản phẩm đồng nhất 100%.</p>
                    </div>
                  </li>
                  <li>
                    <span className="vs-check">✓</span>
                    <div>
                      <b>{t('landing.vs_new_4')}</b>
                      <p>Xử lý toàn bộ trên server đám mây, mở bằng điện thoại hay laptop đều mượt.</p>
                    </div>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* ── VŨ KHÍ 1: VIDEO BÁN HÀNG UGC ── */}
        <section className="blk" id="sell-video">
          <div className="inner">
            <div className="eyebrow reveal">{t('landing.sell_eyebrow')}</div>
            <h2 className="h2 reveal">{t('landing.sell_title')}</h2>
            <p className="sub reveal">{t('landing.sell_desc')}</p>

            <div className="sell-showcase reveal">
              <div className="sell-steps-box">
                <div className="sell-step">
                  <div className="step-badge">Bước 1</div>
                  <h4>Tải ảnh sản phẩm & KOL</h4>
                  <p>Chụp 1 tấm ảnh sản phẩm rõ nét + ảnh gương mặt bạn (hoặc người mẫu mong muốn).</p>
                </div>
                <div className="sell-arrow">➔</div>
                <div className="sell-step">
                  <div className="step-badge">Bước 2</div>
                  <h4>Gõ mô tả bằng Tiếng Việt</h4>
                  <p>Ví dụ: <em>"Kem chống nắng nâng tone tự nhiên, KOL thoa thử và đi dưới nắng hè..."</em></p>
                </div>
                <div className="sell-arrow">➔</div>
                <div className="sell-step hot">
                  <div className="step-badge">Bước 3</div>
                  <h4>Nhận Video hoàn chỉnh</h4>
                  <p>AI tự tạo 4–6 cảnh nối tiếp, lồng giọng đọc review tự nhiên, ghép thành file MP4 9:16.</p>
                </div>
              </div>

              <div className="sell-cta-strip">
                <div className="cta-left">
                  <ShoppingBag size={28} color="#fb923c" />
                  <div>
                    <b>Sẵn sàng tăng trưởng doanh số TikTok Shop & Shopee?</b>
                    <span>Tạo video bán hàng đầu tiên của bạn chỉ trong 3 phút.</span>
                  </div>
                </div>
                <a className="btn btn-grad" href={registerHref}>
                  Thử tạo Video Bán Hàng 0Đ
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* ── BENTO GRID FEATURES ── */}
        <section className="blk" id="features">
          <div className="inner">
            <div className="eyebrow reveal">{t('landing.features_eyebrow')}</div>
            <h2 className="h2 reveal">{t('landing.features_title')}</h2>
            <p className="sub reveal">{t('landing.features_desc')}</p>

            <div className="bento-grid reveal">
              {/* Bento 1: Face-Lock (Lớn) */}
              <div className="bento-card bento-wide">
                <div className="bento-info">
                  <span className="bento-icon"><Users size={22} color="#ec4899" /></span>
                  <h3>Giữ mặt nhân vật & Logo sản phẩm xuyên suốt</h3>
                  <p>Công nghệ Model Sheet Reference độc quyền khoá chặt các đặc trưng khuôn mặt diễn viên và logo bao bì sản phẩm. Không còn tình trạng lệch mặt giữa các cảnh.</p>
                  <div className="bento-tags">
                    <span>#FaceLock</span>
                    <span>#ProductLock</span>
                    <span>#SeriesMovie</span>
                  </div>
                </div>
                <div className="bento-visual">
                  <div className="face-demo-strip">
                    <div className="face-pill">Cảnh 1: Cận mặt</div>
                    <div className="face-pill">Cảnh 2: Góc nghiêng</div>
                    <div className="face-pill">Cảnh 3: Toàn thân</div>
                    <div className="face-pill active">100% Cùng 1 Diễn Viên</div>
                  </div>
                </div>
              </div>

              {/* Bento 2: AI Auto Scripting */}
              <div className="bento-card">
                <span className="bento-icon"><Sparkles size={22} color="#f97316" /></span>
                <h3>Viết kịch bản tự động bằng Tiếng Việt</h3>
                <p>Không cần biết viết prompt tiếng Anh phức tạp. Bạn chỉ cần gõ ý tưởng tiếng Việt, Gemini AI sẽ tự phân bổ thành các cảnh quay điện ảnh chuyên nghiệp.</p>
              </div>

              {/* Bento 3: Native Audio & Auto Merge */}
              <div className="bento-card">
                <span className="bento-icon"><Film size={22} color="#a855f7" /></span>
                <h3>Tự động ghép phim & Lồng tiếng AI</h3>
                <p>Sau khi mọi cảnh render xong, hệ thống tự động ghép nối thành một video liền mạch kèm âm thanh hoặc voiceover. Tải về dùng ngay, không cần CapCut.</p>
              </div>

              {/* Bento 4: 1080p Upscale Lanczos */}
              <div className="bento-card">
                <span className="bento-icon"><Maximize2 size={22} color="#34d399" /></span>
                <h3>Nâng cấp sắc nét 1080p Full HD</h3>
                <p>Engine upscale tích hợp thuật toán Lanczos khử nhiễu, làm mịn chi tiết da và chữ trên sản phẩm khi bạn tải video về.</p>
              </div>

              {/* Bento 5: Kho trợ lý GPT độc quyền */}
              <div className="bento-card">
                <span className="bento-icon"><Layers size={22} color="#3b82f6" /></span>
                <h3>Tặng kèm Kho Trợ Lý AI Chuyên Sâu</h3>
                <p>Hơn 100+ trợ lý GPT chuyên biệt cho viết kịch bản viral, tối ưu quảng cáo, sáng tạo nội dung được mở khóa kèm các gói Pro.</p>
              </div>
            </div>
          </div>
        </section>

        {/* ── THƯ VIỆN VIDEO MẪU (SAMPLES GALLERY) ── */}
        <section className="blk" id="samples">
          <div className="inner">
            <div className="eyebrow reveal">{t('landing.samples_eyebrow')}</div>
            <h2 className="h2 reveal">{t('landing.samples_title')}</h2>
            <p className="sub reveal">{t('landing.samples_desc')}</p>

            <div className="gallery-tabs reveal">
              <button
                className={`g-tab ${sampleTab === 'all' ? 'active' : ''}`}
                onClick={() => setSampleTab('all')}
              >
                Tất cả mẫu
              </button>
              <button
                className={`g-tab ${sampleTab === 'sell' ? 'active' : ''}`}
                onClick={() => setSampleTab('sell')}
              >
                🛍️ Video Bán Hàng (9:16)
              </button>
              <button
                className={`g-tab ${sampleTab === 'movie' ? 'active' : ''}`}
                onClick={() => setSampleTab('movie')}
              >
                🎬 Phim ngắn giữ mặt
              </button>
              <button
                className={`g-tab ${sampleTab === 'cinema' ? 'active' : ''}`}
                onClick={() => setSampleTab('cinema')}
              >
                🌊 Điện ảnh 16:9
              </button>
            </div>

            <div className="samples-grid reveal">
              {filteredSamples.map((s, idx) => renderSample(s, idx))}
            </div>
          </div>
        </section>

        {/* ── HOW IT WORKS (3 BƯỚC ĐƠN GIẢN) ── */}
        <section className="blk" id="how">
          <div className="inner">
            <div className="eyebrow reveal">{t('landing.how_eyebrow')}</div>
            <h2 className="h2 reveal">{t('landing.how_title')}</h2>
            <p className="sub reveal">{t('landing.how_desc')}</p>

            <div className="steps-container reveal">
              <div className="step-card">
                <span className="step-num">01</span>
                <h3>Nhập ý tưởng hoặc tải ảnh</h3>
                <p>Mô tả nội dung bạn muốn làm bằng tiếng Việt, chọn tỉ lệ (9:16 hoặc 16:9), tải ảnh sản phẩm / người mẫu nếu có.</p>
              </div>
              <div className="step-card">
                <span className="step-num">02</span>
                <h3>AI lên kịch bản chi tiết</h3>
                <p>Hệ thống tự động phân chia mạch phim thành từng cảnh, viết prompt điện ảnh tối ưu riêng cho engine Google Veo 3.1.</p>
              </div>
              <div className="step-card">
                <span className="step-num">03</span>
                <h3>Render & nhận phim ghép</h3>
                <p>Chỉ cần 1 cú click: Các cảnh được render song song, tự động ghép nối hoàn chỉnh thành 1 video duy nhất để tải về.</p>
              </div>
            </div>
          </div>
        </section>

        {/* ── TESTIMONIALS (ĐÁNH GIÁ NGƯỜI DÙNG) ── */}
        <section className="blk" id="testimonials">
          <div className="inner">
            <div className="eyebrow reveal">{t('landing.testimonials_eyebrow')}</div>
            <h2 className="h2 reveal">{t('landing.testimonials_title')}</h2>

            <div className="testi-grid reveal">
              {TESTIMONIALS.map((t, i) => (
                <div key={i} className="testi-card">
                  <div className="testi-av-row">
                    <div className="testi-av" style={{ background: t.col }}>{t.name[0]}</div>
                    <div className="testi-meta">
                      <b>{t.name}</b>
                      <span>{t.role}</span>
                    </div>
                  </div>
                  <p>{t.text}</p>
                  <div className="stars">
                    {Array.from({ length: 5 }).map((_, k) => (
                      <Star key={k} size={14} fill="#fbbf24" color="#fbbf24" />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── BẢNG GIÁ (PRICING) ── */}
        <section className="blk" id="pricing">
          <div className="inner">
            <div className="eyebrow reveal">{t('landing.pricing_eyebrow')}</div>
            <h2 className="h2 reveal">{t('landing.pricing_title')}</h2>
            <p className="sub reveal" dangerouslySetInnerHTML={{ __html: t('landing.pricing_desc') }} />

            <div className="price-grid reveal">
              {/* Dùng thử */}
              <div className="pcard">
                <span className="tag tag-trial">{t('landing.price_trial_tag')}</span>
                <div className="pname">{t('landing.price_free')}</div>
                <div className="pamt">0đ<small>{t('landing.price_free_period')}</small></div>
                <ul className="pfeatures">
                  <li><Check size={16} /> <b>24 {t('landing.hours')}</b> {t('landing.price_free_f1')}</li>
                  <li><Check size={16} /> Model Veo 3.1 Lite — <b>FREE</b></li>
                  <li><Check size={16} /> {t('landing.price_free_f3')}</li>
                  <li><Check size={16} /> 150MB {t('landing.storage')}</li>
                </ul>
                <a className="btn btn-ghost pbtn" href={registerHref}>{t('landing.price_free_cta')}</a>
              </div>

              {/* Gói 1 tháng Pro (Hot) */}
              <div className="pcard hot">
                <span className="tag tag-hot">{t('landing.price_pro_tag')}</span>
                <div className="pname">Pro · 1 tháng</div>
                <div className="pamt">249k<small>{t('landing.price_per_month')}</small></div>
                <ul className="pfeatures">
                  <li><Check size={16} /> {t('landing.price_pro_f1')}</li>
                  <li><Check size={16} /> <b>{t('landing.price_pro_f2a')}</b> {t('landing.price_pro_f2b')}</li>
                  <li><Check size={16} /> {t('landing.price_pro_f3')}</li>
                  <li><Check size={16} /> <b>1GB</b> {t('landing.storage')}</li>
                  <li><Check size={16} /> <b>Tặng 10</b> trợ lý AI chuyên sâu</li>
                  <li><Check size={16} /> {t('landing.price_pro_f5')}</li>
                </ul>
                <a className="btn btn-grad pbtn" href={registerHref}>{t('landing.price_pro_cta')}</a>
              </div>

              {/* Gói 6 tháng */}
              <div className="pcard">
                <span className="tag tag-save">{t('landing.price_m6_tag') || 'TIẾT KIỆM 5%'}</span>
                <div className="pname">{t('landing.price_m6_name') || 'Pro · 6 tháng'}</div>
                <div className="pamt">1.419k<small>{t('landing.price_m6_period') || '/6 tháng'}</small></div>
                <ul className="pfeatures">
                  <li><Check size={16} /> {t('landing.price_m6_f1') || 'Mọi tính năng gói Pro'}</li>
                  <li><Check size={16} /> <b>Tặng 50</b> {t('landing.price_m6_f2') || 'trợ lý AI chuyên sâu'}</li>
                  <li><Check size={16} /> 1GB lưu trữ & ưu tiên queue</li>
                  <li><Check size={16} /> {t('landing.price_m6_f3') || 'Thanh toán 1 lần, dùng nửa năm'}</li>
                </ul>
                <a className="btn btn-ghost pbtn" href={registerHref}>{t('landing.price_m6_cta') || 'Chọn gói 6 tháng'}</a>
              </div>

              {/* Gói 12 tháng */}
              <div className="pcard">
                <span className="tag tag-save">{t('landing.price_yearly_tag')}</span>
                <div className="pname">{t('landing.price_yearly_name')}</div>
                <div className="pamt">2.599k<small>{t('landing.price_per_year')}</small></div>
                <ul className="pfeatures">
                  <li><Check size={16} /> {t('landing.price_yearly_f1')}</li>
                  <li><Check size={16} /> <b>Tặng 100</b> trợ lý AI độc quyền</li>
                  <li><Check size={16} /> {t('landing.price_yearly_f2')}</li>
                  <li><Check size={16} /> {t('landing.price_yearly_f3')}</li>
                </ul>
                <a className="btn btn-ghost pbtn" href={registerHref}>{t('landing.price_yearly_cta')}</a>
              </div>
            </div>

            <p className="price-note reveal" dangerouslySetInnerHTML={{ __html: t('landing.pricing_note') }} />
          </div>
        </section>

        {/* ── FAQ (CÂU HỎI THƯỜNG GẶP) ── */}
        <section className="blk" id="faq">
          <div className="inner">
            <div className="eyebrow reveal">{t('landing.faq_eyebrow')}</div>
            <h2 className="h2 reveal">{t('landing.faq_title')}</h2>
            <p className="sub reveal">{t('landing.faq_desc')}</p>

            <div className="faq-container reveal">
              {[
                { q: t('landing.faq_q1'), a: t('landing.faq_a1') },
                { q: t('landing.faq_q2'), a: t('landing.faq_a2') },
                { q: t('landing.faq_q3'), a: t('landing.faq_a3') },
                { q: t('landing.faq_q4'), a: t('landing.faq_a4') },
                { q: t('landing.faq_q5'), a: t('landing.faq_a5') },
              ].map((item, idx) => (
                <div key={idx} className={`faq-item ${openFaq === idx ? 'open' : ''}`}>
                  <button className="faq-q" onClick={() => toggleFaq(idx)}>
                    <span>{item.q}</span>
                    {openFaq === idx ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                  </button>
                  {openFaq === idx && (
                    <div className="faq-a">
                      <p>{item.a}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── FINAL CTA BANNER ── */}
        <section className="blk">
          <div className="inner">
            <div className="final-band reveal">
              <div className="band-content">
                <h2>{t('landing.final_cta_title')}</h2>
                <p dangerouslySetInnerHTML={{ __html: t('landing.final_cta_desc') }} />
                <div className="band-actions">
                  <a className="btn btn-grad btn-lg" href={registerHref}>
                    <Sparkles size={18} />
                    {t('landing.final_cta_btn')}
                  </a>
                  <a className="btn btn-ghost btn-lg" href={loginHref}>
                    {t('landing.login')}
                  </a>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── FOOTER ── */}
        <footer>
          <div className="inner">
            <div className="foot-top">
              <div className="foot-brand">
                <div className="brand">
                  <span className="logo"><Logo /></span>
                  <span className="brand-text">AI AutoCut</span>
                </div>
                <p className="foot-desc">{t('landing.footer_desc') || 'Nền tảng tạo video AI Veo 3.1 tự động hóa toàn diện từ ý tưởng đến thành phẩm.'}</p>
              </div>

              <div className="fcol">
                <b>{t('landing.footer_product')}</b>
                <a href="#features">{t('landing.nav_features')}</a>
                <a href="#sell-video">{t('landing.nav_sell')}</a>
                <a href="#samples">{t('landing.nav_samples')}</a>
                <a href="#pricing">{t('landing.nav_pricing')}</a>
              </div>

              <div className="fcol">
                <b>{t('landing.footer_support')}</b>
                <a href={isSameOrigin ? '/guide' : 'https://app.aiautocut.com/guide'}>{t('landing.nav_guide')}</a>
                <a href="https://t.me/thaidem57" target="_blank" rel="noreferrer">Telegram: @thaidem57</a>
                <a href="https://zalo.me/0366566303" target="_blank" rel="noreferrer">Zalo: 0366566303</a>
              </div>

              <div className="fcol">
                <b>{t('landing.footer_policy')}</b>
                <a href="#">Điều khoản sử dụng</a>
                <a href="#">Chính sách bảo mật</a>
                <a href="#">Hỗ trợ 24/7</a>
              </div>
            </div>

            <div className="foot-bottom">
              <span>© 2026 AI AutoCut. All rights reserved. Powered by Google Veo 3.1 & Gemini.</span>
            </div>
          </div>
        </footer>
      </div>
    </div>
  )
}
