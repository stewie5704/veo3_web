import { useState, useEffect } from 'react'
import './Landing.css'
import { useT, LangSwitch } from '../i18n'
import {
  Sparkles, Play, Check, Zap, Film, ShoppingBag, Clapperboard,
  Users, Layers, Star,
  CheckCircle2, XCircle, Volume2, Maximize2, Video, Sliders, Mic,
  Clock, ShieldCheck, ChevronDown, ChevronUp, Camera, Radio
} from 'lucide-react'

// ============================================
// AI AutoCut Studio — Official Landing Page
// Hollywood AI Film & Creative Production Suite
// ============================================

const Logo = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="6" cy="6" r="2.4" />
    <circle cx="6" cy="18" r="2.4" />
    <line x1="8.1" y1="7.6" x2="20" y2="18" />
    <line x1="8.1" y1="16.4" x2="20" y2="6" />
  </svg>
)

// Curated Showreel Samples
const SAMPLES = [
  { id: 1, category: 'sell', dur: '0:15', title: 'Review thời trang áo dài thanh lịch giữa phố sáng 🌸', ratio: '9:16', file: 'v1.MP4', tag: 'UGC Commercial' },
  { id: 2, category: 'movie', dur: '0:12', title: 'Tiên hiệp cổ phong: Diễn viên giữ mặt qua từng cảnh ✨', ratio: '9:16', file: 'v2.MP4', tag: 'Face-Lock Series' },
  { id: 3, category: 'sell', dur: '0:28', title: 'Video review đồ ngủ lụa satin ấm áp góc phòng ngủ 🌙', ratio: '9:16', file: 'v3.mp4', tag: 'TikTok Shop' },
  { id: 4, category: 'sell', dur: '0:13', title: 'Quảng cáo kính gọng mảnh & trang phục quý phái 🖤', ratio: '9:16', file: 'v4.MP4', tag: 'Product Lock' },
  { id: 5, category: 'movie', dur: '0:08', title: 'Mèo nón lá giữa ruộng bậc thang Tây Bắc 🐱🌾', ratio: '9:16', file: 'v5.mp4', tag: '3D Anime' },
  { id: 6, category: 'cinema', dur: '0:08', title: 'Phim gia đình: Khoảnh khắc ấm áp bên cửa sổ 👨‍👩‍👦', ratio: '16:9', file: 'v6.mp4', tag: 'Cinema 16:9' },
  { id: 7, category: 'cinema', dur: '0:08', title: 'Giao long biển sâu uốn lượn rạn san hô 🌊', ratio: '16:9', file: 'v7.mp4', tag: 'Sci-Fi Film' },
  { id: 8, category: 'cinema', dur: '0:08', title: 'Kỳ quan thủy cung: Rùa biển lướt qua rạn san hô 🐢💙', ratio: '16:9', file: 'v8.mp4', tag: '4K Ultra HDR' },
]

// Testimonials từ Creators & Filmmakers
const TESTIMONIALS = [
  { name: 'Minh Hoàng', role: 'Top 1 TikTok Shop Affiliate Creator (500k followers)', col: '#F97316', text: 'Nhờ tính năng video bán hàng khóa mặt KOL và sản phẩm, mình lên 20 video affiliate mỗi ngày. Doanh thu affiliate tháng vừa rồi tăng hơn gấp 3 lần.' },
  { name: 'Thùy Linh', role: 'Chủ chuỗi Thời trang & Mỹ phẩm Lynh Studio', col: '#EC4899', text: 'Trước đây thuê mẫu và quay dựng mất 5 triệu mỗi buổi. Bây giờ chỉ cần chụp ảnh sản phẩm đưa vào AI AutoCut là có video review lung linh đăng TikTok, Shopee.' },
  { name: 'Anh Tuấn', role: 'Đạo diễn độc lập & Nhà sản xuất Phim AI', col: '#8B5CF6', text: 'Tính năng giữ mặt nhân vật xuyên suốt 10 phần phim của AI AutoCut thật sự là phép màu. Không còn cảnh tập 1 một mặt, tập 2 mặt người khác.' },
  { name: 'Hải Yến', role: 'Creative Director tại AdAgency Media', col: '#3B82F6', text: 'Giao diện trực quan chuẩn Director Desk. Gõ ý tưởng tiếng Việt là sinh prompt chuẩn Google Veo 3.1 kèm góc máy điện ảnh cực kỳ ấn tượng.' },
]

