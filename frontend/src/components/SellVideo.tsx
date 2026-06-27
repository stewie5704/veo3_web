import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { toolsApi, charactersApi, projectsApi } from '../api/client'
import { pushLog } from '../pages/Dashboard'
import { Plus, Loader2, ShoppingBag, AlertCircle } from 'lucide-react'

const GEN_MODELS = [
  { key: 'veo_3_1_t2v_lite_low_priority', label: 'Lite (Lower Priority) — FREE' },
  { key: 'veo_3_1_t2v_lite', label: 'Lite — 5💎/cảnh' },
  { key: 'veo_3_1_t2v_fast_portrait_ultra', label: 'Fast — 10💎/cảnh' },
  { key: 'veo_3_1_t2v_portrait', label: 'Quality — 100💎/cảnh' },
]
const SELL_SCENES = [
  { v: 'street', label: '🏙️ Đường phố', vi: 'trên phố ban ngày' },
  { v: 'studio', label: '🎬 Studio', vi: 'trong studio sáng' },
  { v: 'cafe', label: '☕ Quán cafe', vi: 'ở quán cafe' },
  { v: 'home', label: '🏠 Tại nhà', vi: 'tại nhà' },
]
const SELL_TONES = [
  { v: 'ugc', label: '📱 UGC quay tay', vi: 'quay tay tự nhiên, đời thường' },
  { v: 'young', label: '✨ Trẻ trung', vi: 'trẻ trung, năng lượng' },
  { v: 'lux', label: '💎 Sang xịn', vi: 'sang xịn, tinh tế' },
  { v: 'fun', label: '😄 Hài hước', vi: 'vui nhộn, hài hước' },
]
const secLbl: React.CSSProperties = { fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 8 }

