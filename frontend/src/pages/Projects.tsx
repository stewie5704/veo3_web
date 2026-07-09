import { useState, useEffect, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { projectsApi, toolsApi, charactersApi, removeDeletedSellId } from '../api/client'
import { pushLog } from './Dashboard'
import { Loader2, Link2, Sparkles, PenLine, Volume2, Mic, MessagesSquare, VolumeX, Plus, X, Search, Users, Clapperboard, Rocket, List } from 'lucide-react'
import SellVideo from '../components/SellVideo'
import { useT } from '../i18n'

type AudioMode = 'voiceover' | 'character_speak' | 'off'

const MODELS = [
  { key: 'veo_3_1_t2v_lite_low_priority', label: 'Veo 3.1 · Lite (Lower Priority) — FREE', cost: 0 },
  { key: 'veo_3_1_t2v_lite', label: 'Veo 3.1 · Lite — 5💎', cost: 5 },
  { key: 'veo_3_1_t2v_fast_portrait_ultra', label: 'Veo 3.1 · Fast — 10💎', cost: 10 },
  { key: 'veo_3_1_t2v_portrait', label: 'Veo 3.1 · Quality — 100💎', cost: 100 },
  { key: 'abra_t2v_10s', label: 'Omni Flash (10s) — 15💎', cost: 15 },
]
const ASPECTS = ['16:9', '9:16', '1:1']   // Veo chỉ hỗ trợ 3 tỉ lệ thật (4:3/3:4 bị map về ngang/dọc)
const DURATIONS = [4, 6, 8, 10]
export const VOICES = [
  { id: 'Kore', label: 'Kore (Nữ)' },
  { id: 'Aoede', label: 'Aoede (Nữ)' },
  { id: 'Leda', label: 'Leda (Nữ)' },
  { id: 'Vega', label: 'Vega (Nữ)' },
  { id: 'Puck', label: 'Puck (Nam)' },
  { id: 'Charon', label: 'Charon (Nam)' },
  { id: 'Orus', label: 'Orus (Nam)' },
  { id: 'Fenrir', label: 'Fenrir (Nam)' },
  { id: 'Achernar', label: 'Achernar (Nam)' },
  { id: 'Rigel', label: 'Rigel (Nam)' },
  { id: 'Sirius', label: 'Sirius (Nam)' },
  { id: 'Quasar', label: 'Quasar (Nam)' },
  { id: 'Pulcherrima', label: 'Pulcherrima (Phi giới tính · Forward)' },
  { id: 'Rasalgethi', label: 'Rasalgethi (Nam · Informative)' },
  { id: 'Sadachbia', label: 'Sadachbia (Nam · Lively)' },
  { id: 'Sadaltager', label: 'Sadaltager (Nam · Knowledgeable)' },
  { id: 'Schedar', label: 'Schedar (Nam · Even)' },
  { id: 'Sulafat', label: 'Sulafat (Nữ · Warm)' },
  { id: 'Umbriel', label: 'Umbriel (Nam · Smooth)' },
  { id: 'Vindemiatrix', label: 'Vindemiatrix (Nữ · Gentle)' },
  { id: 'Zephyr', label: 'Zephyr (Nữ · Bright)' },
  { id: 'Zubenelgenubi', label: 'Zubenelgenubi (Nam · Casual)' },
]

type Tab = 'new' | 'batch' | 'copy' | 'sell'

export default function Projects({ user, onCreated }: { user: any; onCreated?: () => void }) {
  const t = useT()
  const nav = useNavigate()
  const [sp] = useSearchParams()
  const [tab, setTab] = useState<Tab>((sp.get('tab') as Tab) || 'new')
  useEffect(() => { const tab = sp.get('tab'); if (tab) setTab(tab as Tab) }, [sp])
  const [error, setError] = useState('')
  const [creating, setCreating] = useState(false)
  const [projects, setProjects] = useState<any[]>([])
  const [chars, setChars] = useState<any[]>([])
  const [selectedChars, setSelectedChars] = useState<Set<string>>(new Set())

  // Các bước hiển thị khi đang phân tích + tạo (cho cảm giác đang chạy, đỡ thấy lâu)
  const CREATE_STEPS = [
    { icon: Search, text: t('project.step_reading_script') },
    { icon: Users, text: t('project.step_identify_chars') },
    { icon: Clapperboard, text: t('project.step_building_scenes') },
    { icon: Sparkles, text: t('project.step_optimizing') },
    { icon: Rocket, text: t('project.step_starting_render') },
  ]

  const AUDIO_OPTS = [
    { v: 'voiceover' as const, icon: Mic, t: t('project.audio_voiceover'), d: t('project.audio_voiceover_desc') },
    { v: 'character_speak' as const, icon: MessagesSquare, t: t('project.audio_character_speak'), d: t('project.audio_character_speak_desc') },
    { v: 'off' as const, icon: VolumeX, t: t('project.audio_off'), d: t('project.audio_off_desc') },
  ]

  // Bộ chọn âm thanh dùng CHUNG cho cả 3 tab (Tạo ý tưởng / Mô tả từng cảnh / Chép ý tưởng)
  function AudioPicker({ value, onChange }: { value: AudioMode; onChange: (v: AudioMode) => void }) {
    return (
      <div>
        <div style={{ marginBottom: 9 }}>
          <span className="cmp-clab"><Volume2 size={13} style={{ color: 'var(--accent2)' }} /> {t('project.audio')}</span>
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
  const voiceover = audioMode === 'voiceover'
  const [voice, setVoice] = useState('Kore')
  const [bibleChars, setBibleChars] = useState<any[]>([])           // hồ sơ nhân vật từ AI
  const [charVoices, setCharVoices] = useState<Record<string, string>>({})  // tên nhân vật -> giọng
  const [charIdsMap, setCharIdsMap] = useState<Record<string, string>>({})  // tên nhân vật -> ID ảnh
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
  const [bScenes, setBScenes] = useState<{ prompt: string; narration: string; speaker?: string }[]>([
    { prompt: '', narration: '' },
    { prompt: '', narration: '' },
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

  // Overlay đã tắt — chỉ giữ loading trên nút

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

  const [generatingPortraits, setGeneratingPortraits] = useState(false)

  const autoGeneratePortraits = async (bc: any[]) => {
    if (!bc || bc.length === 0) return {}
    setGeneratingPortraits(true)
    pushLog(t('project.generating_portraits'))
    try {
      await charactersApi.generateAIPortraits(bc)
      const newChars = await charactersApi.list()
      setChars(newChars)
      const newCharMap = Object.fromEntries(newChars.map((c: any) => [c.name, c.id]))
      const nm: Record<string, string> = {}
      for (const b of bc) {
        const cName = b.name || b.char_key
        if (newCharMap[cName]) {
          nm[cName] = newCharMap[cName]
        }
      }
      setCharIdsMap(m => ({ ...m, ...nm }))
      return nm
    } catch(e) {
      console.error(e)
      return {}
    } finally {
      setGeneratingPortraits(false)
    }
  }

  // AI viết kịch bản
  async function genPrompts(directCreate = true) {
    if (!idea.trim()) { setError(t('project.enter_idea_first')); return }
    setError(''); setLoadingPrompts(true)
    try {
      const castObjs = chars.filter(c => selectedChars.has(c.name))
      
      const proj = await projectsApi.create({
        name: name || `Dự án AI ${new Date().toISOString().slice(0,10)}`,
        idea: idea,
        style, model_key: model, aspect_ratio: aspect, duration_seconds: duration, language,
        scene_count: sceneCount,
        prompts: [], narrations: [],
        chain_mode: false, audio_mode: audioMode, voice,
        character_ids: castObjs.map(c => c.id),
        i2v_fix: false,
        auto_render: false
      })

      // AI viết: bung ý tưởng thành cảnh (parse_mode=false)
      await projectsApi.extractOutline(proj.id, false)

      // Fake loading 3s cho nguy hiểm
      pushLog("Đang phân tích kịch bản và chuẩn bị tài nguyên...")
      await new Promise(r => setTimeout(r, 2000))
      pushLog("Khởi tạo không gian làm việc thành công!")
      await new Promise(r => setTimeout(r, 1000))

      nav(`/projects/${proj.id}`)
    } catch (e: any) { setError(e.response?.data?.detail || t('project.error_create_prompt')); setLoadingPrompts(false) }
  }

  // Tự nhập kịch bản — LUÔN qua review (chốt nhân vật + giọng trước khi tạo project)
  async function parseScript(_directCreate = false) {
    if (!idea.trim()) { setError(t('project.paste_script_first')); return }
    setError(''); setLoadingPrompts(true)
    const t0 = Date.now()
    const chars_ct = idea.length
    pushLog(`Đang đọc kịch bản (${chars_ct.toLocaleString('vi')} ký tự)...`)
    const phases = [
      'Đang phân tích cấu trúc kịch bản...',
      'Đang bóc tách nhân vật và vai diễn...',
      'Đang xây hồ sơ diện mạo nhân vật...',
      'Đang chia cảnh và viết prompt Veo...',
      'Đang gán giọng cho từng nhân vật...',
      'Sắp xong, đang tổng hợp kết quả...',
    ]
    let phaseIdx = 0
    const ticker = window.setInterval(() => {
      const sec = Math.round((Date.now() - t0) / 1000)
      pushLog(`⏳ ${phases[Math.min(phaseIdx, phases.length - 1)]} (${sec}s)`)
      phaseIdx += 1
    }, 5000)
    try {
      const castObjs = chars.filter(c => selectedChars.has(c.name))
      const res = await toolsApi.parseScript({
        script: idea, scene_count: sceneCount, language, aspect_ratio: aspect, cast: castObjs,
      })
      const bc = res.characters || []
      const cv = Object.fromEntries(bc.map((c: any) =>
        [c.name, charVoices[c.name] || charVoices['@' + c.name] || charVoices[c.name.replace('@', '')] || c.tts_voice || voice]))
      setPrompts(res.prompts || [])
      setNarrations(res.narrations || [])
      setScenes(res.scenes || [])
      setBibleChars(bc)
      setCharVoices(cv)
      const n = (res.scenes?.length || res.prompts?.length || 0)
      if (!n) { setError(t('project.error_parse_script')); return }
      const sec = Math.round((Date.now() - t0) / 1000)
      pushLog(`✓ Đã bóc tách ${n} cảnh · ${bc.length} nhân vật (${sec}s) — vui lòng chốt giọng`)
      setStep('review')
    } catch (e: any) {
      pushLog(`✗ Lỗi phân tích: ${e.response?.data?.detail || e.message || 'không rõ'}`, 'error')
      setError(e.response?.data?.detail || t('project.error_parse_script'))
    } finally {
      window.clearInterval(ticker)
      setLoadingPrompts(false)
    }
  }

  // Dán Prompts
  async function parsePromptsLocally(directCreate = true) {
    if (!idea.trim()) { setError(t('project.paste_prompts_first')); return }
    const lines = idea.split('\n').map(l => l.trim()).filter(l => l.length > 0)
    if (!lines.length) { setError(t('project.no_valid_prompt')); return }
    
    const n = lines.length
    pushLog(`Đã đọc ${n} prompts`)
    
    if (directCreate) {
        const cost = modelObjNew.cost * n
    if (cost > 0 && !window.confirm(t('project.confirm_create', { n, cost }))) { return }
    await createNew(true, { scenes: [], prompts: lines, narrations: new Array(n).fill(''), bible: [], charVoices: {} })
      } else {
        setPrompts(lines)
        setNarrations(new Array(n).fill(''))
        setScenes([])
        setStep('review')
      }
  }

  // Đọc storyboard
  async function readStoryboard(directCreate = true) {
    if (!sbFiles.length) { setError(t('project.select_storyboard_first')); return }
    setError(''); setLoadingPrompts(true)
    try {
      const castObjs = chars.filter(c => selectedChars.has(c.name))
      const res = await toolsApi.parseStoryboard(sbFiles, { scene_count: 0, language, aspect_ratio: aspect, style: style || undefined, cast: castObjs })
      const bc = res.characters || []
      const cv = Object.fromEntries(bc.map((c: any) => [c.name, charVoices[c.name] || charVoices['@' + c.name] || charVoices[c.name.replace('@', '')] || c.tts_voice || voice]))
      setPrompts(res.prompts); setNarrations(res.narrations); setScenes(res.scenes || []); setBibleChars(bc); setCharVoices(cv)
      const n = (res.scenes?.length || res.prompts?.length || 0)
      pushLog(`Đã đọc storyboard ${n} cảnh`)
      if (!n) { setError(t('project.storyboard_no_frames')); setLoadingPrompts(false); return }
      if (directCreate) {
        const cost = modelObjNew.cost * n
        if (cost > 0 && !window.confirm(t('project.confirm_create', { n, cost }))) { setLoadingPrompts(false); return }
        let extraCharMap = {}
        if (bc && bc.length > 0) {
          extraCharMap = await autoGeneratePortraits(bc) || {}
        }
        await createNew(true, { scenes: res.scenes || [], prompts: res.prompts || [], narrations: res.narrations || [], bible: bc, charVoices: cv, charIdsMap: extraCharMap })
      } else {
        setStep('review')
        setLoadingPrompts(false)
      }
    } catch (e: any) { setError(e.response?.data?.detail || t('project.error_read_storyboard')); setLoadingPrompts(false) }
  }

  function addScene() {
    setScenes(prev => [...prev, { beat: '', image: '', action: '', speaker: '', dialogue: '', prompt: '' }])
  }
  function delScene(i: number) {
    setScenes(prev => prev.filter((_, idx) => idx !== i))
  }

  async function addCharacter() {
    if (!newCharName.trim() || !newCharFile) { setError(t('project.need_name_and_photo')); return }
    setAddingChar(true); setError('')
    try {
      const c = await charactersApi.add(newCharName.trim(), newCharFile)  // vào kho chung, dùng lại được
      const list = await charactersApi.list()
      setChars(list)
      setSelectedChars(prev => { const n = new Set(prev); n.add(c.name); return n })  // chọn luôn
      setNewCharName(''); setNewCharFile(null); setAddCharOpen(false)
      if (charFileRef.current) charFileRef.current.value = ''
      pushLog(`Đã thêm nhân vật @${c.name}`)
    } catch (e: any) { setError(e.response?.data?.detail || t('project.add_char_failed')) }
    finally { setAddingChar(false) }
  }

  // data: cho phép tạo THẲNG từ kết quả phân tích (bỏ bước duyệt) thay vì đọc từ state (chưa kịp cập nhật)
  async function createNew(autoRender: boolean, data?: { scenes?: any[]; prompts?: string[]; narrations?: string[]; bible?: any[]; charVoices?: Record<string, string>; name?: string; style?: string; aspect?: string; charIdsMap?: Record<string, string> }) {
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

    // === FIX gán giọng theo nhân vật ===
    // Gom tất cả tên nhân vật đã gán giọng (user override hoặc từ bible)
    const knownCharNames = Array.from(new Set([
      ...Object.keys(sCharVoices || {}),
      ...sBible.map((c: any) => c.name || '').filter(Boolean),
      ...Array.from(selectedChars || []),
      ...Object.keys(charIdsMap)
    ]))
    function pickVoiceForScene(s: any, narration: string): string {
      const spk = (s?.speaker || '').trim()
      // Ưu tiên speaker field
      let v = sCharVoices[spk] || sCharVoices['@' + spk] || sCharVoices[spk.replace('@', '')]
      if (v) return v
      const aiV = sBible.find((c: any) => c.name === spk)?.tts_voice
      if (aiV) return aiV
      // Fallback: quét narration "Tên: ..." hoặc @Tên để tìm nhân vật nói
      const nar = (narration || '').toLowerCase()
      for (const nm of knownCharNames) {
        const n = nm.toLowerCase().replace(/^@/, '')
        if (nar.includes(n + ':') || nar.includes('@' + n) || nar.includes(n)) {
          const vv = sCharVoices[nm] || sCharVoices['@' + nm] || sCharVoices[n] || sCharVoices[nm.replace('@', '')]
          if (vv) return vv
          const found = sBible.find((c: any) => (c.name || '').toLowerCase() === n)?.tts_voice
          if (found) return found
        }
      }
      return voice // fallback project default
    }
    // giọng riêng theo nhân vật nói trong mỗi cảnh (dùng baseNarr để quét nếu cần)
    const baseVoices = (sScenes.length ? sScenes : basePrompts.map((_, i) => ({}))).map((s, i) => {
      const nar = (baseNarr[i] || sNarr[i] || '')
      return pickVoiceForScene(s, nar)
    })
    if (!basePrompts.length) { setError(t('project.write_script_first')); return }
    setError(''); setCreating(true)
    // Inject @CharName into prompts for selected chars
    const mapToUse = data?.charIdsMap || charIdsMap
    const extraCharIds = Object.values(mapToUse).filter(Boolean)
    const combinedCharIds = Array.from(new Set([...chars.filter(c => selectedChars.has(c.name)).map(c => c.id), ...extraCharIds]))
    
    const combinedNames = new Set([...selectedChars])
    for (const [nm, id] of Object.entries(mapToUse)) {
      if (id) combinedNames.add(nm)
    }
    const hasImageLock = combinedCharIds.length > 0;

    const enriched = basePrompts.map(p => {
      const mentions = [...combinedNames].map(c => `@${c}`).join(' ')
      return combinedNames.size > 0 && !p.includes('@') ? `${mentions} ${p}` : p
    })
    try {
      const startTime = Date.now();
      const proj = await projectsApi.create({
        name: sName || `${t('project.default_name')} ${new Date().toLocaleDateString('vi-VN')}`,
        idea, style: sStyle || undefined, model_key: model,
        aspect_ratio: sAspect, duration_seconds: duration, language,
        prompts: enriched, narrations: baseNarr, auto_render: autoRender,
        character_names: [...combinedNames],
        // id nhân vật được chọn -> backend clone thành nhân vật RIÊNG của project (giữ mặt)
        character_ids: combinedCharIds,
        audio_mode: audioMode, voiceover, voice, voices: baseVoices,
        character_bible: sBible,   // -> backend sinh chân dung AI giữ mặt mọi cảnh
        i2v_fix: hasImageLock,
      })
      const elapsed = Date.now() - startTime;
      if (elapsed < 5000) await new Promise(r => setTimeout(r, 5000 - elapsed));
      pushLog(`${autoRender ? 'Auto render' : 'Tạo'} dự án: ${proj.name}`)
      onCreated?.()
      nav(`/projects/${proj.id}`)
    } catch (e: any) { setError(e.response?.data?.detail || t('project.create_project_failed')); setCreating(false); setLoadingPrompts(false) }
  }

  const addBScene = () => setBScenes(s => [...s, { prompt: '', narration: '' }])
  const delBScene = (i: number) => setBScenes(s => s.filter((_, idx) => idx !== i))
  const updBScene = (i: number, key: 'prompt' | 'narration' | 'speaker', v: string) =>
    setBScenes(s => s.map((x, idx) => idx === i ? { ...x, [key]: v } : x))

  async function createBatch() {
    let valid = bScenes.filter(s => s.prompt.trim())
    if (!valid.length) { setError(t('project.need_at_least_one_scene')); return }
    setError(''); setCreating(true)
    
    try {
      const startTime = Date.now();
      if (bAudioMode === 'character_speak' && Array.from(selectedChars).length > 0) {
        const res = await toolsApi.fillDialogue('vi', valid, Array.from(selectedChars))
        valid = res.scenes || valid
      }

      const proj = await projectsApi.create({
        name: bName || `Video ${new Date().toLocaleDateString('vi-VN')}`,
        model_key: bModel, aspect_ratio: bAspect, duration_seconds: bDuration,
        prompts: valid.map(s => {
          // Gắn @Tên vào prompt nếu chưa có để giữ mặt
          const cNames = Array.from(selectedChars)
          const mentions = cNames.map(c => `@${c}`).join(' ')
          return (cNames.length > 0 && !s.prompt.includes('@')) ? `${mentions} ${s.prompt.trim()}` : s.prompt.trim()
        }),
        narrations: valid.map(s => s.narration?.trim() || ''),
        auto_render: true, chain_mode: bChain,
        audio_mode: bAudioMode, voiceover: bAudioMode === 'voiceover', voice: bVoice,
        voices: valid.map(s => s.speaker ? (charVoices[s.speaker] || bVoice) : bVoice),
        character_names: Array.from(selectedChars),
        character_ids: chars.filter(c => selectedChars.has(c.name)).map(c => c.id)
      })
      const elapsed = Date.now() - startTime;
      if (elapsed < 5000) await new Promise(r => setTimeout(r, 5000 - elapsed));
      pushLog(`Tạo video từ ${valid.length} cảnh prompt${bChain ? ' (chain)' : ''}`)
      nav(`/projects/${proj.id}`)
    } catch (e: any) { setError(e.response?.data?.detail || t('project.create_video_failed')); setCreating(false) }
  }

  async function doCopy() {
    if (!copyUrl.trim()) { setError(t('project.enter_url')); return }
    setError(''); setCopyLoading(true)
    try {
      const res = await toolsApi.copyIdea({ url: copyUrl, style: copyStyle || undefined, scene_count: copyCount })
      pushLog(`Chép ý tưởng: ${res.prompts.length} cảnh`)
      const cost = modelObjNew.cost * (res.prompts?.length || 0)
      setCopyLoading(false)
      if (cost > 0 && !window.confirm(t('project.confirm_create', { n: res.prompts.length, cost }))) return
      await createNew(true, { name: res.title, prompts: res.prompts, narrations: res.narrations, style: copyStyle, bible: [], aspect: copyAspect })
    } catch (e: any) { setError(e.response?.data?.detail || t('project.analysis_failed')); setCopyLoading(false) }
  }

  async function delProject(id: string, e: React.MouseEvent) {
    e.stopPropagation()
    if (!confirm(t('project.confirm_delete'))) return
    await projectsApi.delete(id)
    removeDeletedSellId(id)
    setProjects(ps => ps.filter(p => p.id !== id))
    onCreated?.()
  }

  return (
    <div style={{ maxWidth: tab === 'sell' ? '100%' : 760, margin: '0 auto' }}>
      <div className="fx-grain" aria-hidden="true" />
      {/* Overlay đã tắt */}
      {/* Header — chế độ chọn ở sidebar (mục con của "Tạo video") */}
      <div className="page-header">
        <div>
          <div className="page-title" style={{ margin: 0 }}>{t('project.create_video')}</div>
          <div className="page-subtitle">
            {tab === 'new' ? t('project.tab_new') : tab === 'batch' ? t('project.tab_batch') : tab === 'copy' ? t('project.tab_copy') : t('project.tab_sell')}
          </div>
        </div>
      </div>

      {error && <div className="alert alert-error" style={{ marginBottom: 16 }}>{error}</div>}

      {/* NEW — Composer 2 bước */}
      {tab === 'new' && (
        <div className="composer fx-card">
          <div className="cmp-steps">
            <span className="on"><i>✦</i> {t('project.new_header')}</span>
          </div>

          {/* ─── BƯỚC 1: THIẾT LẬP ─── */}
          {step === 'setup' && (<>
          <div className="cmp-body">
              <div className="cmp-titlerow">
                <span className="cmp-tlabel">{t('project.project_name')}</span>
                <input className="cmp-titlein" placeholder={t('project.project_name_placeholder')} value={name} onChange={e => setName(e.target.value)} />
              </div>

              <div className="cmp-tabs" style={{ marginBottom: 14 }}>
                <button className={mode === 'ai' ? 'on' : ''} onClick={() => setMode('ai')}><Sparkles size={14} /> {t('project.mode_ai')}</button>
                <button className={mode === 'manual' ? 'on' : ''} onClick={() => setMode('manual')}><PenLine size={14} /> {t('project.mode_manual')}</button>
                <button className={mode === 'prompts' ? 'on' : ''} onClick={() => setMode('prompts')}><List size={14} /> {t('project.mode_prompts')}</button>
                <button className={mode === 'storyboard' ? 'on' : ''} onClick={() => setMode('storyboard')}><Clapperboard size={14} /> {t('project.mode_storyboard')}</button>
              </div>

              {mode === 'storyboard' ? (
                <div style={{ marginBottom: 4 }}>
                  <label htmlFor="sb-input" style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8,
                    minHeight: 130, padding: '20px 16px', cursor: 'pointer', textAlign: 'center',
                    border: '1.5px dashed var(--line, #2a2740)', borderRadius: 14, background: 'rgba(255,255,255,0.02)',
                  }}>
                    <Clapperboard size={26} style={{ color: 'var(--accent2)' }} />
                    <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{t('project.storyboard_select')}</div>
                    <div style={{ fontSize: 12, color: 'var(--text3)', maxWidth: 420 }}>
                      {t('project.storyboard_desc')}
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
                      ? t('project.placeholder_manual')
                      : mode === 'prompts'
                      ? t('project.placeholder_prompts')
                      : t('project.placeholder_ai')} />
                </div>
              )}

              <div className="cmp-settings">
                <div className="cmp-ctrl">
                  <div className="cmp-label">{t('project.scene_count')} {sceneCount > 30 && <span className="rv" style={{ color: 'var(--accent2)' }}>{t('project.fast_create')} ⚡</span>}</div>
                  <div className="stepper">
                    <button type="button" onClick={() => setSceneCount(c => Math.max(1, c - 1))}>−</button>
                    <input type="number" min={1} max={600} value={sceneCount}
                      onChange={e => setSceneCount(Math.min(600, Math.max(1, +e.target.value || 1)))} />
                    <button type="button" onClick={() => setSceneCount(c => Math.min(600, c + 1))}>+</button>
                  </div>
                </div>
                <div className="cmp-ctrl">
                  <div className="cmp-label">{t('project.duration_per_scene')} <span className="rv">{duration}s</span></div>
                  <div className="seg2">
                    {DURATIONS.map(d => (
                      <button key={d} type="button" className={duration === d ? 'on' : ''} onClick={() => setDuration(d)}>{d}</button>
                    ))}
                  </div>
                </div>
                <div className="cmp-ctrl">
                  <div className="cmp-label">{t('project.video_quality')}</div>
                  <div className="selwrap">
                    <select className="cmp-sel" value={model} onChange={e => setModel(e.target.value)}>
                      {MODELS.map(m => <option key={m.key} value={m.key}>{m.label}</option>)}
                    </select>
                    <svg className="chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
                  </div>
                </div>
                <div className="cmp-ctrl">
                  <div className="cmp-label">{t('project.aspect_ratio')}</div>
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
                  <div className="cmp-label">{t('project.language')}</div>
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
                <span className="cmp-clab">{t('project.face_lock')}</span>
                {chars.length === 0 && (
                  <span style={{ fontSize: 12, color: 'var(--text3)' }}>{t('project.face_lock_hint')}</span>
                )}
                {chars.map(c => (
                  <div key={c.id} className={selectedChars.has(c.name) ? 'cmp-chip on' : 'cmp-chip'}
                    onClick={() => setSelectedChars(prev => { const n = new Set(prev); n.has(c.name) ? n.delete(c.name) : n.add(c.name); return n })}>
                    <img src={c.image_url} alt="" />@{c.name}
                  </div>
                ))}
                <div className="cmp-chip add" onClick={() => setAddCharOpen(o => !o)} title={t('project.face_lock_tooltip')}>
                  {addCharOpen ? <><X size={13} /> {t('project.close')}</> : <><Plus size={13} /> {t('project.add_character')}</>}
                </div>
              </div>
              {addCharOpen && (
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
                  <input className="cmp-sel" placeholder={t('project.char_name_placeholder')} value={newCharName} onChange={e => setNewCharName(e.target.value)} style={{ flex: '0 0 160px' }} />
                  <label className="cmp-ghost" style={{ cursor: 'pointer' }}>
                    {newCharFile ? `📷 ${newCharFile.name.slice(0, 14)}` : t('project.select_photo')}
                    <input ref={charFileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => setNewCharFile(e.target.files?.[0] || null)} />
                  </label>
                  <button type="button" className="cmp-cta" onClick={addCharacter} disabled={addingChar || !newCharName.trim() || !newCharFile} style={{ padding: '10px 16px' }}>
                    {addingChar ? <Loader2 size={13} className="spin" /> : t('project.save')}
                  </button>
                </div>
              )}

              {/* Âm thanh: chọn 1 trong 3 (component dùng chung) */}
              <div style={{ marginTop: 24 }}>
                <AudioPicker value={audioMode} onChange={setAudioMode} />
                {(audioMode === 'voiceover' || audioMode === 'character_speak') && selectedChars.size > 0 && (
                  <div style={{ marginTop: 14, padding: '12px 14px', background: 'var(--inset)', borderRadius: 11, border: '1px solid var(--border)' }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 10 }}>🔊 {t('project.assign_voice')}</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                      {Array.from(selectedChars).map(cName => (
                        <div key={cName} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: 13, color: 'var(--text2)', fontWeight: 600 }}>@{cName}</span>
                          <div className="selwrap" style={{ width: 150 }}>
                            <select className="cmp-sel" value={charVoices[cName] || voice} onChange={e => setCharVoices(v => ({ ...v, [cName]: e.target.value }))}>
                              {VOICES.map(vo => <option key={vo.id} value={vo.id}>{vo.label}</option>)}
                            </select>
                            <svg className="chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
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
              
              {mode !== 'prompts' && mode !== 'manual' && (
                <button className="cmp-ghost" style={{ marginRight: 8 }}
                  onClick={() => {
                    if (mode === 'storyboard') readStoryboard(false)
                    else genPrompts(false)
                  }}
                  disabled={loadingPrompts || creating || (mode === 'storyboard' ? sbFiles.length === 0 : !idea.trim())}>
                  {t('project.review_script')}
                </button>
              )}

              <button className="cmp-cta"
                onClick={() => {
                  if (mode === 'storyboard') readStoryboard(true)
                  else if (mode === 'manual') parseScript()
                  else if (mode === 'prompts') parsePromptsLocally(true)
                  else genPrompts(true)
                }}
                disabled={loadingPrompts || creating || (mode === 'storyboard' ? sbFiles.length === 0 : !idea.trim())}>
                {loadingPrompts || creating
                  ? <><Loader2 size={14} className="spin" /> {mode === 'storyboard' ? t('project.reading_storyboard') : mode === 'manual' ? t('project.analyzing_creating') : t('project.creating')}</>
                  : <><svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round"><path d="M12 4l1.6 5.4L19 11l-5.4 1.6L12 18l-1.6-5.4L5 11l5.4-1.6z" /></svg> {mode === 'storyboard' ? t('project.cta_storyboard') : mode === 'manual' ? t('project.cta_manual') : mode === 'prompts' ? t('project.cta_prompts') : t('project.cta_ai')}</>}
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
                <div style={{ fontSize: 10, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 2 }}>{t('project.video_length')}</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--accent3)' }}>~{fmtLen(reviewLenSec)}</div>
              </div>
              <div style={{ width: 1, height: 32, background: 'var(--border2)' }} />
              <div>
                <div style={{ fontSize: 10, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 2 }}>{t('project.scene_count')}</div>
                <div style={{ fontSize: 16, fontWeight: 600 }}>{reviewN} × {duration}s</div>
              </div>
              <div style={{ width: 1, height: 32, background: 'var(--border2)' }} />
              <div>
                <div style={{ fontSize: 10, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 2 }}>{t('project.cost')}</div>
                <div style={{ fontSize: 16, fontWeight: 600, color: reviewCost === 0 ? 'var(--green)' : 'var(--yellow)' }}>{reviewCost === 0 ? 'FREE' : `${reviewCost} 💎`}</div>
              </div>
              <div style={{ flex: 1 }} />
              <div style={{ fontSize: 11, color: 'var(--text3)', textAlign: 'right', lineHeight: 1.5 }}>
                {modelObjNew.label} · {aspect}
                {(selectedChars.size > 0 || Object.values(charIdsMap).filter(Boolean).length > 0) && <><br />{t('project.locked_faces', { count: new Set([...selectedChars, ...Object.keys(charIdsMap).filter(k => charIdsMap[k])]).size })}</>}
              </div>
            </div>

            {bibleChars.length > 0 && (
              <div style={{ marginBottom: 14, padding: '12px 14px', background: 'var(--inset)', borderRadius: 11, border: '1px solid var(--border)' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 10 }}>
                  🎭 {t('project.char_list_title')}
                  {generatingPortraits && <span style={{ marginLeft: 8, color: 'var(--accent3)' }}><Loader2 size={10} className="spin" style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: 4 }}/> {t('project.auto_drawing')}</span>}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {bibleChars.map((c: any) => {
                    const cName = c.name || c.char_key
                    const cId = charIdsMap[cName] || (selectedChars.has(cName) ? chars.find(x => x.name === cName)?.id : '')
                    const cVoice = charVoices[cName] || c.tts_voice || voice
                    return (
                      <div key={cName} style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12, paddingBottom: 10, borderBottom: '1px dashed var(--border)' }}>
                        <div style={{ minWidth: 100, fontSize: 13, color: 'var(--text2)', fontWeight: 600 }}>{cName}</div>
                        
                        {cId && chars.find(x => x.id === cId)?.image_url && (
                          <div style={{ height: 160, minWidth: 90, borderRadius: 8, overflow: 'hidden', border: '1px solid var(--border)', background: 'var(--inset)', flexShrink: 0 }}>
                            <img 
                              src={chars.find(x => x.id === cId)?.image_url} 
                              alt={cName} 
                              style={{ height: '100%', width: 'auto', display: 'block' }} 
                            />
                          </div>
                        )}

                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                          <div className="selwrap" style={{ width: 160 }}>
                            <select className="cmp-sel" value={cId || ''} onChange={e => {
                              const val = e.target.value
                              if (val === 'UPLOAD') {
                                document.getElementById(`char-upload-${cName}`)?.click()
                              } else {
                                setCharIdsMap(m => ({ ...m, [cName]: val }))
                              }
                            }}>
                              <option value="">{t('project.ai_auto_portrait')}</option>
                              {chars.map(char => <option key={char.id} value={char.id}>{char.name}</option>)}
                              <option value="UPLOAD">{t('project.upload_new_photo')}</option>
                            </select>
                            <svg className="chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
                          </div>
                          
                          <button 
                            className="cmp-ghost" 
                            style={{ fontSize: 11, padding: '4px 8px', minHeight: 24, alignSelf: 'flex-start' }}
                            onClick={async () => {
                              // Regenerate
                              const btn = document.getElementById(`regen-btn-${cName}`)
                              if (btn) btn.innerHTML = `⏳ ${t('project.drawing')}`
                              try {
                                await charactersApi.generateAIPortraits([c], true)
                                await charactersApi.list().then(setChars)
                              } catch(e) {
                                alert(t('project.error_create_photo'))
                              } finally {
                                if (btn) btn.innerHTML = `✨ ${t('project.redraw_ai')}`
                              }
                            }}
                            id={`regen-btn-${cName}`}
                          >
                            ✨ {t('project.redraw_ai')}
                          </button>
                        </div>
                        
                        <input type="file" id={`char-upload-${cName}`} style={{ display: 'none' }} accept="image/*" onChange={async e => {
                          const file = e.target.files?.[0]
                          if (!file) return
                          try {
                            const res = await charactersApi.add(cName, file)
                            await charactersApi.list().then(setChars)
                            setCharIdsMap(m => ({ ...m, [cName]: res.id }))
                          } catch (err) {
                            alert(t('project.upload_error'))
                          }
                        }} />

                        <div className="selwrap" style={{ width: 160 }}>
                          <select className="cmp-sel" value={cVoice} onChange={e => setCharVoices(v => ({ ...v, [cName]: e.target.value }))}>
                            {VOICES.map(vo => <option key={vo.id} value={vo.id}>{vo.label}</option>)}
                          </select>
                          <svg className="chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 10, fontWeight: 600 }}>
              {loadingPrompts
                ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, color: 'var(--accent2)' }}>
                    <Loader2 size={13} className="spin" /> {t('project.ai_writing_script', { count: sceneCount })}
                  </span>
                : <>{t('project.detailed_script', { count: reviewN })}</>}
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
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#fff', background: 'var(--grad)', borderRadius: 6, padding: '2px 9px' }}>{t('scene.label', { index: i + 1 })}</span>
                    <span style={{ fontFamily: 'ui-monospace,Menlo,monospace', fontSize: 11, color: 'var(--text3)' }}>{fmtTC(i * duration)}–{fmtTC((i + 1) * duration)}</span>
                    {s.beat && <span style={{ fontSize: 11.5, color: 'var(--accent3)', fontWeight: 600 }}>· {s.beat}</span>}
                    <button onClick={() => delScene(i)} title={t('scene.delete')} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', fontSize: 14, lineHeight: 1 }}>✕</button>
                  </div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 5 }}>🎬 {t('scene.image_desc')}</div>
                  <textarea className="form-textarea" rows={2} style={{ fontSize: 12.5, minHeight: 'auto', marginBottom: 9 }} value={s.image} onChange={e => updateScene(i, 'image', e.target.value)} />
                  <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 5 }}>🎬 {t('scene.action')}</div>
                  <textarea className="form-textarea" rows={2} style={{ fontSize: 12.5, minHeight: 'auto', marginBottom: 9 }} value={s.action} onChange={e => updateScene(i, 'action', e.target.value)} />
                  <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 5 }}>🔊 {t('scene.dialogue')}</div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <input className="form-input" style={{ fontSize: 12.5, flex: '0 0 120px' }} placeholder={t('scene.speaker')} value={s.speaker} onChange={e => updateScene(i, 'speaker', e.target.value)} />
                    <input className="form-input" style={{ fontSize: 12.5, flex: 1 }} placeholder={t('scene.dialogue_placeholder')} value={s.dialogue} onChange={e => updateScene(i, 'dialogue', e.target.value)} />
                  </div>
                  <details style={{ marginTop: 8 }}>
                    <summary style={{ fontSize: 11, color: 'var(--text3)', cursor: 'pointer' }}>⚙ {t('scene.edit_prompt')}</summary>
                    <textarea className="form-textarea" rows={2} style={{ fontSize: 12, minHeight: 'auto', marginTop: 6 }} value={s.prompt} onChange={e => updateScene(i, 'prompt', e.target.value)} />
                  </details>
                </div>
              )) : prompts.map((p, i) => (
                <div key={i} style={{ padding: '10px 12px', background: 'var(--bg3)', borderRadius: 9, border: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#fff', background: 'var(--grad)', borderRadius: 5, padding: '1px 7px' }}>{t('scene.label', { index: i + 1 })}</span>
                    <span style={{ fontSize: 10, color: 'var(--text3)' }}>{duration}s</span>
                  </div>
                  <textarea className="form-textarea" rows={2} style={{ fontSize: 12, marginBottom: narrations[i] !== undefined ? 6 : 0 }} value={p}
                    placeholder={t('scene.describe')}
                    onChange={e => { const np = [...prompts]; np[i] = e.target.value; setPrompts(np) }} />
                  {narrations[i] !== undefined && (
                    <input className="form-input" style={{ fontSize: 12 }} value={narrations[i]}
                      placeholder={t('scene.narration_placeholder')}
                      onChange={e => { const nn = [...narrations]; nn[i] = e.target.value; setNarrations(nn) }} />
                  )}
                </div>
              ))}
            </div>
            {scenes.length > 0 && (
              <button className="cmp-ghost" onClick={addScene} style={{ width: '100%', borderStyle: 'dashed' }}>+ {t('scene.add')}</button>
            )}
            </div>
            <div className="cmp-actionbar">
              <button className="cmp-ghost" onClick={() => setStep('setup')} disabled={creating}>← {t('project.edit_back')}</button>
              <div style={{ flex: 1 }} />
              <button className="cmp-ghost" onClick={() => createNew(false)} disabled={creating || loadingPrompts}>💾 {t('project.save_draft')}</button>
              <button className="cmp-cta" onClick={() => {
                const n = reviewN
                const msg = reviewCost === 0
                  ? t('project.confirm_create_free', { n })
                  : t('project.confirm_create_paid', { n, cost: reviewCost })
                if (!window.confirm(msg)) return
                createNew(true)
              }} disabled={creating || loadingPrompts}>
                {creating ? <><Loader2 size={14} className="spin" /> {t('project.initializing')}</> : t('project.create_and_merge')}
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
              <span className="cmp-tlabel">{t('project.project_name')}</span>
              <input className="cmp-titlein" placeholder={t('project.video_name_placeholder')} value={bName} onChange={e => setBName(e.target.value)} />
            </div>

            <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 10, fontWeight: 600 }}>
              {t('project.batch_desc')}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 12 }}>
              {bScenes.map((s, i) => (
                <div key={i} style={{ padding: '12px 14px', background: 'var(--inset)', borderRadius: 11, border: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#fff', background: 'var(--grad)', borderRadius: 6, padding: '2px 9px' }}>{t('scene.label', { index: i + 1 })}</span>
                    <span style={{ fontFamily: 'ui-monospace,Menlo,monospace', fontSize: 11, color: 'var(--text3)' }}>{fmtTC(i * bDuration)}–{fmtTC((i + 1) * bDuration)}</span>
                    {bScenes.length > 1 && <button onClick={() => delBScene(i)} title={t('scene.delete')} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', fontSize: 14, lineHeight: 1 }}>✕</button>}
                  </div>
                  <textarea className="form-textarea" rows={2} style={{ fontSize: 12.5, minHeight: 'auto', marginBottom: 8 }}
                    placeholder={t('project.batch_scene_placeholder')} value={s.prompt} onChange={e => updBScene(i, 'prompt', e.target.value)} />
                  <div style={{ display: 'flex', gap: 8 }}>
                    {(bAudioMode === 'character_speak' && selectedChars.size > 0) && (
                      <div className="selwrap" style={{ width: 120 }}>
                        <select className="cmp-sel" value={s.speaker || ''} onChange={e => updBScene(i, 'speaker', e.target.value)}>
                          <option value="">{t('project.narrator')}</option>
                          {Array.from(selectedChars).map(c => <option key={c} value={c}>@{c}</option>)}
                        </select>
                        <svg className="chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
                      </div>
                    )}
                    <input className="form-input" style={{ flex: 1, fontSize: 12.5 }} placeholder={t('project.batch_narration_placeholder')} value={s.narration} onChange={e => updBScene(i, 'narration', e.target.value)} />
                  </div>
                </div>
              ))}
            </div>
            <button className="cmp-ghost" onClick={addBScene} style={{ width: '100%', borderStyle: 'dashed', marginBottom: 18 }}>+ {t('scene.add')}</button>

            <div className="cmp-settings">
              <div className="cmp-ctrl">
                <div className="cmp-label">{t('project.video_quality')}</div>
                <div className="selwrap">
                  <select className="cmp-sel" value={bModel} onChange={e => setBModel(e.target.value)}>
                    {MODELS.map(m => <option key={m.key} value={m.key}>{m.label}</option>)}
                  </select>
                  <svg className="chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
                </div>
              </div>
              <div className="cmp-ctrl">
                <div className="cmp-label">{t('project.aspect_ratio')}</div>
                <div className="selwrap">
                  <select className="cmp-sel" value={bAspect} onChange={e => setBAspect(e.target.value)}>
                    {ASPECTS.map(a => <option key={a}>{a}</option>)}
                  </select>
                  <svg className="chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
                </div>
              </div>
              <div className="cmp-ctrl">
                <div className="cmp-label">{t('project.duration_per_scene')} <span className="rv">{bDuration}s</span></div>
                <div className="seg2">
                  {DURATIONS.map(d => <button key={d} type="button" className={bDuration === d ? 'on' : ''} onClick={() => setBDuration(d)}>{d}</button>)}
                </div>
              </div>
              <div className="cmp-ctrl">
                <div className="cmp-label">{t('project.options')}</div>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: 'var(--text2)', height: 38 }}>
                  <input type="checkbox" checked={bChain} onChange={e => setBChain(e.target.checked)} style={{ accentColor: 'var(--accent)', width: 14, height: 14 }} />
                  <Link2 size={13} color="var(--accent2)" /> {t('project.chain_mode')}
                </label>
              </div>
            </div>

            <div style={{ marginTop: 18 }}>
              <AudioPicker value={bAudioMode} onChange={setBAudioMode} />
              {(bAudioMode === 'voiceover' || bAudioMode === 'character_speak') && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10 }}>
                  <span style={{ fontSize: 12, color: 'var(--text3)' }}>{t('project.voice_read')}:</span>
                  <div className="selwrap" style={{ width: 170 }}>
                    <select className="cmp-sel" value={bVoice} onChange={e => setBVoice(e.target.value)}>
                      {VOICES.map(v => <option key={v.id} value={v.id}>{v.label}</option>)}
                    </select>
                    <svg className="chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
                  </div>
                </div>
              )}
              {(bAudioMode === 'character_speak' && selectedChars.size > 0) && (
                <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8, padding: '10px 12px', background: 'var(--inset)', borderRadius: 8 }}>
                  <div style={{ fontSize: 12, color: 'var(--text2)', fontWeight: 600 }}>🎭 {t('project.char_voice_assign')}:</div>
                  {Array.from(selectedChars).map(cName => (
                    <div key={cName} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontSize: 13, color: 'var(--text2)', minWidth: 100 }}>@{cName}</span>
                      <div className="selwrap" style={{ width: 170 }}>
                        <select className="cmp-sel" value={charVoices[cName] || bVoice} onChange={e => setCharVoices(v => ({ ...v, [cName]: e.target.value }))}>
                          {VOICES.map(vo => <option key={vo.id} value={vo.id}>{vo.label}</option>)}
                        </select>
                        <svg className="chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
                      </div>
                    </div>
                  ))}
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
              {creating ? <><Loader2 size={14} className="spin" /> {t('project.creating')}</> : t('project.create_and_merge')}
            </button>
          </div>
        </div>
      )}

      {/* COPY */}
      {tab === 'copy' && (
        <div className="composer fx-card">
          <div className="cmp-steps">
            <span className="on"><i>✦</i> {t('project.copy_header')}</span>
          </div>
          <div className="cmp-body">
            <div className="cmp-titlerow">
              <span className="cmp-tlabel">{t('project.video_link')}</span>
              <input className="cmp-titlein" placeholder="https://youtube.com/... hoặc TikTok" value={copyUrl} onChange={e => setCopyUrl(e.target.value)} />
            </div>

            <div className="cmp-settings">
              <div className="cmp-ctrl">
                <div className="cmp-label">{t('project.scene_count')} <span className="rv">{copyCount}</span></div>
                <div className="stepper">
                  <button type="button" onClick={() => setCopyCount(c => Math.max(2, c - 1))}>−</button>
                  <input type="number" min={2} max={20} value={copyCount}
                    onChange={e => setCopyCount(Math.min(20, Math.max(2, +e.target.value || 2)))} />
                  <button type="button" onClick={() => setCopyCount(c => Math.min(20, c + 1))}>+</button>
                </div>
              </div>
              <div className="cmp-ctrl">
                <div className="cmp-label">{t('project.frame')}</div>
                <div className="selwrap">
                  <select className="cmp-sel" value={copyAspect} onChange={e => setCopyAspect(e.target.value)}>
                    <option value="9:16">{t('project.frame_vertical')}</option>
                    <option value="16:9">{t('project.frame_horizontal')}</option>
                    <option value="1:1">{t('project.frame_square')}</option>
                  </select>
                  <svg className="chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
                </div>
              </div>
              <div className="cmp-ctrl" style={{ gridColumn: '1 / -1' }}>
                <div className="cmp-label">{t('project.visual_style')}</div>
                <div className="selwrap">
                  <select className="cmp-sel" value={copyStyle} onChange={e => setCopyStyle(e.target.value)}>
                    <option value="">{t('project.keep_original_style')}</option>
                    {styleList.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                  <svg className="chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
                </div>
              </div>
            </div>

            {/* Giữ mặt — đồng bộ nhân vật cho video clone */}
            <div className="cmp-chiprow" style={{ marginBottom: 20 }}>
              <span className="cmp-clab">{t('project.face_lock')}</span>
              {chars.length === 0 && (
                <span style={{ fontSize: 12, color: 'var(--text3)' }}>{t('project.face_lock_clone_hint')}</span>
              )}
              {chars.map(c => (
                <div key={c.id} className={selectedChars.has(c.name) ? 'cmp-chip on' : 'cmp-chip'}
                  onClick={() => setSelectedChars(prev => { const n = new Set(prev); n.has(c.name) ? n.delete(c.name) : n.add(c.name); return n })}>
                  <img src={c.image_url} alt="" />@{c.name}
                </div>
              ))}
              <div className="cmp-chip add" onClick={() => setAddCharOpen(o => !o)} title={t('project.face_lock_tooltip')}>
                {addCharOpen ? <><X size={13} /> {t('project.close')}</> : <><Plus size={13} /> {t('project.add_character')}</>}
              </div>
            </div>
            {addCharOpen && (
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
                <input className="cmp-sel" placeholder={t('project.char_name_placeholder')} value={newCharName} onChange={e => setNewCharName(e.target.value)} style={{ flex: '0 0 160px' }} />
                <label className="cmp-ghost" style={{ cursor: 'pointer' }}>
                  {newCharFile ? `📷 ${newCharFile.name.slice(0, 14)}` : t('project.select_photo')}
                  <input ref={charFileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => setNewCharFile(e.target.files?.[0] || null)} />
                </label>
                <button type="button" className="cmp-cta" onClick={addCharacter} disabled={addingChar || !newCharName.trim() || !newCharFile} style={{ padding: '10px 16px' }}>
                  {addingChar ? <Loader2 size={13} className="spin" /> : t('project.save')}
                </button>
              </div>
            )}

            <div style={{ marginTop: 8 }}>
              <AudioPicker value={audioMode} onChange={setAudioMode} />
            </div>
          </div>

          <div className="cmp-actionbar">
            <div className="cmp-est">
              <span className="meta">{t('project.copy_est', { count: copyCount, aspect: copyAspect })}{selectedChars.size > 0 ? ` · ${t('project.locked_faces', { count: selectedChars.size })}` : ''}</span>
            </div>
            <div style={{ flex: 1 }} />
            <button className="cmp-cta" onClick={doCopy} disabled={copyLoading || !copyUrl.trim()}>
              {copyLoading ? <><Loader2 size={14} className="spin" /> {t('project.analyzing_creating_film')}</> : <>{t('project.create_film_now')}</>}
            </button>
          </div>
        </div>
      )}

      {/* VIDEO BÁN HÀNG — KOL + sản phẩm (component dùng chung) */}
      {tab === 'sell' && <SellVideo />}
    </div>
  )
}
