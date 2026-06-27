import { useState, useEffect, useRef } from 'react'
import { videosApi } from '../api/client'
import { pushLog } from '../pages/Dashboard'
import VideoFeed from './VideoFeed'
import { Plus, Loader2, Sparkles, ShoppingBag, AlertCircle } from 'lucide-react'

const GEN_MODELS = [
  { key: 'veo_3_1_t2v_lite_low_priority', label: 'Veo 3.1 · Lite (Lower Priority) — FREE' },
  { key: 'veo_3_1_t2v_lite', label: 'Veo 3.1 · Lite — 5💎' },
  { key: 'veo_3_1_t2v_fast_portrait_ultra', label: 'Veo 3.1 · Fast — 10💎' },
  { key: 'veo_3_1_t2v_portrait', label: 'Veo 3.1 · Quality — 100💎' },
]
const ASPECTS = [
  { v: '9:16', label: '9:16 · Dọc' },
  { v: '1:1', label: '1:1 · Vuông' },
  { v: '16:9', label: '16:9 · Ngang' },
]
const SELL_SCENES = [
  { v: 'street', label: '🏙️ Đường phố' }, { v: 'studio', label: '🎬 Studio' },
  { v: 'cafe', label: '☕ Quán cafe' }, { v: 'home', label: '🏠 Tại nhà' },
]
const SELL_TONES = [
  { v: 'ugc', label: '📱 UGC quay tay' }, { v: 'young', label: '✨ Trẻ trung' },
  { v: 'lux', label: '💎 Sang xịn' }, { v: 'fun', label: '😄 Hài hước' },
]

