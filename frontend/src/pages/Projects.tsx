import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { projectsApi, toolsApi, charactersApi } from '../api/client'
import { pushLog } from './Dashboard'
import { Loader2, Link2 } from 'lucide-react'

const MODELS = [
  { key: 'veo_3_1_t2v_lite_low_priority', label: 'Veo 3.1 · Lite (Ưu tiên thấp) — FREE', cost: 0 },
  { key: 'veo_3_1_t2v_lite', label: 'Veo 3.1 · Lite', cost: 5 },
  { key: 'veo_3_1_t2v_fast_portrait_ultra', label: 'Veo 3.1 · Fast', cost: 10 },
  { key: 'veo_3_1_t2v_portrait', label: 'Veo 3.1 · Quality', cost: 100 },
  { key: 'abra_t2v_10s', label: 'Omni Flash (10s)', cost: 15 },
]
const ASPECTS = ['16:9', '9:16', '1:1', '4:3']
const DURATIONS = [4, 6, 8, 10]
const VOICES = [
  { id: 'Kore', label: 'Kore (nữ)' },
  { id: 'Aoede', label: 'Aoede (nữ)' },
  { id: 'Leda', label: 'Leda (nữ)' },
  { id: 'Puck', label: 'Puck (nam)' },
  { id: 'Charon', label: 'Charon (nam)' },
  { id: 'Orus', label: 'Orus (nam)' },
]

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
  const [mode, setMode] = useState<'ai' | 'manual'>('ai')        // AI viết | Tự nhập kịch bản
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
  const [scenes, setScenes] = useState<any[]>([])  // kịch bản chi tiết (beat/image/action/speaker/dialogue/prompt)
  const [styleList, setStyleList] = useState<{ id: string; name: string }[]>([])  // style packs từ server
  const [voiceover, setVoiceover] = useState(true)   // Auto lồng tiếng Việt — MẶC ĐỊNH BẬT
  const voice = 'Kore'                               // giọng mặc định (fallback) cho cảnh không rõ ai nói
  const [bibleChars, setBibleChars] = useState<any[]>([])           // hồ sơ nhân vật từ AI
  const [charVoices, setCharVoices] = useState<Record<string, string>>({})  // tên nhân vật -> giọng
  // Thêm nhân vật inline (giữ mặt) trong wizard
  const [addCharOpen, setAddCharOpen] = useState(false)
  const [newCharName, setNewCharName] = useState('')
  const [newCharFile, setNewCharFile] = useState<File | null>(null)
  const [addingChar, setAddingChar] = useState(false)
  const charFileRef = useRef<HTMLInputElement>(null)

  // "Từ prompt" tab: mỗi ô = 1 CẢNH của CÙNG 1 video -> render rồi ghép
  const [bName, setBName] = useState('')
  const [bScenes, setBScenes] = useState<{ prompt: string; narration: string }[]>([
    { prompt: '', narration: '' }, { prompt: '', narration: '' },
  ])
  const [bModel, setBModel] = useState(MODELS[0].key)
  const [bAspect, setBAspect] = useState('16:9')
  const [bDuration, setBDuration] = useState(8)
  const [bChain, setBChain] = useState(false)
  const [bVoiceover, setBVoiceover] = useState(true)   // mặc định bật lồng tiếng
  const [bVoice, setBVoice] = useState('Kore')

  // COPY tab
  const [copyUrl, setCopyUrl] = useState('')
  const [copyStyle, setCopyStyle] = useState('')
  const [copyCount, setCopyCount] = useState(6)
  const [copyLoading, setCopyLoading] = useState(false)

  useEffect(() => {
    projectsApi.list().then(setProjects)
    charactersApi.list().then(setChars)
    toolsApi.styles().then(setStyleList).catch(() => {})
  }, [])

  // Credit cost estimate
  const modelObj = MODELS.find(m => m.key === bModel) || MODELS[0]
  const bValid = bScenes.filter(s => s.prompt.trim())   // cảnh có prompt
  const bCost = modelObj.cost * bValid.length
  const bLenSec = bValid.length * bDuration
  const modelObjNew = MODELS.find(m => m.key === model) || MODELS[0]
  const fmtLen = (s: number) => s < 60 ? `${s}s` : `${Math.floor(s / 60)}p${s % 60 ? ` ${s % 60}s` : ''}`
  const fmtTC = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
  // Bước thiết lập: dùng số cảnh đang chọn
  const setupLenSec = sceneCount * duration
  // Bước duyệt: dùng số cảnh THỰC TẾ AI đã sinh ra
  const reviewN = (scenes.length || prompts.length) || sceneCount
  const reviewCost = modelObjNew.cost * reviewN
  const reviewLenSec = reviewN * duration
  const updateScene = (i: number, key: string, val: string) =>
    setScenes(prev => prev.map((x, idx) => idx === i ? { ...x, [key]: val } : x))

  async function genPrompts() {
    if (!idea.trim()) { setError('Nhập ý tưởng trước'); return }
    setError(''); setLoadingPrompts(true)
    try {
      const res = await toolsApi.autoprompt({ idea, scene_count: sceneCount, style: style || undefined, language, aspect_ratio: aspect })
      setPrompts(res.prompts); setNarrations(res.narrations); setScenes(res.scenes || [])
      const bc = res.characters || []
      setBibleChars(bc)
      setCharVoices(Object.fromEntries(bc.map((c: any) => [c.name, c.tts_voice || voice])))
      setStep('review')
      pushLog(`Đã viết kịch bản ${(res.scenes || res.prompts).length} cảnh`)
    } catch (e: any) { setError(e.response?.data?.detail || 'Lỗi tạo prompt') }
    finally { setLoadingPrompts(false) }
  }

  async function parseScript() {
    if (!idea.trim()) { setError('Dán kịch bản của bạn trước'); return }
    setError(''); setLoadingPrompts(true)
    try {
      const res = await toolsApi.parseScript({ script: idea, scene_count: sceneCount, language, aspect_ratio: aspect })
      setPrompts(res.prompts); setNarrations(res.narrations); setScenes(res.scenes || [])
      const bc = res.characters || []
      setBibleChars(bc)
      setCharVoices(Object.fromEntries(bc.map((c: any) => [c.name, c.tts_voice || voice])))
      setStep('review')
      pushLog(`Đã phân tích kịch bản ${(res.scenes || res.prompts).length} cảnh`)
    } catch (e: any) { setError(e.response?.data?.detail || 'Lỗi phân tích kịch bản') }
    finally { setLoadingPrompts(false) }
  }

  function addScene() {
    setScenes(prev => [...prev, { beat: '', image: '', action: '', speaker: '', dialogue: '', prompt: '' }])
  }
  function delScene(i: number) {
    setScenes(prev => prev.filter((_, idx) => idx !== i))
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
    // Nếu có kịch bản chi tiết -> lấy prompt (tiếng Anh) + lời thoại từ scenes (đã chỉnh sửa); else dùng format phẳng (Copy Idea)
    const basePrompts = scenes.length ? scenes.map(s => s.prompt || s.image || '') : prompts
    const baseNarr = scenes.length
      ? scenes.map(s => ((s.speaker || '').trim() ? `${s.speaker}: ` : '') + (s.dialogue || ''))
      : narrations
    // giọng riêng theo nhân vật nói trong mỗi cảnh (fallback giọng mặc định)
    const baseVoices = scenes.length ? scenes.map(s => charVoices[(s.speaker || '').trim()] || voice) : []
    if (!basePrompts.length) { setError('Viết kịch bản trước'); return }
    setError(''); setCreating(true)
    // Inject @CharName into prompts for selected chars
    const enriched = basePrompts.map(p => {
      const mentions = [...selectedChars].map(c => `@${c}`).join(' ')
      return selectedChars.size > 0 && !p.includes('@') ? `${mentions} ${p}` : p
    })
    try {
      const proj = await projectsApi.create({
        name: name || `Dự án ${new Date().toLocaleDateString('vi-VN')}`,
        idea, style: style || undefined, model_key: model,
        aspect_ratio: aspect, duration_seconds: duration, language,
        prompts: enriched, narrations: baseNarr, auto_render: autoRender,
        character_names: [...selectedChars],
        // id nhân vật được chọn -> backend clone thành nhân vật RIÊNG của project (giữ mặt)
        character_ids: chars.filter(c => selectedChars.has(c.name)).map(c => c.id),
        voiceover, voice, voices: baseVoices,
      })
      pushLog(`${autoRender ? 'Auto render' : 'Tạo'} dự án: ${proj.name}`)
      onCreated?.()
      nav(`/projects/${proj.id}`)
    } catch (e: any) { setError(e.response?.data?.detail || 'Tạo dự án thất bại'); setCreating(false) }
  }

  const addBScene = () => setBScenes(s => [...s, { prompt: '', narration: '' }])
  const delBScene = (i: number) => setBScenes(s => s.filter((_, idx) => idx !== i))
  const updBScene = (i: number, key: 'prompt' | 'narration', v: string) =>
    setBScenes(s => s.map((x, idx) => idx === i ? { ...x, [key]: v } : x))

  async function createBatch() {
    const valid = bScenes.filter(s => s.prompt.trim())
    if (!valid.length) { setError('Nhập ít nhất 1 cảnh có prompt'); return }
    setError(''); setCreating(true)
    try {
      const proj = await projectsApi.create({
        name: bName || `Video ${new Date().toLocaleDateString('vi-VN')}`,
        model_key: bModel, aspect_ratio: bAspect, duration_seconds: bDuration,
        prompts: valid.map(s => s.prompt.trim()),
        narrations: valid.map(s => s.narration.trim()),
        auto_render: true, chain_mode: bChain,
        voiceover: bVoiceover, voice: bVoice,
      })
      pushLog(`Tạo video từ ${valid.length} cảnh prompt${bChain ? ' (chain)' : ''}`)
      nav(`/projects/${proj.id}`)
    } catch (e: any) { setError(e.response?.data?.detail || 'Tạo video thất bại'); setCreating(false) }
  }

  async function doCopy() {
    if (!copyUrl.trim()) { setError('Nhập URL'); return }
    setError(''); setCopyLoading(true)
    try {
      const res = await toolsApi.copyIdea({ url: copyUrl, style: copyStyle || undefined, scene_count: copyCount })
      setName(res.title); setPrompts(res.prompts); setNarrations(res.narrations); setScenes([])
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
    <div style={{ maxWidth: 760, margin: '0 auto' }}>
      {/* Header + tabs */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20, flexWrap: 'wrap' }}>
        <div className="page-title" style={{ margin: 0 }}>Tạo dự án mới</div>
        <div className="cmp-tabs" style={{ marginLeft: 'auto' }}>
          {(['new', 'batch', 'copy'] as Tab[]).map(t => (
            <button key={t} className={tab === t ? 'on' : ''} onClick={() => { setTab(t); setError('') }}>
              {t === 'new' ? 'Tạo từ ý tưởng' : t === 'batch' ? 'Từ prompt' : 'Copy Idea'}
            </button>
          ))}
        </div>
      </div>

      {error && <div className="alert alert-error" style={{ marginBottom: 16 }}>{error}</div>}

      {/* NEW — Composer 2 bước */}
      {tab === 'new' && (
        <div className="composer">
          <div className="cmp-steps">
            <span className={step === 'setup' ? 'on' : ''}><i>01</i> Ý tưởng &amp; thiết lập</span>
            <span className="arr">→</span>
            <span className={step === 'review' ? 'on' : ''}>02 Duyệt kịch bản &amp; tạo</span>
          </div>

          {/* ─── BƯỚC 1: THIẾT LẬP ─── */}
          {step === 'setup' && (<>
            <div className="cmp-body">
              <div className="cmp-titlerow">
                <span className="cmp-tlabel">Tên dự án</span>
                <input className="cmp-titlein" placeholder="Tên phim của bạn..." value={name} onChange={e => setName(e.target.value)} />
              </div>

              <div className="cmp-tabs" style={{ marginBottom: 16 }}>
                <button className={mode === 'ai' ? 'on' : ''} onClick={() => setMode('ai')}>🤖 AI viết</button>
                <button className={mode === 'manual' ? 'on' : ''} onClick={() => setMode('manual')}>✍️ Tự nhập kịch bản</button>
              </div>

              <div className="cmp-herowrap">
                <svg className="cmp-spark" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M12 4l1.6 5.4L19 11l-5.4 1.6L12 18l-1.6-5.4L5 11l5.4-1.6z" /></svg>
                <textarea className="cmp-hero" style={{ minHeight: mode === 'manual' ? 160 : 96 }} value={idea} onChange={e => setIdea(e.target.value)}
                  placeholder={mode === 'manual'
                    ? 'Dán kịch bản của bạn (kèm lời thoại + tên nhân vật)...\nVD:\nCảnh 1: Mẹ ngồi gục ở quầy spa, mệt mỏi.\nLời thoại (Mẹ): "Cả ngày không có khách nào..."\nCảnh 2: Con trai bước vào...'
                    : 'Mô tả ý tưởng của bạn — càng chi tiết, AI viết càng sát...'} />
              </div>

              <div className="cmp-settings">
                <div className="cmp-ctrl">
                  <div className="cmp-label">Số cảnh</div>
                  <div className="stepper">
                    <button type="button" onClick={() => setSceneCount(c => Math.max(1, c - 1))}>−</button>
                    <input type="number" min={1} max={60} value={sceneCount}
                      onChange={e => setSceneCount(Math.min(60, Math.max(1, +e.target.value || 1)))} />
                    <button type="button" onClick={() => setSceneCount(c => Math.min(60, c + 1))}>+</button>
                  </div>
                </div>
                <div className="cmp-ctrl">
                  <div className="cmp-label">Thời lượng / cảnh <span className="rv">{duration}s</span></div>
                  <div className="seg2">
                    {DURATIONS.map(d => (
                      <button key={d} type="button" className={duration === d ? 'on' : ''} onClick={() => setDuration(d)}>{d}</button>
                    ))}
                  </div>
                </div>
                <div className="cmp-ctrl">
                  <div className="cmp-label">Model</div>
                  <div className="selwrap">
                    <select className="cmp-sel" value={model} onChange={e => setModel(e.target.value)}>
                      {MODELS.map(m => <option key={m.key} value={m.key}>{m.label}</option>)}
                    </select>
                    <svg className="chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
                  </div>
                </div>
                <div className="cmp-ctrl">
                  <div className="cmp-label">Tỉ lệ</div>
                  <div className="selwrap">
                    <select className="cmp-sel" value={aspect} onChange={e => setAspect(e.target.value)}>
                      {ASPECTS.map(a => <option key={a}>{a}</option>)}
                    </select>
                    <svg className="chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
                  </div>
                </div>
                <div className="cmp-ctrl">
                  <div className="cmp-label">Style</div>
                  <div className="selwrap">
                    <select className="cmp-sel" value={style} onChange={e => setStyle(e.target.value)}>
                      <option value="">Auto style</option>
                      {styleList.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                    <svg className="chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
                  </div>
                </div>
                <div className="cmp-ctrl">
                  <div className="cmp-label">Ngôn ngữ</div>
                  <div className="selwrap">
                    <select className="cmp-sel" value={language} onChange={e => setLanguage(e.target.value)}>
                      <option value="vi">🇻🇳 Việt</option>
                      <option value="en">🇺🇸 English</option>
                    </select>
                    <svg className="chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
                  </div>
                </div>
              </div>

              {/* Nhân vật của dự án — giữ mặt */}
              <div className="cmp-chiprow" style={{ marginBottom: 10 }}>
                <span className="cmp-clab">Giữ mặt</span>
                {chars.map(c => (
                  <div key={c.id} className={selectedChars.has(c.name) ? 'cmp-chip on' : 'cmp-chip'}
                    onClick={() => setSelectedChars(prev => { const n = new Set(prev); n.has(c.name) ? n.delete(c.name) : n.add(c.name); return n })}>
                    <img src={c.image_url} alt="" />@{c.name}
                  </div>
                ))}
                <div className="cmp-chip add" onClick={() => setAddCharOpen(o => !o)}>{addCharOpen ? '✕ đóng' : '+ thêm nhân vật'}</div>
              </div>
              {addCharOpen && (
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
                  <input className="cmp-sel" placeholder="Tên (vd: hero)" value={newCharName} onChange={e => setNewCharName(e.target.value)} style={{ flex: '0 0 160px' }} />
                  <label className="cmp-ghost" style={{ cursor: 'pointer' }}>
                    {newCharFile ? `📷 ${newCharFile.name.slice(0, 14)}` : '📁 Chọn ảnh'}
                    <input ref={charFileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => setNewCharFile(e.target.files?.[0] || null)} />
                  </label>
                  <button type="button" className="cmp-cta" onClick={addCharacter} disabled={addingChar || !newCharName.trim() || !newCharFile} style={{ padding: '10px 16px' }}>
                    {addingChar ? <Loader2 size={13} className="spin" /> : 'Lưu'}
                  </button>
                </div>
              )}

              {/* Auto lồng tiếng Việt */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 14, flexWrap: 'wrap' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: 'var(--text2)' }}>
                  <input type="checkbox" checked={voiceover} onChange={e => setVoiceover(e.target.checked)} style={{ accentColor: 'var(--accent)', width: 15, height: 15 }} />
                  🔊 Lồng tiếng Việt (AI đọc thoại từng cảnh)
                </label>
                {voiceover && (
                  <span style={{ fontSize: 11.5, color: 'var(--text3)' }}>· Giọng <strong>tự gán theo nhân vật</strong> (theo giới tính) — xem &amp; chỉnh ở bước Duyệt</span>
                )}
              </div>
            </div>

            <div className="cmp-actionbar">
              <div className="cmp-est">
                <span className="big">~{fmtLen(setupLenSec)}</span>
                <span className="meta">· {sceneCount}×{duration}s ·</span>
                <span className={modelObjNew.cost === 0 ? 'free' : ''}>{modelObjNew.cost === 0 ? 'FREE' : `${modelObjNew.cost * sceneCount} 💎`}</span>
              </div>
              <div style={{ flex: 1 }} />
              <button className="cmp-cta" onClick={mode === 'manual' ? parseScript : genPrompts} disabled={loadingPrompts || !idea.trim()}>
                {loadingPrompts ? <><Loader2 size={14} className="spin" /> Đang xử lý...</> : <><svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round"><path d="M12 4l1.6 5.4L19 11l-5.4 1.6L12 18l-1.6-5.4L5 11l5.4-1.6z" /></svg> {mode === 'manual' ? 'Phân tích kịch bản →' : 'Viết kịch bản →'}</>}
              </button>
            </div>
          </>)}

          {/* ─── BƯỚC 2: DUYỆT KỊCH BẢN ─── */}
          {step === 'review' && (<>
            <div className="cmp-body">
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

            {voiceover && bibleChars.length > 0 && (
              <div style={{ marginBottom: 14, padding: '12px 14px', background: 'var(--inset)', borderRadius: 11, border: '1px solid var(--border)' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 10 }}>🔊 Giọng nhân vật</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                  {bibleChars.map((c: any) => (
                    <div key={c.char_key || c.name} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 13, color: 'var(--text2)', fontWeight: 600 }}>{c.name || c.char_key}</span>
                      <div className="selwrap" style={{ width: 150 }}>
                        <select className="cmp-sel" value={charVoices[c.name] || c.tts_voice || voice} onChange={e => setCharVoices(v => ({ ...v, [c.name]: e.target.value }))}>
                          {VOICES.map(vo => <option key={vo.id} value={vo.id}>{vo.label}</option>)}
                        </select>
                        <svg className="chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 10, fontWeight: 600 }}>
              📝 Kịch bản chi tiết · {reviewN} cảnh — sửa trước khi tạo:
            </div>
            <div style={{ maxHeight: 440, overflowY: 'auto', marginBottom: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
              {scenes.length > 0 ? scenes.map((s, i) => (
                <div key={i} style={{ padding: '12px 14px', background: 'var(--inset)', borderRadius: 11, border: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#fff', background: 'var(--grad)', borderRadius: 6, padding: '2px 9px' }}>Cảnh {i + 1}</span>
                    <span style={{ fontFamily: 'ui-monospace,Menlo,monospace', fontSize: 11, color: 'var(--text3)' }}>{fmtTC(i * duration)}–{fmtTC((i + 1) * duration)}</span>
                    {s.beat && <span style={{ fontSize: 11.5, color: 'var(--accent3)', fontWeight: 600 }}>· {s.beat}</span>}
                    <button onClick={() => delScene(i)} title="Xoá cảnh" style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', fontSize: 14, lineHeight: 1 }}>✕</button>
                  </div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 5 }}>🎬 Mô tả hình ảnh</div>
                  <textarea className="form-textarea" rows={2} style={{ fontSize: 12.5, minHeight: 'auto', marginBottom: 9 }} value={s.image} onChange={e => updateScene(i, 'image', e.target.value)} />
                  <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 5 }}>🎬 Hành động</div>
                  <textarea className="form-textarea" rows={2} style={{ fontSize: 12.5, minHeight: 'auto', marginBottom: 9 }} value={s.action} onChange={e => updateScene(i, 'action', e.target.value)} />
                  <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 5 }}>🔊 Lời thoại</div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <input className="form-input" style={{ fontSize: 12.5, flex: '0 0 120px' }} placeholder="Người nói" value={s.speaker} onChange={e => updateScene(i, 'speaker', e.target.value)} />
                    <input className="form-input" style={{ fontSize: 12.5, flex: 1 }} placeholder="Lời thoại..." value={s.dialogue} onChange={e => updateScene(i, 'dialogue', e.target.value)} />
                  </div>
                  <details style={{ marginTop: 8 }}>
                    <summary style={{ fontSize: 11, color: 'var(--text3)', cursor: 'pointer' }}>⚙ Prompt Veo (English) — sửa nếu cần</summary>
                    <textarea className="form-textarea" rows={2} style={{ fontSize: 12, minHeight: 'auto', marginTop: 6 }} value={s.prompt} onChange={e => updateScene(i, 'prompt', e.target.value)} />
                  </details>
                </div>
              )) : prompts.map((p, i) => (
                <div key={i} style={{ padding: '10px 12px', background: 'var(--bg3)', borderRadius: 9, border: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#fff', background: 'var(--grad)', borderRadius: 5, padding: '1px 7px' }}>Cảnh {i + 1}</span>
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
            {scenes.length > 0 && (
              <button className="cmp-ghost" onClick={addScene} style={{ width: '100%', borderStyle: 'dashed' }}>+ Thêm cảnh</button>
            )}
            </div>
            <div className="cmp-actionbar">
              <button className="cmp-ghost" onClick={() => setStep('setup')} disabled={creating}>← Sửa lại</button>
              <div style={{ flex: 1 }} />
              <button className="cmp-ghost" onClick={() => createNew(false)} disabled={creating}>💾 Lưu nháp</button>
              <button className="cmp-cta" onClick={() => createNew(true)} disabled={creating}>
                {creating ? <><Loader2 size={14} className="spin" /> Đang khởi tạo...</> : '🚀 Tạo & Ghép video'}
              </button>
            </div>
          </>)}
        </div>
      )}

      {/* TỪ PROMPT — mỗi ô = 1 cảnh của CÙNG 1 video -> ghép */}
      {tab === 'batch' && (
        <div className="composer">
          <div className="cmp-body">
            <div className="cmp-titlerow">
              <span className="cmp-tlabel">Tên dự án</span>
              <input className="cmp-titlein" placeholder="Tên video của bạn..." value={bName} onChange={e => setBName(e.target.value)} />
            </div>

            <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 10, fontWeight: 600 }}>
              🎬 Mỗi ô = 1 <strong>CẢNH</strong> của video — render xong tự ghép thành 1 phim. Dùng <strong>@Tên</strong> để giữ mặt nhân vật.
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 12 }}>
              {bScenes.map((s, i) => (
                <div key={i} style={{ padding: '12px 14px', background: 'var(--inset)', borderRadius: 11, border: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#fff', background: 'var(--grad)', borderRadius: 6, padding: '2px 9px' }}>Cảnh {i + 1}</span>
                    <span style={{ fontFamily: 'ui-monospace,Menlo,monospace', fontSize: 11, color: 'var(--text3)' }}>{fmtTC(i * bDuration)}–{fmtTC((i + 1) * bDuration)}</span>
                    {bScenes.length > 1 && <button onClick={() => delBScene(i)} title="Xoá cảnh" style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', fontSize: 14, lineHeight: 1 }}>✕</button>}
                  </div>
                  <textarea className="form-textarea" rows={2} style={{ fontSize: 12.5, minHeight: 'auto', marginBottom: 8 }}
                    placeholder="Prompt cảnh này (mô tả hình ảnh + hành động)..." value={s.prompt} onChange={e => updBScene(i, 'prompt', e.target.value)} />
                  <input className="form-input" style={{ fontSize: 12.5 }} placeholder="🔊 Lời thoại (tuỳ chọn — để lồng tiếng)" value={s.narration} onChange={e => updBScene(i, 'narration', e.target.value)} />
                </div>
              ))}
            </div>
            <button className="cmp-ghost" onClick={addBScene} style={{ width: '100%', borderStyle: 'dashed', marginBottom: 18 }}>+ Thêm cảnh</button>

            <div className="cmp-settings">
              <div className="cmp-ctrl">
                <div className="cmp-label">Model</div>
                <div className="selwrap">
                  <select className="cmp-sel" value={bModel} onChange={e => setBModel(e.target.value)}>
                    {MODELS.map(m => <option key={m.key} value={m.key}>{m.label}</option>)}
                  </select>
                  <svg className="chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
                </div>
              </div>
              <div className="cmp-ctrl">
                <div className="cmp-label">Tỉ lệ</div>
                <div className="selwrap">
                  <select className="cmp-sel" value={bAspect} onChange={e => setBAspect(e.target.value)}>
                    {ASPECTS.map(a => <option key={a}>{a}</option>)}
                  </select>
                  <svg className="chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
                </div>
              </div>
              <div className="cmp-ctrl">
                <div className="cmp-label">Thời lượng / cảnh <span className="rv">{bDuration}s</span></div>
                <div className="seg2">
                  {DURATIONS.map(d => <button key={d} type="button" className={bDuration === d ? 'on' : ''} onClick={() => setBDuration(d)}>{d}</button>)}
                </div>
              </div>
              <div className="cmp-ctrl">
                <div className="cmp-label">Tuỳ chọn</div>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: 'var(--text2)', height: 38 }}>
                  <input type="checkbox" checked={bChain} onChange={e => setBChain(e.target.checked)} style={{ accentColor: 'var(--accent)', width: 14, height: 14 }} />
                  <Link2 size={13} color="var(--accent2)" /> Chain (nối khung hình)
                </label>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 6, flexWrap: 'wrap' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: 'var(--text2)' }}>
                <input type="checkbox" checked={bVoiceover} onChange={e => setBVoiceover(e.target.checked)} style={{ accentColor: 'var(--accent)', width: 15, height: 15 }} />
                🔊 Lồng tiếng Việt (đọc lời thoại)
              </label>
              {bVoiceover && (
                <div className="selwrap" style={{ width: 170 }}>
                  <select className="cmp-sel" value={bVoice} onChange={e => setBVoice(e.target.value)}>
                    {VOICES.map(v => <option key={v.id} value={v.id}>{v.label}</option>)}
                  </select>
                  <svg className="chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
                </div>
              )}
            </div>
          </div>

          <div className="cmp-actionbar">
            <div className="cmp-est">
              <span className="big">~{fmtLen(bLenSec)}</span>
              <span className="meta">· {bValid.length}×{bDuration}s ·</span>
              <span className={bCost === 0 ? 'free' : ''}>{bCost === 0 ? 'FREE' : `${bCost} 💎`}</span>
            </div>
            <div style={{ flex: 1 }} />
            <button className="cmp-cta" onClick={createBatch} disabled={creating || !bValid.length}>
              {creating ? <><Loader2 size={14} className="spin" /> Đang tạo...</> : '🚀 Tạo & Ghép video'}
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
                <option value="">(Giữ nguyên style)</option>
                {styleList.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
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