/** Video bán hàng: ảnh sản phẩm (+ KOL) -> dự án NHIỀU CẢNH nối khung (chain), giữ nhân vật/giọng/sản phẩm. */
export default function SellVideo() {
  const nav = useNavigate()
  const [error, setError] = useState('')
  const [product, setProduct] = useState<File | null>(null)
  const [productPrev, setProductPrev] = useState<string | null>(null)
  const [kol, setKol] = useState<File | null>(null)
  const [kolPrev, setKolPrev] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [idea, setIdea] = useState('')
  const [scene, setScene] = useState('street')
  const [tone, setTone] = useState('ugc')
  const [sceneCount, setSceneCount] = useState(5)
  const [dur, setDur] = useState(8)
  const [lang, setLang] = useState('vi')
  const [model, setModel] = useState(GEN_MODELS[0].key)
  const [showAdv, setShowAdv] = useState(false)
  const [link, setLink] = useState('')
  const [linkLoading, setLinkLoading] = useState(false)
  const [loading, setLoading] = useState(false)
  const prodRef = useRef<HTMLInputElement>(null)
  const kolRef = useRef<HTMLInputElement>(null)

  async function importFromLink() {
    const u = link.trim()
    if (!u) return
    setError(''); setLinkLoading(true)
    try {
      const res = await toolsApi.productFromLink(u)
      const r = await fetch(res.image_url)
      if (!r.ok) throw new Error('img')
      const blob = await r.blob()
      if (!blob.type.startsWith('image/')) throw new Error('not-image')
      const ext = blob.type.includes('png') ? 'png' : blob.type.includes('webp') ? 'webp' : 'jpg'
      setProduct(new File([blob], `product.${ext}`, { type: blob.type }))
      setProductPrev(res.image_url)
      if (res.title && !name.trim()) setName(res.title)
      setLink('')
    } catch (e: any) {
      setError(e?.response?.data?.detail || 'Không lấy được ảnh từ link. Hãy upload ảnh thủ công.')
    } finally { setLinkLoading(false) }
  }

  function buildIdea(prodTag: string, kolTag: string): string {
    const sc = SELL_SCENES.find(s => s.v === scene)?.vi || ''
    const to = SELL_TONES.find(t => t.v === tone)?.vi || ''
    const who = kolTag ? `@${kolTag}` : 'một người mẫu thân thiện'
    const base =
      `Video bán hàng tiếp thị liên kết cho sản phẩm @${prodTag}${name.trim() ? ` (${name.trim()})` : ''}. ` +
      `${who} cầm/mặc/dùng và khoe @${prodTag} một cách tự nhiên ${sc}, tông ${to}. ` +
      `Mỗi cảnh NỐI TIẾP mạch lạc, GIỮ NGUYÊN cùng một người, cùng giọng nói và đúng sản phẩm xuyên suốt. ` +
      `Kết bằng lời kêu gọi mua hàng (CTA).`
    return idea.trim() ? `${base} Ý tưởng thêm: ${idea.trim()}` : base
  }

  async function doSell() {
    if (!product) { setError('Cần ảnh sản phẩm'); return }
    const MODEL_COST: Record<string, number> = {
      veo_3_1_t2v_lite_low_priority: 0, veo_3_1_t2v_lite: 5,
      veo_3_1_t2v_fast_portrait_ultra: 10, veo_3_1_t2v_portrait: 100,
    }
    const cost = (MODEL_COST[model] || 0) * sceneCount
    if (cost > 0 && !window.confirm(`Tạo ${sceneCount} cảnh bằng model trả phí — tốn khoảng ${cost} 💎. Tiếp tục?`)) return
    setError(''); setLoading(true)
    try {
      pushLog('Đang dựng video bán hàng nhiều cảnh...')
      // 1) Lưu sản phẩm (+ KOL) thành nhân vật -> đính ref MỌI cảnh = đồng nhất sản phẩm/mặt
      const prodTag = ((name.trim() || 'SanPham').replace(/[^\p{L}\p{N}]+/gu, '').slice(0, 20)) || 'SanPham'
      const prodChar = await charactersApi.add(prodTag, product)
      const ids: string[] = [prodChar.id]
      let kolTag = ''
      if (kol) { const k = await charactersApi.add('KOL', kol); ids.push(k.id); kolTag = k.name }
      // 2) AI viết kịch bản NHIỀU CẢNH (sản phẩm + KOL + bối cảnh + tông), đúng ngôn ngữ
      const ideaText = buildIdea(prodChar.name, kolTag)
      const res = await toolsApi.autoprompt({ idea: ideaText, scene_count: sceneCount, language: lang, aspect_ratio: '9:16' })
      const scns: any[] = res.scenes || []
      const prompts = scns.length ? scns.map(s => s.prompt || s.image || '') : (res.prompts || [])
      const narrations = scns.length
        ? scns.map(s => ((s.speaker || '').trim() ? `${s.speaker}: ` : '') + (s.dialogue || ''))
        : (res.narrations || [])
      if (!prompts.length) throw new Error('AI chưa viết được kịch bản, thử lại.')
      // 3) Tạo dự án: chain (nối khung mượt) + ref ảnh giữ mặt/sản phẩm + voiceover (giọng nhất quán)
      const proj = await projectsApi.create({
        name: `Bán hàng: ${name.trim() || 'sản phẩm'}`,
        idea: ideaText, model_key: model, aspect_ratio: '9:16',
        duration_seconds: dur, language: lang,
        prompts, narrations, auto_render: true, chain_mode: true,
        character_ids: ids, character_bible: res.characters || [],
        audio_mode: 'voiceover',
      })
      pushLog(`Đã tạo video bán hàng: ${proj.name}`)
      nav(`/projects/${proj.id}`)
    } catch (e: any) {
      setError(e?.response?.data?.detail || e?.message || 'Tạo video bán hàng thất bại')
      setLoading(false)
    }
  }

  return (
    <div className="card" style={{ maxWidth: 760, margin: '0 auto' }}>
      <div className="card-header"><ShoppingBag size={15} /> Video bán hàng
        <small>Ảnh sản phẩm (+ KOL) → video NHIỀU CẢNH nối mượt cho TikTok Shop (dọc 9:16)</small></div>

      {error && <div className="alert alert-error" style={{ marginBottom: 14 }}><AlertCircle size={15} /> {error}</div>}

      {/* Link sản phẩm */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        <input className="form-input" style={{ flex: 1, minWidth: 200 }}
          placeholder="Dán link sản phẩm (Shopee / TikTok Shop / Lazada) — tự lấy ảnh"
          value={link} onChange={e => setLink(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); importFromLink() } }} />
        <button className="btn btn-ghost btn-sm" onClick={importFromLink} disabled={linkLoading || !link.trim()}>
          {linkLoading ? <><Loader2 size={13} className="spin" /> Đang lấy...</> : <>🔗 Lấy ảnh</>}
        </button>
      </div>

      {/* Ảnh + tên */}
      <div style={{ display: 'flex', gap: 14, alignItems: 'flex-end', marginBottom: 16, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 6, fontWeight: 600 }}>Sản phẩm <span style={{ color: 'var(--accent2)' }}>*</span></div>
          <label className="img-add" title="Ảnh sản phẩm (bắt buộc)">
            {productPrev ? <img src={productPrev} alt="" /> : <Plus size={22} />}
            <input ref={prodRef} type="file" accept="image/*" style={{ display: 'none' }}
              onChange={e => { const f = e.target.files?.[0] || null; setProduct(f); setProductPrev(f ? URL.createObjectURL(f) : null) }} />
          </label>
        </div>
        <div>
          <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 6, fontWeight: 600 }}>KOL <span style={{ fontWeight: 400 }}>(tùy chọn)</span></div>
          <label className="img-add" title="Ảnh KOL / người mẫu (tùy chọn)">
            {kolPrev ? <img src={kolPrev} alt="" /> : <Plus size={22} />}
            <input ref={kolRef} type="file" accept="image/*" style={{ display: 'none' }}
              onChange={e => { const f = e.target.files?.[0] || null; setKol(f); setKolPrev(f ? URL.createObjectURL(f) : null) }} />
          </label>
        </div>
        <input className="form-input" style={{ flex: 1, minWidth: 180 }} placeholder="Sản phẩm là gì? (vd: áo sweater oversize)"
          value={name} onChange={e => setName(e.target.value)} />
      </div>

      {/* Ý tưởng (tùy chọn) */}
      <div style={{ marginBottom: 16 }}>
        <div style={secLbl}>Ý tưởng / điểm nhấn <span style={{ textTransform: 'none', fontWeight: 400 }}>(tùy chọn — AI tự viết kịch bản nhiều cảnh)</span></div>
        <textarea className="form-textarea" rows={2} style={{ minHeight: 'auto' }}
          value={idea} onChange={e => setIdea(e.target.value)}
          placeholder="VD: nhấn mạnh chất vải dày dặn, giá sốc 199k, freeship… (để trống cũng được)" />
      </div>

      {/* Bối cảnh / Tông / Ngôn ngữ */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 14 }}>
        <div className="form-group" style={{ marginBottom: 0 }}><label className="form-label">Bối cảnh</label>
          <select className="form-select" value={scene} onChange={e => setScene(e.target.value)}>
            {SELL_SCENES.map(s => <option key={s.v} value={s.v}>{s.label}</option>)}
          </select></div>
        <div className="form-group" style={{ marginBottom: 0 }}><label className="form-label">Tông video</label>
          <select className="form-select" value={tone} onChange={e => setTone(e.target.value)}>
            {SELL_TONES.map(t => <option key={t.v} value={t.v}>{t.label}</option>)}
          </select></div>
        <div className="form-group" style={{ marginBottom: 0 }}><label className="form-label">Ngôn ngữ</label>
          <select className="form-select" value={lang} onChange={e => setLang(e.target.value)}>
            <option value="vi">🇻🇳 Tiếng Việt</option>
            <option value="en">🇺🇸 English</option>
          </select></div>
      </div>

      {/* Số cảnh / Thời lượng */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
        <div className="form-group" style={{ marginBottom: 0 }}><label className="form-label">Số cảnh</label>
          <div className="stepper">
            <button type="button" onClick={() => setSceneCount(c => Math.max(1, c - 1))}>−</button>
            <input type="number" min={1} max={20} value={sceneCount}
              onChange={e => setSceneCount(Math.min(20, Math.max(1, +e.target.value || 1)))} />
            <button type="button" onClick={() => setSceneCount(c => Math.min(20, c + 1))}>+</button>
          </div>
        </div>
        <div className="form-group" style={{ marginBottom: 0 }}><label className="form-label">Thời lượng / cảnh</label>
          <select className="form-select" value={dur} onChange={e => setDur(+e.target.value)}>
            {[4, 6, 8, 10].map(d => <option key={d} value={d}>{d}s</option>)}
          </select>
        </div>
      </div>

      {/* Tùy chọn nâng cao (model) */}
      <button onClick={() => setShowAdv(v => !v)}
        style={{ background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', fontSize: 12, fontWeight: 600, padding: '4px 0', display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: showAdv ? 10 : 14 }}>
        ⚙ Tùy chọn (chất lượng) {showAdv ? '▴' : '▾'}
      </button>
      {showAdv && (
        <div className="form-group" style={{ marginBottom: 14 }}>
          <label className="form-label">Chất lượng (FREE = không tốn Gem)</label>
          <select className="form-select" value={model} onChange={e => setModel(e.target.value)}>
            {GEN_MODELS.map(m => <option key={m.key} value={m.key}>{m.label}</option>)}
          </select>
        </div>
      )}

      <div style={{ fontSize: 11.5, color: 'var(--text3)', marginBottom: 14, lineHeight: 1.55 }}>
        💡 Các cảnh <b>nối khung</b> (frame cuối cảnh trước = đầu cảnh sau) cho mượt; <b>giữ nguyên</b> người, giọng nói &amp; sản phẩm xuyên suốt. Tạo xong sẽ mở trang dự án để xem từng cảnh + ghép thành 1 video.
      </div>

      <button className="btn btn-primary" style={{ width: '100%' }} onClick={doSell} disabled={loading || !product}>
        {loading ? <><Loader2 size={14} className="spin" /> Đang viết kịch bản &amp; tạo...</> : <><ShoppingBag size={14} /> Tạo video bán hàng ({sceneCount} cảnh)</>}
      </button>
    </div>
  )
}
