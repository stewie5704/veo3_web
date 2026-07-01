import { useState, useEffect, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { projectsApi, toolsApi, charactersApi } from '../api/client'
import { pushLog } from './Dashboard'
import { Loader2, Link2, Sparkles, PenLine, Volume2, Mic, MessagesSquare, VolumeX, Plus, X, Search, Users, Clapperboard, Rocket, List } from 'lucide-react'
import SellVideo from '../components/SellVideo'

// Các bước hiển thị khi đang phân tích + tạo (cho cảm giác đang chạy, đỡ thấy lâu)
const CREATE_STEPS = [
  { icon: Search, text: 'Đang đọc kịch bản của bạn...' },
  { icon: Users, text: 'Nhận diện nhân vật & bối cảnh...' },
  { icon: Clapperboard, text: 'Dựng từng cảnh quay...' },
  { icon: Sparkles, text: 'Tối ưu câu lệnh cho Veo...' },
  { icon: Rocket, text: 'Khởi tạo & bắt đầu render...' },
]

type AudioMode = 'voiceover' | 'character_speak' | 'off'
const AUDIO_OPTS = [
  { v: 'voiceover', icon: Mic, t: 'Lồng tiếng (AI đọc)', d: 'Giọng đọc đè lên — rõ tiếng Việt, mồm không khớp' },
  { v: 'character_speak', icon: MessagesSquare, t: 'Nhân vật tự nói', d: 'Veo cho nhân vật nói, mồm nhép theo lời (giọng có thể chưa chuẩn)' },
  { v: 'off', icon: VolumeX, t: 'Không tiếng', d: 'Chỉ hình' },
] as const

// Bộ chọn âm thanh dùng CHUNG cho cả 3 tab (Tạo ý tưởng / Mô tả từng cảnh / Chép ý tưởng)
function AudioPicker({ value, onChange }: { value: AudioMode; onChange: (v: AudioMode) => void }) {
  return (
    <div>
      <div style={{ marginBottom: 9 }}>
        <span className="cmp-clab"><Volume2 size={13} style={{ color: 'var(--accent2)' }} /> Âm thanh</span>
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {AUDIO_OPTS.map(o => {
          const Icon = o.icon
          return (
            <button key={o.v} type="button" onClick={() => onChange(o.v)} title={o.d}
              className={value === o.v ? 'cmp-audio on' : 'cmp-audio'}>
              <div className="t"><Icon size={15} /> {o.t}</div>
              <div className="d">{o.d}</div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

const MODELS = [
  { key: 'veo_3_1_t2v_lite_low_priority', label: 'Veo 3.1 · Lite (Lower Priority) — FREE', cost: 0 },
  { key: 'veo_3_1_t2v_lite', label: 'Veo 3.1 · Lite — 5💎', cost: 5 },
  { key: 'veo_3_1_t2v_fast_portrait_ultra', label: 'Veo 3.1 · Fast — 10💎', cost: 10 },
  { key: 'veo_3_1_t2v_portrait', label: 'Veo 3.1 · Quality — 100💎', cost: 100 },
  { key: 'abra_t2v_10s', label: 'Omni Flash (10s) — 15💎', cost: 15 },
]
const ASPECTS = ['16:9', '9:16', '1:1']   // Veo chỉ hỗ trợ 3 tỉ lệ thật (4:3/3:4 bị map về ngang/dọc)
const DURATIONS = [4, 6, 8, 10]
const VOICES = [
  { id: 'Kore', label: 'Kore (nữ)' },
  { id: 'Aoede', label: 'Aoede (nữ)' },
  { id: 'Leda', label: 'Leda (nữ)' },
  { id: 'Puck', label: 'Puck (nam)' },
  { id: 'Charon', label: 'Charon (nam)' },
  { id: 'Orus', label: 'Orus (nam)' },
]

type Tab = 'new' | 'batch' | 'copy' | 'sell'

export default function Projects({ user, onCreated }: { user: any; onCreated?: () => void }) {
  const nav = useNavigate()
  const [sp] = useSearchParams()
  const [tab, setTab] = useState<Tab>((sp.get('tab') as Tab) || 'new')
  useEffect(() => { const t = sp.get('tab'); if (t) setTab(t as Tab) }, [sp])
  const [error, setError] = useState('')
  const [creating, setCreating] = useState(false)
  const [projects, setProjects] = useState<any[]>([])
  const [chars, setChars] = useState<any[]>([])
  const [selectedChars, setSelectedChars] = useState<Set<string>>(new Set())

  // NEW tab
  const [step, setStep] = useState<'setup' | 'review'>('setup')  // wizard: thiết lập -> duyệt kịch bản
  const [mode, setMode] = useState<'ai' | 'manual' | 'storyboard' | 'prompts'>('ai')   // AI viết | Tự nhập kịch bản | Đọc storyboard | Dán Prompts
  const [name, setName] = useState('')
  const [idea, setIdea] = useState('')
  const [sceneCount, setSceneCount] = useState(6)
  const [style, setStyle] = useState('')
  const [model, setModel] = useState(MODELS[0].key)
  const [aspect, setAspect] = useState('16:9')
  const [duration, setDuration] = useState(8)
  const [language, setLanguage] = useState('vi')
  const [loadingPrompts, setLoadingPrompts] = useState(false)
  const [loadStep, setLoadStep] = useState(0)   // bước hiển thị trong overlay "đang tạo"
  const [prompts, setPrompts] = useState<string[]>([])
  const [narrations, setNarrations] = useState<string[]>([])
  const [scenes, setScenes] = useState<any[]>([])  // kịch bản chi tiết (beat/image/action/speaker/dialogue/prompt)
  const [styleList, setStyleList] = useState<{ id: string; name: string }[]>([])  // style packs từ server
  // Âm thanh: 'voiceover' (TTS đọc thoại ghép) | 'character_speak' (Veo cho nhân vật tự nói, nhép miệng) | 'off'
  const [audioMode, setAudioMode] = useState<'voiceover' | 'character_speak' | 'off'>('voiceover')
  const voiceover = audioMode === 'voiceover'   // picker giọng TTS chỉ hiện ở chế độ này
  const voice = 'Kore'                               // giọng mặc định (fallback) cho cảnh không rõ ai nói
  const [bibleChars, setBibleChars] = useState<any[]>([])           // hồ sơ nhân vật từ AI
  const [charVoices, setCharVoices] = useState<Record<string, string>>({})  // tên nhân vật -> giọng
  // Thêm nhân vật inline (giữ mặt) trong wizard
  const [addCharOpen, setAddCharOpen] = useState(false)
  const [newCharName, setNewCharName] = useState('')
  const [newCharFile, setNewCharFile] = useState<File | null>(null)
  const [addingChar, setAddingChar] = useState(false)
  const charFileRef = useRef<HTMLInputElement>(null)
  // Đọc storyboard: ảnh grid / PDF -> AI trích từng khung thành cảnh
  const [sbFiles, setSbFiles] = useState<File[]>([])
  const sbFileRef = useRef<HTMLInputElement>(null)

  // "Từ prompt" tab: mỗi ô = 1 CẢNH của CÙNG 1 video -> render rồi ghép
  const [bName, setBName] = useState('')
  const [bScenes, setBScenes] = useState<{ prompt: string; narration: string }[]>([
    { prompt: '', narration: '' }, { prompt: '', narration: '' },
  ])
  const [bModel, setBModel] = useState(MODELS[0].key)
  const [bAspect, setBAspect] = useState('16:9')
  const [bDuration, setBDuration] = useState(8)
  const [bChain, setBChain] = useState(false)
  const [bAudioMode, setBAudioMode] = useState<AudioMode>('voiceover')
  const [bVoice, setBVoice] = useState('Kore')

  // COPY tab
  const [copyUrl, setCopyUrl] = useState('')
  const [copyStyle, setCopyStyle] = useState('')
  const [copyCount, setCopyCount] = useState(6)
  const [copyAspect, setCopyAspect] = useState('9:16')
  const [copyLoading, setCopyLoading] = useState(false)

  useEffect(() => {
    projectsApi.list().then(setProjects)
    charactersApi.list().then(setChars)
    toolsApi.styles().then(setStyleList).catch(() => {})
  }, [])

  // Spotlight viền theo chuột: cập nhật toạ độ con trỏ vào CSS var của surface đang rê (rAF throttle)
  useEffect(() => {
    let raf = 0
    const onMove = (e: MouseEvent) => {
      if (raf) return
      raf = requestAnimationFrame(() => {
        raf = 0
        const el = (e.target as HTMLElement)?.closest?.('.fx-card') as HTMLElement | null
        if (!el) return
        const r = el.getBoundingClientRect()
        el.style.setProperty('--spot-x', `${e.clientX - r.left}px`)
        el.style.setProperty('--spot-y', `${e.clientY - r.top}px`)
      })
    }
    window.addEventListener('mousemove', onMove, { passive: true })
    return () => { window.removeEventListener('mousemove', onMove); if (raf) cancelAnimationFrame(raf) }
  }, [])

  // Overlay "đang tạo" (manual): cuộn qua các bước ~1.8s để cảm giác đang chạy
  const overlayOn = tab === 'new' && (loadingPrompts || creating)
  useEffect(() => {
    if (!overlayOn) { setLoadStep(0); return }
    const id = setInterval(() => setLoadStep(s => Math.min(s + 1, CREATE_STEPS.length - 1)), 1800)
    return () => clearInterval(id)
  }, [overlayOn])

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

  // AI viết kịch bản xong là TẠO + RENDER thẳng (vào hàng chờ) — BỎ bước duyệt prompt.
  async function genPrompts() {
    if (!idea.trim()) { setError('Nhập ý tưởng trước'); return }
    setError(''); setLoadingPrompts(true)
    try {
      const res = await toolsApi.autoprompt({ idea, scene_count: sceneCount, style: style || undefined, language, aspect_ratio: aspect })
      const bc = res.characters || []
      const cv = Object.fromEntries(bc.map((c: any) => [c.name, c.tts_voice || voice]))
      setScenes(res.scenes || []); setBibleChars(bc); setCharVoices(cv)
      const n = (res.scenes?.length || res.prompts?.length || 0)
      pushLog(`Đã viết kịch bản ${n} cảnh`)
      const cost = modelObjNew.cost * n
      if (cost > 0 && !window.confirm(`Tạo ${n} cảnh — tốn khoảng ${cost} 💎. Tiếp tục?`)) { setLoadingPrompts(false); return }
      await createNew(true, { scenes: res.scenes || [], prompts: res.prompts || [], narrations: res.narrations || [], bible: bc, charVoices: cv })
    } catch (e: any) { setError(e.response?.data?.detail || 'Lỗi tạo prompt'); setLoadingPrompts(false) }
  }

  // Tự nhập kịch bản: phân tích xong TẠO + RENDER thẳng — BỎ bước duyệt (user đã có kịch bản rồi).
  async function parseScript() {
    if (!idea.trim()) { setError('Dán kịch bản của bạn trước'); return }
    setError(''); setLoadingPrompts(true)
    try {
      const res = await toolsApi.parseScript({ script: idea, scene_count: sceneCount, language, aspect_ratio: aspect })
      const bc = res.characters || []
      const cv = Object.fromEntries(bc.map((c: any) => [c.name, c.tts_voice || voice]))
      setPrompts(res.prompts); setNarrations(res.narrations); setScenes(res.scenes || []); setBibleChars(bc); setCharVoices(cv)
      const n = (res.scenes?.length || res.prompts?.length || 0)
      pushLog(`Đã phân tích kịch bản ${n} cảnh`)
      // Chỉ hỏi xác nhận khi TỐN Gem (model trả phí); model free thì tạo luôn cho nhanh.
      const cost = modelObjNew.cost * n
      if (cost > 0 && !window.confirm(`Tạo ${n} cảnh — tốn khoảng ${cost} 💎. Tiếp tục?`)) { setLoadingPrompts(false); return }
      await createNew(true, { scenes: res.scenes || [], prompts: res.prompts || [], narrations: res.narrations || [], bible: bc, charVoices: cv })
    } catch (e: any) { setError(e.response?.data?.detail || 'Lỗi phân tích kịch bản'); setLoadingPrompts(false) }
  }

  // Dán Prompts: 1 dòng = 1 prompt = 1 cảnh. TẠO + RENDER thẳng.
  async function parsePromptsLocally() {
    if (!idea.trim()) { setError('Dán prompts của bạn trước'); return }
    const lines = idea.split('\n').map(l => l.trim()).filter(l => l.length > 0)
    if (!lines.length) { setError('Không tìm thấy prompt hợp lệ'); return }
    
    const n = lines.length
    pushLog(`Đã đọc ${n} prompts`)
    
    const cost = modelObjNew.cost * n
    if (cost > 0 && !window.confirm(`Tạo ${n} cảnh — tốn khoảng ${cost} 💎. Tiếp tục?`)) { return }
    
    await createNew(true, { scenes: [], prompts: lines, narrations: new Array(n).fill(''), bible: [], charVoices: {} })
  }

  // Đọc storyboard (ảnh grid / PDF) -> trích cảnh -> TẠO + RENDER thẳng (số cảnh = số khung, để AI tự đếm).
  async function readStoryboard() {
    if (!sbFiles.length) { setError('Chọn ảnh storyboard hoặc PDF trước'); return }
    setError(''); setLoadingPrompts(true)
    try {
      const res = await toolsApi.parseStoryboard(sbFiles, { scene_count: 0, language, aspect_ratio: aspect, style: style || undefined })
      const bc = res.characters || []
      const cv = Object.fromEntries(bc.map((c: any) => [c.name, c.tts_voice || voice]))
      setPrompts(res.prompts); setNarrations(res.narrations); setScenes(res.scenes || []); setBibleChars(bc); setCharVoices(cv)
      const n = (res.scenes?.length || res.prompts?.length || 0)
      pushLog(`Đã đọc storyboard ${n} cảnh`)
      if (!n) { setError('Không đọc được khung nào từ storyboard — thử ảnh rõ hơn.'); setLoadingPrompts(false); return }
      const cost = modelObjNew.cost * n
      if (cost > 0 && !window.confirm(`Tạo ${n} cảnh — tốn khoảng ${cost} 💎. Tiếp tục?`)) { setLoadingPrompts(false); return }
      await createNew(true, { scenes: res.scenes || [], prompts: res.prompts || [], narrations: res.narrations || [], bible: bc, charVoices: cv })
    } catch (e: any) { setError(e.response?.data?.detail || 'Lỗi đọc storyboard'); setLoadingPrompts(false) }
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

  // data: cho phép tạo THẲNG từ kết quả phân tích (bỏ bước duyệt) thay vì đọc từ state (chưa kịp cập nhật)
  async function createNew(autoRender: boolean, data?: { scenes?: any[]; prompts?: string[]; narrations?: string[]; bible?: any[]; charVoices?: Record<string, string>; name?: string; style?: string; aspect?: string }) {
    const sScenes = data?.scenes ?? scenes
    const sPrompts = data?.prompts ?? prompts
    const sNarr = data?.narrations ?? narrations
    const sBible = data?.bible ?? bibleChars
    const sCharVoices = data?.charVoices ?? charVoices
    const sName = data?.name ?? name
    const sStyle = data?.style ?? style
    const sAspect = data?.aspect ?? aspect
    // Nếu có kịch bản chi tiết -> lấy prompt (tiếng Anh) + lời thoại từ scenes (đã chỉnh sửa); else dùng format phẳng (Copy Idea)
    const basePrompts = sScenes.length ? sScenes.map(s => s.prompt || s.image || '') : sPrompts
    const baseNarr = sScenes.length
      ? sScenes.map(s => ((s.speaker || '').trim() ? `${s.speaker}: ` : '') + (s.dialogue || ''))
      : sNarr
    // giọng riêng theo nhân vật nói trong mỗi cảnh (fallback giọng mặc định)
    const baseVoices = sScenes.length ? sScenes.map(s => sCharVoices[(s.speaker || '').trim()] || voice) : []
    if (!basePrompts.length) { setError('Viết kịch bản trước'); return }
    setError(''); setCreating(true)
    // Inject @CharName into prompts for selected chars
    const enriched = basePrompts.map(p => {
      const mentions = [...selectedChars].map(c => `@${c}`).join(' ')
      return selectedChars.size > 0 && !p.includes('@') ? `${mentions} ${p}` : p
    })
    try {
      const proj = await projectsApi.create({
        name: sName || `Dự án ${new Date().toLocaleDateString('vi-VN')}`,
        idea, style: sStyle || undefined, model_key: model,
        aspect_ratio: sAspect, duration_seconds: duration, language,
        prompts: enriched, narrations: baseNarr, auto_render: autoRender,
        character_names: [...selectedChars],
        // id nhân vật được chọn -> backend clone thành nhân vật RIÊNG của project (giữ mặt)
        character_ids: chars.filter(c => selectedChars.has(c.name)).map(c => c.id),
        audio_mode: audioMode, voiceover, voice, voices: baseVoices,
        character_bible: sBible,   // -> backend sinh chân dung AI giữ mặt mọi cảnh
      })
      pushLog(`${autoRender ? 'Auto render' : 'Tạo'} dự án: ${proj.name}`)
      onCreated?.()
      nav(`/projects/${proj.id}`)
    } catch (e: any) { setError(e.response?.data?.detail || 'Tạo dự án thất bại'); setCreating(false); setLoadingPrompts(false) }
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
        audio_mode: bAudioMode, voiceover: bAudioMode === 'voiceover', voice: bVoice,
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
      pushLog(`Chép ý tưởng: ${res.prompts.length} cảnh`)
      const cost = modelObjNew.cost * (res.prompts?.length || 0)
      setCopyLoading(false)
      if (cost > 0 && !window.confirm(`Tạo ${res.prompts.length} cảnh — tốn khoảng ${cost} 💎. Tiếp tục?`)) return
      await createNew(true, { name: res.title, prompts: res.prompts, narrations: res.narrations, style: copyStyle, bible: [], aspect: copyAspect })
    } catch (e: any) { setError(e.response?.data?.detail || 'Phân tích thất bại'); setCopyLoading(false) }
  }

  async function delProject(id: string, e: React.MouseEvent) {
    e.stopPropagation()
    if (!confirm('Xóa dự án này?')) return
    await projectsApi.delete(id)
    setProjects(ps => ps.filter(p => p.id !== id))
  }

  return (
    <div style={{ maxWidth: tab === 'sell' ? '100%' : 760, margin: '0 auto' }}>
      <div className="fx-grain" aria-hidden="true" />
      {/* Overlay tiến trình khi phân tích + tạo (manual) — đỡ cảm giác chờ lâu */}
      {overlayOn && (() => {
        const StepIcon = CREATE_STEPS[loadStep].icon
        return (
          <div style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(11,9,17,0.8)', backdropFilter: 'blur(7px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
            <div style={{ textAlign: 'center', maxWidth: 400 }}>
              <div className="creating-orb"><StepIcon size={30} color="#fff" /></div>
              <div style={{ fontSize: 16, fontWeight: 700, marginTop: 22, marginBottom: 6, color: 'var(--text)' }}>
                {CREATE_STEPS[loadStep].text}
              </div>
              <div style={{ fontSize: 12.5, color: 'var(--text3)' }}>Đang dựng phim từ kịch bản của bạn — chỉ vài giây ☕</div>
              <div className="load-bar"><div className="load-bar-fill" /></div>
            </div>
          </div>
        )
      })()}
      {/* Header — chế độ chọn ở sidebar (mục con của "Tạo video") */}
      <div className="page-header">
        <div>
          <div className="page-title" style={{ margin: 0 }}>Tạo video</div>
          <div className="page-subtitle">
            {tab === 'new' ? 'Tạo từ ý tưởng' : tab === 'batch' ? 'Từ mô tả từng cảnh' : tab === 'copy' ? 'Chép ý tưởng' : 'Video bán hàng'}
          </div>
        </div>
      </div>

      {error && <div className="alert alert-error" style={{ marginBottom: 16 }}>{error}</div>}

      {/* NEW — Composer 2 bước */}
      {tab === 'new' && (
        <div className="composer fx-card">
          <div className="cmp-steps">
            <span className="on"><i>✦</i> Tạo từ ý tưởng — AI tự viết kịch bản &amp; render thẳng</span>
          </div>

          {/* ─── BƯỚC 1: THIẾT LẬP ─── */}
          {step === 'setup' && (<>
            <div className="cmp-body">
              <div className="cmp-titlerow">
                <span className="cmp-tlabel">Tên dự án</span>
                <input className="cmp-titlein" placeholder="Tên phim của bạn..." value={name} onChange={e => setName(e.target.value)} />
              </div>

              <div className="cmp-tabs" style={{ marginBottom: 14 }}>
                <button className={mode === 'ai' ? 'on' : ''} onClick={() => setMode('ai')}><Sparkles size={14} /> AI viết</button>
                <button className={mode === 'manual' ? 'on' : ''} onClick={() => setMode('manual')}><PenLine size={14} /> Tự nhập kịch bản</button>
                <button className={mode === 'prompts' ? 'on' : ''} onClick={() => setMode('prompts')}><List size={14} /> Dán Prompts</button>
                <button className={mode === 'storyboard' ? 'on' : ''} onClick={() => setMode('storyboard')}><Clapperboard size={14} /> Đọc storyboard</button>
              </div>

              {mode === 'storyboard' ? (
                <div style={{ marginBottom: 4 }}>
                  <label htmlFor="sb-input" style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8,
                    minHeight: 130, padding: '20px 16px', cursor: 'pointer', textAlign: 'center',
                    border: '1.5px dashed var(--line, #2a2740)', borderRadius: 14, background: 'rgba(255,255,255,0.02)',
                  }}>
                    <Clapperboard size={26} style={{ color: 'var(--accent2)' }} />
                    <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>Chọn ảnh storyboard hoặc PDF</div>
                    <div style={{ fontSize: 12, color: 'var(--text3)', maxWidth: 420 }}>
                      1 ảnh nhiều khung (grid), nhiều ảnh rời, hoặc PDF. AI đọc từng khung → tự viết prompt + lời thoại.
                      <strong> Số cảnh = số khung.</strong> Tối đa 10 file, ~18MB.
                    </div>
                    <input id="sb-input" ref={sbFileRef} type="file" accept="image/*,application/pdf" multiple style={{ display: 'none' }}
                      onChange={e => { const fs = Array.from(e.target.files || []); if (fs.length) setSbFiles(prev => [...prev, ...fs].slice(0, 10)); if (sbFileRef.current) sbFileRef.current.value = '' }} />
                  </label>
                  {sbFiles.length > 0 && (
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
                      {sbFiles.map((f, i) => (
                        <span key={i} className="cmp-chip" style={{ cursor: 'default', gap: 6 }}>
                          {f.type === 'application/pdf' ? '📄' : '🖼️'} {f.name.length > 22 ? f.name.slice(0, 20) + '…' : f.name}
                          <X size={13} style={{ cursor: 'pointer' }} onClick={() => setSbFiles(prev => prev.filter((_, j) => j !== i))} />
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="cmp-herowrap">
                  <svg className="cmp-spark" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M12 4l1.6 5.4L19 11l-5.4 1.6L12 18l-1.6-5.4L5 11l5.4-1.6z" /></svg>
                  <textarea className="cmp-hero" style={{ minHeight: mode === 'manual' || mode === 'prompts' ? 160 : 96 }} value={idea} onChange={e => setIdea(e.target.value)}
                    placeholder={mode === 'manual'
                      ? 'Dán kịch bản của bạn (kèm lời thoại + tên nhân vật)...\nVD:\nCảnh 1: Mẹ ngồi gục ở quầy spa, mệt mỏi.\nLời thoại (Mẹ): "Cả ngày không có khách nào..."\nCảnh 2: Con trai bước vào...'
                      : mode === 'prompts'
                      ? 'Dán danh sách prompt của bạn (1 dòng = 1 prompt = 1 cảnh)...\nVD:\nA cinematic shot of a mountain at sunset\nA person walking in the snow\n...'
                      : 'Mô tả ý tưởng của bạn — càng chi tiết, AI viết càng sát...'} />
                </div>
              )}

              <div className="cmp-settings">
                <div className="cmp-ctrl">
                  <div className="cmp-label">Số cảnh {sceneCount > 30 && <span className="rv" style={{ color: 'var(--accent2)' }}>tạo nhanh ⚡</span>}</div>
                  <div className="stepper">
                    <button type="button" onClick={() => setSceneCount(c => Math.max(1, c - 1))}>−</button>
                    <input type="number" min={1} max={600} value={sceneCount}
                      onChange={e => setSceneCount(Math.min(600, Math.max(1, +e.target.value || 1)))} />
                    <button type="button" onClick={() => setSceneCount(c => Math.min(600, c + 1))}>+</button>
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
                  <div className="cmp-label">Chất lượng video</div>
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
              <div className="cmp-chiprow" style={{ marginBottom: 24 }}>
                <span className="cmp-clab">Giữ mặt</span>
                {chars.length === 0 && (
                  <span style={{ fontSize: 12, color: 'var(--text3)' }}>Thêm ảnh để nhân vật giữ nguyên khuôn mặt qua các cảnh.</span>
                )}
                {chars.map(c => (
                  <div key={c.id} className={selectedChars.has(c.name) ? 'cmp-chip on' : 'cmp-chip'}
                    onClick={() => setSelectedChars(prev => { const n = new Set(prev); n.has(c.name) ? n.delete(c.name) : n.add(c.name); return n })}>
                    <img src={c.image_url} alt="" />@{c.name}
                  </div>
                ))}
                <div className="cmp-chip add" onClick={() => setAddCharOpen(o => !o)} title="Tải ảnh để AI giữ đúng mặt nhân vật qua các cảnh">
                  {addCharOpen ? <><X size={13} /> đóng</> : <><Plus size={13} /> thêm nhân vật</>}
                </div>
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

              {/* Âm thanh: chọn 1 trong 3 (component dùng chung) */}
              <div style={{ marginTop: 24 }}>
                <AudioPicker value={audioMode} onChange={setAudioMode} />
                {voiceover && (
                  <div style={{ fontSize: 11.5, color: 'var(--text3)', marginTop: 8 }}>Giọng <strong>tự gán theo nhân vật</strong> (theo giới tính) — chỉnh ở bước Duyệt.</div>
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
              <button className="cmp-cta"
                onClick={mode === 'storyboard' ? readStoryboard : mode === 'manual' ? parseScript : mode === 'prompts' ? parsePromptsLocally : genPrompts}
                disabled={loadingPrompts || creating || (mode === 'storyboard' ? sbFiles.length === 0 : !idea.trim())}>
                {loadingPrompts || creating
                  ? <><Loader2 size={14} className="spin" /> {mode === 'storyboard' ? 'Đang đọc storyboard...' : mode === 'manual' ? 'Đang phân tích & tạo...' : 'Đang tạo...'}</>
                  : <><svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round"><path d="M12 4l1.6 5.4L19 11l-5.4 1.6L12 18l-1.6-5.4L5 11l5.4-1.6z" /></svg> {mode === 'storyboard' ? 'Đọc storyboard & tạo phim →' : mode === 'manual' ? 'Phân tích & tạo phim →' : mode === 'prompts' ? 'Tạo phim từ Prompts →' : 'AI viết & tạo phim →'}</>}
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
              {loadingPrompts
                ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, color: 'var(--accent2)' }}>
                    <Loader2 size={13} className="spin" /> 🪄 AI đang viết kịch bản {sceneCount} cảnh — vài giây...
                  </span>
                : <>📝 Kịch bản chi tiết · {reviewN} cảnh — sửa trước khi tạo:</>}
            </div>
            <div style={{ maxHeight: 440, overflowY: 'auto', marginBottom: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
              {loadingPrompts ? Array.from({ length: Math.min(sceneCount, 8) }).map((_, i) => (
                <div key={i} style={{ padding: '12px 14px', background: 'var(--inset)', borderRadius: 11, border: '1px solid var(--border)' }}>
                  <div className="skel" style={{ height: 14, width: 96, marginBottom: 10 }} />
                  <div className="skel" style={{ height: 28, width: '100%', marginBottom: 8 }} />
                  <div className="skel" style={{ height: 28, width: '85%' }} />
                </div>
              )) : scenes.length > 0 ? scenes.map((s, i) => (
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
                    <summary style={{ fontSize: 11, color: 'var(--text3)', cursor: 'pointer' }}>⚙ Mô tả cảnh — sửa nếu cần</summary>
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
                    placeholder="Mô tả cảnh"
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
              <button className="cmp-ghost" onClick={() => createNew(false)} disabled={creating || loadingPrompts}>💾 Lưu nháp</button>
              <button className="cmp-cta" onClick={() => {
                const n = reviewN
                const msg = reviewCost === 0
                  ? `Tạo video ${n} cảnh bằng model Miễn phí — KHÔNG tốn credit (0 💎). Tiếp tục?`
                  : `Tạo video ${n} cảnh — tốn khoảng ${reviewCost} 💎. Tiếp tục?`
                if (!window.confirm(msg)) return
                createNew(true)
              }} disabled={creating || loadingPrompts}>
                {creating ? <><Loader2 size={14} className="spin" /> Đang khởi tạo...</> : '🚀 Tạo & Ghép video'}
              </button>
            </div>
          </>)}
        </div>
      )}

      {/* TỪ PROMPT — mỗi ô = 1 cảnh của CÙNG 1 video -> ghép */}
      {tab === 'batch' && (
        <div className="composer fx-card">
          <div className="cmp-body">
            <div className="cmp-titlerow">
              <span className="cmp-tlabel">Tên dự án</span>
              <input className="cmp-titlein" placeholder="Tên video của bạn..." value={bName} onChange={e => setBName(e.target.value)} />
            </div>

            <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 10, fontWeight: 600 }}>
              🎬 Mỗi ô = 1 <strong>CẢNH</strong> của video — tạo xong tự ghép thành 1 phim. Dùng <strong>@Tên</strong> để giữ mặt nhân vật.
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
                    placeholder="Mô tả cảnh này (hình ảnh + hành động)..." value={s.prompt} onChange={e => updBScene(i, 'prompt', e.target.value)} />
                  <input className="form-input" style={{ fontSize: 12.5 }} placeholder="🔊 Lời thoại (tuỳ chọn — để lồng tiếng)" value={s.narration} onChange={e => updBScene(i, 'narration', e.target.value)} />
                </div>
              ))}
            </div>
            <button className="cmp-ghost" onClick={addBScene} style={{ width: '100%', borderStyle: 'dashed', marginBottom: 18 }}>+ Thêm cảnh</button>

            <div className="cmp-settings">
              <div className="cmp-ctrl">
                <div className="cmp-label">Chất lượng video</div>
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
                  <Link2 size={13} color="var(--accent2)" /> Nối tiếp cảnh trước (cảnh sau bắt đầu từ khung cuối cảnh trước)
                </label>
              </div>
            </div>

            <div style={{ marginTop: 18 }}>
              <AudioPicker value={bAudioMode} onChange={setBAudioMode} />
              {bAudioMode === 'voiceover' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10 }}>
                  <span style={{ fontSize: 12, color: 'var(--text3)' }}>Giọng đọc:</span>
                  <div className="selwrap" style={{ width: 170 }}>
                    <select className="cmp-sel" value={bVoice} onChange={e => setBVoice(e.target.value)}>
                      {VOICES.map(v => <option key={v.id} value={v.id}>{v.label}</option>)}
                    </select>
                    <svg className="chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
                  </div>
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
        <div className="composer fx-card">
          <div className="cmp-steps">
            <span className="on"><i>✦</i> Chép ý tưởng — clone video nguồn → kịch bản mới, render thẳng</span>
          </div>
          <div className="cmp-body">
            <div className="cmp-titlerow">
              <span className="cmp-tlabel">Link video</span>
              <input className="cmp-titlein" placeholder="https://youtube.com/... hoặc TikTok" value={copyUrl} onChange={e => setCopyUrl(e.target.value)} />
            </div>

            <div className="cmp-settings">
              <div className="cmp-ctrl">
                <div className="cmp-label">Số cảnh <span className="rv">{copyCount}</span></div>
                <div className="stepper">
                  <button type="button" onClick={() => setCopyCount(c => Math.max(2, c - 1))}>−</button>
                  <input type="number" min={2} max={20} value={copyCount}
                    onChange={e => setCopyCount(Math.min(20, Math.max(2, +e.target.value || 2)))} />
                  <button type="button" onClick={() => setCopyCount(c => Math.min(20, c + 1))}>+</button>
                </div>
              </div>
              <div className="cmp-ctrl">
                <div className="cmp-label">Khung hình</div>
                <div className="selwrap">
                  <select className="cmp-sel" value={copyAspect} onChange={e => setCopyAspect(e.target.value)}>
                    <option value="9:16">9:16 — Dọc (TikTok / Reels)</option>
                    <option value="16:9">16:9 — Ngang (YouTube)</option>
                    <option value="1:1">1:1 — Vuông</option>
                  </select>
                  <svg className="chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
                </div>
              </div>
              <div className="cmp-ctrl" style={{ gridColumn: '1 / -1' }}>
                <div className="cmp-label">Phong cách hình ảnh</div>
                <div className="selwrap">
                  <select className="cmp-sel" value={copyStyle} onChange={e => setCopyStyle(e.target.value)}>
                    <option value="">Giữ nguyên style gốc</option>
                    {styleList.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                  <svg className="chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
                </div>
              </div>
            </div>

            {/* Giữ mặt — đồng bộ nhân vật cho video clone */}
            <div className="cmp-chiprow" style={{ marginBottom: 20 }}>
              <span className="cmp-clab">Giữ mặt</span>
              {chars.length === 0 && (
                <span style={{ fontSize: 12, color: 'var(--text3)' }}>Thêm ảnh nhân vật để giữ NGUYÊN gương mặt qua mọi cảnh của video clone.</span>
              )}
              {chars.map(c => (
                <div key={c.id} className={selectedChars.has(c.name) ? 'cmp-chip on' : 'cmp-chip'}
                  onClick={() => setSelectedChars(prev => { const n = new Set(prev); n.has(c.name) ? n.delete(c.name) : n.add(c.name); return n })}>
                  <img src={c.image_url} alt="" />@{c.name}
                </div>
              ))}
              <div className="cmp-chip add" onClick={() => setAddCharOpen(o => !o)} title="Tải ảnh để giữ đúng mặt nhân vật qua các cảnh">
                {addCharOpen ? <><X size={13} /> đóng</> : <><Plus size={13} /> thêm nhân vật</>}
              </div>
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

            <div style={{ marginTop: 8 }}>
              <AudioPicker value={audioMode} onChange={setAudioMode} />
            </div>
          </div>

          <div className="cmp-actionbar">
            <div className="cmp-est">
              <span className="meta">{copyCount} cảnh · {copyAspect}{selectedChars.size > 0 ? ` · 🔒 khoá ${selectedChars.size} mặt` : ''}</span>
            </div>
            <div style={{ flex: 1 }} />
            <button className="cmp-cta" onClick={doCopy} disabled={copyLoading || !copyUrl.trim()}>
              {copyLoading ? <><Loader2 size={14} className="spin" /> Đang phân tích & tạo phim...</> : <>🚀 Tạo phim ngay →</>}
            </button>
          </div>
        </div>
      )}

      {/* VIDEO BÁN HÀNG — KOL + sản phẩm (component dùng chung) */}
      {tab === 'sell' && <SellVideo />}
    </div>
  )
}
