import { useState, useRef, useEffect } from 'react'
import { toolsApi, projectsApi, charactersApi } from '../api/client'
import { Loader2, X, Sparkles, PenLine, List, Clapperboard, Plus } from 'lucide-react'

const ASPECTS = ['16:9', '9:16', '1:1']


// Tái dùng đúng tên model Flow (đồng bộ với Projects.tsx)
const MODELS = [
  { key: 'veo_3_1_t2v_lite_low_priority', label: 'Veo 3.1 · Lite (Lower Priority) — FREE', cost: 0 },
  { key: 'veo_3_1_t2v_lite', label: 'Veo 3.1 · Lite — 5💎', cost: 5 },
  { key: 'veo_3_1_t2v_fast_portrait_ultra', label: 'Veo 3.1 · Fast — 10💎', cost: 10 },
  { key: 'veo_3_1_t2v_portrait', label: 'Veo 3.1 · Quality — 100💎', cost: 100 },
  { key: 'abra_t2v_10s', label: 'Omni Flash (10s) — 15💎', cost: 15 },
]
const DURATIONS = [4, 6, 8, 10]
const AUDIO = [
  { v: 'voiceover', t: '🎙️ Lồng tiếng (AI đọc)' },
  { v: 'character_speak', t: '👄 Nhân vật tự nói' },
  { v: 'off', t: '🔇 Không tiếng' },
] as const

