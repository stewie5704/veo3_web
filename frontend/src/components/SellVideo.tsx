import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { toolsApi, charactersApi, projectsApi } from '../api/client'
import { pushLog } from '../pages/Dashboard'
import DownloadMenu from './DownloadMenu'
import { Plus, Loader2, Sparkles, ShoppingBag, AlertCircle, Film, ExternalLink } from 'lucide-react'

const GEN_MODELS = [
  { key: 'veo_3_1_t2v_lite_low_priority', label: 'Lite (Lower Priority) — FREE' },
  { key: 'veo_3_1_t2v_lite', label: 'Lite — 5💎/cảnh' },
  { key: 'veo_3_1_t2v_fast_portrait_ultra', label: 'Fast — 10💎/cảnh' },
  { key: 'veo_3_1_t2v_portrait', label: 'Quality — 100💎/cảnh' },
]
const SELL_SCENES = [
  { v: 'street', label: '🏙️ Đường phố' }, { v: 'studio', label: '🎬 Studio' },
  { v: 'cafe', label: '☕ Quán cafe' }, { v: 'home', label: '🏠 Tại nhà' },
]
const SELL_TONES = [
  { v: 'ugc', label: '📱 UGC quay tay' }, { v: 'young', label: '✨ Trẻ trung' },
  { v: 'lux', label: '💎 Sang xịn' }, { v: 'fun', label: '😄 Hài hước' },
]
const VOICES = [
  { v: 'Kore', label: 'Nữ · Kore' }, { v: 'Aoede', label: 'Nữ · Aoede' },
  { v: 'Puck', label: 'Nam · Puck' }, { v: 'Charon', label: 'Nam · Charon' },
]
const MODEL_COST: Record<string, number> = {
  veo_3_1_t2v_lite_low_priority: 0, veo_3_1_t2v_lite: 5,
  veo_3_1_t2v_fast_portrait_ultra: 10, veo_3_1_t2v_portrait: 100,
}
const SCENE_VI: Record<string, string> = { street: 'trên phố', studio: 'trong studio', cafe: 'ở quán cafe', home: 'tại nhà' }
const TONE_VI: Record<string, string> = { ugc: 'UGC quay tay tự nhiên', young: 'trẻ trung', lux: 'sang xịn', fun: 'hài hước' }