/** Video bán hàng: KOL + ảnh sản phẩm → video mặc/cầm sản phẩm tự nhiên (dùng r2v). Feed video ở trên. */
export default function SellVideo() {
  const [error, setError] = useState('')
  const [vidJobs, setVidJobs] = useState<any[]>([])
  const loadJobs = async () => { try { setVidJobs(await videosApi.list(60)) } catch { /* ignore */ } }
  useEffect(() => { loadJobs() }, [])
  useEffect(() => {
    if (!vidJobs.some(j => j.status === 'pending' || j.status === 'processing')) return
    const id = setInterval(loadJobs, 6000)
    return () => clearInterval(id)
  }, [vidJobs])

  const [product, setProduct] = useState<File | null>(null)
  const [productPrev, setProductPrev] = useState<string | null>(null)
  const [kol, setKol] = useState<File | null>(null)
  const [kolPrev, setKolPrev] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [scene, setScene] = useState('street')
  const [tone, setTone] = useState('ugc')
  const [prompt, setPrompt] = useState('')
  const [model, setModel] = useState(GEN_MODELS[0].key)   // FREE mặc định
  const [aspect, setAspect] = useState('9:16')            // dọc cho TikTok
  const [dur, setDur] = useState(6)
  const [loading, setLoading] = useState(false)
  const [showAdv, setShowAdv] = useState(false)
  const prodRef = useRef<HTMLInputElement>(null)
  const kolRef = useRef<HTMLInputElement>(null)

  function aiPrompt() {
    const sceneTxt: Record<string, string> = {
      street: 'on a busy city street, natural daylight',
      studio: 'in a clean bright studio with soft lighting',
      cafe: 'in a cozy cafe by the window',
      home: 'at home in soft natural window light',
    }
    const toneTxt: Record<string, string> = {
      ugc: 'authentic handheld UGC vibe, casual and real, not a studio ad',
      young: 'youthful energetic vibe, upbeat',
      lux: 'premium elegant vibe, refined',
      fun: 'playful and funny vibe',
    }
    const subj = kol ? 'the person in the reference (keep their face identical)' : 'a friendly young Vietnamese model'
    const prod = name.trim() || 'the product'
    setPrompt(
`Candid iPhone footage, ${sceneTxt[scene]}. ${subj} naturally shows and tries on the EXACT ${prod} from the product reference — keep the SAME color, pattern, print, logo and cut, do NOT alter it. They turn to show the fit, soft genuine smile, slight handheld camera shake, realistic skin texture. ${toneTxt[tone]}.
[negative] warping, morphing, altered logo or print, extra fingers, plastic skin, text artifacts`)
  }

  async function doSell() {
    if (!product) { setError('Cần ảnh sản phẩm'); return }
    if (!prompt.trim()) { setError('Nhập mô tả hoặc bấm “Trợ lý viết”'); return }
    setError(''); setLoading(true)
    try {
      const imgs = [product, kol].filter(Boolean) as File[]
      await videosApi.createR2V(imgs, { prompt, model_key: model, aspect_ratio: aspect, duration_seconds: dur })
      setProduct(null); setProductPrev(null); setKol(null); setKolPrev(null); setPrompt('')
      if (prodRef.current) prodRef.current.value = ''
      if (kolRef.current) kolRef.current.value = ''
      await loadJobs()
      pushLog('Đã gửi video bán hàng — đang tạo')
    } catch (e: any) { const m = e.response?.data?.detail || 'Lỗi'; setError(m); pushLog(m, 'error') }
    finally { setLoading(false) }
  }

  return (
    <div>
      {error && <div className="alert alert-error" style={{ marginBottom: 16 }}><AlertCircle size={15} /> {error}</div>}
      <div className="tool-flow">
        <div className="tool-feed">
          <VideoFeed jobs={vidJobs.filter(j => j.kind === 'r2v')} />
        </div>
        <div className="tool-composer">
          <div className="card" style={{ margin: 0 }}>
            <div className="card-header"><ShoppingBag size={15} /> Video bán hàng <small>Ảnh sản phẩm (+ KOL) → video mặc/cầm sản phẩm tự nhiên cho TikTok Shop</small></div>

            {/* Ảnh + mô tả — bố cục giống tool "Ảnh → Video": ảnh trái, mô tả phải */}
            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', marginBottom: 12, flexWrap: 'wrap' }}>
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
              <div style={{ flex: 1, minWidth: 240 }}>
                <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 6, fontWeight: 600 }}>Mô tả cảnh</div>
                <div style={{ position: 'relative' }}>
                  <textarea className="form-textarea" rows={3} style={{ minHeight: 'auto' }}
                    value={prompt} onChange={e => setPrompt(e.target.value)}
                    placeholder="Mô tả cảnh… hoặc bấm “Trợ lý viết” để tự khóa sản phẩm + kiểu quay tay tự nhiên." />
                  <button className="btn btn-primary btn-sm" style={{ position: 'absolute', right: 8, bottom: 8 }} onClick={aiPrompt}>
                    <Sparkles size={13} /> Trợ lý viết
                  </button>
                </div>
              </div>
            </div>

            {/* Tên sản phẩm — giúp trợ lý viết sát hơn */}
            <input className="form-input" style={{ width: '100%', marginBottom: 12 }} placeholder="Sản phẩm là gì? (vd: áo sweater oversize) — giúp trợ lý viết sát hơn"
              value={name} onChange={e => setName(e.target.value)} />

            {/* Bối cảnh + Tông — combobox cho gọn, cùng 1 hàng */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Bối cảnh</label>
                <select className="form-select" value={scene} onChange={e => setScene(e.target.value)}>
                  {SELL_SCENES.map(s => <option key={s.v} value={s.v}>{s.label}</option>)}
                </select>
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Tông video</label>
                <select className="form-select" value={tone} onChange={e => setTone(e.target.value)}>
                  {SELL_TONES.map(t => <option key={t.v} value={t.v}>{t.label}</option>)}
                </select>
              </div>
            </div>

            {/* Tùy chọn nâng cao (giấu cho đỡ ngộp — đã có mặc định FREE / 9:16 / 6s) */}
            <button onClick={() => setShowAdv(v => !v)}
              style={{ background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', fontSize: 12, fontWeight: 600, padding: '4px 0', display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: showAdv ? 12 : 18 }}>
              ⚙ Tùy chọn (chất lượng · tỉ lệ · thời lượng) {showAdv ? '▴' : '▾'}
            </button>
            {showAdv && (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 1fr', gap: 10, marginBottom: 10 }}>
                  <div className="form-group" style={{ marginBottom: 0 }}><label className="form-label">Chất lượng</label>
                    <select className="form-select" value={model} onChange={e => setModel(e.target.value)}>
                      {GEN_MODELS.map(m => <option key={m.key} value={m.key}>{m.label}</option>)}
                    </select></div>
                  <div className="form-group" style={{ marginBottom: 0 }}><label className="form-label">Tỉ lệ</label>
                    <select className="form-select" value={aspect} onChange={e => setAspect(e.target.value)}>
                      {ASPECTS.map(a => <option key={a.v} value={a.v}>{a.label}</option>)}
                    </select></div>
                  <div className="form-group" style={{ marginBottom: 0 }}><label className="form-label">Thời lượng</label>
                    <select className="form-select" value={dur} onChange={e => setDur(+e.target.value)}>
                      {[4, 6, 8].map(d => <option key={d} value={d}>{d}s</option>)}
                    </select></div>
                </div>
                <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 18, lineHeight: 1.5 }}>
                  💡 Sản phẩm trơn/ít chi tiết giữ tốt; họa tiết·chữ·logo phức tạp có thể lệch nhẹ (model free). Cần nét hơn thì chọn Quality.
                </div>
              </>
            )}

            <button className="btn btn-primary" style={{ width: '100%' }} onClick={doSell} disabled={loading || !product || !prompt.trim()}>
              {loading ? <><Loader2 size={14} className="spin" /> Đang gửi...</> : <><ShoppingBag size={14} /> Tạo video bán hàng</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
