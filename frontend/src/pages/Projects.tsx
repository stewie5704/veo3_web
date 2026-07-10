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
  const [step, setStep] = useState<'setup' | 'casting' | 'review'>('setup')  // wizard: thiết lập -> đang tạo nhân vật + phân tích cảnh -> duyệt kịch bản
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

  // Casting stage: mỗi nhân vật có state riêng để render grid cards với shimmer/thumb.
  // 'pending' = chờ tới lượt · 'generating' = đang gọi Flow · 'done' = có url · 'error' = fail
  type CastCardState = 'pending' | 'generating' | 'done' | 'error'
  type CastCard = { name: string; state: CastCardState; url?: string; error?: string; charId?: string }
  const [castCards, setCastCards] = useState<CastCard[]>([])
  const [scenePhase, setScenePhase] = useState<{ note: string; done: number; total: number }>({ note: '', done: 0, total: 1 })
  const [swapPickerIdx, setSwapPickerIdx] = useState<number | null>(null)  // index card đang mở picker
  const swapUploadRef = useRef<HTMLInputElement>(null)

  // Swap ảnh AI vẽ bằng ảnh user có sẵn / upload mới (Cách C).
  async function swapCastCardFromLibrary(cardIdx: number, libCharId: string) {
    const libChar = chars.find(c => c.id === libCharId)
    if (!libChar) return
    const cardName = castCards[cardIdx]?.name
    setCastCards(prev => prev.map((c, i) => i === cardIdx
      ? { ...c, state: 'done', url: libChar.image_url, charId: libChar.id, error: undefined }
      : c))
    if (cardName) setCharIdsMap(m => ({ ...m, [cardName]: libChar.id }))
    setSwapPickerIdx(null)
    pushLog(`🔁 "${cardName}" dùng ảnh có sẵn "${libChar.name}"`)
  }

  async function swapCastCardFromUpload(cardIdx: number, file: File) {
    const card = castCards[cardIdx]
    if (!card) return
    try {
      // Dùng lại flow upload thư viện — tự tạo character với ảnh này.
      const newChar = await charactersApi.add(card.name, file)
      setChars(prev => [...prev, newChar])
      setCastCards(prev => prev.map((c, i) => i === cardIdx
        ? { ...c, state: 'done', url: newChar.image_url, charId: newChar.id, error: undefined }
        : c))
      setCharIdsMap(m => ({ ...m, [card.name]: newChar.id }))
      setSwapPickerIdx(null)
      pushLog(`📷 "${card.name}" đã dùng ảnh upload`)
    } catch (e: any) {
      pushLog(`✗ Upload ảnh cho "${card.name}" lỗi: ${e.message || 'không rõ'}`, 'error')
    }
  }

  // Vẽ lại 1 nhân vật (khi user không hài lòng với ảnh AI đầu tiên).
  async function reGenerateCastCard(cardIdx: number, bibleObj: any) {
    setCastCards(prev => prev.map((c, i) => i === cardIdx ? { ...c, state: 'generating' } : c))
    try {
      const resp = await charactersApi.generateAIPortraitOne(bibleObj, true)  // overwrite = true
      setCastCards(prev => prev.map((c, i) => i === cardIdx
        ? { ...c, state: 'done', url: resp.image_url, charId: resp.id, error: undefined }
        : c))
      const card = castCards[cardIdx]
      if (card) setCharIdsMap(m => ({ ...m, [card.name]: resp.id }))
      pushLog(`🎨 Đã vẽ lại "${bibleObj.name || ''}"`)
    } catch (e: any) {
      setCastCards(prev => prev.map((c, i) => i === cardIdx
        ? { ...c, state: 'error', error: e.response?.data?.detail || e.message || 'lỗi' } : c))
    }
  }

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

  // ═══════════════════════════════════════════════════════════════════════════════
  // 1 pipeline duy nhất cho MỌI kiểu input (idea / script / prompts / storyboard).
  // Mỗi mode chỉ khác cách LẤY bible+scenes; sau khi có -> flow casting + review chung.
  // ═══════════════════════════════════════════════════════════════════════════════
  type InputMode = 'idea' | 'script' | 'prompts' | 'storyboard'

  async function runUnifiedPipeline(inputMode: InputMode) {
    setError(''); setLoadingPrompts(true)
    const t0 = Date.now()
    const secs = () => Math.round((Date.now() - t0) / 1000)
    try {
      const castObjs = chars.filter(c => selectedChars.has(c.name))

      // ── Nhánh PROMPTS: parse phẳng ở FE, không có bible ──
      if (inputMode === 'prompts') {
        if (!idea.trim()) { setError(t('project.paste_prompts_first')); return }
        const lines = idea.split('\n').map(l => l.trim()).filter(l => l.length > 0)
        if (!lines.length) { setError(t('project.no_valid_prompt')); return }
        pushLog(`Đã đọc ${lines.length} prompts`)
        setPrompts(lines); setNarrations(new Array(lines.length).fill(''))
        setScenes([]); setBibleChars([])
        // Không có bible từ prompts -> vào review luôn, chỉ có characters user đã chọn từ thư viện
        setStep('review')
        return
      }

      // ── Nhánh STORYBOARD: multipart sync (Gemini vision) ──
      if (inputMode === 'storyboard') {
        if (!sbFiles.length) { setError(t('project.select_storyboard_first')); return }
        pushLog(`Đang đọc ${sbFiles.length} ảnh storyboard...`)
        const res = await toolsApi.parseStoryboard(sbFiles, {
          scene_count: 0, language, aspect_ratio: aspect, style: style || undefined, cast: castObjs,
        })
        const bc = res.characters || []
        setPrompts(res.prompts || []); setNarrations(res.narrations || []); setScenes(res.scenes || [])
        setBibleChars(bc)
        const cv = Object.fromEntries(bc.map((c: any) =>
          [c.name, charVoices[c.name] || c.tts_voice || voice]))
        setCharVoices(cv)
        const n = (res.scenes?.length || res.prompts?.length || 0)
        if (!n) { setError(t('project.storyboard_no_frames')); return }
        pushLog(`✓ Đã đọc storyboard ${n} cảnh · ${bc.length} nhân vật (${secs()}s)`)
        if (bc.length === 0) { setStep('review'); return }
        setStep('casting')
        await kickCastingPortraits(bc)
        setStep('review')
        return
      }

      // ── Nhánh IDEA + SCRIPT: parse-script job nền với partial characters ──
      pushLog(inputMode === 'idea'
        ? `Đang biến ý tưởng thành ${sceneCount} cảnh...`
        : `Đang đọc kịch bản (${idea.length.toLocaleString('vi')} ký tự)...`)
      const { job_id } = await toolsApi.parseScriptStart({
        script: idea, scene_count: sceneCount, language, aspect_ratio: aspect, cast: castObjs,
        mode: inputMode,
      })
      pushLog(`Đã khởi động phân tích (job ${job_id.slice(0, 8)})...`)
      // Chuyển casting NGAY — hiện skeleton "đang phân tích..." trước khi có characters.
      // Cards sẽ được điền khi outline xong.
      setCastCards([])   // rỗng = hiện skeleton chờ
      setScenePhase({ note: 'Đang phân tích...', done: 0, total: 1 })
      setStep('casting')

      // ── Vòng poll: bắt characters SỚM (sau outline) rồi kick portraits song song. Tiếp tục poll expand ──
      let portraitsLaunched = false
      let portraitsDone: Promise<void> = Promise.resolve()
      let lastNote = ''
      let res: any = null
      // eslint-disable-next-line no-constant-condition
      while (true) {
        await new Promise(r => setTimeout(r, 2500))
        let st
        try {
          st = await toolsApi.parseScriptStatus(job_id)
        } catch (e: any) {
          const code = e.response?.status
          if (code === 404 || code === 403) throw e
          pushLog(`⏳ Mạng chớp nháy, thử lại... (${secs()}s)`)
          continue
        }

        // Bible SỚM -> vào step casting và kick portraits song song với expand.
        if (!portraitsLaunched && st.characters && st.characters.length > 0) {
          portraitsLaunched = true
          const bc = st.characters
          const cv = Object.fromEntries(bc.map((c: any) =>
            [c.name, charVoices[c.name] || charVoices['@' + c.name] || charVoices[c.name.replace('@', '')] || c.tts_voice || voice]))
          setBibleChars(bc)
          setCharVoices(cv)
          pushLog(`👥 Đã xác định ${bc.length} nhân vật — bắt đầu vẽ chân dung song song`)
          setStep('casting')
          portraitsDone = kickCastingPortraits(bc)
        }

        if (st.status === 'running') {
          const note = `${st.note || st.phase} · ${st.done}/${st.total}`
          setScenePhase({ note: st.note || st.phase, done: st.done, total: st.total || 1 })
          if (note !== lastNote) {
            pushLog(`⏳ ${note} — ${secs()}s`)
            lastNote = note
          }
          continue
        }
        if (st.status === 'error') {
          throw new Error(st.error || 'Lỗi không rõ khi phân tích kịch bản')
        }
        res = st.result
        break
      }

      // Scenes xong -> đợi tất cả portrait xong luôn rồi vào review.
      const bc = res?.characters || []
      // Nếu outline không kịp bắn characters trước (kịch bản ngắn) -> kick tại đây.
      if (!portraitsLaunched && bc.length > 0) {
        setBibleChars(bc)
        setStep('casting')
        portraitsDone = kickCastingPortraits(bc)
      }
      setPrompts(res?.prompts || [])
      setNarrations(res?.narrations || [])
      setScenes(res?.scenes || [])
      const n = (res?.scenes?.length || res?.prompts?.length || 0)
      if (!n) { setError(t('project.error_parse_script')); return }
      pushLog(`✓ Đã bóc tách ${n} cảnh (${secs()}s) — đợi vẽ chân dung xong...`)
      await portraitsDone
      pushLog(`✓ Đã tạo xong toàn bộ chân dung — vui lòng duyệt và chốt giọng`)
      setStep('review')
    } catch (e: any) {
      const msg = e.response?.data?.detail || e.message || 'không rõ'
      pushLog(`✗ Lỗi phân tích: ${msg}`, 'error')
      setError(e.response?.data?.detail || t('project.error_parse_script'))
      setStep('setup')
    } finally {
      setLoadingPrompts(false)
    }
  }

  // ═══ Client-side detect input type ═══
  // Không gọi AI — thuần heuristic. User luôn có thể override qua dropdown "Kiểu nội dung".
  //  - Đính kèm ảnh -> storyboard (ưu tiên nhất)
  //  - ≥3 dòng không rỗng + đa số > 30 ký tự + không có keyword kịch bản -> prompts
  //  - Có keyword "Cảnh N:" / "Scene N:" / "HỒI ", "Nhân vật:", ":" tần suất cao -> script
  //  - Ngắn (< 400 ký tự) + không có markup -> idea
  //  - Mặc định (dài + có cấu trúc mờ) -> script (an toàn hơn: giữ nguyên văn)
  function detectInputMode(text: string, hasFiles: boolean): InputMode {
    if (hasFiles) return 'storyboard'
    const t = text.trim()
    if (!t) return 'idea'
    const lines = t.split('\n').map(l => l.trim()).filter(Boolean)
    const hasScriptMarker = /(^|\n)\s*(cảnh|scene|hồi|chương|nhân vật|lời thoại|dialogue)\s*\d*\s*:/i.test(t)
    if (hasScriptMarker) return 'script'
    if (lines.length >= 3) {
      const longRatio = lines.filter(l => l.length > 30).length / lines.length
      if (longRatio > 0.5) return 'prompts'
    }
    if (t.length < 400 && lines.length <= 3) return 'idea'
    return 'script'   // dài + không rõ -> giả định là kịch bản (giữ nguyên văn)
  }

  // Chuẩn hoá tên để match fuzzy: bỏ dấu, lowercase, gọn khoảng trắng, bỏ @ đầu.
  // "Thạch Sanh" == "thach sanh" == "@ThachSanh" == "THẠCH  SANH "
  function _normName(s: string): string {
    return (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/^@/, '').replace(/\s+/g, ' ').trim().toLowerCase()
  }

  function findCharByFuzzyName(name: string) {
    const target = _normName(name)
    if (!target) return null
    return chars.find(x => _normName(x.name) === target) || null
  }

  // Vẽ portrait song song 3 luồng, cập nhật từng card khi xong. Trả Promise resolve khi ALL xong.
  async function kickCastingPortraits(bc: any[]): Promise<void> {
    const cards: CastCard[] = bc.map((c: any) => {
      const nm = c.name || c.char_key
      const already = findCharByFuzzyName(nm)   // fuzzy: bỏ dấu + lowercase
      if (already) return { name: nm, state: 'done', url: `/images/chars/${(already as any).image_file || ''}`, charId: already.id }
      return { name: nm, state: 'pending' }
    })
    setCastCards(cards)
    setGeneratingPortraits(true)

    const idToDo = cards.map((c, i) => (c.state === 'done' ? -1 : i)).filter(i => i >= 0)
    if (idToDo.length === 0) { setGeneratingPortraits(false); return }

    const CONCURRENCY = 3
    let cursor = 0
    const nextIdx = () => { const v = cursor < idToDo.length ? idToDo[cursor] : -1; cursor += 1; return v }

    async function worker() {
      while (true) {
        const i = nextIdx()
        if (i < 0) return
        const card = cards[i]
        const bibleObj = bc[i]
        setCastCards(prev => prev.map((c, ci) => ci === i ? { ...c, state: 'generating' } : c))
        try {
          const resp = await charactersApi.generateAIPortraitOne(bibleObj, false)
          setCastCards(prev => prev.map((c, ci) => ci === i ? { ...c, state: 'done', url: resp.image_url, charId: resp.id } : c))
          setCharIdsMap(m => ({ ...m, [card.name]: resp.id }))
          pushLog(`🎨 Chân dung "${card.name}" xong`)
        } catch (e: any) {
          const msg = e.response?.data?.detail || e.message || 'lỗi'
          setCastCards(prev => prev.map((c, ci) => ci === i ? { ...c, state: 'error', error: msg } : c))
          pushLog(`✗ Chân dung "${card.name}": ${msg}`, 'error')
        }
      }
    }
    const workers = Array.from({ length: Math.min(CONCURRENCY, idToDo.length) }, () => worker())
    await Promise.all(workers)
    // Refresh cache thư viện chars để review step có thumb đúng.
    try { setChars(await charactersApi.list()) } catch { /* ignore */ }
    setGeneratingPortraits(false)
  }

  // (Các flow parsePromptsLocally / readStoryboard cũ đã được gộp vào runUnifiedPipeline.)

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

              {/* Khung nhập DUY NHẤT: idea | script | prompts | storyboard - AI tự phân loại */}
              <div className="cmp-herowrap" style={{ position: 'relative' }}>
                <svg className="cmp-spark" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M12 4l1.6 5.4L19 11l-5.4 1.6L12 18l-1.6-5.4L5 11l5.4-1.6z" /></svg>
                <textarea className="cmp-hero" style={{ minHeight: 180 }} value={idea} onChange={e => setIdea(e.target.value)}
                  placeholder={t('project.unified_placeholder')} />

                {/* Chip attach ảnh + chip nhân vật (Cách A) */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
                  {/* Ảnh đính kèm (storyboard) */}
                  {sbFiles.map((f, i) => (
                    <span key={`sb-${i}`} className="cmp-chip" style={{ cursor: 'default', gap: 6 }}>
                      {f.type === 'application/pdf' ? '📄' : '🖼️'} {f.name.length > 22 ? f.name.slice(0, 20) + '…' : f.name}
                      <X size={13} style={{ cursor: 'pointer' }} onClick={() => setSbFiles(prev => prev.filter((_, j) => j !== i))} />
                    </span>
                  ))}
                  {/* Nhân vật đã chọn */}
                  {chars.filter(c => selectedChars.has(c.name)).map(c => (
                    <span key={c.id} className="cmp-chip on" style={{ gap: 6 }}
                      onClick={() => setSelectedChars(prev => { const n = new Set(prev); n.delete(c.name); return n })}>
                      <img src={c.image_url} alt="" style={{ width: 20, height: 20, borderRadius: '50%', objectFit: 'cover' }} />
                      @{c.name} <X size={13} />
                    </span>
                  ))}
                </div>

                {/* Nút bên dưới textarea: paperclip + nhân vật + auto-detect badge */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
                  {/* Đính kèm ảnh */}
                  <label className="cmp-ghost" style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 12px' }}>
                    <Clapperboard size={14} /> {t('project.attach_images')}
                    <input ref={sbFileRef} type="file" accept="image/*,application/pdf" multiple style={{ display: 'none' }}
                      onChange={e => { const fs = Array.from(e.target.files || []); if (fs.length) setSbFiles(prev => [...prev, ...fs].slice(0, 10)); if (sbFileRef.current) sbFileRef.current.value = '' }} />
                  </label>
                  {/* Nhân vật picker */}
                  <button type="button" className="cmp-ghost" style={{ padding: '8px 12px', display: 'inline-flex', alignItems: 'center', gap: 6 }}
                    onClick={() => setAddCharOpen(o => !o)}>
                    <Users size={14} /> {t('project.characters_picker')}
                    {selectedChars.size > 0 && <span style={{ background: 'var(--accent2)', color: '#fff', borderRadius: 10, padding: '1px 7px', fontSize: 11 }}>{selectedChars.size}</span>}
                  </button>
                  {/* Auto-detect badge */}
                  {idea.trim() && !sbFiles.length && (
                    <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text3)' }}>
                      🔍 {t('project.detected_as')}: <b style={{ color: 'var(--accent3)' }}>{
                        detectInputMode(idea, sbFiles.length > 0) === 'idea' ? t('project.mode_idea')
                        : detectInputMode(idea, sbFiles.length > 0) === 'script' ? t('project.mode_script')
                        : detectInputMode(idea, sbFiles.length > 0) === 'prompts' ? t('project.mode_prompt_list')
                        : t('project.mode_storyboard_short')
                      }</b>
                    </span>
                  )}
                  {sbFiles.length > 0 && (
                    <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text3)' }}>
                      🔍 {t('project.detected_as')}: <b style={{ color: 'var(--accent3)' }}>{t('project.mode_storyboard_short')}</b>
                    </span>
                  )}
                </div>
              </div>

              {/* Picker nhân vật — mở khi click nút nhân vật */}
              {addCharOpen && (
                <div style={{ marginTop: 12, padding: 14, background: 'var(--inset)', borderRadius: 12, border: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: chars.length > 0 ? 12 : 0 }}>
                    {chars.map(c => (
                      <div key={c.id} className={selectedChars.has(c.name) ? 'cmp-chip on' : 'cmp-chip'}
                        onClick={() => setSelectedChars(prev => { const n = new Set(prev); n.has(c.name) ? n.delete(c.name) : n.add(c.name); return n })}>
                        <img src={c.image_url} alt="" />@{c.name}
                      </div>
                    ))}
                  </div>
                  {/* Upload thêm nhân vật mới */}
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', paddingTop: chars.length > 0 ? 12 : 0, borderTop: chars.length > 0 ? '1px dashed var(--border)' : 'none' }}>
                    <input className="cmp-sel" placeholder={t('project.char_name_placeholder')} value={newCharName} onChange={e => setNewCharName(e.target.value)} style={{ flex: '0 0 160px' }} />
                    <label className="cmp-ghost" style={{ cursor: 'pointer' }}>
                      {newCharFile ? `📷 ${newCharFile.name.slice(0, 14)}` : t('project.select_photo')}
                      <input ref={charFileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => setNewCharFile(e.target.files?.[0] || null)} />
                    </label>
                    <button type="button" className="cmp-cta" onClick={addCharacter} disabled={addingChar || !newCharName.trim() || !newCharFile} style={{ padding: '10px 16px' }}>
                      {addingChar ? <Loader2 size={13} className="spin" /> : t('project.save')}
                    </button>
                  </div>
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
              
              <button className="cmp-cta"
                onClick={() => {
                  const detected = detectInputMode(idea, sbFiles.length > 0)
                  runUnifiedPipeline(detected)
                }}
                disabled={loadingPrompts || creating || (!idea.trim() && sbFiles.length === 0)}>
                {loadingPrompts || creating
                  ? <><Loader2 size={14} className="spin" /> {t('project.analyzing_creating')}</>
                  : <><svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round"><path d="M12 4l1.6 5.4L19 11l-5.4 1.6L12 18l-1.6-5.4L5 11l5.4-1.6z" /></svg> {t('project.cta_unified')}</>}
              </button>
            </div>
          </>)}

          {/* ─── BƯỚC 1.5: ĐANG TẠO NHÂN VẬT (grid card + phân tích cảnh song song) ─── */}
          {step === 'casting' && (<>
            <div className="cmp-body">
              <div style={{ textAlign: 'center', marginBottom: 24 }}>
                <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 6 }}>🎬 Đang tuyển vai</div>
                <div style={{ fontSize: 13, color: 'var(--text3)' }}>
                  AI đang vẽ chân dung {castCards.length} nhân vật &amp; chia nhỏ kịch bản song song
                </div>
              </div>

              {/* Grid nhân vật — skeleton khi chưa có characters, cards thật khi outline xong */}
              <div style={{
                display: 'grid', gap: 14,
                gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
                marginBottom: 22,
              }}>
                {castCards.length === 0 ? (
                  // Skeleton: 4 card chờ outline xong
                  Array.from({ length: 4 }).map((_, i) => (
                    <div key={`sk-${i}`} style={{
                      borderRadius: 14, aspectRatio: '3 / 4',
                      background: 'var(--inset)', border: '1px solid var(--border)',
                      backgroundImage: 'linear-gradient(115deg, rgba(255,255,255,.03) 25%, rgba(255,255,255,.08) 50%, rgba(255,255,255,.03) 75%)',
                      backgroundSize: '200% 100%',
                      animation: 'shimmerBg 1.6s linear infinite',
                    }} />
                  ))
                ) : castCards.map((c, i) => (
                  <div key={i} className="cast-card" style={{
                    borderRadius: 14, overflow: 'hidden',
                    border: '1px solid var(--border)',
                    background: 'var(--inset)',
                    position: 'relative',
                    aspectRatio: '3 / 4',
                    transition: 'transform .3s, box-shadow .3s',
                    transform: c.state === 'done' ? 'scale(1)' : 'scale(.98)',
                    boxShadow: c.state === 'done' ? '0 4px 24px rgba(249,115,22,0.14)' : 'none',
                  }}>
                    {/* Ảnh khi done */}
                    {c.state === 'done' && c.url && (
                      <img src={c.url} alt={c.name}
                        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
                    )}
                    {/* Shimmer khi generating */}
                    {c.state === 'generating' && (
                      <div style={{
                        position: 'absolute', inset: 0,
                        background: 'linear-gradient(115deg, rgba(249,115,22,.10), rgba(236,72,153,.14) 50%, rgba(168,85,247,.10))',
                        backgroundSize: '200% 100%',
                        animation: 'shimmerBg 1.4s linear infinite',
                      }}>
                        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Loader2 size={28} className="spin" style={{ color: 'var(--accent2)' }} />
                        </div>
                      </div>
                    )}
                    {/* Pending — dot chờ */}
                    {c.state === 'pending' && (
                      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: 'var(--text3)' }}>
                        · chờ tới lượt ·
                      </div>
                    )}
                    {/* Error */}
                    {c.state === 'error' && (
                      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                        flexDirection: 'column', gap: 6, padding: 12, fontSize: 11, color: 'var(--red)', textAlign: 'center' }}>
                        <X size={22} />
                        <span>{c.error || 'Lỗi vẽ'}</span>
                      </div>
                    )}
                    {/* Overlay hover: nút hành động (Cách C) — show khi done hoặc error */}
                    {(c.state === 'done' || c.state === 'error') && (
                      <div className="cast-hover" style={{
                        position: 'absolute', inset: 0,
                        background: 'rgba(0,0,0,.55)',
                        opacity: 0, transition: 'opacity .2s',
                        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8,
                        padding: 12,
                      }}>
                        <button type="button" className="cmp-ghost" style={{ padding: '6px 10px', fontSize: 11, gap: 5 }}
                          onClick={() => setSwapPickerIdx(swapPickerIdx === i ? null : i)}>
                          <Users size={12} /> {t('project.use_existing_image')}
                        </button>
                        <button type="button" className="cmp-ghost" style={{ padding: '6px 10px', fontSize: 11, gap: 5 }}
                          onClick={() => {
                            const bibleObj = bibleChars[i]
                            if (bibleObj) reGenerateCastCard(i, bibleObj)
                          }}>
                          <Sparkles size={12} /> {t('project.regenerate')}
                        </button>
                      </div>
                    )}
                    {/* Picker library — mở khi bấm Dùng ảnh có sẵn */}
                    {swapPickerIdx === i && (
                      <div style={{
                        position: 'absolute', inset: 0,
                        background: 'rgba(0,0,0,.92)',
                        padding: 10,
                        overflowY: 'auto',
                        zIndex: 2,
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                          <span style={{ fontSize: 11, color: '#fff', fontWeight: 600 }}>{t('project.pick_from_library')}</span>
                          <X size={16} style={{ cursor: 'pointer', color: '#fff' }} onClick={() => setSwapPickerIdx(null)} />
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 6 }}>
                          {chars.map(lib => (
                            <div key={lib.id} style={{ cursor: 'pointer', borderRadius: 6, overflow: 'hidden', border: '1px solid rgba(255,255,255,.15)' }}
                              onClick={() => swapCastCardFromLibrary(i, lib.id)}>
                              <img src={lib.image_url} alt="" style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', display: 'block' }} />
                              <div style={{ padding: '3px 6px', fontSize: 10, color: '#fff', background: 'rgba(0,0,0,.6)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>@{lib.name}</div>
                            </div>
                          ))}
                        </div>
                        <label className="cmp-ghost" style={{ marginTop: 8, cursor: 'pointer', fontSize: 11, padding: '6px 10px', display: 'flex', justifyContent: 'center', gap: 5 }}>
                          <Plus size={12} /> {t('project.upload_new')}
                          <input ref={swapUploadRef} type="file" accept="image/*" style={{ display: 'none' }}
                            onChange={e => { const f = e.target.files?.[0]; if (f) swapCastCardFromUpload(i, f); if (swapUploadRef.current) swapUploadRef.current.value = '' }} />
                        </label>
                      </div>
                    )}
                    {/* Overlay tên + trạng thái */}
                    <div style={{
                      position: 'absolute', left: 0, right: 0, bottom: 0,
                      padding: '10px 12px',
                      background: 'linear-gradient(to top, rgba(0,0,0,.75), transparent)',
                      color: '#fff',
                      pointerEvents: 'none',
                    }}>
                      <div style={{ fontSize: 13, fontWeight: 700 }}>{c.name}</div>
                      <div style={{ fontSize: 10.5, opacity: .8 }}>
                        {c.state === 'done' && '✓ Xong'}
                        {c.state === 'generating' && '⏳ Đang vẽ...'}
                        {c.state === 'pending' && '· chờ'}
                        {c.state === 'error' && '✗ Lỗi'}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Trạng thái phân tích cảnh */}
              <div style={{
                padding: '14px 16px', borderRadius: 12,
                background: 'var(--inset)', border: '1px solid var(--border)',
                display: 'flex', alignItems: 'center', gap: 12,
              }}>
                <Loader2 size={16} className="spin" style={{ color: 'var(--accent3)', flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 4 }}>
                    📽️ Chia nhỏ kịch bản
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--text2)' }}>
                    {scenePhase.note || 'Đang khởi động...'}
                  </div>
                </div>
                <div style={{ minWidth: 60, textAlign: 'right', fontSize: 13, fontWeight: 700, color: 'var(--accent3)' }}>
                  {scenePhase.total ? Math.round((scenePhase.done / scenePhase.total) * 100) : 0}%
                </div>
              </div>

              <div style={{ marginTop: 16, fontSize: 11, color: 'var(--text3)', textAlign: 'center' }}>
                Chờ chút — khi tất cả xong sẽ tự chuyển qua bước duyệt & chốt giọng.
              </div>
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
              <button className="cmp-ghost" onClick={() => createNew(false)} disabled={creating || loadingPrompts || generatingPortraits}>💾 {t('project.save_draft')}</button>
              <button className="cmp-cta" onClick={async () => {
                const n = reviewN
                const msg = reviewCost === 0
                  ? t('project.confirm_create_free', { n })
                  : t('project.confirm_create_paid', { n, cost: reviewCost })
                if (!window.confirm(msg)) return
                // Vá sót: nhân vật nào lỡ fail ở step casting -> retry lần chót trước khi tạo project.
                const needPortrait = bibleChars.filter((c: any) => {
                  const nm = c.name || c.char_key
                  return nm && !charIdsMap[nm] && !selectedChars.has(nm)
                })
                let extraCharMap: Record<string, string> = { ...charIdsMap }
                if (needPortrait.length > 0) {
                  const generated = await autoGeneratePortraits(needPortrait) || {}
                  extraCharMap = { ...extraCharMap, ...generated }
                }
                createNew(true, {
                  scenes, prompts, narrations, bible: bibleChars, charVoices,
                  charIdsMap: extraCharMap,
                })
              }} disabled={creating || loadingPrompts || generatingPortraits}>
                {creating ? <><Loader2 size={14} className="spin" /> {t('project.initializing')}</> : generatingPortraits ? <><Loader2 size={14} className="spin" /> {t('project.auto_drawing')}</> : t('project.create_and_merge')}
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
