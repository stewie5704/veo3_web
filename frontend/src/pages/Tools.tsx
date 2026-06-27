import { useState, useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { toolsApi, charactersApi, mediaApi, videosApi } from '../api/client'
import { pushLog } from './Dashboard'
import {
  Users, Plus, Trash2, Mic, Image, Scissors, Download,
  Volume2, AlertCircle, CheckCircle, Loader2, ExternalLink,
  Upload, Sparkles, Film, Layers
} from 'lucide-react'

type ToolTab = 'chars' | 'i2v' | 'r2v' | 'tts' | 'image' | 'cut' | 'download'

const TABS = [
  { key: 'chars' as ToolTab, label: 'Nhân vật', icon: Users },
  { key: 'i2v' as ToolTab, label: 'Ảnh → Video', icon: Film },
  { key: 'r2v' as ToolTab, label: 'Giữ mặt → Video', icon: Layers },
  { key: 'tts' as ToolTab, label: 'Đọc thành giọng nói', icon: Volume2 },
  { key: 'image' as ToolTab, label: 'Tạo ảnh', icon: Image },
  { key: 'cut' as ToolTab, label: 'Cắt video', icon: Scissors },
  { key: 'download' as ToolTab, label: 'Tải video', icon: Download },
]

// Model gen video (t2v key — runner tự đổi sang i2v/r2v khi render)
const GEN_MODELS = [
  { key: 'veo_3_1_t2v_lite_low_priority', label: 'Veo 3.1 · Lite (Lower Priority) — FREE' },
  { key: 'veo_3_1_t2v_lite', label: 'Veo 3.1 · Lite — 5💎' },
  { key: 'veo_3_1_t2v_fast_portrait_ultra', label: 'Veo 3.1 · Fast — 10💎' },
  { key: 'veo_3_1_t2v_portrait', label: 'Veo 3.1 · Quality — 100💎' },
  { key: 'abra_t2v_10s', label: 'Omni Flash (10s) — 15💎' },
]
// Veo/Flow chỉ hỗ trợ 3 tỉ lệ THẬT (16:9/9:16/1:1). 4:3,3:4 sẽ bị map về ngang/dọc -> bỏ cho khỏi gây hiểu nhầm.
const ASPECTS = [
  { v: '16:9', label: '16:9 · Ngang' },
  { v: '9:16', label: '9:16 · Dọc' },
  { v: '1:1', label: '1:1 · Vuông' },
]

// Feed sản phẩm kiểu Flow: video đã/đang tạo xếp ở trên, mới nhất trước. Load từ server -> F5 vẫn còn.
function VideoFeed({ jobs }: { jobs: any[] }) {
  if (!jobs.length) return (
    <div className="empty-state" style={{ padding: '44px 20px' }}>
      <div className="ico"><Film size={24} color="var(--accent2)" /></div>
      <h3>Chưa có video nào</h3>
      <p>Tạo video đầu tiên bằng ô bên dưới — kết quả hiện ở đây, để lâu/F5 vẫn giữ.</p>
    </div>
  )
  return (
    <div className="stagger" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', gap: 14 }}>
      {jobs.map(j => {
        const file = (j.output_files || [])[0]
        return (
          <div key={j.id} className="video-card">
            <div className="video-preview" style={{ position: 'relative' }}>
              {j.hd && j.status === 'done' && file && <span className="hd-badge">HD</span>}
              {j.status === 'done' && file ? (
                <video src={`/uploads/${file}`} controls preload="metadata"
                  style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
              ) : (
                <div className={`scene-ph${j.status === 'processing' ? ' shimmer' : ''}`} style={{ width: '100%', height: '100%' }}>
                  {j.status === 'failed' ? (
                    <><div className="scene-ph-orb fail"><AlertCircle size={20} /></div>
                      <span style={{ fontSize: 11, color: '#fca5a5', textAlign: 'center', padding: '0 10px' }}>{(j.error_msg || 'Lỗi').slice(0, 70)}</span></>
                  ) : (
                    <><div className="scene-ph-orb wait"><Loader2 size={20} className="spin" /></div><span>Đang tạo...</span></>
                  )}
                </div>
              )}
            </div>
            <div className="video-card-body">
              <div className="video-card-prompt">{j.prompt}</div>
              {j.status === 'done' && file && (
                <a href={`/api/v1/videos/${j.id}/download/0`} download className="btn btn-ghost btn-sm" style={{ marginTop: 8 }}>
                  <Download size={12} /> Tải
                </a>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// Lưu kết quả tool (ảnh/audio/file) vào localStorage -> reload vẫn còn (file đã nằm trên server)
const FEED_LIMIT = 24
function loadFeed(key: string): any[] { try { return JSON.parse(localStorage.getItem('aiac_feed_' + key) || '[]') } catch { return [] } }
function saveFeed(key: string, items: any[]) { try { localStorage.setItem('aiac_feed_' + key, JSON.stringify(items.slice(0, FEED_LIMIT))) } catch { /* ignore */ } }

export default function Tools({ user }: { user: any }) {
  // Tab điều khiển bởi dropdown "Công cụ" ở sidebar qua URL ?t=...
  const [sp] = useSearchParams()
  const [tab, setTab] = useState<ToolTab>((sp.get('t') as ToolTab) || 'i2v')
  useEffect(() => { const t = sp.get('t'); if (t) setTab(t as ToolTab) }, [sp])
  const [error, setError] = useState('')

  // Character Library
  const [chars, setChars] = useState<any[]>([])
  const [charName, setCharName] = useState('')
  const [charImg, setCharImg] = useState<File | null>(null)
  const [charLoading, setCharLoading] = useState(false)
  const charImgRef = useRef<HTMLInputElement>(null)

  useEffect(() => { charactersApi.list().then(setChars) }, [])

  async function addChar() {
    if (!charName.trim() || !charImg) { setError('Nhập tên và chọn ảnh'); return }
    setError(''); setCharLoading(true)
    try {
      const c = await charactersApi.add(charName.trim(), charImg)
      setChars(cs => [...cs, c])
      setCharName(''); setCharImg(null)
      if (charImgRef.current) charImgRef.current.value = ''
      pushLog(`Đã thêm nhân vật @${charName}`)
    } catch (e: any) { setError(e.response?.data?.detail || 'Thêm thất bại') }
    finally { setCharLoading(false) }
  }

  async function delChar(id: string, name: string) {
    await charactersApi.delete(id)
    setChars(cs => cs.filter(c => c.id !== id))
    pushLog(`Đã xóa @${name}`)
  }

  // TTS
  const [ttsText, setTtsText] = useState('')
  const [ttsVoice, setTtsVoice] = useState('Kore')
  const [ttsLoading, setTtsLoading] = useState(false)
  const [ttsFeed, setTtsFeed] = useState<any[]>(() => loadFeed('tts'))

  async function doTTS() {
    if (!ttsText.trim()) return
    setError(''); setTtsLoading(true)
    pushLog('Đang tạo audio TTS...')
    try {
      const res = await toolsApi.tts({ text: ttsText, voice: ttsVoice })
      pushFeed('tts', setTtsFeed, [{ url: res.audio_url, text: ttsText, voice: ttsVoice }])
      pushLog('Tạo audio xong!')
    } catch (e: any) { const m = e.response?.data?.detail || 'Lỗi TTS'; setError(m); pushLog(m, 'error') }
    finally { setTtsLoading(false) }
  }

  // Image gen
  const [imgPrompt, setImgPrompt] = useState('')
  const [imgCount, setImgCount] = useState(1)
  const [imgAspect, setImgAspect] = useState('1:1')
  const [imgLoading, setImgLoading] = useState(false)
  const [imgFeed, setImgFeed] = useState<any[]>(() => loadFeed('img'))
  const imgPromptRef = useRef<HTMLTextAreaElement>(null)

  async function doImage() {
    if (!imgPrompt.trim()) return
    setError(''); setImgLoading(true)
    pushLog('Đang tạo ảnh AI...')
    try {
      // @Tên trong prompt -> backend tu resolve thanh anh giu mat (reference)
      const res = await toolsApi.image({ prompt: imgPrompt, count: imgCount, aspect_ratio: imgAspect })
      pushFeed('img', setImgFeed, (res.image_urls || []).map((url: string) => ({ url, prompt: imgPrompt })))
      pushLog(`Tạo xong ${res.image_urls.length} ảnh`)
    } catch (e: any) { const m = e.response?.data?.detail || 'Lỗi'; setError(m); pushLog(m, 'error') }
    finally { setImgLoading(false) }
  }

  // Cài đặt chung cho I2V/R2V
  const [genModel, setGenModel] = useState(GEN_MODELS[0].key)
  const [genAspect, setGenAspect] = useState('16:9')
  const [genDur, setGenDur] = useState(8)

  // Feed video (kiểu Flow) — load từ server nên F5/reload vẫn giữ các job đang chạy
  const [vidJobs, setVidJobs] = useState<any[]>([])
  const loadJobs = async () => { try { setVidJobs(await videosApi.list(60)) } catch { /* ignore */ } }
  useEffect(() => { loadJobs() }, [])
  useEffect(() => {
    if (!vidJobs.some(j => j.status === 'pending' || j.status === 'processing')) return
    const id = setInterval(loadJobs, 6000)   // còn job đang chạy -> tự cập nhật feed
    return () => clearInterval(id)
  }, [vidJobs])

  // Thêm item vào feed (mới nhất trước) + lưu localStorage
  function pushFeed(key: string, setter: React.Dispatch<React.SetStateAction<any[]>>, items: any[]) {
    setter(prev => { const next = [...items, ...prev].slice(0, FEED_LIMIT); saveFeed(key, next); return next })
  }

  // Ảnh → Video (I2V)
  const [i2vImg, setI2vImg] = useState<File | null>(null)
  const [i2vPreview, setI2vPreview] = useState<string | null>(null)
  const [i2vPrompt, setI2vPrompt] = useState('')
  const [i2vLoading, setI2vLoading] = useState(false)
  const i2vRef = useRef<HTMLInputElement>(null)
  async function doI2V() {
    if (!i2vImg || !i2vPrompt.trim()) { setError('Chọn ảnh + nhập mô tả chuyển động'); return }
    setError(''); setI2vLoading(true)
    try {
      await videosApi.createI2V(i2vImg, { prompt: i2vPrompt, model_key: genModel, aspect_ratio: genAspect, duration_seconds: genDur })
      setI2vImg(null); setI2vPreview(null); setI2vPrompt(''); if (i2vRef.current) i2vRef.current.value = ''
      await loadJobs()
      pushLog('Đã gửi Ảnh→Video — đang tạo')
    } catch (e: any) { const m = e.response?.data?.detail || 'Lỗi'; setError(m); pushLog(m, 'error') }
    finally { setI2vLoading(false) }
  }

  // Giữ mặt → Video (R2V)
  const [r2vImgs, setR2vImgs] = useState<File[]>([])
  const [r2vPrompt, setR2vPrompt] = useState('')
  const [r2vLoading, setR2vLoading] = useState(false)
  const r2vRef = useRef<HTMLInputElement>(null)
  async function doR2V() {
    if (!r2vImgs.length || !r2vPrompt.trim()) { setError('Chọn 1-3 ảnh nhân vật + nhập prompt'); return }
    setError(''); setR2vLoading(true)
    try {
      await videosApi.createR2V(r2vImgs, { prompt: r2vPrompt, model_key: genModel, aspect_ratio: genAspect, duration_seconds: genDur })
      setR2vImgs([]); setR2vPrompt(''); if (r2vRef.current) r2vRef.current.value = ''
      await loadJobs()
      pushLog('Đã gửi Giữ-mặt→Video — đang tạo')
    } catch (e: any) { const m = e.response?.data?.detail || 'Lỗi'; setError(m); pushLog(m, 'error') }
    finally { setR2vLoading(false) }
  }

  // Chèn @Tên vào prompt tại vị trí con trỏ (như mention)
  function insertMention(name: string) {
    const tag = `@${name} `
    const ta = imgPromptRef.current
    if (!ta) { setImgPrompt(p => (p && !p.endsWith(' ') ? p + ' ' : p) + tag); return }
    const start = ta.selectionStart ?? imgPrompt.length
    const end = ta.selectionEnd ?? start
    setImgPrompt(imgPrompt.slice(0, start) + tag + imgPrompt.slice(end))
    requestAnimationFrame(() => { ta.focus(); const pos = start + tag.length; ta.setSelectionRange(pos, pos) })
  }

  // Cut
  const [cutFile, setCutFile] = useState('')
  const [cutMode, setCutMode] = useState('split')
  const [cutSeg, setCutSeg] = useState(8)
  const [cutFps, setCutFps] = useState(1)
  const [cutLoading, setCutLoading] = useState(false)
  const [cutFeed, setCutFeed] = useState<any[]>(() => loadFeed('cut'))

  async function doCut() {
    if (!cutFile.trim()) { setError('Nhập tên file'); return }
    setError(''); setCutLoading(true)
    try {
      const res = await mediaApi.cut({ filename: cutFile, mode: cutMode, segment: cutSeg, fps: cutFps })
      pushFeed('cut', setCutFeed, [{ file: cutFile, mode: cutMode, urls: res.files }]); pushLog(`Cắt xong: ${res.count} file`)
    } catch (e: any) { const m = e.response?.data?.detail || 'Lỗi'; setError(m); pushLog(m, 'error') }
    finally { setCutLoading(false) }
  }

  // Download URL
  const [dlUrl, setDlUrl] = useState('')
  const [dlLoading, setDlLoading] = useState(false)
  const [dlFeed, setDlFeed] = useState<any[]>(() => loadFeed('dl'))

  async function doDownload() {
    if (!dlUrl.trim()) { setError('Nhập URL'); return }
    setError(''); setDlLoading(true)
    pushLog(`Đang tải ${dlUrl}...`)
    try {
      const res = await mediaApi.downloadUrl(dlUrl)
      pushFeed('dl', setDlFeed, [{ url: res.url, filename: res.filename, src: dlUrl }]); pushLog(`Tải xong: ${res.filename}`)
    } catch (e: any) { const m = e.response?.data?.detail || 'Lỗi'; setError(m); pushLog(m, 'error') }
    finally { setDlLoading(false) }
  }

  const genSettings = (
    <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 1fr', gap: 10, marginBottom: 12 }}>
      <div className="form-group" style={{ marginBottom: 0 }}><label className="form-label">Chất lượng</label>
        <select className="form-select" value={genModel} onChange={e => setGenModel(e.target.value)}>
          {GEN_MODELS.map(m => <option key={m.key} value={m.key}>{m.label}</option>)}
        </select></div>
      <div className="form-group" style={{ marginBottom: 0 }}><label className="form-label">Tỉ lệ</label>
        <select className="form-select" value={genAspect} onChange={e => setGenAspect(e.target.value)}>
          {ASPECTS.map(a => <option key={a.v} value={a.v}>{a.label}</option>)}
        </select></div>
      <div className="form-group" style={{ marginBottom: 0 }}><label className="form-label">Thời lượng</label>
        <select className="form-select" value={genDur} onChange={e => setGenDur(+e.target.value)}>
          {[4, 6, 8, 10].map(d => <option key={d} value={d}>{d}s</option>)}
        </select></div>
    </div>
  )
  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Sparkles size={22} color="#a78bfa" />
            Công cụ
          </div>
          <div className="page-subtitle">{TABS.find(t => t.key === tab)?.label || 'Công cụ'}</div>
        </div>
      </div>

      {error && (
        <div className="alert alert-error" style={{ marginBottom: 16 }}>
          <AlertCircle size={15} /> {error}
        </div>
      )}

      {/* Character Library */}
      {tab === 'chars' && (
        <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: 20 }}>
          <div className="card">
            <div className="card-header"><Plus size={15} /> Thêm nhân vật</div>
            <div className="form-group">
              <label className="form-label">Tên nhân vật</label>
              <input className="form-input" placeholder="vd: Naruto, Gojo..."
                value={charName} onChange={e => setCharName(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Ảnh khuôn mặt</label>
              <label style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
                padding: 20, background: 'var(--bg3)', border: '1px dashed var(--border2)',
                borderRadius: 10, cursor: 'pointer', transition: 'all 0.2s',
              }}
                onDragOver={e => e.preventDefault()}
                onDrop={e => { e.preventDefault(); setCharImg(e.dataTransfer.files[0]) }}>
                {charImg ? (
                  <img src={URL.createObjectURL(charImg)} style={{ width: 70, height: 70, objectFit: 'cover', borderRadius: '50%' }} />
                ) : (
                  <><Upload size={24} color="#6060a0" /><span style={{ fontSize: 12, color: 'var(--text3)' }}>Click hoặc kéo ảnh vào</span></>
                )}
                <input ref={charImgRef} type="file" accept="image/*" style={{ display: 'none' }}
                  onChange={e => setCharImg(e.target.files?.[0] || null)} />
              </label>
            </div>
            <button className="btn btn-primary" style={{ width: '100%' }}
              onClick={addChar} disabled={charLoading || !charName || !charImg}>
              {charLoading ? <><Loader2 size={14} className="spin" /> Đang lưu...</> : <><Plus size={14} /> Thêm nhân vật</>}
            </button>
            <div className="alert alert-info" style={{ marginTop: 14, fontSize: 12 }}>
              Gõ <code style={{ background: 'rgba(124,92,252,0.15)', padding: '1px 5px', borderRadius: 4 }}>@Tên</code> trong prompt để khoá mặt nhân vật
            </div>
          </div>

          <div className="card">
            <div className="card-header"><Users size={15} /> Thư viện nhân vật ({chars.length})</div>
            {chars.length === 0 ? (
              <div className="empty-state">
                <Users size={40} strokeWidth={1.5} style={{ opacity: 0.3, marginBottom: 12 }} />
                <h3>Chưa có nhân vật</h3>
                <p>Thêm nhân vật để giữ mặt xuyên suốt phim</p>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px,1fr))', gap: 12 }}>
                {chars.map(c => (
                  <div key={c.id} style={{
                    background: 'var(--bg3)', borderRadius: 12, padding: 14,
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
                    border: '1px solid var(--border)',
                  }}>
                    <img src={c.image_url} alt={c.name}
                      style={{ width: 64, height: 64, objectFit: 'cover', borderRadius: '50%', border: '2px solid rgba(124,92,252,0.4)' }} />
                    <div style={{ fontSize: 12, fontWeight: 600 }}>@{c.name}</div>
                    <button className="btn btn-danger btn-sm" style={{ width: '100%', gap: 4 }}
                      onClick={() => delChar(c.id, c.name)}>
                      <Trash2 size={11} /> Xóa
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Ảnh → Video (I2V) — layout kiểu Flow: sản phẩm ở trên, thao tác dưới-giữa */}
      {tab === 'i2v' && (
        <div className="tool-flow">
          <div className="tool-feed">
            <VideoFeed jobs={vidJobs.filter(j => j.kind === 'i2v')} />
          </div>
          <div className="tool-composer">
            <div className="card" style={{ margin: 0 }}>
              <div className="card-header"><Film size={15} /> Ảnh → Video <small>Ảnh là khung hình đầu, video chuyển động từ nó</small></div>
              <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 12, flexWrap: 'wrap' }}>
                <label className="img-add" title="Chọn ảnh khung đầu">
                  {i2vPreview ? <img src={i2vPreview} alt="" /> : <Plus size={22} />}
                  <input ref={i2vRef} type="file" accept="image/*" style={{ display: 'none' }}
                    onChange={e => { const f = e.target.files?.[0] || null; setI2vImg(f); setI2vPreview(f ? URL.createObjectURL(f) : null) }} />
                </label>
                <textarea className="form-textarea" rows={2} style={{ flex: 1, minWidth: 220, minHeight: 'auto' }}
                  value={i2vPrompt} onChange={e => setI2vPrompt(e.target.value)}
                  placeholder="Mô tả chuyển động: camera đẩy nhẹ, cô ấy quay lại mỉm cười, tóc bay trong gió..." />
              </div>
              {genSettings}
              <button className="btn btn-primary" style={{ width: '100%' }} onClick={doI2V} disabled={i2vLoading || !i2vImg || !i2vPrompt.trim()}>
                {i2vLoading ? <><Loader2 size={14} className="spin" /> Đang gửi...</> : <><Film size={14} /> Tạo video từ ảnh</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Giữ mặt → Video (R2V) — layout kiểu Flow */}
      {tab === 'r2v' && (
        <div className="tool-flow">
          <div className="tool-feed">
            <VideoFeed jobs={vidJobs.filter(j => j.kind === 'r2v')} />
          </div>
          <div className="tool-composer">
            <div className="card" style={{ margin: 0 }}>
              <div className="card-header"><Layers size={15} /> Giữ mặt → Video <small>1-3 ảnh tham chiếu giữ mặt nhân vật/vật thể trong cảnh mới</small></div>
              <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 6, flexWrap: 'wrap' }}>
                <label className="img-add" title="Chọn 1-3 ảnh nhân vật (giữ Ctrl chọn nhiều)">
                  {r2vImgs.length ? <span style={{ fontWeight: 800, fontSize: 18 }}>{r2vImgs.length}</span> : <Plus size={22} />}
                  <input ref={r2vRef} type="file" accept="image/*" multiple style={{ display: 'none' }}
                    onChange={e => setR2vImgs(Array.from(e.target.files || []).slice(0, 3))} />
                </label>
                <textarea className="form-textarea" rows={2} style={{ flex: 1, minWidth: 220, minHeight: 'auto' }}
                  value={r2vPrompt} onChange={e => setR2vPrompt(e.target.value)}
                  placeholder="Mô tả cảnh mới: nhân vật đi trên phố Tokyo đêm neon, trung cảnh, điện ảnh..." />
              </div>
              <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 12 }}>
                Mặt người THƯỜNG vẫn qua (chỉ người nổi tiếng bị chặn). Dính lọc thì hệ thống tự thử lại.
              </div>
              {genSettings}
              <button className="btn btn-primary" style={{ width: '100%' }} onClick={doR2V} disabled={r2vLoading || !r2vImgs.length || !r2vPrompt.trim()}>
                {r2vLoading ? <><Loader2 size={14} className="spin" /> Đang gửi...</> : <><Layers size={14} /> Tạo video giữ mặt</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TTS — layout Flow */}
      {tab === 'tts' && (
        <div className="tool-flow">
          <div className="tool-feed">
            {ttsFeed.length === 0 ? (
              <div className="empty-state" style={{ padding: '44px 20px' }}>
                <div className="ico"><Volume2 size={24} color="var(--accent2)" /></div>
                <h3>Chưa có audio</h3>
                <p>Nhập văn bản bên dưới rồi bấm Tạo — audio hiện ở đây, F5 vẫn giữ.</p>
              </div>
            ) : (
              <div className="stagger" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {ttsFeed.map((a, i) => (
                  <div key={i} className="card" style={{ margin: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                      <span className="badge badge-done" style={{ fontSize: 10 }}>{a.voice || 'Kore'}</span>
                      <span style={{ fontSize: 12.5, color: 'var(--text2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.text}</span>
                    </div>
                    <audio controls src={a.url} style={{ width: '100%' }} />
                    <a href={a.url} download className="btn btn-ghost btn-sm" style={{ marginTop: 8 }}><Download size={12} /> Tải .wav</a>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="tool-composer">
            <div className="card" style={{ margin: 0 }}>
              <div className="card-header"><Mic size={15} /> Đọc thành giọng nói</div>
              {!user?.has_gemini_key && (<div className="alert alert-info" style={{ marginBottom: 10 }}><AlertCircle size={14} /> Cần Gemini API key — vào Cài đặt để thêm</div>)}
              <textarea className="form-textarea" rows={2} style={{ marginBottom: 10, minHeight: 'auto' }}
                placeholder="Nhập văn bản muốn chuyển thành giọng nói..." value={ttsText} onChange={e => setTtsText(e.target.value)} />
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
                {['Kore', 'Charon', 'Fenrir', 'Aoede', 'Puck', 'Orbit', 'Zephyr'].map(v => (
                  <button key={v} className={ttsVoice === v ? 'btn btn-primary btn-sm' : 'btn btn-ghost btn-sm'} onClick={() => setTtsVoice(v)}>{v}</button>
                ))}
              </div>
              <button className="btn btn-primary" style={{ width: '100%' }} onClick={doTTS} disabled={ttsLoading || !ttsText.trim()}>
                {ttsLoading ? <><Loader2 size={14} className="spin" /> Đang tạo...</> : <><Volume2 size={14} /> Tạo Audio</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tạo ảnh — layout Flow */}
      {tab === 'image' && (
        <div className="tool-flow">
          <div className="tool-feed">
            {imgFeed.length === 0 ? (
              <div className="empty-state" style={{ padding: '44px 20px' }}>
                <div className="ico"><Image size={24} color="var(--accent2)" /></div>
                <h3>Chưa có ảnh</h3>
                <p>Nhập mô tả bên dưới rồi bấm Tạo ảnh — kết quả hiện ở đây, F5 vẫn giữ.</p>
              </div>
            ) : (
              <div className="stagger" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px,1fr))', gap: 12 }}>
                {imgFeed.map((it, i) => (
                  <div key={i} style={{ position: 'relative', borderRadius: 10, overflow: 'hidden', border: '1px solid var(--border)' }}>
                    <img src={it.url} alt="" style={{ width: '100%', display: 'block' }} />
                    <div style={{ position: 'absolute', top: 6, right: 6, display: 'flex', gap: 4 }}>
                      <a href={it.url} download className="btn btn-primary btn-sm btn-icon"><Download size={12} /></a>
                      <button className="btn btn-ghost btn-sm btn-icon" onClick={() => window.open(it.url, '_blank')}><ExternalLink size={12} /></button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="tool-composer">
            <div className="card" style={{ margin: 0 }}>
              <div className="card-header"><Image size={15} /> Tạo ảnh <small style={{ color: 'var(--green)' }}>Miễn phí · Ultra</small></div>
              <textarea ref={imgPromptRef} className="form-textarea" rows={2} style={{ marginBottom: 10, minHeight: 'auto' }}
                placeholder="Mô tả ảnh... (bấm chip @nhân vật để chèn giữ mặt)" value={imgPrompt} onChange={e => setImgPrompt(e.target.value)} />
              {chars.length > 0 && (
                <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', marginBottom: 12 }}>
                  {chars.map(c => (
                    <button key={c.id} type="button" title={`Chèn @${c.name}`} onClick={() => insertMention(c.name)}
                      style={{ display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer', padding: '3px 9px 3px 3px', borderRadius: 99, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text2)' }}>
                      <img src={c.image_url} style={{ width: 20, height: 20, borderRadius: '50%', objectFit: 'cover' }} />
                      <span style={{ fontSize: 12, fontWeight: 500 }}>@{c.name}</span><Plus size={11} />
                    </button>
                  ))}
                </div>
              )}
              <div className="form-row" style={{ marginBottom: 12 }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Số ảnh</label>
                  <select className="form-select" value={imgCount} onChange={e => setImgCount(+e.target.value)}>
                    {[1, 2, 3, 4].map(n => <option key={n} value={n}>{n} ảnh</option>)}
                  </select>
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Tỉ lệ</label>
                  <select className="form-select" value={imgAspect} onChange={e => setImgAspect(e.target.value)}>
                    {ASPECTS.map(a => <option key={a.v} value={a.v}>{a.label}</option>)}
                  </select>
                </div>
              </div>
              <button className="btn btn-primary" style={{ width: '100%' }} onClick={doImage} disabled={imgLoading || !imgPrompt.trim()}>
                {imgLoading ? <><Loader2 size={14} className="spin" /> Đang tạo...</> : <><Sparkles size={14} /> Tạo ảnh</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cắt video — layout Flow */}
      {tab === 'cut' && (
        <div className="tool-flow">
          <div className="tool-feed">
            {cutFeed.length === 0 ? (
              <div className="empty-state" style={{ padding: '44px 20px' }}>
                <div className="ico"><Scissors size={24} color="var(--accent2)" /></div>
                <h3>Chưa cắt video nào</h3>
                <p>Nhập tên file + chọn chế độ bên dưới rồi bấm Cắt — kết quả hiện ở đây.</p>
              </div>
            ) : (
              <div className="stagger" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {cutFeed.map((c, i) => (
                  <div key={i} className="card" style={{ margin: 0 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 600, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Scissors size={13} color="var(--accent2)" /> {c.file} <span style={{ color: 'var(--text3)', fontWeight: 400 }}>· {(c.urls || []).length} file</span>
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {(c.urls || []).map((f: string, j: number) => (
                        <a key={j} href={f} download className="btn btn-ghost btn-sm" style={{ fontSize: 11.5 }}><Download size={11} /> {f.split('/').pop()}</a>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="tool-composer">
            <div className="card" style={{ margin: 0 }}>
              <div className="card-header"><Scissors size={15} /> Cắt video</div>
              <div className="form-group">
                <label className="form-label">Tên file trong Thư viện</label>
                <input className="form-input" placeholder="scene_abc123.mp4" value={cutFile} onChange={e => setCutFile(e.target.value)} />
              </div>
              <div className="form-row" style={{ marginBottom: 12 }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Chế độ</label>
                  <select className="form-select" value={cutMode} onChange={e => setCutMode(e.target.value)}>
                    <option value="split">Tách đoạn (giây)</option>
                    <option value="frames">Trích frame (ảnh)</option>
                  </select>
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">{cutMode === 'split' ? 'Giây/đoạn' : 'Frame/giây'}</label>
                  <input className="form-input" type="number" min={1} value={cutMode === 'split' ? cutSeg : cutFps}
                    onChange={e => cutMode === 'split' ? setCutSeg(+e.target.value) : setCutFps(+e.target.value)} />
                </div>
              </div>
              <button className="btn btn-primary" style={{ width: '100%' }} onClick={doCut} disabled={cutLoading}>
                {cutLoading ? <><Loader2 size={14} className="spin" /> Đang cắt...</> : <><Scissors size={14} /> Cắt ngay</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tải video từ đường link — layout Flow */}
      {tab === 'download' && (
        <div className="tool-flow">
          <div className="tool-feed">
            {dlFeed.length === 0 ? (
              <div className="empty-state" style={{ padding: '44px 20px' }}>
                <div className="ico"><Download size={24} color="var(--accent2)" /></div>
                <h3>Chưa tải video nào</h3>
                <p>Dán link bên dưới rồi bấm Tải — video hiện ở đây, F5 vẫn giữ.</p>
              </div>
            ) : (
              <div className="stagger" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px,1fr))', gap: 14 }}>
                {dlFeed.map((d, i) => (
                  <div key={i} className="video-card">
                    <div className="video-preview"><video src={d.url} controls preload="metadata" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} /></div>
                    <div className="video-card-body">
                      <div className="video-card-prompt">{d.filename || d.src}</div>
                      <a href={d.url} download className="btn btn-ghost btn-sm" style={{ marginTop: 8 }}><Download size={12} /> Tải về máy</a>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="tool-composer">
            <div className="card" style={{ margin: 0 }}>
              <div className="card-header"><Download size={15} /> Tải video từ đường link</div>
              <div style={{ fontSize: 11.5, color: 'var(--text3)', marginBottom: 10 }}>Hỗ trợ YouTube, TikTok, Instagram, Facebook, 1000+ trang.</div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <input className="form-input" style={{ flex: 1, minWidth: 220 }} placeholder="https://youtube.com/watch?v=..." value={dlUrl} onChange={e => setDlUrl(e.target.value)} />
                <button className="btn btn-primary" style={{ flex: 'none' }} onClick={doDownload} disabled={dlLoading || !dlUrl.trim()}>
                  {dlLoading ? <><Loader2 size={14} className="spin" /> Đang tải...</> : <><Download size={14} /> Tải</>}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
