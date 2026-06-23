import { useState, useEffect, useRef } from 'react'
import { toolsApi, charactersApi, mediaApi } from '../api/client'
import { pushLog } from './Dashboard'
import {
  Users, Plus, Trash2, Mic, Image, Scissors, Download,
  Volume2, AlertCircle, CheckCircle, Loader2, ExternalLink,
  Upload, Sparkles
} from 'lucide-react'

type ToolTab = 'chars' | 'tts' | 'image' | 'cut' | 'download'

const TABS = [
  { key: 'chars' as ToolTab, label: 'Nhân vật', icon: Users },
  { key: 'tts' as ToolTab, label: 'TTS Audio', icon: Volume2 },
  { key: 'image' as ToolTab, label: 'Tạo ảnh', icon: Image },
  { key: 'cut' as ToolTab, label: 'Cắt video', icon: Scissors },
  { key: 'download' as ToolTab, label: 'Tải video', icon: Download },
]

export default function Tools({ user }: { user: any }) {
  const [tab, setTab] = useState<ToolTab>('chars')
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
  const [ttsResult, setTtsResult] = useState<string | null>(null)

  async function doTTS() {
    if (!ttsText.trim()) return
    setError(''); setTtsLoading(true); setTtsResult(null)
    pushLog('Đang tạo audio TTS...')
    try {
      const res = await toolsApi.tts({ text: ttsText, voice: ttsVoice })
      setTtsResult(res.audio_url)
      pushLog('Tạo audio xong!')
    } catch (e: any) { const m = e.response?.data?.detail || 'Lỗi TTS'; setError(m); pushLog(m, 'error') }
    finally { setTtsLoading(false) }
  }

  // Image gen
  const [imgPrompt, setImgPrompt] = useState('')
  const [imgCount, setImgCount] = useState(1)
  const [imgAspect, setImgAspect] = useState('1:1')
  const [imgLoading, setImgLoading] = useState(false)
  const [imgResults, setImgResults] = useState<string[]>([])
  const [imgChars, setImgChars] = useState<Set<string>>(new Set())

  async function doImage() {
    if (!imgPrompt.trim()) return
    setError(''); setImgLoading(true); setImgResults([])
    pushLog('Đang tạo ảnh AI...')
    try {
      const res = await toolsApi.image({ prompt: imgPrompt, count: imgCount, aspect_ratio: imgAspect,
        char_ids: imgChars.size > 0 ? [...imgChars] : undefined })
      setImgResults(res.image_urls)
      pushLog(`Tạo xong ${res.image_urls.length} ảnh`)
    } catch (e: any) { const m = e.response?.data?.detail || 'Lỗi'; setError(m); pushLog(m, 'error') }
    finally { setImgLoading(false) }
  }

  // Cut
  const [cutFile, setCutFile] = useState('')
  const [cutMode, setCutMode] = useState('split')
  const [cutSeg, setCutSeg] = useState(8)
  const [cutFps, setCutFps] = useState(1)
  const [cutLoading, setCutLoading] = useState(false)
  const [cutResults, setCutResults] = useState<string[]>([])

  async function doCut() {
    if (!cutFile.trim()) { setError('Nhập tên file'); return }
    setError(''); setCutLoading(true); setCutResults([])
    try {
      const res = await mediaApi.cut({ filename: cutFile, mode: cutMode, segment: cutSeg, fps: cutFps })
      setCutResults(res.files); pushLog(`Cắt xong: ${res.count} file`)
    } catch (e: any) { const m = e.response?.data?.detail || 'Lỗi'; setError(m); pushLog(m, 'error') }
    finally { setCutLoading(false) }
  }

  // Download URL
  const [dlUrl, setDlUrl] = useState('')
  const [dlLoading, setDlLoading] = useState(false)
  const [dlResult, setDlResult] = useState<string | null>(null)

  async function doDownload() {
    if (!dlUrl.trim()) { setError('Nhập URL'); return }
    setError(''); setDlLoading(true); setDlResult(null)
    pushLog(`Đang tải ${dlUrl}...`)
    try {
      const res = await mediaApi.downloadUrl(dlUrl)
      setDlResult(res.url); pushLog(`Tải xong: ${res.filename}`)
    } catch (e: any) { const m = e.response?.data?.detail || 'Lỗi'; setError(m); pushLog(m, 'error') }
    finally { setDlLoading(false) }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Sparkles size={22} color="#a78bfa" />
            Công cụ
          </div>
          <div className="page-subtitle">Character Library · TTS · Image Gen · Cắt & Tải video</div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 24 }}>
        {TABS.map(t => {
          const Icon = t.icon
          const active = tab === t.key
          return (
            <button key={t.key}
              onClick={() => { setTab(t.key); setError('') }}
              style={{
                display: 'flex', alignItems: 'center', gap: 7,
                padding: '8px 16px', borderRadius: 9, border: 'none', cursor: 'pointer',
                fontSize: 13, fontWeight: 500, transition: 'all 0.15s',
                background: active ? 'rgba(124,92,252,0.15)' : 'rgba(255,255,255,0.04)',
                color: active ? '#a78bfa' : '#6060a0',
                outline: active ? '1px solid rgba(124,92,252,0.25)' : '1px solid transparent',
              }}>
              <Icon size={14} strokeWidth={2} />
              {t.label}
            </button>
          )
        })}
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

      {/* TTS */}
      {tab === 'tts' && (
        <div style={{ maxWidth: 600 }}>
          <div className="card">
            <div className="card-header"><Mic size={15} /> Text-to-Speech <small>Gemini TTS</small></div>
            {!user?.has_gemini_key && (
              <div className="alert alert-info"><AlertCircle size={14} /> Cần Gemini API key — vào Cài đặt để thêm</div>
            )}
            <div className="form-group">
              <label className="form-label">Văn bản cần đọc</label>
              <textarea className="form-textarea" rows={5}
                placeholder="Nhập văn bản muốn chuyển thành giọng nói..."
                value={ttsText} onChange={e => setTtsText(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Giọng đọc</label>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {['Kore', 'Charon', 'Fenrir', 'Aoede', 'Puck', 'Orbit', 'Zephyr'].map(v => (
                  <button key={v}
                    className={ttsVoice === v ? 'btn btn-primary btn-sm' : 'btn btn-ghost btn-sm'}
                    onClick={() => setTtsVoice(v)}>{v}</button>
                ))}
              </div>
            </div>
            <button className="btn btn-primary" onClick={doTTS} disabled={ttsLoading || !ttsText.trim()}>
              {ttsLoading ? <><Loader2 size={14} className="spin" /> Đang tạo...</> : <><Volume2 size={14} /> Tạo Audio</>}
            </button>
            {ttsResult && (
              <div style={{ marginTop: 20, padding: 16, background: 'var(--bg3)', borderRadius: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10, color: 'var(--green)' }}>
                  <CheckCircle size={14} /> Audio đã tạo
                </div>
                <audio controls src={ttsResult} style={{ width: '100%' }} />
                <a href={ttsResult} download className="btn btn-ghost btn-sm" style={{ marginTop: 8 }}>
                  <Download size={12} /> Tải .wav
                </a>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Image gen */}
      {tab === 'image' && (
        <div style={{ display: 'grid', gridTemplateColumns: '360px 1fr', gap: 20 }}>
          <div className="card">
            <div className="card-header"><Image size={15} /> Image Generation <small style={{ color: 'var(--green)' }}>FREE · Ultra</small></div>
            <div className="form-group">
              <label className="form-label">Prompt (tiếng Anh)</label>
              <textarea className="form-textarea" rows={4}
                placeholder="A beautiful landscape, mountain lake at sunset, photorealistic, 8K..."
                value={imgPrompt} onChange={e => setImgPrompt(e.target.value)} />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Số ảnh</label>
                <select className="form-select" value={imgCount} onChange={e => setImgCount(+e.target.value)}>
                  {[1,2,3,4].map(n => <option key={n} value={n}>{n} ảnh</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Tỉ lệ</label>
                <select className="form-select" value={imgAspect} onChange={e => setImgAspect(e.target.value)}>
                  {['1:1','16:9','9:16','4:3','3:4'].map(a => <option key={a}>{a}</option>)}
                </select>
              </div>
            </div>
            {/* Face ref */}
            {chars.length > 0 && (
              <div style={{ marginBottom: 14, padding: '10px 12px', background: 'rgba(255,255,255,0.02)', borderRadius: 9, border: '1px solid var(--border)' }}>
                <div style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 600, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.6px' }}>🎭 Giữ mặt nhân vật (tùy chọn)</div>
                <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
                  {chars.map(c => (
                    <div key={c.id}
                      onClick={() => setImgChars(prev => { const n = new Set(prev); n.has(c.id) ? n.delete(c.id) : n.add(c.id); return n })}
                      style={{ display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer', padding: '3px 9px 3px 3px', borderRadius: 99,
                        border: `1px solid ${imgChars.has(c.id) ? 'var(--accent)' : 'var(--border)'}`,
                        background: imgChars.has(c.id) ? 'rgba(249,115,22,0.12)' : 'transparent', transition: 'all 0.15s' }}>
                      <img src={c.image_url} style={{ width: 20, height: 20, borderRadius: '50%', objectFit: 'cover' }} />
                      <span style={{ fontSize: 12, fontWeight: 500, color: imgChars.has(c.id) ? 'var(--accent3)' : 'var(--text2)' }}>@{c.name}</span>
                      {imgChars.has(c.id) && <span style={{ fontSize: 10, color: 'var(--accent2)' }}>✓</span>}
                    </div>
                  ))}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 6 }}>Chọn nhân vật để AI giữ mặt trong ảnh (Image Reference)</div>
              </div>
            )}
            <button className="btn btn-primary" onClick={doImage} disabled={imgLoading || !imgPrompt.trim()}>
              {imgLoading ? <><Loader2 size={14} className="spin" /> Đang tạo...</> : <><Sparkles size={14} /> Tạo ảnh</>}
            </button>
          </div>
          <div className="card">
            <div className="card-header"><Image size={15} /> Kết quả</div>
            {imgResults.length === 0 ? (
              <div className="empty-state">
                <Image size={36} strokeWidth={1.5} style={{ opacity: 0.25, marginBottom: 12 }} />
                <h3>Chưa có ảnh</h3>
                <p>Nhập prompt và bấm Tạo ảnh</p>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px,1fr))', gap: 12 }}>
                {imgResults.map((url, i) => (
                  <div key={i} style={{ position: 'relative', borderRadius: 10, overflow: 'hidden' }}>
                    <img src={url} alt="" style={{ width: '100%', display: 'block' }} />
                    <div style={{ position: 'absolute', top: 6, right: 6, display: 'flex', gap: 4 }}>
                      <a href={url} download className="btn btn-primary btn-sm btn-icon"><Download size={12} /></a>
                      <button className="btn btn-ghost btn-sm btn-icon" onClick={() => window.open(url, '_blank')}>
                        <ExternalLink size={12} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Cut video */}
      {tab === 'cut' && (
        <div style={{ maxWidth: 580 }}>
          <div className="card">
            <div className="card-header"><Scissors size={15} /> Cắt Video <small>FFmpeg</small></div>
            <div className="form-group">
              <label className="form-label">Tên file trong /uploads/</label>
              <input className="form-input" placeholder="scene_abc123.mp4"
                value={cutFile} onChange={e => setCutFile(e.target.value)} />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Chế độ</label>
                <select className="form-select" value={cutMode} onChange={e => setCutMode(e.target.value)}>
                  <option value="split">Tách đoạn (giây)</option>
                  <option value="frames">Trích frame (ảnh)</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">{cutMode === 'split' ? 'Giây/đoạn' : 'Frame/giây'}</label>
                <input className="form-input" type="number" min={1}
                  value={cutMode === 'split' ? cutSeg : cutFps}
                  onChange={e => cutMode === 'split' ? setCutSeg(+e.target.value) : setCutFps(+e.target.value)} />
              </div>
            </div>
            <button className="btn btn-primary" onClick={doCut} disabled={cutLoading}>
              {cutLoading ? <><Loader2 size={14} className="spin" /> Đang cắt...</> : <><Scissors size={14} /> Cắt ngay</>}
            </button>
            {cutResults.length > 0 && (
              <div style={{ marginTop: 16 }}>
                <div style={{ fontSize: 13, color: 'var(--green)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <CheckCircle size={14} /> {cutResults.length} file
                </div>
                {cutResults.map((f, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid var(--border)', fontSize: 12, color: 'var(--text2)' }}>
                    {f.split('/').pop()}
                    <a href={f} download className="btn btn-ghost btn-sm btn-icon"><Download size={12} /></a>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Download URL */}
      {tab === 'download' && (
        <div style={{ maxWidth: 580 }}>
          <div className="card">
            <div className="card-header"><Download size={15} /> Tải Video từ URL <small>yt-dlp</small></div>
            <div className="alert alert-info">
              <AlertCircle size={14} /> Hỗ trợ YouTube, TikTok, Instagram, Facebook, 1000+ trang
            </div>
            <div className="form-group">
              <label className="form-label">URL video</label>
              <input className="form-input" placeholder="https://youtube.com/watch?v=..."
                value={dlUrl} onChange={e => setDlUrl(e.target.value)} />
            </div>
            <button className="btn btn-primary" onClick={doDownload} disabled={dlLoading}>
              {dlLoading ? <><Loader2 size={14} className="spin" /> Đang tải...</> : <><Download size={14} /> Tải về server</>}
            </button>
            {dlResult && (
              <div style={{ marginTop: 16, padding: 16, background: 'var(--bg3)', borderRadius: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--green)', marginBottom: 10 }}>
                  <CheckCircle size={14} /> Tải xong!
                </div>
                <video src={dlResult} controls style={{ width: '100%', borderRadius: 8, marginBottom: 8 }} />
                <a href={dlResult} download className="btn btn-primary btn-sm"><Download size={12} /> Tải về máy</a>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
