import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { toolsApi, charactersApi, projectsApi } from '../api/client'
import { pushLog } from '../pages/Dashboard'
import DownloadMenu from './DownloadMenu'
import { Plus, Loader2, Sparkles, ShoppingBag, AlertCircle, ExternalLink, Copy, Check, SlidersHorizontal, ChevronUp } from 'lucide-react'

const GEN_MODELS = [
  { key: 'veo_3_1_t2v_lite_low_priority', short: '⚡ Lite · FREE' },
  { key: 'veo_3_1_t2v_lite', short: '⚡ Lite · 5💎' },
  { key: 'veo_3_1_t2v_fast_portrait_ultra', short: '🚀 Fast · 10💎' },
  { key: 'veo_3_1_t2v_portrait', short: '💎 Quality · 100💎' },
]
// Mũi tên xuống cho dropdown kiểu Flow (.cmp-sel) — đồng bộ trang Tạo
const Chev = () => <svg className="chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
const SELL_SCENES = [
  { v: 'street', label: '🏙️ Đường phố' }, { v: 'studio', label: '🎬 Studio' },
  { v: 'cafe', label: '☕ Quán cafe' }, { v: 'home', label: '🏠 Tại nhà' },
]
const AUDIO_MODES = [
  { v: 'voiceover', label: '🎙️ Lồng tiếng (AI đọc)' },
  { v: 'character_speak', label: '💬 Nhân vật tự nói' },
  { v: 'off', label: '🔇 Không tiếng' },
]
const VOICES = [
  { v: 'Kore', label: 'Kore (Nữ)' },
  { v: 'Aoede', label: 'Aoede (Nữ)' },
  { v: 'Leda', label: 'Leda (Nữ)' },
  { v: 'Vega', label: 'Vega (Nữ)' },
  { v: 'Puck', label: 'Puck (Nam)' },
  { v: 'Charon', label: 'Charon (Nam)' },
  { v: 'Orus', label: 'Orus (Nam)' },
  { v: 'Fenrir', label: 'Fenrir (Nam)' },
  { v: 'Achernar', label: 'Achernar (Nam)' },
  { v: 'Rigel', label: 'Rigel (Nam)' },
  { v: 'Sirius', label: 'Sirius (Nam)' },
  { v: 'Quasar', label: 'Quasar (Nam)' },
  { v: 'Pulcherrima', label: 'Pulcherrima (Phi giới tính · Forward)' },
  { v: 'Rasalgethi', label: 'Rasalgethi (Nam · Informative)' },
  { v: 'Sadachbia', label: 'Sadachbia (Nam · Lively)' },
  { v: 'Sadaltager', label: 'Sadaltager (Nam · Knowledgeable)' },
  { v: 'Schedar', label: 'Schedar (Nam · Even)' },
  { v: 'Sulafat', label: 'Sulafat (Nữ · Warm)' },
  { v: 'Umbriel', label: 'Umbriel (Nam · Smooth)' },
  { v: 'Vindemiatrix', label: 'Vindemiatrix (Nữ · Gentle)' },
  { v: 'Zephyr', label: 'Zephyr (Nữ · Bright)' },
  { v: 'Zubenelgenubi', label: 'Zubenelgenubi (Nam · Casual)' },
]
const MODEL_COST: Record<string, number> = {
  veo_3_1_t2v_lite_low_priority: 0, veo_3_1_t2v_lite: 5,
  veo_3_1_t2v_fast_portrait_ultra: 10, veo_3_1_t2v_portrait: 100,
}
const SCENE_VI: Record<string, string> = { street: 'trên phố', studio: 'trong studio', cafe: 'ở quán cafe', home: 'tại nhà' }
const TONE_VI: Record<string, string> = { ugc: 'UGC quay tay tự nhiên', young: 'trẻ trung', lux: 'sang xịn', fun: 'hài hước' }
const SCENE_EN: Record<string, string> = { street: 'walking on a city street', studio: 'in a clean studio', cafe: 'in a cozy cafe', home: 'at home' }
const TONE_EN: Record<string, string> = { ugc: 'casual handheld UGC style', young: 'youthful and energetic', lux: 'premium and elegant', fun: 'fun and humorous' }
// Cụm khoá sản phẩm tự chèn vào mỗi prompt -> Veo giữ đúng sản phẩm trong ảnh ref
const PRODUCT_LOCK = 'keep the product the EXACT same item as the reference image — identical colour, material and finish, surface pattern/print, logo and on-pack text (same wording, font and placement), label, shape and proportions; never recolour, restyle, relabel, resize, swap, distort, morph or regenerate it, and never add or remove any text or logo; product in sharp focus, true-to-life colour; UGC handheld, real skin, natural light, vertical 9:16'