/** Video bán hàng: ảnh sản phẩm (+ KOL) -> dự án NHIỀU CẢNH nối khung, tự ghép; QUEUE + kết quả ngay trên tab này. */
export default function SellVideo() {
  const nav = useNavigate()
  const [error, setError] = useState('')

  // Hàng chờ video bán hàng (dự án) — ở lại tab, không nhảy đi
  const [sellIds, setSellIds] = useState<string[]>(() => { try { return JSON.parse(localStorage.getItem('aiac_sell_ids') || '[]') } catch { return [] } })
  const [sellData, setSellData] = useState<Record<string, any>>({})
  const saveIds = (ids: string[]) => { try { localStorage.setItem('aiac_sell_ids', JSON.stringify(ids.slice(0, 30))) } catch { /* ignore */ } }
  const loadSell = async () => {
    if (!sellIds.length) return
    const entries = await Promise.all(sellIds.map(id => projectsApi.get(id).then(p => [id, p] as const).catch(() => [id, null] as const)))
    const map: Record<string, any> = {}
    for (const [id, p] of entries) if (p) map[id] = p
    setSellData(map)
  }
  useEffect(() => { loadSell() }, [sellIds])
  useEffect(() => {
    const active = sellIds.some(id => { const p = sellData[id]; return p && !p.merged_file })
    if (!active) return
    const t = setInterval(loadSell, 6000)
    return () => clearInterval(t)
  }, [sellData, sellIds])

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
  const [voice, setVoice] = useState('Kore')
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

  function suggestIdea() {
    setIdea(`Khoe ${name.trim() || 'sản phẩm'} ${SCENE_VI[scene]}, tông ${TONE_VI[tone]}: mở bằng hook bắt mắt, nêu 2-3 điểm nổi bật (chất liệu / giá / ưu đãi), kết bằng lời kêu gọi mua ở giỏ hàng.`)
  }

  async function doSell() {
    if (!product) { setError('Cần ảnh sản phẩm'); return }
    const cost = (MODEL_COST[model] || 0) * sceneCount
    if (cost > 0 && !window.confirm(`Tạo ${sceneCount} cảnh bằng model trả phí — tốn khoảng ${cost} 💎. Tiếp tục?`)) return
    setError(''); setLoading(true)
    try {
      pushLog(`🛍️ Video bán hàng: đang upload ảnh + viết kịch bản ${sceneCount} cảnh...`)
      // 1) Lưu sản phẩm (+ KOL) thành nhân vật -> ref MỌI cảnh = giữ ĐÚNG sản phẩm/mặt (ảnh quyết định diện mạo)
      const prodTag = ((name.trim() || 'SanPham').replace(/[^\p{L}\p{N}]+/gu, '').slice(0, 20)) || 'SanPham'
      const prodChar = await charactersApi.add(prodTag, product)
      const ids: string[] = [prodChar.id]
      if (kol) { const k = await charactersApi.add('KOL', kol); ids.push(k.id) }
      // 2) Kịch bản nhiều cảnh TRUNG TÍNH (không tả giới tính -> hết bug nam ra nữ)
      const sres = await toolsApi.sellScript({ product: name.trim(), scene, tone, scene_count: sceneCount, language: lang, has_kol: !!kol })
      const scns: any[] = sres.scenes || []
      const extra = idea.trim() ? ` ${idea.trim()}` : ''
      const prompts = scns.map(s => (s.prompt || '') + extra)
      const narrations = scns.map(s => s.narration || '')
      if (!prompts.length) throw new Error('AI chưa viết được kịch bản, thử lại.')
      pushLog(`📝 Đã có kịch bản ${prompts.length} cảnh — đang đưa lên hàng chờ render...`)
      // 3) Tạo dự án: chain (nối khung) + ref ảnh (giữ mặt/sản phẩm) + voice cố định (giọng nhất quán) + tự ghép
      const proj = await projectsApi.create({
        name: `Bán hàng: ${name.trim() || 'sản phẩm'}`,
        idea: idea.trim() || `Video bán hàng ${name.trim() || 'sản phẩm'}`,
        model_key: model, aspect_ratio: '9:16', duration_seconds: dur, language: lang,
        prompts, narrations, auto_render: true, chain_mode: true,
        character_ids: ids, character_bible: [],
        audio_mode: 'voiceover', voice,
      })
      pushLog(`✅ Đã đưa "${proj.name}" vào hàng chờ — đang render & sẽ tự ghép thành 1 video.`)
      const next = [proj.id, ...sellIds.filter(x => x !== proj.id)]
      setSellIds(next); saveIds(next)
      // reset ảnh cho lần tạo tiếp
      setProduct(null); setProductPrev(null); setKol(null); setKolPrev(null)
      if (prodRef.current) prodRef.current.value = ''
      if (kolRef.current) kolRef.current.value = ''
    } catch (e: any) {
      const m = e?.response?.data?.detail || e?.message || 'Tạo video bán hàng thất bại'
      setError(m); pushLog(`❌ ${m}`, 'error')
    } finally { setLoading(false) }
  }

  const renderSellCard = (id: string) => {
    const p = sellData[id]
    if (!p) return (
      <div key={id} className="video-card"><div className="video-preview"><div className="scene-ph shimmer" style={{ width: '100%', height: '100%' }}><div className="scene-ph-orb wait"><Loader2 size={20} className="spin" /></div><span>Đang tải...</span></div></div></div>
    )
    const scenes: any[] = p.scenes || []
    const done = scenes.filter(s => s.status === 'done').length
    const total = scenes.length || p.scene_count || 0
    const failed = scenes.some(s => s.status === 'failed')
    return (
      <div key={id} className="video-card">
        <div className="video-preview" style={{ position: 'relative' }}>
          {p.merged_file ? (
            <video src={`/uploads/${p.merged_file}`} controls preload="metadata"
              onLoadedMetadata={e => { const v = e.currentTarget; const par = v.parentElement; if (par && v.videoWidth && v.videoHeight) par.style.aspectRatio = `${v.videoWidth} / ${v.videoHeight}` }}
              style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block', background: '#0a0807' }} />
          ) : (
            <div className={`scene-ph${!failed ? ' shimmer' : ''}`} style={{ width: '100%', height: '100%' }}>
              {failed ? <><div className="scene-ph-orb fail"><AlertCircle size={20} /></div><span style={{ fontSize: 11, color: '#fca5a5' }}>Có cảnh lỗi</span></>
                : <><div className="scene-ph-orb run"><Loader2 size={20} className="spin" /></div>
                  <span>{done < total ? `Đang tạo ${done}/${total} cảnh` : 'Đang ghép video...'}</span></>}
            </div>
          )}
        </div>
        <div className="video-card-body">
          <div className="video-card-prompt">🛍️ {p.name}</div>
          <div style={{ display: 'flex', gap: 6, marginTop: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            {p.merged_file
              ? <DownloadMenu base={`/projects/${id}/download-merged`} filename="video_ban_hang.mp4" />
              : <span style={{ fontSize: 11.5, color: 'var(--text3)' }}>{done}/{total} cảnh xong</span>}
            <button className="btn btn-ghost btn-sm" title="Mở dự án (xem từng cảnh)" onClick={() => nav(`/projects/${id}`)} style={{ marginLeft: 'auto' }}>
              <ExternalLink size={12} /> Mở
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="tool-flow">
      <div className="tool-feed">
        {sellIds.length === 0 ? (
          <div className="empty-state" style={{ padding: '44px 20px' }}>
            <div className="ico"><ShoppingBag size={24} color="var(--accent2)" /></div>
            <h3>Chưa có video bán hàng</h3>
            <p>Điền ảnh sản phẩm + bấm Tạo ở dưới — video nhiều cảnh sẽ render &amp; tự ghép, hiện ngay ở đây.</p>
          </div>
        ) : (
          <div className="stagger" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', gap: 14 }}>
            {sellIds.map(id => renderSellCard(id))}
          </div>
        )}
      </div>

      <div className="tool-composer">
        <div className="card" style={{ margin: 0 }}>
          <div className="card-header"><ShoppingBag size={15} /> Video bán hàng
            <small>Ảnh sản phẩm (+ KOL) → video NHIỀU CẢNH nối mượt, tự ghép (dọc 9:16)</small></div>

          {error && <div className="alert alert-error" style={{ marginBottom: 12 }}><AlertCircle size={15} /> {error}</div>}

          <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
            <input className="form-input" style={{ flex: 1, minWidth: 200 }}
              placeholder="Dán link sản phẩm (Shopee / TikTok Shop / Lazada) — tự lấy ảnh"
              value={link} onChange={e => setLink(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); importFromLink() } }} />
            <button className="btn btn-ghost btn-sm" onClick={importFromLink} disabled={linkLoading || !link.trim()}>
              {linkLoading ? <><Loader2 size={13} className="spin" /> Đang lấy...</> : <>🔗 Lấy ảnh</>}
            </button>
          </div>

          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', marginBottom: 10, flexWrap: 'wrap' }}>
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
            <div style={{ flex: 1, minWidth: 220 }}>
              <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 6, fontWeight: 600 }}>Ý tưởng / điểm nhấn <span style={{ fontWeight: 400 }}>(tùy chọn)</span></div>
              <div style={{ position: 'relative' }}>
                <textarea className="form-textarea" rows={2} style={{ minHeight: 'auto' }}
                  value={idea} onChange={e => setIdea(e.target.value)}
                  placeholder="VD: chất vải dày dặn, giá sốc 199k, freeship… hoặc bấm “Trợ lý viết”." />
                <button className="btn btn-primary btn-sm" style={{ position: 'absolute', right: 8, bottom: 8 }} onClick={suggestIdea}>
                  <Sparkles size={13} /> Trợ lý viết
                </button>
              </div>
            </div>
          </div>

          <input className="form-input" style={{ width: '100%', marginBottom: 10 }} placeholder="Sản phẩm là gì? (vd: áo sweater oversize) — giúp AI viết sát hơn"
            value={name} onChange={e => setName(e.target.value)} />

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 10 }}>
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

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr 1fr', gap: 10, marginBottom: 10 }}>
            <div className="form-group" style={{ marginBottom: 0 }}><label className="form-label">Số cảnh</label>
              <div className="stepper">
                <button type="button" onClick={() => setSceneCount(c => Math.max(1, c - 1))}>−</button>
                <input type="number" min={1} max={12} value={sceneCount}
                  onChange={e => setSceneCount(Math.min(12, Math.max(1, +e.target.value || 1)))} />
                <button type="button" onClick={() => setSceneCount(c => Math.min(12, c + 1))}>+</button>
              </div>
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}><label className="form-label">Thời lượng / cảnh</label>
              <div className="seg2">
                {[4, 6, 8, 10].map(d => <button key={d} type="button" className={dur === d ? 'on' : ''} onClick={() => setDur(d)}>{d}s</button>)}
              </div>
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}><label className="form-label">Giọng đọc</label>
              <select className="form-select" value={voice} onChange={e => setVoice(e.target.value)}>
                {VOICES.map(v => <option key={v.v} value={v.v}>{v.label}</option>)}
              </select></div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
            <button onClick={() => setShowAdv(v => !v)}
              style={{ background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', fontSize: 12, fontWeight: 600, padding: '2px 0', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              ⚙ {GEN_MODELS.find(m => m.key === model)?.label || 'Chất lượng'} {showAdv ? '▴' : '▾'}
            </button>
            <span style={{ fontSize: 11, color: 'var(--text3)' }}>· nối khung · giữ người·giọng·sản phẩm · tự ghép</span>
            {showAdv && (
              <select className="form-select" style={{ flex: 1, minWidth: 180 }} value={model} onChange={e => setModel(e.target.value)}>
                {GEN_MODELS.map(m => <option key={m.key} value={m.key}>{m.label}</option>)}
              </select>
            )}
          </div>

          <button className="btn btn-primary" style={{ width: '100%' }} onClick={doSell} disabled={loading || !product}>
            {loading ? <><Loader2 size={14} className="spin" /> Đang đưa vào hàng chờ...</> : <><ShoppingBag size={14} /> Tạo video bán hàng ({sceneCount} cảnh)</>}
          </button>
        </div>
      </div>
    </div>
  )
}
