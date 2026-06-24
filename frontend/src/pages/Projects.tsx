import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { projectsApi, toolsApi, charactersApi } from '../api/client'
import { pushLog } from './Dashboard'
import { Loader2, Link2, ChevronRight, Trash2, Image, Users } from 'lucide-react'

const MODELS = [
  { key: 'veo_3_1_t2v_lite_low_priority', label: 'Veo 3.1 Lite (FREE)', cost: 0 },
  { key: 'veo_3_1_t2v_lite', label: 'Veo 3.1 Lite', cost: 10 },
  { key: 'veo_3_1_t2v_fast_portrait_ultra', label: 'Veo 3.1 Fast', cost: 20 },
  { key: 'veo_3_1_t2v_portrait', label: 'Veo 3.1 Quality', cost: 50 },
]
const ASPECTS = ['16:9', '9:16', '1:1', '4:3']
const DURATIONS = [4, 6, 8, 10]
const STYLES = ['', 'Cinematic', 'Anime', 'Documentary', 'Commercial', 'Music Video', 'Short Film']

type Tab = 'new' | 'batch' | 'copy'

export default function Projects({ user, onCreated }: { user: any; onCreated?: () => void }) {
  const nav = useNavigate()
  const [tab, setTab] = useState<Tab>('new')
  const [error, setError] = useState('')
  const [creating, setCreating] = useState(false)
  const [projects, setProjects] = useState<any[]>([])
  const [chars, setChars] = useState<any[]>([])
  const [selectedChars, setSelectedChars] = useState<Set<string>>(new Set())

  // NEW tab
  const [step, setStep] = useState<'setup' | 'review'>('setup')  // wizard: thiết lập -> duyệt kịch bản
  const [name, setName] = useState('')
  const [idea, setIdea] = useState('')
  const [sceneCount, setSceneCount] = useState(6)
  const [style, setStyle] = useState('')
  const [model, setModel] = useState(MODELS[0].key)
  const [aspect, setAspect] = useState('16:9')
  const [duration, setDuration] = useState(8)
  const [language, setLanguage] = useState('vi')
  const [loadingPrompts, setLoadingPrompts] = useState(false)
  const [prompts, setPrompts] = useState<string[]>([])
  const [narrations, setNarrations] = useState<string[]>([])
  // Thêm nhân vật inline (giữ mặt) trong wizard
  const [addCharOpen, setAddCharOpen] = useState(false)
  const [newCharName, setNewCharName] = useState('')
  const [newCharFile, setNewCharFile] = useState<File | null>(null)
  const [addingChar, setAddingChar] = useState(false)
  const charFileRef = useRef<HTMLInputElement>(null)

  // BATCH tab
  const [bName, setBName] = useState('')
  const [bPrompts, setBPrompts] = useState('')
  const [bModel, setBModel] = useState(MODELS[0].key)
  const [bAspect, setBAspect] = useState('16:9')
  const [bDuration, setBDuration] = useState(8)
  const [bCount, setBCount] = useState(1)
  const [bChain, setBChain] = useState(false)
  const [bI2V, setBI2V] = useState(false)
  const [bStartImg, setBStartImg] = useState<File | null>(null)
  const bStartRef = useRef<HTMLInputElement>(null)

  // COPY tab
  const [copyUrl, setCopyUrl] = useState('')
  const [copyStyle, setCopyStyle] = useState('')
  const [copyCount, setCopyCount] = useState(6)
  const [copyLoading, setCopyLoading] = useState(false)

  useEffect(() => {
    projectsApi.list().then(setProjects)
    charactersApi.list().then(setChars)
  }, [])

  // Credit cost estimate
  const modelObj = MODELS.find(m => m.key === bModel) || MODELS[0]
  const bLines = bPrompts.split('\n').filter(l => l.trim()).length
  const estimatedCost = modelObj.cost * bLines * bCount
  const modelObjNew = MODELS.find(m => m.key === model) || MODELS[0]
  const fmtLen = (s: number) => s < 60 ? `${s}s` : `${Math.floor(s / 60)}p${s % 60 ? ` ${s % 60}s` : ''}`
  // Bước thiết lập: dùng số cảnh đang chọn trên slider
  const setupLenSec = sceneCount * duration
  // Bước duyệt: dùng số cảnh THỰC TẾ AI đã sinh ra
  const reviewN = prompts.length || sceneCount
  const reviewCost = modelObjNew.cost * reviewN
  const reviewLenSec = reviewN * duration

  async function genPrompts() {
    if (!idea.trim()) { setError('Nhập ý tưởng trước'); return }
    setError(''); setLoadingPrompts(true)
    try {
      const res = await toolsApi.autoprompt({ idea, scene_count: sceneCount, style: style || undefined, language })
      setPrompts(res.prompts); setNarrations(res.narrations)
      setStep('review')
      pushLog(`Đã tạo ${res.prompts.length} scene prompts`)
    } catch (e: any) { setError(e.response?.data?.detail || 'Lỗi tạo prompt') }
    finally { setLoadingPrompts(false) }
  }

  async function addCharacter() {
    if (!newCharName.trim() || !newCharFile) { setError('Cần tên + ảnh nhân vật'); return }
    setAddingChar(true); setError('')
    try {
      const c = await charactersApi.add(newCharName.trim(), newCharFile)  // vào kho chung, dùng lại được
      const list = await charactersApi.list()
      setChars(list)
      setSelectedChars(prev => { const n = new Set(prev); n.add(c.name); return n })  // chọn luôn
      setNewCharName(''); setNewCharFile(null); setAddCharOpen(false)
      if (charFileRef.current) charFileRef.current.value = ''
      pushLog(`Đã thêm nhân vật @${c.name}`)
    } catch (e: any) { setError(e.response?.data?.detail || 'Thêm nhân vật thất bại') }
    finally { setAddingChar(false) }
  }

  async function createNew(autoRender: boolean) {
    if (!prompts.length) { setError('Tạo prompts trước'); return }
    setError(''); setCreating(true)
    // Inject @CharName into prompts for selected chars
    const enriched = prompts.map(p => {
      const mentions = [...selectedChars].map(c => `@${c}`).join(' ')
      return selectedChars.size > 0 && !p.includes('@') ? `${mentions} ${p}` : p
    })
    try {
      const proj = await projectsApi.create({
        name: name || `Dự án ${new Date().toLocaleDateString('vi-VN')}`,
        idea, style: style || undefined, model_key: model,
        aspect_ratio: aspect, duration_seconds: duration, language,
        prompts: enriched, narrations, auto_render: autoRender,
        character_names: [...selectedChars],
        // id nhân vật được chọn -> backend clone thành nhân vật RIÊNG của project (giữ mặt)
        character_ids: chars.filter(c => selectedChars.has(c.name)).map(c => c.id),
      })
      pushLog(`${autoRender ? 'Auto render' : 'Tạo'} dự án: ${proj.name}`)
      onCreated?.()
      nav(`/projects/${proj.id}`)
    } catch (e: any) { setError(e.response?.data?.detail || 'Tạo dự án thất bại'); setCreating(false) }
  }

  async function createBatch() {
    const lines = bPrompts.split('\n').map(l => l.trim()).filter(Boolean)
    if (!lines.length) { setError('Nhập ít nhất 1 prompt'); return }
    const expanded = lines.flatMap(l => Array(bCount).fill(l))
    setError(''); setCreating(true)

    let startImgName: string | undefined
    // Upload start image if I2V
    if (bI2V && bStartImg) {
      // Upload as temp file
      const fd = new FormData(); fd.append('file', bStartImg)
      // We'll just use the file name approach — store locally
      startImgName = undefined // Will be handled via scene.start_image
    }

    try {
      const proj = await projectsApi.create({
        name: bName || `Batch ${new Date().toLocaleDateString('vi-VN')}`,
        model_key: bModel, aspect_ratio: bAspect, duration_seconds: bDuration,
        prompts: expanded, auto_render: true, chain_mode: bChain,
      })
      pushLog(`Batch ${bChain ? 'chain' : ''}: ${expanded.length} scenes`)
      nav(`/projects/${proj.id}`)
    } catch (e: any) { setError(e.response?.data?.detail || 'Tạo batch thất bại'); setCreating(false) }
  }

  async function doCopy() {
    if (!copyUrl.trim()) { setError('Nhập URL'); return }
    setError(''); setCopyLoading(true)
    try {
      const res = await toolsApi.copyIdea({ url: copyUrl, style: copyStyle || undefined, scene_count: copyCount })
      setName(res.title); setPrompts(res.prompts); setNarrations(res.narrations)
      setIdea(`Clone từ: ${copyUrl}`); setTab('new'); setStep('review')
      pushLog(`Copy idea: ${res.prompts.length} scenes`)
    } catch (e: any) { setError(e.response?.data?.detail || 'Phân tích thất bại') }
    finally { setCopyLoading(false) }
  }

  async function delProject(id: string, e: React.MouseEvent) {
    e.stopPropagation()
    if (!confirm('Xóa dự án này?')) return
    await projectsApi.delete(id)
    setProjects(ps => ps.filter(p => p.id !== id))
  }

  return (
    <div style={{ maxWidth: 920, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 11, color: 'var(--accent2)', fontWeight: 700, letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: 6 }}>AI AUTOCUT</div>
        <div className="page-title" style={{ marginBottom: 4 }}>Tạo dự án mới</div>
        <div className="page-subtitle">Từ ý tưởng → AI viết kịch bản → Render tự động</div>
      </div>

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 24, background: 'rgba(255,255,255,0.03)', borderRadius: 12, padding: 4, border: '1px solid var(--border)' }}>
        {(['new', 'batch', 'copy'] as Tab[]).map(t => (
          <button key={t} onClick={() => { setTab(t); setError('') }} style={{
            flex: 1, padding: '9px 0', border: 'none', borderRadius: 9, cursor: 'pointer',
            fontSize: 13, fontWeight: 600, transition: 'all 0.18s',
            background: tab === t ? 'linear-gradient(135deg, var(--accent), var(--accent-dark))' : 'transparent',
            color: tab === t ? '#fff' : 'var(--text3)',
            boxShadow: tab === t ? '0 4px 14px rgba(249,115,22,0.3)' : 'none',
          }}>
            {t === 'new' ? '✦ Tạo từ ý tưởng' : t === 'batch' ? '⚡ Hàng loạt' : '🔍 Copy Idea'}
          </button>
        ))}
      </div>

      {error && <div className="alert alert-error" style={{ marginBottom: 16 }}>{error}</div>}

      {/* NEW — Wizard 2 bước */}
      {tab === 'new' && (
        <div className="card" style={{ marginBottom: 24 }}>
          {/* Thanh tiến trình 2 bước */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
            {[{ k: 'setup', n: 1, label: 'Ý tưởng & Thiết lập' }, { k: 'review', n: 2, label: 'Duyệt kịch bản & Tạo' }].map((s, i) => (
              <div key={s.k} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {i > 0 && <div style={{ width: 24, height: 1, background: 'var(--border2)' }} />}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, opacity: step === s.k ? 1 : 0.45 }}>
                  <div style={{ width: 22, height: 22, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700,
                    background: step === s.k ? 'var(--accent)' : 'var(--bg3)', color: step === s.k ? '#fff' : 'var(--text3)' }}>{s.n}</div>
                  <span style={{ fontSize: 12.5, fontWeight: 600, color: step === s.k ? 'var(--text)' : 'var(--text3)' }}>{s.label}</span>
                </div>
              </div>
            ))}
          </div>

          {/* ─── BƯỚC 1: THIẾT LẬP ─── */}
          {step === 'setup' && (<>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Tên dự án</label>
                <input className="form-input" placeholder="Tên phim của bạn..." value={name} onChange={e => setName(e.target.value)} />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Style · Ngôn ngữ</label>
                <div style={{ display: 'flex', gap: 6 }}>
                  <select className="form-select" value={style} onChange={e => setStyle(e.target.value)} style={{ flex: 1 }}>
                    {STYLES.map(s => <option key={s} value={s}>{s || 'Auto style'}</option>)}
                  </select>
                  <select className="form-select" value={language} onChange={e => setLanguage(e.target.value)} style={{ width: 130 }}>
                    <option value="vi">🇻🇳 Việt</option>
                    <option value="en">🇺🇸 English</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Ý tưởng — mô tả càng chi tiết càng tốt</label>
              <textarea className="form-textarea" rows={3} value={idea} onChange={e => setIdea(e.target.value)}
                placeholder="VD: Một chàng trai trẻ bỗng khám phá mình có sức mạnh siêu nhiên ở Tokyo tương lai 2087..." />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 12, marginBottom: 16 }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Số cảnh: <strong style={{ color: 'var(--accent3)' }}>{sceneCount}</strong></label>
                <input type="range" min={2} max={20} value={sceneCount} onChange={e => setSceneCount(+e.target.value)}
                  style={{ width: '100%', accentColor: 'var(--accent)', marginTop: 8 }} />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Model</label>
                <select className="form-select" value={model} onChange={e => setModel(e.target.value)}>
                  {MODELS.map(m => <option key={m.key} value={m.key}>{m.label}</option>)}
                </select>
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Tỉ lệ</label>
                <select className="form-select" value={aspect} onChange={e => setAspect(e.target.value)}>
                  {ASPECTS.map(a => <option key={a}>{a}</option>)}
                </select>
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Thời lượng/cảnh</label>
                <div style={{ display: 'flex', gap: 3 }}>
                  {DURATIONS.map(d => (
                    <button key={d} type="button" onClick={() => setDuration(d)}
                      className={duration === d ? 'btn btn-primary btn-sm' : 'btn btn-ghost btn-sm'}
                      style={{ flex: 1, padding: '7px 0' }}>{d}s</button>
                  ))}
                </div>
              </div>
            </div>

            {/* Nhân vật của dự án — giữ mặt (kho chung + upload riêng) */}
            <div style={{ marginBottom: 14, padding: '10px 12px', background: 'rgba(255,255,255,0.02)', borderRadius: 9, border: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <div style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.6px' }}>
                  <Users size={11} style={{ verticalAlign: '-1px', marginRight: 4 }} />Nhân vật của dự án — giữ mặt
                </div>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setAddCharOpen(o => !o)} style={{ fontSize: 11, padding: '3px 9px' }}>
                  {addCharOpen ? '✕ Đóng' : '+ Thêm nhân vật'}
                </button>
              </div>

              {chars.length > 0 ? (
                <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
                  {chars.map(c => (
                    <div key={c.id} onClick={() => setSelectedChars(prev => { const n = new Set(prev); n.has(c.name) ? n.delete(c.name) : n.add(c.name); return n })}
                      style={{ display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer', padding: '3px 9px 3px 3px', borderRadius: 99,
                        border: `1px solid ${selectedChars.has(c.name) ? 'var(--accent)' : 'var(--border)'}`,
                        background: selectedChars.has(c.name) ? 'rgba(249,115,22,0.12)' : 'transparent', transition: 'all 0.15s' }}>
                      <img src={c.image_url} style={{ width: 20, height: 20, borderRadius: '50%', objectFit: 'cover' }} />
                      <span style={{ fontSize: 12, fontWeight: 500, color: selectedChars.has(c.name) ? 'var(--accent3)' : 'var(--text2)' }}>@{c.name}</span>
                      {selectedChars.has(c.name) && <span style={{ fontSize: 10, color: 'var(--accent2)' }}>✓</span>}
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ fontSize: 11.5, color: 'var(--text3)' }}>Chưa có nhân vật nào. Bấm <strong>+ Thêm nhân vật</strong> để upload ảnh giữ mặt.</div>
              )}

              {addCharOpen && (
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border)' }}>
                  <input className="form-input" placeholder="Tên (vd: hero)" value={newCharName} onChange={e => setNewCharName(e.target.value)} style={{ flex: '0 0 150px', fontSize: 12 }} />
                  <label className="btn btn-ghost btn-sm" style={{ cursor: 'pointer', fontSize: 12 }}>
                    {newCharFile ? `📷 ${newCharFile.name.slice(0, 16)}` : '📁 Chọn ảnh'}
                    <input ref={charFileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => setNewCharFile(e.target.files?.[0] || null)} />
                  </label>
                  <button type="button" className="btn btn-primary btn-sm" onClick={addCharacter} disabled={addingChar || !newCharName.trim() || !newCharFile} style={{ fontSize: 12 }}>
                    {addingChar ? <Loader2 size={12} className="spin" /> : 'Lưu'}
                  </button>
                </div>
              )}

              <div style={{ fontSize: 10.5, color: 'var(--text3)', marginTop: 8, lineHeight: 1.5 }}>
                Chọn nhân vật để <strong>giữ mặt</strong> xuyên suốt video. Khi tạo, nhân vật được chọn sẽ lưu <strong>riêng cho dự án này</strong> (ảnh trong kho chung vẫn còn để tái sử dụng).
              </div>
            </div>

            {/* Ước tính nhanh + nút sang bước 2 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ fontSize: 12, color: 'var(--text3)' }}>
                Dự kiến: <strong style={{ color: 'var(--accent3)', fontSize: 13 }}>~{fmtLen(setupLenSec)}</strong>
                <span> ({sceneCount} cảnh × {duration}s)</span>
              </div>
              <div style={{ flex: 1 }} />
              <button className="btn btn-primary" onClick={genPrompts} disabled={loadingPrompts || !idea.trim()} style={{ minWidth: 220 }}>
                {loadingPrompts ? <><Loader2 size={13} className="spin" /> AI đang viết...</> : '🤖 Viết kịch bản & xem trước →'}
              </button>
            </div>
          </>)}

          {/* ─── BƯỚC 2: DUYỆT KỊCH BẢN ─── */}
          {step === 'review' && (<>
            {/* Banner ước tính */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'center', padding: '14px 16px', marginBottom: 16,
              background: 'rgba(249,115,22,0.06)', border: '1px solid rgba(249,115,22,0.18)', borderRadius: 10 }}>
              <div>
                <div style={{ fontSize: 10, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 2 }}>Độ dài video</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--accent3)' }}>~{fmtLen(reviewLenSec)}</div>
              </div>
              <div style={{ width: 1, height: 32, background: 'var(--border2)' }} />
              <div>
                <div style={{ fontSize: 10, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 2 }}>Số cảnh</div>
                <div style={{ fontSize: 16, fontWeight: 600 }}>{reviewN} × {duration}s</div>
              </div>
              <div style={{ width: 1, height: 32, background: 'var(--border2)' }} />
              <div>
                <div style={{ fontSize: 10, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 2 }}>Chi phí</div>
                <div style={{ fontSize: 16, fontWeight: 600, color: reviewCost === 0 ? 'var(--green)' : 'var(--yellow)' }}>{reviewCost === 0 ? 'FREE' : `${reviewCost} 💎`}</div>
              </div>
              <div style={{ flex: 1 }} />
              <div style={{ fontSize: 11, color: 'var(--text3)', textAlign: 'right', lineHeight: 1.5 }}>
                {modelObjNew.label} · {aspect}
                {selectedChars.size > 0 && <><br />🔒 khoá {selectedChars.size} mặt</>}
              </div>
            </div>

            <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 10, fontWeight: 600 }}>
              📝 {prompts.length} cảnh — sửa prompt / lời thoại trước khi tạo:
            </div>
            <div style={{ maxHeight: 360, overflowY: 'auto', marginBottom: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
              {prompts.map((p, i) => (
                <div key={i} style={{ padding: '10px 12px', background: 'var(--bg3)', borderRadius: 9, border: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#fff', background: 'var(--accent)', borderRadius: 5, padding: '1px 7px' }}>Cảnh {i + 1}</span>
                    <span style={{ fontSize: 10, color: 'var(--text3)' }}>{duration}s</span>
                  </div>
                  <textarea className="form-textarea" rows={2} style={{ fontSize: 12, marginBottom: narrations[i] !== undefined ? 6 : 0 }} value={p}
                    placeholder="Prompt hình ảnh (tiếng Anh)"
                    onChange={e => { const np = [...prompts]; np[i] = e.target.value; setPrompts(np) }} />
                  {narrations[i] !== undefined && (
                    <input className="form-input" style={{ fontSize: 12 }} value={narrations[i]}
                      placeholder="🔊 Lời thoại / narration"
                      onChange={e => { const nn = [...narrations]; nn[i] = e.target.value; setNarrations(nn) }} />
                  )}
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-ghost" onClick={() => setStep('setup')} disabled={creating}>← Sửa lại</button>
              <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => createNew(false)} disabled={creating}>💾 Lưu nháp</button>
              <button className="btn btn-primary" style={{ flex: 2 }} onClick={() => createNew(true)} disabled={creating}>
                {creating ? <><Loader2 size={13} className="spin" /> Đang khởi tạo...</> : '🚀 Tạo & Ghép video'}
              </button>
            </div>
          </>)}
        </div>
      )}

      {/* BATCH */}
      {tab === 'batch' && (
        <div className="card" style={{ marginBottom: 24 }}>
          <div className="form-group">
            <label className="form-label">Tên dự án</label>
            <input className="form-input" placeholder="Batch Project" value={bName} onChange={e => setBName(e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Prompts (mỗi dòng = 1 video · dùng @Tên để khoá mặt)</label>
            <textarea className="form-textarea" rows={8}
              placeholder={"@Naruto chạy trên mái nhà lúc hoàng hôn\n@Naruto và @Sasuke đối đầu giữa rừng tre\nCon rồng vàng bay qua thành phố đêm"}
              value={bPrompts} onChange={e => setBPrompts(e.target.value)} />
            <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>{bLines} prompts</div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Model</label>
              <select className="form-select" value={bModel} onChange={e => setBModel(e.target.value)}>
                {MODELS.map(m => <option key={m.key} value={m.key}>{m.label}</option>)}
              </select>
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Tỉ lệ</label>
              <select className="form-select" value={bAspect} onChange={e => setBAspect(e.target.value)}>
                {ASPECTS.map(a => <option key={a}>{a}</option>)}
              </select>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Thời lượng/scene</label>
              <div style={{ display: 'flex', gap: 4 }}>
                {DURATIONS.map(d => <button key={d} type="button" onClick={() => setBDuration(d)} className={bDuration === d ? 'btn btn-primary btn-sm' : 'btn btn-ghost btn-sm'} style={{ flex: 1 }}>{d}s</button>)}
              </div>
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Số bản/prompt</label>
              <div style={{ display: 'flex', gap: 4 }}>
                {[1,2,3,4].map(c => <button key={c} type="button" onClick={() => setBCount(c)} className={bCount === c ? 'btn btn-primary btn-sm' : 'btn btn-ghost btn-sm'} style={{ flex: 1 }}>x{c}</button>)}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 20, marginBottom: 16 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: 'var(--text2)' }}>
              <input type="checkbox" checked={bChain} onChange={e => setBChain(e.target.checked)} style={{ accentColor: 'var(--accent)', width: 14, height: 14 }} />
              <Link2 size={13} color="var(--accent2)" /> Chain mode
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: 'var(--text2)' }}>
              <input type="checkbox" checked={bI2V} onChange={e => setBI2V(e.target.checked)} style={{ accentColor: 'var(--accent)', width: 14, height: 14 }} />
              <Image size={13} color="var(--accent2)" /> I2V (animate ảnh)
            </label>
          </div>
          {bI2V && (
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: 'var(--bg3)', border: '1px dashed var(--border2)', borderRadius: 9, cursor: 'pointer', marginBottom: 16 }}>
              <Image size={16} color="var(--text3)" />
              <span style={{ fontSize: 12, color: 'var(--text2)' }}>{bStartImg ? bStartImg.name : 'Chọn ảnh gốc...'}</span>
              <input ref={bStartRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => setBStartImg(e.target.files?.[0] || null)} />
            </label>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ fontSize: 12, color: 'var(--text3)' }}>
              Ước tính: <strong style={{ color: estimatedCost === 0 ? 'var(--green)' : 'var(--yellow)' }}>
                {estimatedCost === 0 ? 'FREE' : `${estimatedCost} 💎`}
              </strong> · {bLines * bCount} videos
            </div>
            <button className="btn btn-primary" style={{ marginLeft: 'auto', minWidth: 200 }} onClick={createBatch} disabled={creating || !bLines}>
              {creating ? <><Loader2 size={13} className="spin" /> Đang tạo...</> : `⚡ Render ${bLines * bCount} videos${bChain ? ' ⛓' : ''}`}
            </button>
          </div>
        </div>
      )}

      {/* COPY */}
      {tab === 'copy' && (
        <div className="card" style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', marginBottom: 20, padding: '14px', background: 'rgba(249,115,22,0.05)', borderRadius: 10, border: '1px solid rgba(249,115,22,0.15)' }}>
            <span style={{ fontSize: 28 }}>🔍</span>
            <div>
              <div style={{ fontWeight: 600, marginBottom: 4 }}>Copy Idea</div>
              <div style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.6 }}>Paste URL video YouTube/TikTok → AI phân tích phong cách, kịch bản → tạo lại phiên bản của bạn</div>
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">URL video nguồn</label>
            <input className="form-input" placeholder="https://youtube.com/watch?v=..." value={copyUrl} onChange={e => setCopyUrl(e.target.value)} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px', gap: 12 }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Visual Style (tùy chọn)</label>
              <select className="form-select" value={copyStyle} onChange={e => setCopyStyle(e.target.value)}>
                {STYLES.map(s => <option key={s} value={s}>{s || '(Giữ nguyên style)'}</option>)}
              </select>
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Số scene</label>
              <input className="form-input" type="number" min={2} max={20} value={copyCount} onChange={e => setCopyCount(+e.target.value)} />
            </div>
          </div>
          <button className="btn btn-primary" style={{ width: '100%', marginTop: 16 }} onClick={doCopy} disabled={copyLoading || !copyUrl.trim()}>
            {copyLoading ? <><Loader2 size={13} className="spin" /> Đang phân tích video...</> : '🔍 Phân tích & Clone'}
          </button>
        </div>
      )}
    </div>
  )
}