// --- Tự nhận dạng nội dung dán vào ---
const VN_RE = /[ăâêôơưđàáảãạằắẳẵặầấẩẫậèéẻẽẹềếểễệìíỉĩịòóỏõọồốổỗộờớởỡợùúủũụừứửữựỳýỷỹỵ]/gi
const looksVietnamese = (t: string) => { const m = t.match(VN_RE); return !!m && m.length >= 2 }
const STRUCT_RE = /(?:^|\n)[^\p{L}\n]{0,4}(?:c[ảa]nh|scene|đoạn|phân đoạn)\s*\d+|h[ìi]nh ảnh\s*[:\-]|lời thoại\s*(?:\([^)]*\))?\s*[:\-]|prompt\s*[:\-]|narration\s*[:\-]/iu
const hasStructure = (t: string) => STRUCT_RE.test(t)
const PROMPT_HINTS = /\b(shot|camera|close[- ]?up|wide|angle|the person|they|product|background|lighting|handheld|cinematic|vertical|9:?16|frame|lens|footage|scene|holds?|wearing|showcase|reference image)\b/i
const isPromptish = (t: string) => !looksVietnamese(t) && (PROMPT_HINTS.test(t) || t.split(/\n{2,}/).filter(s => s.trim()).length > 1)

/** Video bán hàng: ảnh sản phẩm (+ KOL) -> dự án NHIỀU CẢNH nối khung, tự ghép; QUEUE + kết quả ngay trên tab này.
 *  1 ô đa năng: gõ ý tưởng/kịch bản tiếng Việt -> AI tự tạo prompt; dán sẵn prompt/kịch bản -> dùng luôn. */
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
    const validIds: string[] = []
    for (const [id, p] of entries) {
      if (p) {
        map[id] = p
        validIds.push(id)
      }
    }
    setSellData(map)
    if (validIds.length !== sellIds.length) {
      setSellIds(validIds)
      saveIds(validIds)
    }
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
  const [box, setBox] = useState('')
  const [copied, setCopied] = useState(false)
  const [scene, setScene] = useState('street')
  const [tone] = useState('ugc')   // tông cố định UGC (đã bỏ ô chọn) — vẫn dùng khi AI viết kịch bản
  const [sceneCount, setSceneCount] = useState(5)
  const [dur, setDur] = useState(8)
  const [lang, setLang] = useState('vi')
  const [voice, setVoice] = useState('Kore')
  const [audioMode, setAudioMode] = useState<'voiceover' | 'character_speak' | 'off'>('voiceover')
  const [model, setModel] = useState(GEN_MODELS[0].key)
  const [loading, setLoading] = useState(false)
  const [optOpen, setOptOpen] = useState(false)   // tùy chọn kiểu Flow: mặc định thu gọn, bấm mới bung
  const prodRef = useRef<HTMLInputElement>(null)
  const kolRef = useRef<HTMLInputElement>(null)
  const optRef = useRef<HTMLDivElement>(null)

  // Đóng popover tùy chọn khi bấm ra ngoài / nhấn Esc
  useEffect(() => {
    if (!optOpen) return
    const onDown = (e: MouseEvent) => { if (optRef.current && !optRef.current.contains(e.target as Node)) setOptOpen(false) }
    const onEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOptOpen(false) }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onEsc)
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onEsc) }
  }, [optOpen])

  function suggestIdea() {
    setBox(`Khoe ${name.trim() || 'sản phẩm'} ${SCENE_VI[scene]}, tông ${TONE_VI[tone]}: mở bằng hook bắt mắt, nêu 2-3 điểm nổi bật (chất liệu / giá / ưu đãi), kết bằng lời kêu gọi mua ở giỏ hàng.`)
  }

  // Câu lệnh dán vào trợ lý GPT (trong gói tặng) để nó viết đúng định dạng app đọc được
  function buildGptCommand(): string {
    const prod = name.trim() || 'sản phẩm trong ảnh'
    const langLabel = lang === 'vi' ? 'tiếng Việt' : 'tiếng Anh'
    return `Viết kịch bản video bán hàng affiliate (TikTok Shop), dọc 9:16, kiểu UGC quay tay, gồm ${sceneCount} cảnh NỐI TIẾP nhau cho sản phẩm: "${prod}". Bối cảnh: ${SCENE_VI[scene]}. Tông: ${TONE_VI[tone]}.

QUY TẮC:
- Phần HÌNH ẢNH viết bằng TIẾNG ANH cho AI Veo. Chỉ gọi nhân vật là "the person"/"they", TUYỆT ĐỐI không tả giới tính/tuổi/khuôn mặt/ngoại hình (ảnh quyết định 100%). Luôn kèm cụm: keep the product the EXACT same item as the reference image — identical colour, material and finish, surface pattern/print, logo and on-pack text (same wording, font and placement), label, shape and proportions; never recolour, restyle, relabel, swap, distort, morph or regenerate it.
- Phần LỜI THOẠI viết ${langLabel}, tự nhiên, ~1 câu mỗi cảnh, nối mạch để bán hàng.

Xuất ĐÚNG định dạng sau, KHÔNG thêm chữ nào khác:

Cảnh 1
HÌNH ẢNH: <english veo prompt>
LỜI THOẠI: <lời thoại>

Cảnh 2
HÌNH ẢNH: ...
LỜI THOẠI: ...

(đủ ${sceneCount} cảnh)`
  }

  async function copyCommand() {
    try {
      await navigator.clipboard.writeText(buildGptCommand())
      setCopied(true); setTimeout(() => setCopied(false), 2000)
    } catch { setError('Trình duyệt chặn copy — hãy bôi đen câu lệnh và copy thủ công.') }
  }

  // Tách văn bản có cấu trúc -> [{prompt, narration}] (thuần frontend, KHÔNG cần Gemini)
  function parsePastedScript(raw: string): { prompt: string; narration: string }[] {
    const text = (raw || '').replace(/\r/g, '').trim()
    if (!text) return []
    // Bỏ ký tự trang trí đầu dòng (markdown ** ##, emoji, bullet) trước khi nhận diện -> "lì" hơn.
    const stripDeco = (s: string) => s.replace(/^[^\p{L}\p{N}"']+/u, '').trim()
    // Tiêu đề cảnh: KHÔNG bắt buộc dấu hai chấm ("Cảnh 1", "Cảnh 1: ...", "Cảnh 1 – Tiêu đề" đều nhận).
    const sceneHdr = /^(?:c[ảa]nh|scene|đoạn|phân đoạn|part)\s*\d+\b\s*[:.)\-–—]*\s*/i
    const visLabel = /^(?:h[ìi]nh ảnh|h[ìi]nh anh|prompt|visual|image|video|mô tả|mo ta|cảnh quay|bối cảnh)\s*[:\-–]\s*/i
    const narLabel = /^(?:lời thoại|loi thoai|thoại|thoai|narration|voice ?over|dialogue|lời|loi|script|nội dung)\s*(?:\([^)]*\))?\s*[:\-–]\s*/i
    // Dòng ghi chú sản xuất -> bỏ qua (tránh TTS đọc "Âm thanh: nhạc nền...", "Camera: ...").
    const ignoreLabel = /^(?:âm thanh|am thanh|music|nhạc|sound|sfx|ghi chú|ghi chu|note|notes|camera|máy quay|may quay|góc máy|thời lượng|duration|style|phong cách|chuyển cảnh|transition|caption|text màn hình)\s*[:\-–]/i
    type S = { prompt: string; narration: string }
    const scenes: S[] = []
    const lines = text.split('\n')
    // Có tiêu đề "Cảnh N" -> chỉ tách theo tiêu đề. KHÔNG có -> tách theo mỗi nhãn HÌNH ẢNH (mỗi ảnh = 1 cảnh).
    const hasHeaders = lines.some(l => sceneHdr.test(stripDeco(l.trim())))
    let cur: S | null = null
    let curHasImg = false   // cảnh hiện tại đã có nhãn HÌNH ẢNH chưa (để tách cảnh khi KHÔNG có tiêu đề "Cảnh N")
    let last: 'prompt' | 'narration' | 'ignore' = 'prompt'
    const start = () => { cur = { prompt: '', narration: '' }; scenes.push(cur); last = 'prompt'; curHasImg = false }
    const add = (f: 'prompt' | 'narration' | 'ignore', t: string) => {
      if (f === 'ignore') return
      if (!cur) start()
      cur![f] += (cur![f] ? ' ' : '') + t.trim(); last = f
    }

    for (const ln of lines) {
      const line = stripDeco(ln.trim())
      if (!line) continue
      const hdr = line.match(sceneHdr)
      if (hdr) { start(); const after = line.slice(hdr[0].length).replace(/[*_#~`]+$/g, '').trim(); if (after) add('prompt', after); continue }
      const vm = line.match(visLabel)
      if (vm) { if (!hasHeaders && curHasImg) start(); add('prompt', line.slice(vm[0].length)); curHasImg = true; continue }
      const nm = line.match(narLabel)
      if (nm) { add('narration', line.slice(nm[0].length)); continue }
      if (ignoreLabel.test(line)) { last = 'ignore'; continue }
      add(last, line)
    }
    return scenes.map(s => ({ prompt: s.prompt.trim(), narration: s.narration.trim() }))
      .filter(s => s.prompt || s.narration)
      .map(s => {
        let prompt = s.prompt
        if (!prompt && s.narration) prompt = `The person presents and shows the product to camera, ${SCENE_EN[scene] || 'on a street'}, ${TONE_EN[tone] || 'casual UGC'}`
        if (prompt && !/reference image/i.test(prompt)) prompt = `${prompt} — ${PRODUCT_LOCK}`
        return { prompt, narration: s.narration }
      })
  }

  async function doSell() {
    if (!product) { setError('Cần ảnh sản phẩm'); return }
    const text = box.trim()

    // Tự quyết: dán sẵn prompt/kịch bản -> dùng luôn (không Gemini); ý tưởng/kịch bản tiếng Việt -> AI tạo prompt
    let prompts: string[] = []
    let narrations: string[] = []
    const direct = !!text && (hasStructure(text) || isPromptish(text))
    if (direct) {
      if (hasStructure(text)) {
        const parsed = parsePastedScript(text)
        prompts = parsed.map(s => s.prompt); narrations = parsed.map(s => s.narration)
      } else {
        const blocks = text.split(/\n{2,}/).map(s => s.trim()).filter(Boolean)
        const list = blocks.length ? blocks : [text]
        prompts = list.map(p => /reference image/i.test(p) ? p : `${p} — ${PRODUCT_LOCK}`)
        narrations = []
      }
      if (!prompts.length) { setError('Chưa đọc được nội dung — thử lại hoặc dùng định dạng "Cảnh / HÌNH ẢNH / LỜI THOẠI".'); return }
    }
    const nScenes = direct ? prompts.length : sceneCount
    const cost = (MODEL_COST[model] || 0) * nScenes
    if (cost > 0 && !window.confirm(`Tạo ${nScenes} cảnh bằng model trả phí — tốn khoảng ${cost} 💎. Tiếp tục?`)) return

    setError(''); setLoading(true)
    try {
      pushLog(`🛍️ Video bán hàng: đang upload ảnh${direct ? ` + đọc ${nScenes} cảnh có sẵn` : ` + viết kịch bản ${sceneCount} cảnh`}...`)
      // Lưu sản phẩm (+ KOL) thành nhân vật -> ref MỌI cảnh = giữ ĐÚNG sản phẩm/mặt (ảnh quyết định diện mạo + giới tính).
      // Hậu tố thời gian để KHÔNG đụng lỗi "đã tồn tại" khi tạo nhiều video (kho chung chặn trùng tên); dọn lại sau khi tạo.
      const stamp = Date.now().toString(36).slice(-5)
      const prodTag = ((name.trim() || 'SanPham').replace(/[^\p{L}\p{N}]+/gu, '').slice(0, 16)) || 'SanPham'
      const prodChar = await charactersApi.add(`${prodTag}_${stamp}`, product)
      const ids: string[] = [prodChar.id]
      let kolChar: any = null
      if (kol) { kolChar = await charactersApi.add(`KOL_${stamp}`, kol); ids.push(kolChar.id) }

      if (!direct) {
        // AI tự viết kịch bản + tạo prompt, BÁM ý tưởng/kịch bản trong ô (nếu có)
        const sres = await toolsApi.sellScript({ product: name.trim(), scene, tone, scene_count: sceneCount, language: lang, duration: dur, has_kol: !!kol, brief: text })
        const scns: any[] = sres.scenes || []
        // Lưới an toàn: AI thỉnh thoảng quên chèn khoá sản phẩm -> tự bù như nhánh dán sẵn,
        // để MỌI cảnh đều neo đúng sản phẩm theo ảnh ref (đồng bộ xuyên cảnh).
        prompts = scns.map(s => { const p = s.prompt || ''; return p && !/reference image/i.test(p) ? `${p} — ${PRODUCT_LOCK}` : p })
        narrations = scns.map(s => s.narration || '')
        if (!prompts.length) throw new Error('AI chưa viết được kịch bản, thử lại.')
      }
      pushLog(`📝 Kịch bản ${prompts.length} cảnh — đang đưa lên hàng chờ render...`)

      const proj = await projectsApi.create({
        name: `Bán hàng: ${name.trim() || 'sản phẩm'}`,
        idea: text || `Video bán hàng ${name.trim() || 'sản phẩm'}`,
        model_key: model, aspect_ratio: '9:16', duration_seconds: dur, language: lang,
        prompts, narrations, auto_render: true, chain_mode: true,
        character_ids: ids, character_bible: [],
        audio_mode: audioMode, voiceover: audioMode === 'voiceover', voice,
      })
      pushLog(`✅ Đã đưa "${proj.name}" vào hàng chờ — đang render & sẽ tự ghép thành 1 video.`)
      const next = [proj.id, ...sellIds.filter(x => x !== proj.id)]
      setSellIds(next); saveIds(next)
      // Dự án đã CLONE ảnh sản phẩm/KOL thành bản riêng -> xoá nhân vật tạm khỏi kho chung cho gọn (lỗi cũng kệ)
      Promise.allSettled([prodChar.id, ...(kolChar ? [kolChar.id] : [])].map(cid => charactersApi.delete(cid)))
      setProduct(null); setProductPrev(null); setKol(null); setKolPrev(null); setBox('')
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

  const modelShort = GEN_MODELS.find(m => m.key === model)?.short || ''
  const voiceLabel = VOICES.find(v => v.v === voice)?.label || ''
  const sceneLabel = SELL_SCENES.find(s => s.v === scene)?.label || ''
  const audioLabel = audioMode === 'voiceover' ? voiceLabel : audioMode === 'character_speak' ? 'NV tự nói' : 'Không tiếng'
  const langLabel = lang === 'vi' ? '🇻🇳 Việt' : '🇺🇸 English'

  return (
    <div className="tool-flow">
      {optOpen && <div className="sell-scrim" onMouseDown={() => setOptOpen(false)} />}
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

      <div className="tool-composer" style={optOpen ? { zIndex: 50 } : undefined}>
        <div className="card fx-card" style={{ margin: 0 }}>
          {error && <div className="alert alert-error" style={{ marginBottom: 12 }}><AlertCircle size={15} /> {error}</div>}

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
            <input className="form-input" style={{ flex: 1, minWidth: 200, alignSelf: 'center' }} placeholder="Sản phẩm là gì? (vd: áo sweater oversize) — giúp viết sát hơn"
              value={name} onChange={e => setName(e.target.value)} />
          </div>

          {/* 1 ô đa năng: ý tưởng / kịch bản / prompt */}
          <div style={{ marginBottom: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6, gap: 8, flexWrap: 'wrap' }}>
              <label className="form-label" style={{ margin: 0 }}>Ý tưởng · kịch bản · hoặc prompt</label>
              <div style={{ display: 'flex', gap: 6 }}>
                <button className="btn btn-ghost btn-sm" onClick={suggestIdea} title="Điền nhanh một ý tưởng mẫu"><Sparkles size={12} /> Gợi ý</button>
                <button className="btn btn-ghost btn-sm" onClick={copyCommand} title="Copy câu lệnh để dán vào trợ lý GPT trong gói của bạn">
                  {copied ? <><Check size={12} /> Đã chép</> : <><Copy size={12} /> Lệnh cho GPT</>}
                </button>
              </div>
            </div>
            <textarea className="form-textarea" rows={5} style={{ width: '100%' }} value={box} onChange={e => setBox(e.target.value)}
              placeholder={'Gõ ý tưởng tiếng Việt → AI tự viết kịch bản & tạo prompt.\nHoặc dán prompt / kịch bản có sẵn (từ trợ lý GPT) → dùng luôn.\n\nVD ý tưởng: áo sweater oversize, chất dày, giá 199k, freeship.\nVD dán sẵn:\nCảnh 1\nHÌNH ẢNH: the person holds the product, close-up...\nLỜI THOẠI: Mọi người ơi, em này xịn lắm nha!'} />
          </div>

          {/* Hàng đáy gọn kiểu Flow: thanh tùy chọn thu gọn + nút Tạo cùng 1 hàng */}
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <div ref={optRef} style={{ position: 'relative', flex: 1, minWidth: 0 }}>
            <button type="button" className="sell-optbar" onClick={() => setOptOpen(o => !o)} aria-expanded={optOpen} title="Tùy chọn video">
              <span className="sum"><SlidersHorizontal size={14} /><b>{modelShort}</b> · {sceneCount} cảnh · {dur}s · {audioLabel} · {langLabel} · {sceneLabel}</span>
              <ChevronUp size={16} style={{ flex: 'none', color: 'var(--text3)', transition: 'transform .15s', transform: optOpen ? 'rotate(180deg)' : 'none' }} />
            </button>
            {optOpen && (
            <div className="sell-optpop">
            <div className="cmp-settings" style={{ marginBottom: 0 }}>
            <div className="cmp-ctrl">
              <div className="cmp-label">Bối cảnh</div>
              <div className="selwrap">
                <select className="cmp-sel" value={scene} onChange={e => setScene(e.target.value)}>
                  {SELL_SCENES.map(s => <option key={s.v} value={s.v}>{s.label}</option>)}
                </select>
                <Chev />
              </div>
            </div>
            <div className="cmp-ctrl">
              <div className="cmp-label">Thời lượng / cảnh</div>
              <div className="selwrap">
                <select className="cmp-sel" value={dur} onChange={e => setDur(+e.target.value)}>
                  {[4, 6, 8, 10].map(d => <option key={d} value={d}>{d}s</option>)}
                </select>
                <Chev />
              </div>
            </div>

            <div className="cmp-ctrl">
              <div className="cmp-label">Số cảnh</div>
              <div className="stepper">
                <button type="button" onClick={() => setSceneCount(c => Math.max(1, c - 1))}>−</button>
                <input type="number" min={1} max={12} value={sceneCount}
                  onChange={e => setSceneCount(Math.min(12, Math.max(1, +e.target.value || 1)))} />
                <button type="button" onClick={() => setSceneCount(c => Math.min(12, c + 1))}>+</button>
              </div>
            </div>
            <div className="cmp-ctrl">
              <div className="cmp-label">Ngôn ngữ lời thoại</div>
              <div className="selwrap">
                <select className="cmp-sel" value={lang} onChange={e => setLang(e.target.value)}>
                  <option value="vi">🇻🇳 Tiếng Việt</option>
                  <option value="en">🇺🇸 English</option>
                </select>
                <Chev />
              </div>
            </div>

            <div className="cmp-ctrl">
              <div className="cmp-label">Âm thanh</div>
              <div className="selwrap">
                <select className="cmp-sel" value={audioMode} onChange={e => setAudioMode(e.target.value as 'voiceover' | 'character_speak' | 'off')}>
                  {AUDIO_MODES.map(a => <option key={a.v} value={a.v}>{a.label}</option>)}
                </select>
                <Chev />
              </div>
            </div>
            <div className="cmp-ctrl">
              <div className="cmp-label">Giọng đọc</div>
              <div className="selwrap">
                <select className="cmp-sel" value={voice} onChange={e => setVoice(e.target.value)} disabled={audioMode === 'off'}>
                  {VOICES.map(v => <option key={v.v} value={v.v}>{v.label}</option>)}
                </select>
                <Chev />
              </div>
            </div>

            <div className="cmp-ctrl" style={{ gridColumn: '1 / -1' }}>
              <div className="cmp-label">Chất lượng video</div>
              <div className="selwrap">
                <select className="cmp-sel" value={model} onChange={e => setModel(e.target.value)}>
                  {GEN_MODELS.map(m => <option key={m.key} value={m.key}>{m.short}</option>)}
                </select>
                <Chev />
              </div>
            </div>
            </div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 14 }}>nối khung · giữ người·giọng·sản phẩm · tự ghép</div>
            </div>
            )}
          </div>
          <button className="cmp-cta" style={{ flex: 'none', justifyContent: 'center', padding: '0 20px', height: 44, whiteSpace: 'nowrap' }} onClick={doSell} disabled={loading || !product}>
            {loading ? <><Loader2 size={14} className="spin" /> Đang tạo...</> : <><ShoppingBag size={14} /> Tạo video</>}
          </button>
          </div>
        </div>
      </div>
    </div>
  )
}