/** Panel thêm 1 KỊCH BẢN / PHẦN mới vào dự án đang có. Giữ nhân vật + tỉ lệ của dự án. */
export default function AddPartPanel({ project, onDone, onClose }: {
  project: any; onDone: () => void; onClose: () => void
}) {
  const nextPart = Math.max(1, ...(project.scenes || []).map((s: any) => s.part || 1)) + 1
  const charNames: string[] = (project.characters || []).map((c: any) => c.name)

  const [mode, setMode] = useState<'ai' | 'manual' | 'prompts' | 'storyboard'>('ai')
  const [idea, setIdea] = useState('')
  const [sbFiles, setSbFiles] = useState<File[]>([])
  const sbFileRef = useRef<HTMLInputElement>(null)

  const [sceneCount, setSceneCount] = useState(6)
  const [duration, setDuration] = useState(project.duration_seconds || 8)
  const [model, setModel] = useState(project.model_key || MODELS[0].key)
  const [aspect, setAspect] = useState(project.aspect_ratio || '16:9')
  const [style, setStyle] = useState(project.style || '')
  const [language, setLanguage] = useState(project.language || 'vi')
  const [audioMode, setAudioMode] = useState<string>(project.audio_mode || 'voiceover')
  const [styleList, setStyleList] = useState<{ id: string; name: string }[]>([])
  
  const [chars, setChars] = useState<any[]>([])
  const [selectedChars, setSelectedChars] = useState<Set<string>>(new Set())
  const [addCharOpen, setAddCharOpen] = useState(false)
  const [newCharName, setNewCharName] = useState('')
  const [newCharFile, setNewCharFile] = useState<File | null>(null)
  const [addingChar, setAddingChar] = useState(false)
  const charFileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    toolsApi.styles().then(res => setStyleList(res || [])).catch(() => {})
    charactersApi.list().then(res => setChars(res || [])).catch(() => {})
  }, [])

  async function addCharacter() {
    if (!newCharName.trim() || !newCharFile) return
    setAddingChar(true)
    try {
      await charactersApi.add(newCharName.trim(), newCharFile)
      setNewCharName(''); setNewCharFile(null); setAddCharOpen(false)
      const list = await charactersApi.list()
      setChars(list || [])
      setSelectedChars(prev => new Set([...prev, list[0].id]))
    } catch (e: any) {
      setError(e.response?.data?.detail || 'Lỗi thêm nhân vật')
    }
    setAddingChar(false)
  }

  const [busy, setBusy] = useState<'' | 'gen' | 'create'>('')
  const [error, setError] = useState('')

  const modelObj = MODELS.find(m => m.key === model) || MODELS[0]

  // Ngữ cảnh nối tiếp: nhắc AI giữ nhân vật + bám phần trước (giữ mạch truyện).
  function continuationIdea() {
    const parts: string[] = ['Đây là PHẦN TIẾP THEO của câu chuyện.']
    if (charNames.length) parts.push(`Giữ NGUYÊN các nhân vật đã có: ${charNames.map(n => '@' + n).join(', ')} (cùng ngoại hình).`)
    if (project.idea) parts.push(`Bối cảnh/nội dung phần trước: ${project.idea}.`)
    parts.push('Yêu cầu nội dung cho PHẦN MỚI này:')
    return parts.join(' ') + '\n' + idea
  }

  // 1 BƯỚC: viết kịch bản -> tạo + render THẲNG (bỏ bước duyệt prompt, như kịch bản đầu).
  async function run() {
    setError(''); setBusy('gen')
    const cast = project.character_bible || []   // KHÓA nhân vật đã có -> phần này dùng lại y nguyên
    let res: any

    try {
      if (mode === 'prompts') {
        if (!idea.trim()) { setError('Dán prompts của bạn trước'); setBusy(''); return }
        const lines = idea.split('\n').map(l => l.trim()).filter(l => l.length > 0)
        if (!lines.length) { setError('Không tìm thấy prompt hợp lệ'); setBusy(''); return }
        res = { prompts: lines, narrations: new Array(lines.length).fill('') }
      } else if (mode === 'storyboard') {
        if (!sbFiles.length) { setError('Chọn ảnh storyboard hoặc PDF trước'); setBusy(''); return }
        res = await toolsApi.parseStoryboard(sbFiles, { scene_count: 0, language, aspect_ratio: aspect, style })
      } else if (mode === 'manual') {
        if (!idea.trim()) { setError('Dán kịch bản phần mới'); setBusy(''); return }
        res = await toolsApi.parseScript({ script: idea, scene_count: sceneCount, language, aspect_ratio: aspect, cast })
      } else {
        if (!idea.trim()) { setError('Nhập ý tưởng phần mới'); setBusy(''); return }
        res = await toolsApi.autoprompt({ idea: continuationIdea(), scene_count: sceneCount, language, aspect_ratio: aspect, style, cast })
      }
    } catch (e: any) { setError(e.response?.data?.detail || 'Tạo kịch bản thất bại'); setBusy(''); return }

    const scns: any[] = res.scenes || []
    const basePrompts: string[] = scns.length ? scns.map((s: any) => s.prompt || s.image || '') : (res.prompts || [])
    const baseNarr: string[] = scns.length
      ? scns.map((s: any) => ((s.speaker || '').trim() ? `${s.speaker}: ` : '') + (s.dialogue || ''))
      : (res.narrations || [])
    const valid = basePrompts.filter(p => (p || '').trim())
    if (!valid.length) { setError('AI chưa viết được cảnh nào, thử lại.'); setBusy(''); return }

    const cost = modelObj.cost * valid.length
    if (cost > 0 && !window.confirm(`Thêm ${valid.length} cảnh (Phần ${nextPart}) — tốn khoảng ${cost} 💎. Tiếp tục?`)) { setBusy(''); return }

    setBusy('create')
    try {
      await projectsApi.addScenes(project.id, {
        idea: idea.trim(), prompts: basePrompts, narrations: baseNarr,
        model_key: model, duration_seconds: duration, audio_mode: audioMode,
        character_bible: res.characters || [], auto_render: true,
        character_ids: Array.from(selectedChars)
      })
      onDone()
    } catch (e: any) { setError(e.response?.data?.detail || 'Thêm phần thất bại'); setBusy('') }
  }

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 200,
      display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '5vh 16px', overflowY: 'auto',
    }}>
      <div onClick={e => e.stopPropagation()} className="card" style={{ maxWidth: 720, width: '100%', margin: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ fontSize: 16, fontWeight: 700 }}>➕ Thêm kịch bản — <span style={{ color: 'var(--accent2)' }}>Phần {nextPart}</span></div>
          <button onClick={onClose} className="btn btn-ghost btn-sm btn-icon" style={{ marginLeft: 'auto' }}><X size={15} /></button>
        </div>

        {error && <div className="alert alert-error" style={{ marginBottom: 14 }}>{error}</div>}

          <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 12, lineHeight: 1.5 }}>
            Nối tiếp dự án — <strong>giữ nguyên {charNames.length} nhân vật</strong>
            {charNames.length > 0 && <> ({charNames.map(n => '@' + n).join(', ')})</>} để ghép phim liền mạch.
            <em>Tỉ lệ {project.aspect_ratio} sẽ được khoá cứng cho phần mới.</em>
          </div>

          <div className="cmp-tabs" style={{ marginBottom: 12 }}>
            <button className={mode === 'ai' ? 'on' : ''} onClick={() => setMode('ai')}><Sparkles size={14} /> AI viết</button>
            <button className={mode === 'manual' ? 'on' : ''} onClick={() => setMode('manual')}><PenLine size={14} /> Tự nhập kịch bản</button>
            <button className={mode === 'prompts' ? 'on' : ''} onClick={() => setMode('prompts')}><List size={14} /> Dán Prompts</button>
            <button className={mode === 'storyboard' ? 'on' : ''} onClick={() => setMode('storyboard')}><Clapperboard size={14} /> Đọc storyboard</button>
          </div>

          {mode === 'storyboard' ? (
            <div style={{ marginBottom: 14 }}>
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
            <textarea className="form-textarea" style={{ minHeight: mode === 'manual' ? 150 : 90, marginBottom: 14 }}
              value={idea} onChange={e => setIdea(e.target.value)}
              placeholder={mode === 'prompts' ? 'Dán danh sách prompt của bạn (1 dòng = 1 prompt = 1 cảnh)...\nVD:\nA cinematic shot of a mountain at sunset\nA person walking in the snow\n...'
                : mode === 'manual' ? 'Dán kịch bản phần tiếp theo (kèm lời thoại + tên nhân vật)...'
                : 'Phần này diễn biến tiếp thế nào? (VD: Mẹ và Nam mở rộng spa, gặp khó khăn mới...)'} />
          )}

          <div className="cmp-settings" style={{ marginBottom: 12 }}>
            <div className="cmp-ctrl" style={{ padding: '8px 12px' }}>
              <div className="cmp-label">Số cảnh</div>
              <div className="stepper">
                <button type="button" onClick={() => setSceneCount(c => Math.max(1, c - 1))}>−</button>
                <input type="number" min={1} max={600} value={sceneCount}
                  onChange={e => setSceneCount(Math.min(600, Math.max(1, +e.target.value || 1)))} />
                <button type="button" onClick={() => setSceneCount(c => Math.min(600, c + 1))}>+</button>
              </div>
            </div>
            <div className="cmp-ctrl" style={{ padding: '8px 12px' }}>
              <div className="cmp-label">Thời lượng</div>
              <div className="selwrap">
                <select className="cmp-sel" value={duration} onChange={e => setDuration(+e.target.value)}>
                  {DURATIONS.map(d => <option key={d} value={d}>{d}s</option>)}
                </select>
                <svg className="chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
              </div>
            </div>
            <div className="cmp-ctrl" style={{ padding: '8px 12px' }}>
              <div className="cmp-label">Chất lượng</div>
              <div className="selwrap">
                <select className="cmp-sel" value={model} onChange={e => setModel(e.target.value)}>
                  {MODELS.map(m => <option key={m.key} value={m.key}>{m.label.split(' — ')[0]}</option>)}
                </select>
                <svg className="chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
              </div>
            </div>
            <div className="cmp-ctrl" style={{ padding: '8px 12px' }}>
              <div className="cmp-label">Tỉ lệ</div>
              <div className="selwrap">
                <select className="cmp-sel" value={aspect} onChange={e => setAspect(e.target.value)}>
                  {ASPECTS.map(a => <option key={a}>{a}</option>)}
                </select>
                <svg className="chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
              </div>
            </div>
            <div className="cmp-ctrl" style={{ padding: '8px 12px' }}>
              <div className="cmp-label">Style</div>
              <div className="selwrap">
                <select className="cmp-sel" value={style} onChange={e => setStyle(e.target.value)}>
                  <option value="">Auto style</option>
                  {styleList.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
                <svg className="chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
              </div>
            </div>
            <div className="cmp-ctrl" style={{ padding: '8px 12px' }}>
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

          <div className="cmp-chiprow" style={{ marginBottom: 16 }}>
            <span className="cmp-clab" style={{ fontSize: 13, marginRight: 8 }}>Giữ mặt</span>
            {chars.length === 0 && (
              <span style={{ fontSize: 12, color: 'var(--text3)' }}>Thêm ảnh để AI giữ nguyên mặt qua các cảnh.</span>
            )}
            {chars.map(c => (
              <div key={c.id} className={selectedChars.has(c.id) ? 'cmp-chip on' : 'cmp-chip'}
                onClick={() => setSelectedChars(prev => { const n = new Set(prev); n.has(c.id) ? n.delete(c.id) : n.add(c.id); return n })}>
                <img src={c.image_url} alt="" />@{c.name}
              </div>
            ))}
            <div className="cmp-chip add" onClick={() => setAddCharOpen(o => !o)}>
              {addCharOpen ? <><X size={13} /> đóng</> : <><Plus size={13} /> thêm nhân vật mới</>}
            </div>
          </div>
          {addCharOpen && (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 16 }}>
              <input className="cmp-sel" placeholder="Tên (vd: hero)" value={newCharName} onChange={e => setNewCharName(e.target.value)} style={{ flex: '0 0 160px' }} />
              <label className="cmp-ghost" style={{ cursor: 'pointer', flex: 1, padding: '9px 12px' }}>
                {newCharFile ? `📷 ${newCharFile.name.slice(0, 14)}` : '📁 Chọn ảnh (nhìn thẳng, rõ mặt)'}
                <input ref={charFileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => setNewCharFile(e.target.files?.[0] || null)} />
              </label>
              <button type="button" className="cmp-cta" onClick={addCharacter} disabled={addingChar || !newCharName.trim() || !newCharFile} style={{ padding: '10px 16px', margin: 0 }}>
                {addingChar ? <Loader2 size={13} className="spin" /> : 'Lưu'}
              </button>
            </div>
          )}

          <button className="btn btn-primary" style={{ width: '100%' }} onClick={run} disabled={!!busy || (mode === 'storyboard' ? !sbFiles.length : !idea.trim())}>
            {busy === 'gen' ? <><Loader2 size={14} className="spin" /> Đang viết kịch bản...</>
              : busy === 'create' ? <><Loader2 size={14} className="spin" /> Đang thêm & render...</>
              : (mode === 'manual' || mode === 'storyboard' || mode === 'prompts' ? 'Phân tích & tạo →' : 'AI viết tiếp & tạo →')}
          </button>
      </div>
    </div>
  )
}
