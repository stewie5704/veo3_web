import { useState, useRef } from 'react'
import './Landing.css'
import { useT, LangSwitch } from '../i18n'
import {
  Sparkles, Play, Check, Zap, Film, ShoppingBag, Clapperboard,
  Layers, CheckCircle2, XCircle, Volume2, VolumeX, Video, Mic,
  ChevronDown, ArrowRight, ShieldCheck, Cpu
} from 'lucide-react'

// ==========================================================================
// AI AutoCut Studio — Official Premium Landing Page
// Ultra-clean, Cinematic AI Video Studio Experience
// ==========================================================================

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
  { id: 1, category: 'sell', dur: '0:15', title: 'Review thời trang áo dài phố sáng — Khóa mặt người mẫu', ratio: '9:16', file: 'v1.MP4', tag: 'UGC Commercial', isVertical: true },
  { id: 2, category: 'cinema', dur: '0:12', title: 'Tiên hiệp cổ phong: Giữ mặt nhân vật qua từng cảnh', ratio: '9:16', file: 'v2.MP4', tag: 'Face-Lock Series', isVertical: true },
  { id: 3, category: 'sell', dur: '0:28', title: 'Video review đồ ngủ lụa satin góc phòng ngủ ấm áp', ratio: '9:16', file: 'v3.mp4', tag: 'TikTok Shop', isVertical: true },
  { id: 4, category: 'sell', dur: '0:13', title: 'Quảng cáo kính gọng mảnh & trang phục quý phái', ratio: '9:16', file: 'v4.MP4', tag: 'Product Lock', isVertical: true },
  { id: 5, category: 'cinema', dur: '0:08', title: 'Mèo nón lá giữa ruộng bậc thang Tây Bắc mây mù', ratio: '9:16', file: 'v5.mp4', tag: '3D Animation', isVertical: true },
  { id: 6, category: 'cinema', dur: '0:08', title: 'Phim gia đình: Khoảnh khắc ấm áp bên khung cửa sổ', ratio: '16:9', file: 'v6.mp4', tag: 'Cinema 16:9', isVertical: false },
  { id: 7, category: 'cinema', dur: '0:08', title: 'Giao long biển sâu lướt qua rạn san hô phát sáng', ratio: '16:9', file: 'v7.mp4', tag: 'Sci-Fi Epic', isVertical: false },
  { id: 8, category: 'cinema', dur: '0:08', title: 'Kỳ quan thủy cung: Rùa biển lướt qua rạn san hô 4K', ratio: '16:9', file: 'v8.mp4', tag: '4K Ultra HDR', isVertical: false },
]

// Showcase Hero Data
const SHOWCASE_MODES = [
  {
    key: 'cinema',
    label: '🎬 Phim Ngắn Đa Cảnh',
    video: '/samples/v7.mp4',
    title: 'Giao Long Biển Sâu · Phân cảnh 3/4',
    scene: 'Cảnh 3: Drone Orbit toàn cảnh',
    aspect: '16:9',
    model: 'Google Veo 3.1 Cinema'
  },
  {
    key: 'ugc',
    label: '🛍️ Video Bán Hàng UGC',
    video: '/samples/v1.MP4',
    title: 'Review Thời Trang Phố Sáng · Khóa Mặt KOL',
    scene: 'Cảnh 1: Cận cảnh nụ cười tự tin',
    aspect: '9:16',
    model: 'Veo 3.1 Fast UGC'
  },
  {
    key: 'wonder',
    label: '🌊 Kỳ Quan Điện Ảnh 4K',
    video: '/samples/v8.mp4',
    title: 'Kỳ Quan Biển Sâu · Sinh Thái San Hô',
    scene: 'Cảnh 2: Macro Close-up 60fps',
    aspect: '16:9',
    model: 'Veo 3.1 Ultra-HD'
  }
]

