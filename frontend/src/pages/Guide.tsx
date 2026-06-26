import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  BookOpen, Puzzle, Plug, Clapperboard, Wrench, Ratio, LifeBuoy, Download,
  Film, Layers, Image, Volume2, Scissors, Users, Sparkles, Check, AlertCircle,
} from 'lucide-react'

const SECTIONS = [
  { id: 'overview', icon: BookOpen, label: 'Tổng quan' },
  { id: 'extension', icon: Puzzle, label: 'Cài tiện ích Chrome' },
  { id: 'connect', icon: Plug, label: 'Kết nối Google Ultra' },
  { id: 'project', icon: Clapperboard, label: 'Tạo phim từ kịch bản' },
  { id: 'tools', icon: Wrench, label: 'Bộ công cụ' },
  { id: 'specs', icon: Ratio, label: 'Tỉ lệ · Chất lượng · Gem' },
  { id: 'trouble', icon: LifeBuoy, label: 'Gặp lỗi? Khắc phục' },
]

function Sec({ id, icon: Icon, title, children }: { id: string; icon: any; title: string; children: any }) {
  return (
    <section id={id} style={{ scrollMarginTop: 24, marginBottom: 30 }}>
      <h2 style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 19, fontWeight: 800, margin: '0 0 14px' }}>
        <span style={{ width: 34, height: 34, borderRadius: 9, background: 'var(--accent-dim)', display: 'grid', placeItems: 'center', flex: 'none' }}>
          <Icon size={18} color="var(--accent2)" />
        </span>
        {title}
      </h2>
      <div className="card" style={{ margin: 0 }}>{children}</div>
    </section>
  )
}

// Bước đánh số
function Step({ n, children }: { n: number; children: any }) {
  return (
    <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
      <span style={{ flex: 'none', width: 24, height: 24, borderRadius: '50%', background: 'var(--grad)', color: '#fff', fontSize: 12, fontWeight: 800, display: 'grid', placeItems: 'center' }}>{n}</span>
      <div style={{ fontSize: 13.5, lineHeight: 1.65, color: 'var(--text)', paddingTop: 1 }}>{children}</div>
    </div>
  )
}

function Note({ kind = 'info', children }: { kind?: 'info' | 'warn'; children: any }) {
  const warn = kind === 'warn'
  return (
    <div style={{
      display: 'flex', gap: 9, alignItems: 'flex-start', fontSize: 12.5, lineHeight: 1.6, marginTop: 12,
      padding: '10px 13px', borderRadius: 10,
      background: warn ? 'rgba(251,191,36,0.08)' : 'var(--accent-dim)',
      border: `1px solid ${warn ? 'rgba(251,191,36,0.3)' : 'var(--border2)'}`,
      color: 'var(--text2)',
    }}>
      <AlertCircle size={15} style={{ flex: 'none', marginTop: 1, color: warn ? 'var(--yellow)' : 'var(--accent2)' }} />
      <div>{children}</div>
    </div>
  )
}

const TOOLS = [
  { icon: Film, name: 'Ảnh → Video', desc: '1 ảnh làm khung hình đầu, video chuyển động ra từ ảnh đó.' },
  { icon: Layers, name: 'Giữ mặt → Video', desc: '1–3 ảnh nhân vật → dựng cảnh MỚI nhưng giữ đúng khuôn mặt.' },
  { icon: Image, name: 'Tạo ảnh', desc: 'Tạo ảnh AI (miễn phí trên Ultra). Bấm chip @nhân vật để giữ mặt.' },
  { icon: Volume2, name: 'Đọc thành giọng nói', desc: 'Nhập văn bản → ra file audio giọng đọc.' },
  { icon: Scissors, name: 'Cắt video', desc: 'Tách video thành đoạn theo giây, hoặc trích frame thành ảnh.' },
  { icon: Download, name: 'Tải video từ đường link', desc: 'Dán link YouTube/TikTok… → tải video về.' },
  { icon: Users, name: 'Nhân vật', desc: 'Kho ảnh nhân vật để giữ mặt, dùng lại cho mọi dự án.' },
]