// FAQ Items for UI and Schema
const FAQ_ITEMS = [
  {
    q: 'AI AutoCut Studio là gì và hoạt động như thế nào?',
    a: 'AI AutoCut là Studio làm phim & tạo video AI trọn gói: bạn chỉ cần nhập ý tưởng hoặc tải ảnh sản phẩm/nhân vật, AI sẽ tự động phân tích kịch bản thành các phân cảnh điện ảnh, render từng cảnh với Google Veo 3.1, lồng tiếng Việt và ghép nối thành video MP4 hoàn chỉnh.'
  },
  {
    q: 'Công nghệ Face-Lock & Product-Lock giữ mặt nhân vật hoạt động ra sao?',
    a: 'Công nghệ Model Sheet Reference độc quyền của AI AutoCut phân tích và neo giữ các đặc điểm nhân dạng khuôn mặt diễn viên hoặc chi tiết bao bì sản phẩm, đảm bảo diện mạo đồng nhất 100% qua hàng chục phân cảnh và góc quay khác nhau.'
  },
  {
    q: 'Tôi có cần card đồ họa mạnh hay tải phần mềm về máy tính không?',
    a: 'Hoàn toàn không. Toàn bộ quá trình xử lý kịch bản, sinh ảnh và kết xuất video đều chạy trên cụm máy chủ GPU điện toán đám mây tốc độ cao. Bạn có thể sử dụng mượt mà ngay trên trình duyệt web của điện thoại, máy tính bảng hoặc laptop.'
  },
  {
    q: 'AI AutoCut có hỗ trợ lồng tiếng Tiếng Việt tự nhiên không?',
    a: 'Có. AI AutoCut tích hợp hơn 22+ diễn viên lồng tiếng AI tiếng Việt chất lượng cao chuẩn giọng miền Bắc và miền Nam, tự động đồng bộ khẩu hình (lip-sync) và cảm xúc cho từng nhân vật trong phim.'
  },
  {
    q: 'Chính sách dùng thử và thanh toán như thế nào?',
    a: 'Mọi tài khoản mới đăng ký đều nhận ngay 24 giờ trải nghiệm miễn phí với model Veo 3.1 Lite không cần thẻ tín dụng. Khi có nhu cầu sản xuất video 4K hoặc render hàng loạt, bạn có thể nâng cấp gói Pro chỉ từ 249k/tháng.'
  },
  {
    q: 'Video xuất ra có bị dính watermark và có bản quyền thương mại không?',
    a: 'Tất cả video tạo bởi tài khoản Pro đều thuộc toàn quyền sở hữu của bạn, không dính logo watermark và được phép sử dụng tự do cho mục đích thương mại, quảng cáo TikTok Shop, YouTube Monetization, và chiến dịch truyền thông.'
  }
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

  // Director Workspace Demo Tab: 'sell' | 'film' | 'audio'
  const [demoTab, setDemoTab] = useState<'sell' | 'film' | 'audio'>('sell')

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
        const el = (e.target as HTMLElement)?.closest?.('.fcard, .pcard, .gcard, .step, .vscard, .mock-card, .pipeline-card, .bento-card') as HTMLElement | null
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
      <article key={s.id || idx} className={`svid${isWide ? ' wide' : ''}`}>
        <span className="ratio-tag">{s.ratio}</span>
        <video
          poster={poster}
          controls
          preload="metadata"
          playsInline
          muted
          onMouseEnter={e => { e.currentTarget.play().catch(() => {}) }}
          onMouseLeave={e => { e.currentTarget.pause() }}
          onError={(e) => {
            const el = e.currentTarget
            el.style.display = 'none'
            const img = document.createElement('img')
            img.src = poster
            img.className = 'ph' + (isWide ? ' wide' : '')
            img.alt = s.title
            el.parentElement?.insertBefore(img, el)
          }}
        >
          <source src={src} type="video/mp4" />
        </video>
        <div className="meta">
          <div className="t">{s.title}</div>
          <div className="by">
            <span className="tag-model">Google Veo 3.1</span>
            <span>{s.tag}</span>
            <span>• 1080p 60fps</span>
          </div>
        </div>
      </article>
    )
  }

  // Schema Markup JSON-LD for rich snippets
  const schemaData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": "https://app.aiautocut.com/#org",
        "name": "AI AutoCut Studio",
        "url": "https://app.aiautocut.com/",
        "logo": "https://aiautocut.com/og.svg",
        "sameAs": ["https://t.me/thaidem57", "https://zalo.me/0366566303"]
      },
      {
        "@type": "SoftwareApplication",
        "name": "AI AutoCut Studio",
        "applicationCategory": "MultimediaApplication",
        "operatingSystem": "Web, macOS, Windows, iOS, Android",
        "url": "https://app.aiautocut.com/",
        "description": "Studio sáng tạo video và làm phim AI chuyên nghiệp với Google Veo 3.1, công nghệ Face-Lock khóa mặt diễn viên 100% và lồng tiếng AI tiếng Việt.",
        "offers": {
          "@type": "AggregateOffer",
          "priceCurrency": "VND",
          "lowPrice": "0",
          "highPrice": "2599000",
          "offerCount": "4"
        },
        "aggregateRating": {
          "@type": "AggregateRating",
          "ratingValue": "4.9",
          "ratingCount": "1280",
          "bestRating": "5"
        }
      },
      {
        "@type": "FAQPage",
        "mainEntity": FAQ_ITEMS.map(item => ({
          "@type": "Question",
          "name": item.q,
          "acceptedAnswer": {
            "@type": "Answer",
            "text": item.a
          }
        }))
      }
    ]
  }

  return (
    <div id="lp">
      {/* Accessibility Skip Link */}
      <a href="#main-content" className="sr-only">Chuyển đến nội dung chính</a>

      {/* SEO Schema Injection */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schemaData) }}
      />

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
        <header role="banner">
          <div className="inner">
            <div className="hrow">
              <a href="#" className="brand" aria-label="Trang chủ AI AutoCut Studio">
                <span className="logo"><Logo /></span>
                <span className="brand-text">AI AutoCut <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent2)', background: 'rgba(249,115,22,0.14)', padding: '2px 7px', borderRadius: 6, marginLeft: 4, letterSpacing: '.05em' }}>STUDIO</span></span>
              </a>

              <div className="studio-live-badge" style={{ marginLeft: 12 }}>
                <span className="pulse" />
                <span>VEO 3.1 LIVE</span>
              </div>

              <nav className="links" aria-label="Điều hướng chính">
                <a href="#director-desk">Trường Quay</a>
                <a href="#features">Tính Năng Studio</a>
                <a href="#sell-video">Video Bán Hàng</a>
                <a href="#samples">Showreel Phim</a>
                <a href="#pipeline">Quy Trình</a>
                <a href="#pricing">Bảng Giá</a>
                <a href="#faq">Hỏi Đáp</a>
              </nav>

              <div className="hright">
                <LangSwitch compact />
                <a className="btn btn-ghost" href={loginHref}>{t('landing.login')}</a>
                <a className="btn btn-grad" href={registerHref}>
                  <Sparkles size={14} />
                  <span>Khám Phá Studio (0Đ)</span>
                </a>
              </div>
            </div>
          </div>
        </header>

        {/* ── MAIN CONTENT ── */}
        <main id="main-content" role="main">
          {/* ── HERO SECTION ── */}
          <section className="inner" aria-labelledby="hero-title">
            <div className="hero">
              <div className="hero-content reveal">
                <div className="pill">
                  <span className="d" />
                  <span>🎬 HOLLYWOOD AI FILM STUDIO & PRODUCTION HOUSE</span>
                </div>

                <h1 id="hero-title">
                  Biến 1 Dòng Kịch Bản Thành<br />
                  <span className="g">Tác Phẩm Điện Ảnh</span> Hoàn Chỉnh
                </h1>

                <p className="lead">
                  AI AutoCut tự động hóa toàn diện quy trình làm phim: Viết phân cảnh điện ảnh, giữ nguyên 100% diện mạo nhân vật & bao bì sản phẩm qua công nghệ <b>Face-Lock</b>, lồng tiếng Việt chân thực và kết xuất video 4K sắc nét trong 3 phút.
                </p>

                <div className="cta-row">
                  <a className="btn btn-grad btn-lg" href={registerHref}>
                    <Zap size={18} />
                    <span>Bắt đầu làm phim 0Đ</span>
                  </a>
                  <a className="btn btn-ghost btn-lg" href="#samples">
                    <Play size={16} />
                    <span>Xem Showreel Studio</span>
                  </a>
                </div>

                <div className="stats">
                  <div className="stat">
                    <b>50,000+</b>
                    <span>Video / tháng</span>
                  </div>
                  <div className="stat">
                    <b>100%</b>
                    <span>Khóa mặt nhân vật</span>
                  </div>
                  <div className="stat">
                    <b>22+ Giọng</b>
                    <span>Lồng tiếng AI Bắc/Nam</span>
                  </div>
                  <div className="stat">
                    <b>~3 Phút</b>
                    <span>Xuất video hoàn chỉnh</span>
                  </div>
                </div>
              </div>

              {/* Live Interactive Director Studio Canvas Mockup */}
              <div className="hero-mockup reveal" id="director-desk">
                <div className="mock-window">
                  <div className="mock-top">
                    <div className="dots"><i /><i /><i /></div>
                    <div className="mock-tabs">
                      <button
                        type="button"
                        className={`mock-tab ${demoTab === 'sell' ? 'active' : ''}`}
                        onClick={() => setDemoTab('sell')}
                      >
                        🛍️ Video Bán Hàng UGC
                      </button>
                      <button
                        type="button"
                        className={`mock-tab ${demoTab === 'film' ? 'active' : ''}`}
                        onClick={() => setDemoTab('film')}
                      >
                        🎬 Phim Ngắn Đa Cảnh
                      </button>
                      <button
                        type="button"
                        className={`mock-tab ${demoTab === 'audio' ? 'active' : ''}`}
                        onClick={() => setDemoTab('audio')}
                      >
                        🎙️ Soundstage & Audio
                      </button>
                    </div>
                    <span className="mock-url">studio.aiautocut.com</span>
                  </div>

                  <div className="mock-body">
                    {demoTab === 'sell' && (
                      <div className="mock-composer">
                        <div className="mock-left">
                          <div className="mock-badge">✨ Sell Mode — Strict Visual Lock</div>
                          <div className="mock-input-preview">
                            <div className="mock-img-box">
                              <span className="mock-tag">Ảnh sản phẩm (Reference)</span>
                              <div className="mock-img-ph">💄 Son Lì Cao Cấp</div>
                            </div>
                            <div className="mock-img-box">
                              <span className="mock-tag">Gương mặt KOL (Face-Lock)</span>
                              <div className="mock-img-ph">👩 Diễn Viên Nữ</div>
                            </div>
                          </div>
                          <div className="mock-prompt-box">
                            <b>Kịch bản tự động phân cảnh (4 scenes):</b>
                            <p>KOL cầm son trên phố cafe, thoa lên môi mướt mịn, test nước không trôi, cười tươi giới thiệu ưu đãi...</p>
                            <div style={{ marginTop: 8, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                              <span className="cam-pill"><Camera size={10} /> Macro Close-Up</span>
                              <span className="cam-pill">Lighting: Soft Studio</span>
                            </div>
                          </div>
                        </div>

                        <div className="mock-right">
                          <div className="mock-scenes-grid">
                            <div className="mock-scene done">
                              <span className="snum">Cảnh 1</span>
                              <span className="stxt">Cận cảnh mở nắp son · 35mm</span>
                              <span className="scheck">✓ Đã xong</span>
                            </div>
                            <div className="mock-scene active">
                              <span className="snum">Cảnh 2</span>
                              <span className="stxt">KOL thoa son mướt mịn</span>
                              <span className="srun">⚡ Đang render</span>
                            </div>
                            <div className="mock-scene wait">
                              <span className="snum">Cảnh 3</span>
                              <span className="stxt">Test nước không lem màu</span>
                              <span className="swait">Chờ nối khung</span>
                            </div>
                            <div className="mock-scene wait">
                              <span className="snum">Cảnh 4</span>
                              <span className="stxt">Nụ cười rạng rỡ kêu gọi mua</span>
                              <span className="swait">Chờ nối khung</span>
                            </div>
                          </div>
                          <div className="mock-bar">
                            <span>🎬 Tự động ghép: <b>commercial_final.mp4</b></span>
                            <span className="badge-free">9:16 Dọc · 1080p 60fps</span>
                          </div>
                        </div>
                      </div>
                    )}

                    {demoTab === 'film' && (
                      <div className="mock-composer">
                        <div className="mock-left">
                          <div className="mock-badge">👑 Consistent Character Cinema Series</div>
                          <div className="mock-prompt-box" style={{ height: '100%' }}>
                            <b>Ý tưởng trường đoạn phim:</b>
                            <p>Nữ kiếm hiệp bạch y phiêu bạt giang hồ, quyết chiến trên đỉnh núi mây mù, thi triển kiếm pháp tìm lại bảo vật gia truyền...</p>
                            <div style={{ marginTop: 12, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                              <span className="cam-pill"><Camera size={10} /> 35mm Anamorphic</span>
                              <span className="cam-pill">Drone Orbit 4K</span>
                              <span className="cam-pill">Góc rộng toàn cảnh</span>
                            </div>
                          </div>
                        </div>
                        <div className="mock-right">
                          <div className="mock-scenes-grid">
                            {[
                              { s: '01', t: 'Toàn cảnh sương mù trên đỉnh núi', st: 'Ready' },
                              { s: '02', t: 'Nữ kiếm hiệp rút kiếm bạch y', st: 'Ready' },
                              { s: '03', t: 'Giao tranh kiếm khí chấn động', st: 'Rendering' },
                              { s: '04', t: 'Cận cảnh ánh mắt kiên định', st: 'Queued' },
                            ].map((item, k) => (
                              <div key={k} className={`mock-scene ${item.st === 'Ready' ? 'done' : item.st === 'Rendering' ? 'active' : 'wait'}`}>
                                <span className="snum">Cảnh {item.s}</span>
                                <span className="stxt">{item.t}</span>
                                <span className={item.st === 'Ready' ? 'scheck' : item.st === 'Rendering' ? 'srun' : 'swait'}>
                                  {item.st === 'Ready' ? '✓ Ready' : item.st === 'Rendering' ? '⚡ Render' : 'Chờ'}
                                </span>
                              </div>
                            ))}
                          </div>
                          <div className="mock-bar">
                            <span>⏱️ 4 cảnh × 8s = <b>32s Phim 16:9</b></span>
                            <span className="badge-free">Auto Stitching ✓</span>
                          </div>
                        </div>
                      </div>
                    )}

                    {demoTab === 'audio' && (
                      <div className="mock-composer">
                        <div className="mock-left">
                          <div className="mock-badge">🎙️ Soundstage & AI Lip-Sync Engine</div>
                          <div className="mock-prompt-box" style={{ height: '100%' }}>
                            <b>Thiết lập giọng đọc nhân vật:</b>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
                              <div className="track-row">
                                <span className="track-label">Kore</span>
                                <span style={{ color: '#fff', fontWeight: 600 }}>Giọng Nữ Miền Bắc (Ấm áp, truyền cảm)</span>
                                <div className="audio-waveform" style={{ marginLeft: 'auto' }}>
                                  <span /><span /><span /><span /><span /><span />
                                </div>
                              </div>
                              <div className="track-row">
                                <span className="track-label">Puck</span>
                                <span style={{ color: '#fff', fontWeight: 600 }}>Giọng Nam Miền Nam (Trầm ấm, uy quyền)</span>
                                <div className="audio-waveform" style={{ marginLeft: 'auto' }}>
                                  <span /><span /><span /><span /><span /><span />
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                        <div className="mock-right">
                          <div className="mock-scenes-grid">
                            <div className="mock-scene done">
                              <span className="snum">Track 01</span>
                              <span className="stxt">Voiceover diễn cảm theo kịch bản</span>
                              <span className="scheck">Synced</span>
                            </div>
                            <div className="mock-scene done">
                              <span className="snum">Track 02</span>
                              <span className="stxt">Nhạc nền điện ảnh Ambient Cinematic</span>
                              <span className="scheck">Mastered</span>
                            </div>
                            <div className="mock-scene done">
                              <span className="snum">Track 03</span>
                              <span className="stxt">SFX tiếng gió, kiếm khí & bước chân</span>
                              <span className="scheck">Mixed</span>
                            </div>
                          </div>
                          <div className="mock-bar">
                            <span>🔊 Âm thanh vòm: <b>Dolby Atmos Studio</b></span>
                            <span className="badge-free">48kHz / 24-bit</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* ── BENTO GRID: STUDIO CAPABILITIES ── */}
          <section className="blk" id="features" aria-labelledby="features-title">
            <div className="inner">
              <div className="eyebrow reveal">NĂNG LỰC STUDIO ĐỈNH CAO</div>
              <h2 className="h2 reveal" id="features-title">Cả Một Xưởng Phim Điện Ảnh Trong Một Cú Click</h2>
              <p className="sub reveal">Không cần ekip cồng kềnh, không cần diễn viên đắt đỏ. AI AutoCut trang bị cho bạn đầy đủ công cụ của một đạo diễn chuyên nghiệp.</p>

              <div className="bento-grid reveal">
                {/* Bento 1: Face-Lock (Lớn) */}
                <article className="bento-card bento-wide">
                  <div className="bento-info">
                    <span className="bento-icon"><Users size={22} color="#ec4899" /></span>
                    <h3>Công Nghệ Khóa Mặt Diễn Viên & Sản Phẩm (Face-Lock 100%)</h3>
                    <p>Hệ thống Model Sheet Reference độc quyền neo giữ các đặc điểm nhân dạng gương mặt diễn viên và logo bao bì sản phẩm. Dù đổi góc quay cận cảnh, góc nghiêng hay toàn cảnh, nhân vật vẫn giữ nguyên 100% diện mạo.</p>
                    <div className="bento-tags" style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 14 }}>
                      <span className="cam-pill">#FaceLock100%</span>
                      <span className="cam-pill">#ProductLock</span>
                      <span className="cam-pill">#ConsistentSeries</span>
                    </div>
                  </div>
                  <div className="bento-visual">
                    <div className="face-demo-strip">
                      <div className="face-pill">Cảnh 1: Cận mặt 35mm</div>
                      <div className="face-pill">Cảnh 2: Góc nghiêng 45°</div>
                      <div className="face-pill">Cảnh 3: Toàn thân di chuyển</div>
                      <div className="face-pill active">✓ 100% Cùng 1 Diễn Viên</div>
                    </div>
                  </div>
                </article>

                {/* Bento 2: AI Auto Scripting */}
                <article className="bento-card">
                  <span className="bento-icon"><Sparkles size={22} color="#f97316" /></span>
                  <h3>AI Map-Reduce Viết Kịch Bản Phân Cảnh</h3>
                  <p>Bạn chỉ cần đưa ra ý tưởng thô bằng tiếng Việt. Hệ thống tự động phân tách nhịp phim thành từng phân cảnh chi tiết, viết chỉ dẫn máy quay tối ưu riêng cho Google Veo 3.1.</p>
                </article>

                {/* Bento 3: Native Audio & Auto Merge */}
                <article className="bento-card">
                  <span className="bento-icon"><Film size={22} color="#a855f7" /></span>
                  <h3>Tự Động Ghép Phim Liền Mạch & Lồng Tiếng</h3>
                  <p>Sau khi các cảnh render xong, engine hậu kỳ tự động nối khung hình, đồng bộ giọng lồng tiếng Việt và xuất file video hoàn chỉnh sẵn sàng đăng tải mà không cần qua CapCut.</p>
                </article>

                {/* Bento 4: 1080p Upscale Lanczos */}
                <article className="bento-card">
                  <span className="bento-icon"><Maximize2 size={22} color="#34d399" /></span>
                  <h3>Nâng Cấp Chi Tiết Chuẩn 4K Ultra HD</h3>
                  <p>Tích hợp thuật toán nội suy Lanczos và khử nhiễu điện ảnh, làm mịn chi tiết da, mái tóc và chữ trên nhãn mác sản phẩm sắc nét tối đa.</p>
                </article>

                {/* Bento 5: Kho trợ lý GPT độc quyền */}
                <article className="bento-card">
                  <span className="bento-icon"><Layers size={22} color="#3b82f6" /></span>
                  <h3>Kho 100+ Trợ Lý AI Chuyên Sâu Cho Đạo Diễn</h3>
                  <p>Tặng kèm bộ sưu tập trợ lý GPT độc quyền: viết kịch bản viral TikTok, biên kịch phim ngắn tiên hiệp, tối ưu kịch bản chuyển đổi bán hàng cao cấp.</p>
                </article>
              </div>
            </div>
          </section>

          {/* ── SECTION 2: UGC & E-COMMERCE COMMERCIAL STUDIO ── */}
          <section className="blk" id="sell-video" aria-labelledby="sell-title">
            <div className="inner">
              <div className="eyebrow reveal">BÁN HÀNG TỰ ĐỘNG HÓA</div>
              <h2 className="h2 reveal" id="sell-title">Video Bán Hàng UGC TikTok Shop & Shopee Tăng Vọt Chuyển Đổi</h2>
              <p className="sub reveal">Không còn tốn kém thuê mẫu quay chụp. Tạo hàng chục video review sản phẩm mỗi ngày với chi phí chỉ vài nghìn đồng.</p>

              <div className="sell-showcase reveal">
                <div className="sell-steps-box">
                  <div className="sell-step">
                    <div className="step-badge">Bước 1</div>
                    <h4>Tải Ảnh Sản Phẩm & KOL</h4>
                    <p>Chụp 1 tấm ảnh sản phẩm rõ nét + ảnh gương mặt bạn (hoặc người mẫu mong muốn).</p>
                  </div>
                  <div className="sell-arrow" aria-hidden="true">➔</div>
                  <div className="sell-step">
                    <div className="step-badge">Bước 2</div>
                    <h4>Gõ Mô Tả Bằng Tiếng Việt</h4>
                    <p>Ví dụ: <em>"Kem chống nắng nâng tone tự nhiên, KOL thoa thử và đi dưới nắng hè..."</em></p>
                  </div>
                  <div className="sell-arrow" aria-hidden="true">➔</div>
                  <div className="sell-step hot">
                    <div className="step-badge">Bước 3</div>
                    <h4>Nhận Video Hoàn Chỉnh</h4>
                    <p>AI tự tạo 4–6 cảnh nối tiếp, lồng giọng đọc review tự nhiên, ghép thành file MP4 9:16.</p>
                  </div>
                </div>

                <div className="sell-cta-strip">
                  <div className="cta-left">
                    <ShoppingBag size={28} color="#fb923c" />
                    <div>
                      <b>Sẵn sàng tăng trưởng doanh số TikTok Shop & Shopee?</b>
                      <span>Tạo video bán hàng đầu tiên của bạn chỉ trong 3 phút với chi phí 0đ.</span>
                    </div>
                  </div>
                  <a className="btn btn-grad" href={registerHref}>
                    <span>Tạo Video Bán Hàng Ngay</span>
                  </a>
                </div>
              </div>
            </div>
          </section>

          {/* ── SHOWREEL STUDIO GALLERY ── */}
          <section className="blk" id="samples" aria-labelledby="samples-title">
            <div className="inner">
              <div className="eyebrow reveal">SHOWREEL TÁC PHẨM</div>
              <h2 className="h2 reveal" id="samples-title">Phòng Chiếu Phim & Video Mẫu Từ Cộng Đồng</h2>
              <p className="sub reveal">Khám phá các video thực tế do AI AutoCut Studio sản xuất: Giữ mặt chuẩn xác, góc máy điện ảnh mượt mà, âm thanh sống động.</p>

              <div className="gallery-tabs reveal">
                <button
                  type="button"
                  className={`g-tab ${sampleTab === 'all' ? 'active' : ''}`}
                  onClick={() => setSampleTab('all')}
                >
                  Tất cả tác phẩm
                </button>
                <button
                  type="button"
                  className={`g-tab ${sampleTab === 'sell' ? 'active' : ''}`}
                  onClick={() => setSampleTab('sell')}
                >
                  🛍️ Video Bán Hàng (9:16)
                </button>
                <button
                  type="button"
                  className={`g-tab ${sampleTab === 'movie' ? 'active' : ''}`}
                  onClick={() => setSampleTab('movie')}
                >
                  🎬 Phim Giữ Mặt
                </button>
                <button
                  type="button"
                  className={`g-tab ${sampleTab === 'cinema' ? 'active' : ''}`}
                  onClick={() => setSampleTab('cinema')}
                >
                  🌊 Điện Ảnh 16:9
                </button>
              </div>

              <div className="samples-grid reveal">
                {filteredSamples.map((s, idx) => renderSample(s, idx))}
              </div>
            </div>
          </section>

          {/* ── HOLLYWOOD 3-STAGE PRODUCTION PIPELINE ── */}
          <section className="blk" id="pipeline" aria-labelledby="pipeline-title">
            <div className="inner">
              <div className="eyebrow reveal">QUY TRÌNH CHUẨN HOLLYWOOD</div>
              <h2 className="h2 reveal" id="pipeline-title">Quy Trình Sản Xuất Phim 3 Giai Đoạn Tự Động</h2>
              <p className="sub reveal">Từ ý tưởng sơ khai đến tác phẩm hoàn chỉnh, toàn bộ dây chuyền sản xuất được điều phối mượt mà trên nền tảng đám mây.</p>

              <div className="pipeline-box reveal">
                <div className="pipeline-card">
                  <span className="pipeline-num">01</span>
                  <h3>Giai Đoạn Pre-Production (Tiền Kỳ)</h3>
                  <p>AI tiếp nhận ý tưởng bằng tiếng Việt, tự động phân tích cốt truyện, casting diễn viên qua Character Bible và thiết lập kịch bản phân cảnh kèm chỉ dẫn góc máy chi tiết.</p>
                </div>

                <div className="pipeline-card">
                  <span className="pipeline-num">02</span>
                  <h3>Giai Đoạn AI Production (Sản Xuất)</h3>
                  <p>Hệ thống phân phối các cảnh quay đến cụm GPU song song, áp dụng thuật toán Face-Lock độc quyền và engine Google Veo 3.1 để kết xuất hình ảnh điện ảnh sống động.</p>
                </div>

                <div className="pipeline-card">
                  <span className="pipeline-num">03</span>
                  <h3>Giai Đoạn Post-Production (Hậu Kỳ)</h3>
                  <p>Engine âm thanh tự động lồng tiếng Việt theo khẩu hình, chèn hiệu ứng âm thanh môi trường, ghép các cảnh thành một file MP4 4K liền mạch để bạn tải về ngay.</p>
                </div>
              </div>
            </div>
          </section>

          {/* ── SO SÁNH: CÁCH CŨ VS STUDIO AI AUTOCUT ── */}
          <section className="blk" id="comparison" aria-labelledby="comp-title">
            <div className="inner">
              <div className="eyebrow reveal">SO SÁNH HIỆU QUẢ</div>
              <h2 className="h2 reveal" id="comp-title">Tại Sao Các Nhà Sáng Tạo Chọn AI AutoCut Studio?</h2>
              <p className="sub reveal">Đột phá về tốc độ sản xuất, tiết kiệm đến 95% chi phí so với quy trình quay dựng truyền thống.</p>

              <div className="matrix-table-wrap reveal">
                <table className="matrix-table">
                  <thead>
                    <tr>
                      <th>Tiêu chí đánh giá</th>
                      <th style={{ color: '#f87171' }}>Quay Dựng Truyền Thống</th>
                      <th className="highlight" style={{ color: 'var(--accent2)' }}>AI AutoCut Studio</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td><b>Chi phí sản xuất</b></td>
                      <td style={{ color: 'var(--text2)' }}>3 – 15 triệu VNĐ / buổi quay</td>
                      <td className="highlight">Từ 0đ · Gói Pro chỉ 249k/tháng</td>
                    </tr>
                    <tr>
                      <td><b>Thời gian hoàn thiện</b></td>
                      <td style={{ color: 'var(--text2)' }}>2 – 5 ngày làm việc</td>
                      <td className="highlight">3 – 5 phút tự động toàn bộ</td>
                    </tr>
                    <tr>
                      <td><b>Tính nhất quán nhân vật</b></td>
                      <td style={{ color: 'var(--text2)' }}>Phụ thuộc lịch trình diễn viên</td>
                      <td className="highlight">Khóa mặt nhân vật 100% qua mọi cảnh</td>
                    </tr>
                    <tr>
                      <td><b>Yêu cầu thiết bị</b></td>
                      <td style={{ color: 'var(--text2)' }}>Máy ảnh đắt tiền & PC cấu hình khủng</td>
                      <td className="highlight">Chạy 100% trên Cloud · Dùng ngay trên ĐT/Laptop</td>
                    </tr>
                    <tr>
                      <td><b>Kỹ năng dựng phim</b></td>
                      <td style={{ color: 'var(--text2)' }}>Cần học Premiere, After Effects, CapCut</td>
                      <td className="highlight">Chỉ cần gõ tiếng Việt, AI tự động lo trọn gói</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          {/* ── BẢNG GIÁ MINH BẠCH (PRICING) ── */}
          <section className="blk" id="pricing" aria-labelledby="pricing-title">
            <div className="inner">
              <div className="eyebrow reveal">BẢNG GIÁ DỊCH VỤ</div>
              <h2 className="h2 reveal" id="pricing-title">Đầu Tư Nhỏ, Doanh Thu Đột Phá</h2>
              <p className="sub reveal" dangerouslySetInnerHTML={{ __html: t('landing.pricing_desc') }} />

              <div className="price-grid reveal">
                {/* Dùng thử */}
                <div className="pcard">
                  <span className="tag tag-trial">{t('landing.price_trial_tag')}</span>
                  <div className="pname">{t('landing.price_free')}</div>
                  <div className="pamt">0đ<small>{t('landing.price_free_period')}</small></div>
                  <ul className="pfeatures">
                    <li><Check size={16} /> <b>24 Giờ</b> tạo video trải nghiệm</li>
                    <li><Check size={16} /> Model Google Veo 3.1 Lite — <b>FREE</b></li>
                    <li><Check size={16} /> Khóa mặt nhân vật & tự ghép phim</li>
                    <li><Check size={16} /> 150MB lưu trữ đám mây</li>
                  </ul>
                  <a className="btn btn-ghost pbtn" href={registerHref}>{t('landing.price_free_cta')}</a>
                </div>

                {/* Gói 1 tháng Pro (Hot) */}
                <div className="pcard hot">
                  <span className="tag tag-hot">{t('landing.price_pro_tag')}</span>
                  <div className="pname">Pro Creator · 1 Tháng</div>
                  <div className="pamt">249k<small>{t('landing.price_per_month')}</small></div>
                  <ul className="pfeatures">
                    <li><Check size={16} /> Tạo video không giới hạn số lượng</li>
                    <li><Check size={16} /> <b>Mở khóa toàn bộ</b> Model Veo 3.1 & Omni Flash</li>
                    <li><Check size={16} /> Render đa phân cảnh + Ưu tiên hàng đợi</li>
                    <li><Check size={16} /> <b>1GB</b> dung lượng lưu trữ</li>
                    <li><Check size={16} /> <b>Tặng 10</b> trợ lý AI chuyên sâu</li>
                    <li><Check size={16} /> Hỗ trợ kỹ thuật ưu tiên 24/7</li>
                  </ul>
                  <a className="btn btn-grad pbtn" href={registerHref}>{t('landing.price_pro_cta')}</a>
                </div>

                {/* Gói 6 tháng */}
                <div className="pcard">
                  <span className="tag tag-save">{t('landing.price_m6_tag') || 'TIẾT KIỆM 5%'}</span>
                  <div className="pname">Studio Pro · 6 Tháng</div>
                  <div className="pamt">1.419k<small>/6 tháng</small></div>
                  <ul className="pfeatures">
                    <li><Check size={16} /> Mọi tính năng cao cấp của gói Pro</li>
                    <li><Check size={16} /> <b>Tặng 50</b> trợ lý AI đạo diễn chuyên sâu</li>
                    <li><Check size={16} /> 1GB lưu trữ & ưu tiên GPU render</li>
                    <li><Check size={16} /> Thanh toán 1 lần, yên tâm sáng tạo nửa năm</li>
                  </ul>
                  <a className="btn btn-ghost pbtn" href={registerHref}>Chọn Gói 6 Tháng</a>
                </div>

                {/* Gói 12 tháng */}
                <div className="pcard">
                  <span className="tag tag-save">{t('landing.price_yearly_tag')}</span>
                  <div className="pname">Master Studio · 1 Năm</div>
                  <div className="pamt">2.599k<small>{t('landing.price_per_year')}</small></div>
                  <ul className="pfeatures">
                    <li><Check size={16} /> Mọi đặc quyền cao nhất của Studio</li>
                    <li><Check size={16} /> <b>Tặng trọn bộ 100+</b> trợ lý AI độc quyền</li>
                    <li><Check size={16} /> Chỉ ~217k/tháng — Tiết kiệm tối đa 13%</li>
                    <li><Check size={16} /> Hỗ trợ trực tiếp 1-1 qua Telegram & Zalo</li>
                  </ul>
                  <a className="btn btn-ghost pbtn" href={registerHref}>{t('landing.price_yearly_cta')}</a>
                </div>
              </div>

              <p className="price-note reveal" dangerouslySetInnerHTML={{ __html: t('landing.pricing_note') }} />
            </div>
          </section>

          {/* ── TESTIMONIALS & WALL OF LOVE ── */}
          <section className="blk" id="testimonials" aria-labelledby="testi-title">
            <div className="inner">
              <div className="eyebrow reveal">ĐÁNH GIÁ TỪ KHÁCH HÀNG</div>
              <h2 className="h2 reveal" id="testi-title">Được Tin Dùng Bởi Hơn 1,200+ Nhà Làm Phim & Creator</h2>

              <div className="testi-grid reveal">
                {TESTIMONIALS.map((item, i) => (
                  <article key={i} className="testi-card">
                    <div className="testi-av-row">
                      <div className="testi-av" style={{ background: item.col }}>{item.name[0]}</div>
                      <div className="testi-meta">
                        <b>{item.name}</b>
                        <span>{item.role}</span>
                      </div>
                    </div>
                    <p>"{item.text}"</p>
                    <div className="stars" aria-label="5 trên 5 sao">
                      {Array.from({ length: 5 }).map((_, k) => (
                        <Star key={k} size={14} fill="#fbbf24" color="#fbbf24" />
                      ))}
                    </div>
                  </article>
                ))}
              </div>
            </div>
          </section>

          {/* ── FAQ (SEO SCHEMA MATCHING) ── */}
          <section className="blk" id="faq" aria-labelledby="faq-title">
            <div className="inner">
              <div className="eyebrow reveal">HỎI ĐÁP STUDIO</div>
              <h2 className="h2 reveal" id="faq-title">Những Câu Hỏi Thường Gặp Về AI AutoCut Studio</h2>
              <p className="sub reveal">Mọi thông tin bạn cần biết để bắt đầu làm phim và sản xuất video thương mại với AI.</p>

              <div className="faq-container reveal">
                {FAQ_ITEMS.map((item, idx) => (
                  <div key={idx} className={`faq-item ${openFaq === idx ? 'open' : ''}`}>
                    <button
                      type="button"
                      className="faq-q"
                      onClick={() => toggleFaq(idx)}
                      aria-expanded={openFaq === idx}
                    >
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
          <section className="blk" aria-label="Kêu gọi hành động">
            <div className="inner">
              <div className="final-band reveal">
                <div className="band-content">
                  <h2>Sẵn Sàng Trở Thành Đạo Diễn Phim AI Của Riêng Bạn?</h2>
                  <p>Mở tài khoản ngay hôm nay để nhận <b>24 giờ sáng tạo miễn phí</b> trên hệ thống Google Veo 3.1 mà không cần nhập thẻ tín dụng.</p>
                  <div className="band-actions">
                    <a className="btn btn-grad btn-lg" href={registerHref}>
                      <Sparkles size={18} />
                      <span>Bắt Đầu Làm Phim Miễn Phí</span>
                    </a>
                    <a className="btn btn-ghost btn-lg" href={loginHref}>
                      <span>Đăng Nhập Studio</span>
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </main>

        {/* ── FOOTER ── */}
        <footer role="contentinfo">
          <div className="inner">
            <div className="foot-top">
              <div className="foot-brand">
                <div className="brand">
                  <span className="logo"><Logo /></span>
                  <span className="brand-text">AI AutoCut Studio</span>
                </div>
                <p className="foot-desc">Studio làm phim & sản xuất video AI Veo 3.1 tự động hóa toàn diện từ ý tưởng, kịch bản đến thành phẩm 4K sắc nét.</p>
                <div style={{ marginTop: 14, display: 'flex', gap: 10, alignItems: 'center', fontSize: 12, color: 'var(--text3)' }}>
                  <span className="studio-live-badge"><span className="pulse" /> Hệ thống Online</span>
                  <span>99.9% Uptime</span>
                </div>
              </div>

              <div className="fcol">
                <b>Sản Phẩm & Studio</b>
                <a href="#director-desk">Trường Quay Director</a>
                <a href="#features">Tính Năng Cốt Lõi</a>
                <a href="#sell-video">Video Bán Hàng UGC</a>
                <a href="#samples">Showreel Phim Mẫu</a>
                <a href="#pricing">Bảng Giá Dịch Vụ</a>
              </div>

              <div className="fcol">
                <b>Hỗ Trợ & Hướng Dẫn</b>
                <a href={isSameOrigin ? '/guide' : 'https://app.aiautocut.com/guide'}>Hướng Dẫn Sử Dụng</a>
                <a href="https://t.me/thaidem57" target="_blank" rel="noreferrer">Telegram: @thaidem57</a>
                <a href="https://zalo.me/0366566303" target="_blank" rel="noreferrer">Zalo: 0366566303</a>
                <a href="mailto:support@aiautocut.com">Email Hỗ Trợ</a>
              </div>

              <div className="fcol">
                <b>Pháp Lý & Bảo Mật</b>
                <a href="#">Điều Khoản Dịch Vụ</a>
                <a href="#">Chính Sách Bảo Mật</a>
                <a href="#">Bản Quyền Thương Mại</a>
                <a href="#">Hỗ Trợ Kỹ Thuật 24/7</a>
              </div>
            </div>

            <div className="foot-bottom">
              <span>© 2026 AI AutoCut Studio. All rights reserved. Powered by Google Veo 3.1 & Gemini Multimodal.</span>
            </div>
          </div>
        </footer>
      </div>
    </div>
  )
}