// FAQ Items
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

  // Showcase state
  const [activeShowcase, setActiveShowcase] = useState(SHOWCASE_MODES[0])
  const [isMuted, setIsMuted] = useState(true)
  const heroVideoRef = useRef<HTMLVideoElement>(null)

  // Prompt input demo
  const [promptText, setPromptText] = useState('Nữ kiếm khách áo lam phi thân qua mái đình cổ kính dưới mưa tuyết, góc máy flycam điện ảnh 4k')

  // Gallery tab
  const [galleryTab, setGalleryTab] = useState<'all' | 'cinema' | 'sell' | 'vertical'>('all')

  // FAQ Accordion
  const [openFaq, setOpenFaq] = useState<number | null>(0)
  const toggleFaq = (idx: number) => setOpenFaq(openFaq === idx ? null : idx)

  // Toggle Sound
  const toggleSound = () => {
    if (heroVideoRef.current) {
      heroVideoRef.current.muted = !heroVideoRef.current.muted
      setIsMuted(heroVideoRef.current.muted)
    }
  }

  // Filter samples
  const filteredSamples = SAMPLES.filter(s => {
    if (galleryTab === 'all') return true
    if (galleryTab === 'vertical') return s.isVertical
    return s.category === galleryTab
  })

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

      {/* Atmospheric Background Lights */}
      <div className="ambient-bg" aria-hidden="true">
        <div className="ambient-glow-1" />
        <div className="ambient-glow-2" />
        <div className="ambient-glow-3" />
        <div className="ambient-grid" />
      </div>

      {/* ── HEADER ── */}
      <header className="header" role="banner">
        <div className="container">
          <div className="header-inner">
            <a href="#" className="brand" aria-label="AI AutoCut Studio Trang Chủ">
              <span className="brand-logo"><Logo /></span>
              <span>AI AutoCut</span>
              <span className="brand-badge">STUDIO</span>
            </a>

            <nav className="nav-links" aria-label="Điều hướng">
              <a href="#showcase" className="nav-link">Trường Quay</a>
              <a href="#showreel" className="nav-link">Showreel</a>
              <a href="#features" className="nav-link">Năng Lực</a>
              <a href="#pipeline" className="nav-link">Quy Trình</a>
              <a href="#pricing" className="nav-link">Bảng Giá</a>
              <a href="#faq" className="nav-link">Hỏi Đáp</a>
            </nav>

            <div className="header-actions">
              <LangSwitch compact />
              <a className="btn btn-ghost" href={loginHref}>{t('landing.login')}</a>
              <a className="btn btn-primary" href={registerHref}>
                <Sparkles size={14} />
                <span>Thử Nghiệm 0Đ</span>
              </a>
            </div>
          </div>
        </div>
      </header>

      {/* ── MAIN CONTENT ── */}
      <main id="main-content" role="main">
        {/* ── HERO SECTION ── */}
        <section className="section hero" aria-labelledby="hero-title">
          <div className="container">
            <div className="hero-tag-wrap">
              <span className="hero-tag">
                <span className="dot" />
                <span>Google Veo 3.1 Cinema Engine · Trực Tuyến</span>
              </span>
            </div>

            <h1 id="hero-title" className="hero-title">
              Biến Ý Tưởng Thành Thước Phim Điện Ảnh<br />
              <span className="gradient-text">Với Trí Tuệ Nhân Tạo Veo 3.1</span>
            </h1>

            <p className="hero-desc">
              AI AutoCut tự động hóa toàn bộ quy trình sản xuất video: Phân tích kịch bản đa góc máy, neo giữ 100% gương mặt nhân vật qua công nghệ Face-Lock, lồng tiếng Việt chuẩn cảm xúc và xuất video 4K sắc nét chỉ trong 3 phút.
            </p>

            {/* Interactive Prompt Bar */}
            <div className="prompt-bar-wrap">
              <div className="prompt-bar">
                <Sparkles size={18} className="prompt-bar-icon" />
                <input
                  type="text"
                  className="prompt-input"
                  value={promptText}
                  onChange={(e) => setPromptText(e.target.value)}
                  placeholder="Nhập ý tưởng kịch bản phim của bạn..."
                />
                <a href={registerHref} className="btn btn-primary btn-lg">
                  <span>Tạo Video Ngay</span>
                  <ArrowRight size={16} />
                </a>
              </div>

              <div className="prompt-suggestions">
                <button
                  type="button"
                  className="suggestion-pill"
                  onClick={() => setPromptText('Nữ kiếm khách áo lam phi thân qua mái đình cổ kính dưới mưa tuyết, góc máy flycam điện ảnh 4k')}
                >
                  🎬 Phim Cổ Phong Đa Cảnh
                </button>
                <button
                  type="button"
                  className="suggestion-pill"
                  onClick={() => setPromptText('KOL nữ thoa son lì dưỡng ẩm giữa quán cafe Paris nắng vàng, góc quay cận cảnh mướt môi')}
                >
                  🛍️ Review Mỹ Phẩm UGC
                </button>
                <button
                  type="button"
                  className="suggestion-pill"
                  onClick={() => setPromptText('Giao long khổng lồ phát sáng lướt qua rạn san hô kỳ ảo dưới đáy đại dương, điện ảnh Sci-Fi')}
                >
                  🌊 Kỳ Quan Biển Sâu
                </button>
              </div>
            </div>

            {/* ── HERO CINEMATIC SHOWCASE (REAL VIDEO PLAYER) ── */}
            <div className="hero-showcase" id="showcase">
              <div className="showcase-topbar">
                <div className="window-dots">
                  <span /><span /><span />
                </div>

                <div className="showcase-tabs">
                  {SHOWCASE_MODES.map((mode) => (
                    <button
                      key={mode.key}
                      type="button"
                      className={`showcase-tab ${activeShowcase.key === mode.key ? 'active' : ''}`}
                      onClick={() => setActiveShowcase(mode)}
                    >
                      {mode.label}
                    </button>
                  ))}
                </div>

                <div className="showcase-status">
                  <span className="live-dot" />
                  <span>VEO 3.1 ACTIVE</span>
                </div>
              </div>

              <div className="showcase-stage">
                <video
                  ref={heroVideoRef}
                  key={activeShowcase.video}
                  src={activeShowcase.video}
                  autoPlay
                  loop
                  muted={isMuted}
                  playsInline
                  preload="auto"
                />

                {/* Director HUD Overlays */}
                <div className="stage-hud-top">
                  <div className="hud-pill">
                    <Film size={12} style={{ color: '#FB923C' }} />
                    <span>{activeShowcase.model}</span>
                  </div>
                  <div className="hud-pill">
                    <ShieldCheck size={12} style={{ color: '#10B981' }} />
                    <span>FACE-LOCK: 100% LOCK</span>
                  </div>
                </div>

                <div className="stage-hud-bottom">
                  <div className="hud-pill">
                    <span>{activeShowcase.scene}</span>
                  </div>

                  <button
                    type="button"
                    className="hud-control-btn"
                    onClick={toggleSound}
                    aria-label={isMuted ? 'Bật âm thanh' : 'Tắt âm thanh'}
                  >
                    {isMuted ? <VolumeX size={14} /> : <Volume2 size={14} />}
                    <span>{isMuted ? 'Bật âm thanh' : 'Đang phát âm thanh'}</span>
                    {!isMuted && (
                      <div className="eq-bars">
                        <span className="eq-bar" />
                        <span className="eq-bar" />
                        <span className="eq-bar" />
                        <span className="eq-bar" />
                      </div>
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* Stats Bar */}
            <div className="stats-grid">
              <div className="stat-item">
                <div className="stat-number">50,000+</div>
                <div className="stat-label">Video đã sản xuất</div>
              </div>
              <div className="stat-item">
                <div className="stat-number">100%</div>
                <div className="stat-label">Độ nhất quán nhân vật</div>
              </div>
              <div className="stat-item">
                <div className="stat-number">22+ Giọng</div>
                <div className="stat-label">Lồng tiếng AI Bắc & Nam</div>
              </div>
              <div className="stat-item">
                <div className="stat-number">~3 Phút</div>
                <div className="stat-label">Từ ý tưởng đến video MP4</div>
              </div>
            </div>
          </div>
        </section>

        {/* ── SHOWREEL GALLERY SECTION ── */}
        <section className="section" id="showreel" aria-labelledby="showreel-title">
          <div className="container">
            <div className="section-header">
              <span className="section-tag">Bộ Sưu Tập Showreel</span>
              <h2 id="showreel-title" className="section-title">
                Thước Phim Thực Tế Tạo Bởi AI AutoCut
              </h2>
              <p className="section-desc">
                Tất cả tác phẩm dưới đây được kết xuất trực tiếp bằng công nghệ Google Veo 3.1 với độ phân giải cao, chuyển động mượt mà và màu sắc điện ảnh.
              </p>
            </div>

            <div className="gallery-filter">
              <button
                type="button"
                className={`filter-btn ${galleryTab === 'all' ? 'active' : ''}`}
                onClick={() => setGalleryTab('all')}
              >
                Tất cả tác phẩm
              </button>
              <button
                type="button"
                className={`filter-btn ${galleryTab === 'cinema' ? 'active' : ''}`}
                onClick={() => setGalleryTab('cinema')}
              >
                Phim Ngắn Điện Ảnh
              </button>
              <button
                type="button"
                className={`filter-btn ${galleryTab === 'sell' ? 'active' : ''}`}
                onClick={() => setGalleryTab('sell')}
              >
                Video Bán Hàng & UGC
              </button>
              <button
                type="button"
                className={`filter-btn ${galleryTab === 'vertical' ? 'active' : ''}`}
                onClick={() => setGalleryTab('vertical')}
              >
                Khung Hình Dọc 9:16
              </button>
            </div>

            <div className="gallery-grid">
              {filteredSamples.map((sample) => (
                <article key={sample.id} className="gallery-card">
                  <div className={`card-video-wrap ${sample.isVertical ? 'vertical' : 'horizontal'}`}>
                    <video
                      src={`/samples/${sample.file}`}
                      muted
                      loop
                      playsInline
                      preload="metadata"
                      onMouseEnter={(e) => { e.currentTarget.play().catch(() => {}) }}
                      onMouseLeave={(e) => { e.currentTarget.pause() }}
                    />
                    <span className="card-pill">{sample.ratio}</span>
                    <span className="card-duration">{sample.dur}</span>
                  </div>
                  <div className="card-content">
                    <h3 className="card-title">{sample.title}</h3>
                    <div className="card-meta">
                      <span className="model-badge">Veo 3.1</span>
                      <span>{sample.tag}</span>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* ── BENTO FEATURES SECTION ── */}
        <section className="section" id="features" aria-labelledby="features-title">
          <div className="container">
            <div className="section-header">
              <span className="section-tag">Năng Lực Studio</span>
              <h2 id="features-title" className="section-title">
                Công Nghệ Dẫn Đầu Cho Nhà Sáng Tạo Video
              </h2>
              <p className="section-desc">
                Loại bỏ rào cản kỹ thuật phức tạp. AI AutoCut trang bị đầy đủ công cụ để bạn trở thành một nhà sản xuất phim chuyên nghiệp ngay trên trình duyệt.
              </p>
            </div>

            <div className="bento-grid">
              {/* Feature 1: Face-Lock */}
              <div className="bento-card bento-col-7">
                <div className="bento-icon-wrap">
                  <ShieldCheck size={24} />
                </div>
                <h3 className="bento-title">Khóa Mặt & Sản Phẩm Đồng Nhất 100% (Face-Lock)</h3>
                <p className="bento-desc">
                  Giải quyết triệt để nỗi đau lớn nhất của video AI: Diễn viên và bao bì sản phẩm giờ đây được giữ nguyên từng chi tiết nhận dạng, ánh mắt và trang phục xuyên suốt 10 tập phim hay hàng chục phân cảnh khác nhau.
                </p>
                <div className="bento-badge-list">
                  <span className="bento-mini-pill">Model Sheet Reference</span>
                  <span className="bento-mini-pill">Consistent Identity</span>
                  <span className="bento-mini-pill">Multi-Scene Continuity</span>
                </div>
              </div>

              {/* Feature 2: Multi-Scene Director */}
              <div className="bento-card bento-col-5">
                <div className="bento-icon-wrap pink">
                  <Clapperboard size={24} />
                </div>
                <h3 className="bento-title">Đạo Diễn Đa Phân Cảnh Thông Minh</h3>
                <p className="bento-desc">
                  Chỉ từ 1 dòng ý tưởng thô, hệ thống tự động bẻ nhỏ câu chuyện thành mạch phim hấp dẫn: Cảnh mở màn ấn tượng, chuyển động góc máy điện ảnh và kết thúc thu hút người xem.
                </p>
                <div className="bento-badge-list">
                  <span className="bento-mini-pill">Map-Reduce Prompt</span>
                  <span className="bento-mini-pill">Cinematic Angles</span>
                </div>
              </div>

              {/* Feature 3: Vietnamese Soundstage */}
              <div className="bento-card bento-col-5">
                <div className="bento-icon-wrap violet">
                  <Mic size={24} />
                </div>
                <h3 className="bento-title">Phòng Thu Lồng Tiếng Việt 22+ Giọng</h3>
                <p className="bento-desc">
                  Đa dạng chất giọng truyền cảm Bắc & Nam, tự động đồng bộ khẩu hình nhân vật (lip-sync), hòa âm nhạc nền không bản quyền và chèn hiệu ứng âm thanh sống động.
                </p>
                <div className="bento-badge-list">
                  <span className="bento-mini-pill">Giọng Bắc & Nam Chuẩn</span>
                  <span className="bento-mini-pill">Auto BGM & SFX</span>
                </div>
              </div>

              {/* Feature 4: Cloud Render & 4K */}
              <div className="bento-card bento-col-7">
                <div className="bento-icon-wrap cyan">
                  <Cpu size={24} />
                </div>
                <h3 className="bento-title">Kết Xuất Đám Mây Tốc Độ Cao & Master 4K</h3>
                <p className="bento-desc">
                  Cụm máy chủ GPU H100 kết xuất song song các phân cảnh, tự động ghép nối thành một file MP4 hoàn chỉnh với độ phân giải 1080p/4K 60fps, không gắn watermark thương mại.
                </p>
                <div className="bento-badge-list">
                  <span className="bento-mini-pill">GPU H100 Cluster</span>
                  <span className="bento-mini-pill">No Watermark</span>
                  <span className="bento-mini-pill">Tải Về Tức Thì</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── PRODUCTION PIPELINE ── */}
        <section className="section" id="pipeline" aria-labelledby="pipeline-title">
          <div className="container">
            <div className="section-header">
              <span className="section-tag">Quy Trình 3 Bước</span>
              <h2 id="pipeline-title" className="section-title">
                Từ Ý Tưởng Thô Đến Video Xuất Bản Trong 3 Phút
              </h2>
              <p className="section-desc">
                Không cần kinh nghiệm dựng phim, không cần máy tính cấu hình cao. Mọi thao tác đều được tự động hóa tối đa.
              </p>
            </div>

            <div className="pipeline-grid">
              <div className="pipeline-step">
                <div className="step-number">01</div>
                <h3 className="step-title">Nhập Ý Tưởng & Nhân Vật</h3>
                <p className="step-desc">
                  Gõ 1 câu mô tả kịch bản hoặc tải lên ảnh chụp sản phẩm/khuôn mặt diễn viên bạn muốn khóa làm nhân vật chính.
                </p>
              </div>

              <div className="pipeline-step">
                <div className="step-number">02</div>
                <h3 className="step-title">AI Đạo Diễn & Render Veo 3.1</h3>
                <p className="step-desc">
                  Hệ thống tự động phân tách kịch bản thành từng cảnh quay, tính toán góc máy và kết xuất video chất lượng cao với Google Veo 3.1.
                </p>
              </div>

              <div className="pipeline-step">
                <div className="step-number">03</div>
                <h3 className="step-title">Lồng Tiếng & Tải Video Hoàn Chỉnh</h3>
                <p className="step-desc">
                  Tự động ghép nối các cảnh thành một phim liền mạch, thêm phụ đề, thuyết minh tiếng Việt và xuất file MP4 sẵn sàng đăng tải.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ── COMPARISON SECTION ── */}
        <section className="section" aria-labelledby="compare-title">
          <div className="container">
            <div className="section-header">
              <span className="section-tag">Hiệu Suất Vượt Trội</span>
              <h2 id="compare-title" className="section-title">
                Sản Xuất Video Truyền Thống vs AI AutoCut Studio
              </h2>
              <p className="section-desc">
                Tiết kiệm 95% chi phí và rút ngắn thời gian sản xuất từ hàng tuần xuống chỉ còn vài phút.
              </p>
            </div>

            <div className="compare-container">
              <div className="compare-card">
                <div className="compare-header">
                  <h3 className="compare-title">Sản Xuất Truyền Thống</h3>
                  <p className="compare-sub">Thuê ekip, diễn viên và dựng thủ công</p>
                </div>
                <div className="compare-list">
                  <div className="compare-row">
                    <XCircle size={18} className="compare-icon-bad" />
                    <span>Chi phí từ 3.000.000đ - 15.000.000đ cho mỗi video ngắn.</span>
                  </div>
                  <div className="compare-row">
                    <XCircle size={18} className="compare-icon-bad" />
                    <span>Mất 3 - 7 ngày để lên kịch bản, quay phim và hậu kỳ.</span>
                  </div>
                  <div className="compare-row">
                    <XCircle size={18} className="compare-icon-bad" />
                    <span>Phụ thuộc lịch trình diễn viên, khó sản xuất video đều đặn mỗi ngày.</span>
                  </div>
                  <div className="compare-row">
                    <XCircle size={18} className="compare-icon-bad" />
                    <span>Thuê phòng thu lồng tiếng và mua bản quyền âm nhạc đắt đỏ.</span>
                  </div>
                </div>
              </div>

              <div className="compare-card highlight">
                <div className="compare-header">
                  <h3 className="compare-title">AI AutoCut Studio</h3>
                  <p className="compare-sub">Toàn bộ quy trình chạy tự động trên nền tảng đám mây</p>
                </div>
                <div className="compare-list">
                  <div className="compare-row">
                    <CheckCircle2 size={18} className="compare-icon-good" />
                    <span>Chi phí chỉ từ vài nghìn đồng mỗi video hoàn chỉnh.</span>
                  </div>
                  <div className="compare-row">
                    <CheckCircle2 size={18} className="compare-icon-good" />
                    <span>Kết xuất video hoàn thiện chỉ trong 3 - 5 phút.</span>
                  </div>
                  <div className="compare-row">
                    <CheckCircle2 size={18} className="compare-icon-good" />
                    <span>Khóa mặt nhân vật 100%, sản xuất 20 - 50 video mỗi ngày dễ dàng.</span>
                  </div>
                  <div className="compare-row">
                    <CheckCircle2 size={18} className="compare-icon-good" />
                    <span>Tích hợp sẵn 22+ giọng đọc AI tiếng Việt và kho nhạc nền miễn phí bản quyền.</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── PRICING SECTION ── */}
        <section className="section" id="pricing" aria-labelledby="pricing-title">
          <div className="container">
            <div className="section-header">
              <span className="section-tag">Bảng Giá Dịch Vụ</span>
              <h2 id="pricing-title" className="section-title">
                Gói Đầu Tư Linh Hoạt Cho Mọi Quy Mô
              </h2>
              <p className="section-desc">
                Bắt đầu hoàn toàn miễn phí không cần thẻ thanh toán. Nâng cấp khi bạn cần tạo video chất lượng cao và số lượng lớn.
              </p>
            </div>

            <div className="pricing-grid">
              {/* Plan 1: Free Trial */}
              <div className="price-card">
                <h3 className="price-plan-name">Trải Nghiệm</h3>
                <p className="price-plan-desc">Dành cho cá nhân muốn khám phá sức mạnh của AI Veo 3.1</p>
                <div className="price-figure">
                  <span className="price-amount">0đ</span>
                  <span className="price-period">/ 24h trải nghiệm</span>
                </div>
                <div className="price-perks">
                  <div className="perk-item">
                    <Check size={16} className="perk-icon" />
                    <span>Dùng thử model Veo 3.1 Lite</span>
                  </div>
                  <div className="perk-item">
                    <Check size={16} className="perk-icon" />
                    <span>Viết kịch bản phân cảnh tự động</span>
                  </div>
                  <div className="perk-item">
                    <Check size={16} className="perk-icon" />
                    <span>Tải video độ phân giải tiêu chuẩn</span>
                  </div>
                  <div className="perk-item">
                    <Check size={16} className="perk-icon" />
                    <span>Hỗ trợ cộng đồng Telegram</span>
                  </div>
                </div>
                <a href={registerHref} className="btn btn-ghost btn-lg" style={{ width: '100%' }}>
                  Bắt Đầu Miễn Phí
                </a>
              </div>

              {/* Plan 2: Creator Pro (Featured) */}
              <div className="price-card featured">
                <span className="featured-pill">Phổ Biến Nhất</span>
                <h3 className="price-plan-name">Creator Pro</h3>
                <p className="price-plan-desc">Lựa chọn hàng đầu cho TikTok Creator, Affiliate & Người bán hàng</p>
                <div className="price-figure">
                  <span className="price-amount">249.000đ</span>
                  <span className="price-period">/ tháng</span>
                </div>
                <div className="price-perks">
                  <div className="perk-item">
                    <Check size={16} className="perk-icon" />
                    <span>Tạo video không giới hạn với Veo 3.1 Fast</span>
                  </div>
                  <div className="perk-item">
                    <Check size={16} className="perk-icon" />
                    <span><b>Mở khóa Face-Lock</b> khóa mặt nhân vật 100%</span>
                  </div>
                  <div className="perk-item">
                    <Check size={16} className="perk-icon" />
                    <span>Mở khóa 22+ giọng đọc AI tiếng Việt Bắc & Nam</span>
                  </div>
                  <div className="perk-item">
                    <Check size={16} className="perk-icon" />
                    <span>Xuất video Full HD 1080p không dính watermark</span>
                  </div>
                  <div className="perk-item">
                    <Check size={16} className="perk-icon" />
                    <span>Toàn quyền thương mại hóa video sản xuất</span>
                  </div>
                </div>
                <a href={registerHref} className="btn btn-primary btn-lg" style={{ width: '100%' }}>
                  Nâng Cấp Creator Pro
                </a>
              </div>

              {/* Plan 3: Studio Agency */}
              <div className="price-card">
                <h3 className="price-plan-name">Studio Agency</h3>
                <p className="price-plan-desc">Dành cho Media Agency, Đạo diễn phim ngắn và Đội ngũ chuyên nghiệp</p>
                <div className="price-figure">
                  <span className="price-amount">599.000đ</span>
                  <span className="price-period">/ tháng</span>
                </div>
                <div className="price-perks">
                  <div className="perk-item">
                    <Check size={16} className="perk-icon" />
                    <span>Tất cả quyền lợi của gói Creator Pro</span>
                  </div>
                  <div className="perk-item">
                    <Check size={16} className="perk-icon" />
                    <span>Hàng đợi ưu tiên render VIP siêu tốc</span>
                  </div>
                  <div className="perk-item">
                    <Check size={16} className="perk-icon" />
                    <span>Xuất video chất lượng 4K Ultra-HD 60fps</span>
                  </div>
                  <div className="perk-item">
                    <Check size={16} className="perk-icon" />
                    <span>Lưu trữ đám mây 100GB cho dự án</span>
                  </div>
                  <div className="perk-item">
                    <Check size={16} className="perk-icon" />
                    <span>Hỗ trợ kỹ thuật 1-1 chuyên sâu qua Zalo/Telegram</span>
                  </div>
                </div>
                <a href={registerHref} className="btn btn-ghost btn-lg" style={{ width: '100%' }}>
                  Đăng Ký Studio
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* ── FAQ SECTION ── */}
        <section className="section" id="faq" aria-labelledby="faq-title">
          <div className="container">
            <div className="section-header">
              <span className="section-tag">Hỏi & Đáp</span>
              <h2 id="faq-title" className="section-title">
                Những Câu Hỏi Thường Gặp
              </h2>
              <p className="section-desc">
                Mọi thông tin bạn cần biết về nền tảng làm phim AI AutoCut Studio.
              </p>
            </div>

            <div className="faq-wrap">
              {FAQ_ITEMS.map((item, idx) => (
                <div key={idx} className={`faq-item ${openFaq === idx ? 'open' : ''}`}>
                  <button
                    type="button"
                    className="faq-question"
                    onClick={() => toggleFaq(idx)}
                    aria-expanded={openFaq === idx}
                  >
                    <span>{item.q}</span>
                    <ChevronDown size={18} className="faq-chevron" />
                  </button>
                  {openFaq === idx && (
                    <div className="faq-answer">
                      {item.a}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── CTA BANNER ── */}
        <section className="cta-section">
          <div className="container">
            <div className="cta-box">
              <h2 className="cta-title">
                Sẵn Sàng Sáng Tạo Thước Phim Đầu Tiên?
              </h2>
              <p className="cta-desc">
                Tham gia cùng hơn 10,000+ nhà sáng tạo nội dung, đạo diễn và doanh nghiệp đang tối ưu hóa sản xuất video mỗi ngày với AI AutoCut Studio.
              </p>
              <a href={registerHref} className="btn btn-primary btn-lg">
                <Sparkles size={16} />
                <span>Bắt Đầu Làm Phim Miễn Phí (0Đ)</span>
                <ArrowRight size={16} />
              </a>
            </div>
          </div>
        </section>
      </main>

      {/* ── FOOTER ── */}
      <footer className="footer" role="contentinfo">
        <div className="container">
          <div className="footer-grid">
            <div>
              <a href="#" className="brand">
                <span className="brand-logo"><Logo /></span>
                <span>AI AutoCut</span>
                <span className="brand-badge">STUDIO</span>
              </a>
              <p className="footer-brand-desc">
                Studio làm phim và tạo video AI đa phân cảnh chuyên nghiệp. Tự động hóa từ kịch bản, giữ mặt nhân vật đến kết xuất video 4K sắc nét.
              </p>
            </div>

            <div>
              <h4 className="footer-col-title">Sản Phẩm</h4>
              <div className="footer-link-list">
                <a href="#showcase" className="footer-link">Trường Quay AI</a>
                <a href="#features" className="footer-link">Khóa Mặt Face-Lock</a>
                <a href="#features" className="footer-link">Lồng Tiếng Việt AI</a>
                <a href="#showreel" className="footer-link">Bộ Sưu Tập Mẫu</a>
              </div>
            </div>

            <div>
              <h4 className="footer-col-title">Tài Nguyên</h4>
              <div className="footer-link-list">
                <a href="#pipeline" className="footer-link">Quy Trình Tạo Video</a>
                <a href="#pricing" className="footer-link">Bảng Giá Gói Dịch Vụ</a>
                <a href="#faq" className="footer-link">Câu Hỏi Thường Gặp</a>
                <a href={loginHref} className="footer-link">Đăng Nhập Tài Khoản</a>
              </div>
            </div>

            <div>
              <h4 className="footer-col-title">Liên Hệ & Hỗ Trợ</h4>
              <div className="footer-link-list">
                <a href="https://t.me/thaidem57" target="_blank" rel="noopener noreferrer" className="footer-link">Telegram: @thaidem57</a>
                <a href="https://zalo.me/0366566303" target="_blank" rel="noopener noreferrer" className="footer-link">Zalo Hỗ Trợ: 0366566303</a>
                <a href="mailto:support@aiautocut.com" className="footer-link">support@aiautocut.com</a>
                <span className="footer-link">Hà Nội & TP. Hồ Chí Minh</span>
              </div>
            </div>
          </div>

          <div className="footer-bottom">
            <div>© {new Date().getFullYear()} AI AutoCut Studio. Bản quyền thuộc về AI AutoCut.</div>
            <div style={{ display: 'flex', gap: 20 }}>
              <a href="#" className="footer-link">Điều khoản dịch vụ</a>
              <a href="#" className="footer-link">Chính sách bảo mật</a>
              <a href="#" className="footer-link">Bản quyền thương mại</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