export default function Guide() {
  const nav = useNavigate()
  const [searchParams] = useSearchParams()
  const sParam = searchParams.get('s')
  const [go] = useState(() => (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }))

  // Sidebar sub-item click → scroll to section
  useEffect(() => {
    if (!sParam) return
    const el = document.getElementById(sParam)
    if (el) setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80)
  }, [sParam])

  return (
    <div style={{ maxWidth: 900, margin: '0 auto' }}>
      <div className="page-header">
        <div>
          <div className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <BookOpen size={22} color="var(--accent2)" /> Hướng dẫn sử dụng
          </div>
          <div className="page-subtitle">Từ cài tiện ích → kết nối → dùng từng công cụ.</div>
        </div>
      </div>

      {/* Mục lục */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 26 }}>
        {SECTIONS.map(s => (
          <button key={s.id} onClick={() => go(s.id)} className="btn btn-ghost btn-sm">
            <s.icon size={13} /> {s.label}
          </button>
        ))}
      </div>

      <Sec id="overview" icon={BookOpen} title="Tổng quan">
        <div style={{ fontSize: 13.5, lineHeight: 1.7, color: 'var(--text2)' }}>
          AI AutoCut tạo video AI bằng <strong>Veo 3.1</strong> chạy qua tài khoản <strong>Google Ultra</strong> của bạn (qua một tiện ích Chrome làm cầu nối). Chỉ cần 3 bước:
        </div>
        <div style={{ marginTop: 14 }}>
          <Step n={1}>Cài <strong>tiện ích Chrome</strong> (extension) — phần “Cài tiện ích”.</Step>
          <Step n={2}><strong>Kết nối Google Ultra</strong> qua tiện ích.</Step>
          <Step n={3}>Vào <strong>Dự án</strong> hoặc <strong>Công cụ</strong> để tạo video.</Step>
        </div>
        <Note kind="warn">Cần dùng trên <strong>máy tính + trình duyệt Chrome</strong> (để cài tiện ích). Điện thoại chỉ xem được kết quả, không cài được tiện ích.</Note>
      </Sec>

      <Sec id="extension" icon={Puzzle} title="Cài tiện ích Chrome">
        <a href="/api/v1/extension/download" className="btn btn-primary" style={{ marginBottom: 16 }}>
          <Download size={15} /> Tải tiện ích (.zip)
        </a>
        <Step n={1}>Bấm <strong>Tải tiện ích</strong> ở trên → <strong>giải nén</strong> ra một thư mục.</Step>
        <Step n={2}>Mở Chrome, vào địa chỉ <code style={{ background: 'var(--inset)', padding: '1px 6px', borderRadius: 5 }}>chrome://extensions</code></Step>
        <Step n={3}>Bật <strong>“Chế độ dành cho nhà phát triển” (Developer mode)</strong> — công tắc ở góc trên bên phải.</Step>
        <Step n={4}>Bấm <strong>“Tải tiện ích đã giải nén” (Load unpacked)</strong> → chọn <strong>thư mục vừa giải nén</strong>.</Step>
        <Step n={5}>Tiện ích <strong>AI AutoCut</strong> hiện ra. Bấm ghim 📌 cho dễ thấy.</Step>
        <Note>Cập nhật tiện ích sau này: tải bản mới, rồi vào <code>chrome://extensions</code> bấm <strong>⟳ Reload</strong> ở tiện ích.</Note>
      </Sec>

      <Sec id="connect" icon={Plug} title="Kết nối Google Ultra">
        <Step n={1}>Đăng nhập tài khoản Google <strong>có gói Ultra</strong> (gói có Veo) tại <strong>labs.google</strong>.</Step>
        <Step n={2}>Bấm icon tiện ích AI AutoCut → nhập <strong>server</strong> (<code>https://app.aiautocut.com</code>), <strong>email + mật khẩu</strong> tài khoản app → <strong>Đăng nhập &amp; Kết nối</strong>.</Step>
        <Step n={3}>Mở <strong>1 tab Flow</strong>: <code>labs.google/fx/tools/flow</code> và <strong>để tab đó mở</strong>.</Step>
        <Step n={4}>Badge tiện ích <span style={{ color: 'var(--green)' }}>● xanh</span> = đã kết nối, sẵn sàng tạo video.</Step>
        <Note kind="warn">Token Google chỉ <strong>tự làm mới khi tab Flow đang mở</strong>. Khi render nhiều/lâu, <strong>để 1 tab Flow mở sẵn</strong> để khỏi bị “Phiên Google hết hạn” giữa chừng.</Note>
      </Sec>

      <Sec id="project" icon={Clapperboard} title="Tạo phim từ kịch bản (Dự án)">
        <div style={{ fontSize: 13.5, lineHeight: 1.7, color: 'var(--text2)', marginBottom: 12 }}>
          Vào <button className="lnk" onClick={() => nav('/projects')} style={lnk}>Dự án</button> → chọn 1 trong 3 cách:
        </div>
        <Step n={1}><strong>Tạo từ ý tưởng</strong>: gõ ý tưởng ngắn → AI tự viết kịch bản nhiều cảnh (có bước duyệt để sửa).</Step>
        <Step n={2}><strong>Tự nhập kịch bản</strong>: dán kịch bản của bạn → bấm là tạo &amp; render thẳng (bỏ bước duyệt).</Step>
        <Step n={3}><strong>Chép ý tưởng</strong>: dán link video → AI đọc lời thoại + mô tả → viết lại kịch bản tương tự.</Step>
        <div style={{ borderTop: '1px solid var(--border)', margin: '14px 0', paddingTop: 14, fontSize: 13.5, lineHeight: 1.7, color: 'var(--text2)' }}>
          <strong style={{ color: 'var(--text)' }}>Tuỳ chọn quan trọng:</strong>
          <ul style={{ margin: '8px 0 0', paddingLeft: 18 }}>
            <li><strong>Giữ mặt</strong>: thêm ảnh nhân vật → AI giữ nguyên khuôn mặt qua mọi cảnh.</li>
            <li><strong>Âm thanh</strong>: <em>Lồng tiếng (AI đọc)</em> / <em>Nhân vật tự nói (nhép miệng)</em> / <em>Không tiếng</em>.</li>
            <li>Render xong → bấm <strong>Ghép phim</strong> để nối các cảnh thành 1 video.</li>
            <li><strong>Thêm kịch bản</strong>: nối Phần 2, 3… vào cùng dự án — giữ nguyên nhân vật &amp; khuôn mặt.</li>
          </ul>
        </div>
      </Sec>

      <Sec id="tools" icon={Wrench} title="Bộ công cụ">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {TOOLS.map((t, i) => (
            <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: '11px 0', borderBottom: i < TOOLS.length - 1 ? '1px solid var(--border)' : 'none' }}>
              <span style={{ flex: 'none', width: 30, height: 30, borderRadius: 8, background: 'var(--inset)', display: 'grid', placeItems: 'center' }}><t.icon size={15} color="var(--accent2)" /></span>
              <div>
                <div style={{ fontSize: 13.5, fontWeight: 700 }}>{t.name}</div>
                <div style={{ fontSize: 12.5, color: 'var(--text3)', marginTop: 2, lineHeight: 1.5 }}>{t.desc}</div>
              </div>
            </div>
          ))}
        </div>
        <Note>Mỗi công cụ: thao tác ở <strong>ô dưới</strong>, kết quả hiện ở <strong>phía trên</strong>. F5 vẫn giữ. Vào <button className="lnk" onClick={() => nav('/tools?t=i2v')} style={lnk}>Công cụ</button> để dùng.</Note>
      </Sec>

      <Sec id="specs" icon={Ratio} title="Tỉ lệ · Chất lượng · Gem">
        <div style={{ fontSize: 13.5, lineHeight: 1.75, color: 'var(--text2)' }}>
          <p style={{ margin: '0 0 10px' }}><strong style={{ color: 'var(--text)' }}>Tỉ lệ khung hình:</strong> Veo chỉ hỗ trợ 3 tỉ lệ thật — <strong>16:9 (ngang)</strong>, <strong>9:16 (dọc)</strong>, <strong>1:1 (vuông)</strong>.</p>
          <p style={{ margin: '0 0 10px' }}><strong style={{ color: 'var(--text)' }}>Chất lượng video:</strong></p>
          <ul style={{ margin: '0 0 10px', paddingLeft: 18 }}>
            <li><strong>Veo 3.1 · Lite (Lower Priority) — FREE</strong>: miễn phí (0 Gem) nhưng <strong>chậm</strong> (hàng ưu tiên thấp, 5–15 phút).</li>
            <li><strong>Lite / Fast / Quality / Omni Flash</strong>: tốn Gem, render nhanh hơn / đẹp hơn.</li>
          </ul>
          <p style={{ margin: 0 }}><strong style={{ color: 'var(--text)' }}>💎 Gem</strong> = credit của tài khoản Google Ultra. Model FREE không tốn Gem. Số Gem hiện ở góc trái dưới sidebar.</p>
        </div>
      </Sec>

      <Sec id="trouble" icon={LifeBuoy} title="Gặp lỗi? Khắc phục">
        <Tr q="“Extension chưa kết nối / không lấy được captcha”">
          Mở tiện ích → <strong>Đăng nhập lại</strong>, rồi mở 1 tab <code>labs.google/fx/tools/flow</code>. Badge xanh là được.
        </Tr>
        <Tr q="“Phiên Google hết hạn” (lỗi 401)">
          Mở lại tab <strong>labs.google</strong> (đảm bảo đang đăng nhập đúng tài khoản Ultra) để token tự refresh → bấm <strong>Kết nối lại</strong> trong tiện ích → bấm <strong>Tạo lại</strong> cảnh lỗi.
        </Tr>
        <Tr q="“Key Gemini đã hết hạn mức miễn phí (quota)”">
          Chỉ ảnh hưởng <strong>viết kịch bản / đọc giọng nói / tạo ảnh</strong> (không ảnh hưởng render video). Cách sửa: <strong>bật thanh toán (billing)</strong> cho key Gemini, hoặc đợi reset theo ngày, hoặc đổi key ở <button className="lnk" onClick={() => nav('/settings')} style={lnk}>Cài đặt</button>.
        </Tr>
        <Tr q="Render FREE quá lâu">
          Bình thường — model FREE là hàng ưu tiên thấp (5–15 phút). Muốn nhanh: chọn model trả phí (Fast/Quality). Nhớ <strong>để 1 tab Flow mở</strong> suốt lúc render.
        </Tr>
        <Tr q="Tạo video nhưng credit Google bị trừ?">
          Model <strong>FREE</strong> trên Ultra = <strong>0 Gem</strong> (kể cả giữ mặt / từ ảnh). Nếu bị trừ → tài khoản không phải Ultra, hoặc đã chọn model trả phí.
        </Tr>
      </Sec>

      <div style={{ textAlign: 'center', color: 'var(--text3)', fontSize: 12.5, padding: '10px 0 30px' }}>
        <Sparkles size={14} style={{ verticalAlign: -2 }} /> Còn vướng chỗ nào, nhắn đội hỗ trợ nhé.
      </div>
    </div>
  )
}

const lnk: React.CSSProperties = { background: 'none', border: 'none', color: 'var(--accent2)', fontWeight: 600, cursor: 'pointer', padding: 0, font: 'inherit', textDecoration: 'underline' }

function Tr({ q, children }: { q: string; children: any }) {
  return (
    <details style={{ borderBottom: '1px solid var(--border)', padding: '10px 0' }}>
      <summary style={{ cursor: 'pointer', fontSize: 13.5, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8, listStyle: 'none' }}>
        <Check size={14} style={{ color: 'var(--accent2)', flex: 'none' }} /> {q}
      </summary>
      <div style={{ fontSize: 13, lineHeight: 1.65, color: 'var(--text2)', marginTop: 9, paddingLeft: 22 }}>{children}</div>
    </details>
  )
}
