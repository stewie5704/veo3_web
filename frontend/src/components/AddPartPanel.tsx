import { useState, useRef, useEffect } from 'react'
import { toolsApi, projectsApi, charactersApi } from '../api/client'
import { Loader2, X, Sparkles, PenLine, List, Clapperboard, Plus } from 'lucide-react'
import { useT } from '../i18n'

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

/** Panel thêm 1 KỊCH BẢN / PHẦN mới vào dự án đang có. Giữ nhân vật + tỉ lệ của dự án. */
export default function AddPartPanel({ project, onDone, onClose }: {
  project: any; onDone: () => void; onClose: () => void
}) {
  const t = useT()
  const AUDIO = [
    { v: 'voiceover', t: '🎙️ ' + t('addpart.audio_voiceover') },
    { v: 'character_speak', t: '👄 ' + t('addpart.audio_character') },
    { v: 'off', t: '🔇 ' + t('addpart.audio_off') },
  ] as const
  const isSellVideo = (project.name || '').startsWith('Bán hàng:')

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
      setError(e.response?.data?.detail || t('addpart.error_add_character'))
    }
    setAddingChar(false)
  }

  const [busy, setBusy] = useState<'' | 'gen' | 'create'>('')
  const [error, setError] = useState('')

  const modelObj = MODELS.find(m => m.key === model) || MODELS[0]

  // Ngữ cảnh nối tiếp: nhắc AI giữ nhân vật + bám phần trước (giữ mạch truyện).
  function continuationIdea() {
    if (isSellVideo) {
      const parts: string[] = ['Đây là CẢNH TIẾP THEO của video quảng cáo/bán hàng.']
      if (charNames.length) parts.push(`Giữ NGUYÊN các đối tượng (nhân vật/sản phẩm) đã có: ${charNames.map(n => '@' + n).join(', ')}.`)
      if (project.idea) parts.push(`Sản phẩm / Bối cảnh gốc: ${project.idea}.`)
      parts.push('Yêu cầu cho đoạn tiếp theo:')
      return parts.join(' ') + '\n' + idea
    }
    const parts: string[] = ['Đây là PHẦN TIẾP THEO của câu chuyện.']
    if (charNames.length) parts.push(`Giữ NGUYÊN các nhân vật đã có: ${charNames.map(n => '@' + n).join(', ')} (cùng ngoại hình).`)
    if (project.idea) parts.push(`Bối cảnh/nội dung phần trước: ${project.idea}.`)
    parts.push('Yêu cầu nội dung cho PHẦN MỚI này:')
    return parts.join(' ') + '\n' + idea
  }

  const [copied, setCopied] = useState(false)
  const STRUCT_RE = /(?:^|\n)[^\p{L}\n]{0,4}(?:c[ảa]nh|scene|đoạn|phân đoạn)\s*\d+|h[ìi]nh ảnh\s*[:\-]|lời thoại\s*(?:\([^)]*\))?\s*[:\-]|prompt\s*[:\-]|narration\s*[:\-]/iu
  const hasStructure = (t: string) => STRUCT_RE.test(t)
  const looksVietnamese = (t: string) => { const m = t.match(/[ăâêôơưđàáảãạằắẳẵặầấẩẫậèéẻẽẹềếểễệìíỉĩịòóỏõọồốổỗộờớởỡợùúủũụừứửữựỳýỷỹỵ]/gi); return !!m && m.length >= 2 }
  const PROMPT_HINTS = /\b(shot|camera|close[- ]?up|wide|angle|the person|they|product|background|lighting|handheld|cinematic|vertical|9:?16|frame|lens|footage|scene|holds?|wearing|showcase|reference image)\b/i
  const isPromptish = (t: string) => !looksVietnamese(t) && (PROMPT_HINTS.test(t) || t.split(/\n{2,}/).filter(s => s.trim()).length > 1)


  // 1 BƯỚC: viết kịch bản -> chuyển sang bước Duyệt kịch bản
  async function preview() {
    setError(''); setBusy('gen')
    const cast = project.character_bible || []
    let res: any

    try {
      if (isSellVideo) {
        if (!idea.trim()) { setError(t('addpart.enter_idea_or_paste')); setBusy(''); return }
        if (hasStructure(idea) || isPromptish(idea)) {
          res = await toolsApi.parseScript({ script: idea, scene_count: sceneCount, language, aspect_ratio: aspect, cast })
        } else {
          res = await toolsApi.autoprompt({ idea: continuationIdea(), scene_count: sceneCount, language, aspect_ratio: aspect, style, cast })
        }
      } else {
        if (mode === 'prompts') {
          if (!idea.trim()) { setError(t('addpart.paste_prompts_first')); setBusy(''); return }
          const lines = idea.split('\n').map(l => l.trim()).filter(l => l.length > 0)
          if (!lines.length) { setError(t('addpart.no_valid_prompt')); setBusy(''); return }
          res = { prompts: lines, narrations: new Array(lines.length).fill('') }
        } else if (mode === 'storyboard') {
          if (!sbFiles.length) { setError(t('addpart.select_storyboard')); setBusy(''); return }
          res = await toolsApi.parseStoryboard(sbFiles, { scene_count: 0, language, aspect_ratio: aspect, style })
        } else if (mode === 'manual') {
          if (!idea.trim()) { setError(t('addpart.paste_script_new_part')); setBusy(''); return }
          res = await toolsApi.parseScript({ script: idea, scene_count: sceneCount, language, aspect_ratio: aspect, cast })
        } else {
          if (!idea.trim()) { setError(t('addpart.enter_idea_new_part')); setBusy(''); return }
          res = await toolsApi.autoprompt({ idea: continuationIdea(), scene_count: sceneCount, language, aspect_ratio: aspect, style, cast })
        }
      }
    } catch (e: any) { setError(e.response?.data?.detail || t('addpart.script_gen_failed')); setBusy(''); return }


    const scns: any[] = res.scenes || []
    const basePrompts: string[] = scns.length ? scns.map((s: any) => s.prompt || s.image || '') : (res.prompts || [])
    const baseNarr: string[] = scns.length
      ? scns.map((s: any) => ((s.speaker || '').trim() ? `${s.speaker}: ` : '') + (s.dialogue || ''))
      : (res.narrations || [])
    const valid = basePrompts.filter(p => (p || '').trim())
    if (!valid.length) { setError(t('addpart.ai_no_scenes')); setBusy(''); return }

    const cost = modelObj.cost * valid.length
    if (cost > 0 && !window.confirm(t('addpart.confirm_add_scenes', { count: valid.length, part: nextPart, cost: cost }))) { setBusy(''); return }

    setBusy('create')
    try {
      await projectsApi.addScenes(project.id, {
        idea: idea.trim(), prompts: valid.map(p => p.trim()), narrations: baseNarr.map(n => n.trim()),
        model_key: model, duration_seconds: duration, audio_mode: audioMode,
        character_bible: [], auto_render: true,
        character_ids: Array.from(selectedChars)
      })
      onDone()
    } catch (e: any) { setError(e.response?.data?.detail || t('addpart.add_part_failed')); setBusy('') }
  }

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 200,
      display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '5vh 16px', overflowY: 'auto',
    }}>
      <div onClick={e => e.stopPropagation()} className="card" style={{ maxWidth: 720, width: '100%', margin: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ fontSize: 16, fontWeight: 700 }}>➕ {t('addpart.title')} — <span style={{ color: 'var(--accent2)' }}>{t('addpart.part_number', { part: nextPart })}</span></div>
          <button onClick={onClose} className="btn btn-ghost btn-sm btn-icon" style={{ marginLeft: 'auto' }}><X size={15} /></button>
        </div>

        {error && <div className="alert alert-error" style={{ marginBottom: 14 }}>{error}</div>}

          <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 12, lineHeight: 1.5 }}>
            {t('addpart.continue_project')} — {isSellVideo ? <strong>{t('addpart.keep_chars_products')}</strong> : <strong>{t('addpart.keep_characters', { count: charNames.length })}</strong>}
            {(!isSellVideo && charNames.length > 0) && <> ({charNames.map(n => '@' + n).join(', ')})</>} {t('addpart.seamless_merge')}
            <em>{t('addpart.aspect_locked', { ratio: project.aspect_ratio })}</em>
          </div>

          {!isSellVideo && (
            <div className="cmp-tabs" style={{ marginBottom: 12 }}>
              <button className={mode === 'ai' ? 'on' : ''} onClick={() => setMode('ai')}><Sparkles size={14} /> {t('addpart.mode_ai')}</button>
              <button className={mode === 'manual' ? 'on' : ''} onClick={() => setMode('manual')}><PenLine size={14} /> {t('addpart.mode_manual')}</button>
              <button className={mode === 'prompts' ? 'on' : ''} onClick={() => setMode('prompts')}><List size={14} /> {t('addpart.mode_prompts')}</button>
              <button className={mode === 'storyboard' ? 'on' : ''} onClick={() => setMode('storyboard')}><Clapperboard size={14} /> {t('addpart.mode_storyboard')}</button>
            </div>
          )}

          {isSellVideo ? (
            <div style={{ marginBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6, gap: 8, flexWrap: 'wrap' }}>
                <label className="form-label" style={{ margin: 0 }}>{t('addpart.idea_script_prompt')}</label>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button className="btn btn-ghost btn-sm" onClick={() => setIdea('Cận cảnh chi tiết sản phẩm, nhấn mạnh độ bền và kết thúc bằng lời kêu gọi mua hàng chốt sale.')} title={t('addpart.suggest_tooltip')}><Sparkles size={12} /> {t('addpart.suggest')}</button>
                  <button className="btn btn-ghost btn-sm" onClick={() => {
                    const txt = `Viết PHẦN TIẾP THEO cho kịch bản video bán hàng affiliate, dọc 9:16, kiểu UGC quay tay, gồm ${sceneCount} cảnh.\n\nQUY TẮC:\n- Giữ NGUYÊN sản phẩm và KOL (gọi là "the exact product from the @Product reference image" và "the person from the @KOL reference image").\n- BẮT BUỘC chèn: keep the product the EXACT same... và Keep the person's face 100% identical...\n- Hình ảnh viết TIẾNG ANH, Lời thoại viết TIẾNG VIỆT.`
                    navigator.clipboard.writeText(txt)
                    setCopied(true); setTimeout(() => setCopied(false), 2000)
                  }} title={t('addpart.gpt_cmd_tooltip')}>
                    {copied ? t('addpart.copied') : t('addpart.gpt_command')}
                  </button>
                </div>
              </div>
              <textarea className="form-textarea" rows={5} style={{ width: '100%' }} value={idea} onChange={e => setIdea(e.target.value)} disabled={busy !== ''}
                placeholder={t('addpart.sell_placeholder')} />
            </div>
          ) : mode === 'storyboard' ? (
            <div style={{ marginBottom: 14 }}>
              <label htmlFor="sb-input" style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8,
                minHeight: 130, padding: '20px 16px', cursor: 'pointer', textAlign: 'center',
                border: '1.5px dashed var(--line, #2a2740)', borderRadius: 14, background: 'rgba(255,255,255,0.02)',
              }}>
                <Clapperboard size={26} style={{ color: 'var(--accent2)' }} />
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{t('addpart.storyboard_select')}</div>
                <div style={{ fontSize: 12, color: 'var(--text3)', maxWidth: 420 }}>
                  {t('addpart.storyboard_desc')}
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
              value={idea} onChange={e => setIdea(e.target.value)} disabled={busy !== ''}
              placeholder={mode === 'prompts' ? t('addpart.prompts_placeholder')
                : mode === 'manual' ? t('addpart.manual_placeholder')
                : t('addpart.ai_placeholder')} />
          )}

          <div className="cmp-settings" style={{ marginBottom: 12 }}>
            <div className="cmp-ctrl" style={{ padding: '8px 12px' }}>
              <div className="cmp-label">{t('addpart.scene_count')}</div>
              <div className="stepper">
                <button type="button" onClick={() => setSceneCount(c => Math.max(1, c - 1))}>−</button>
                <input type="number" min={1} max={600} value={sceneCount}
                  onChange={e => setSceneCount(Math.min(600, Math.max(1, +e.target.value || 1)))} />
                <button type="button" onClick={() => setSceneCount(c => Math.min(600, c + 1))}>+</button>
              </div>
            </div>
            <div className="cmp-ctrl" style={{ padding: '8px 12px' }}>
              <div className="cmp-label">{t('addpart.duration')}</div>
              <div className="selwrap">
                <select className="cmp-sel" value={duration} onChange={e => setDuration(+e.target.value)}>
                  {DURATIONS.map(d => <option key={d} value={d}>{d}s</option>)}
                </select>
                <svg className="chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
              </div>
            </div>
            <div className="cmp-ctrl" style={{ padding: '8px 12px' }}>
              <div className="cmp-label">{t('addpart.quality')}</div>
              <div className="selwrap">
                <select className="cmp-sel" value={model} onChange={e => setModel(e.target.value)}>
                  {MODELS.map(m => <option key={m.key} value={m.key}>{m.label.split(' — ')[0]}</option>)}
                </select>
                <svg className="chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
              </div>
            </div>
            <div className="cmp-ctrl" style={{ padding: '8px 12px' }}>
              <div className="cmp-label">{t('addpart.aspect_ratio')}</div>
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
              <div className="cmp-label">{t('addpart.language')}</div>
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
            <span className="cmp-clab" style={{ fontSize: 13, marginRight: 8 }}>{t('addpart.keep_face')}</span>
            {chars.length === 0 && (
              <span style={{ fontSize: 12, color: 'var(--text3)' }}>{t('addpart.keep_face_hint')}</span>
            )}
            {chars.map(c => (
              <div key={c.id} className={selectedChars.has(c.id) ? 'cmp-chip on' : 'cmp-chip'}
                onClick={() => setSelectedChars(prev => { const n = new Set(prev); n.has(c.id) ? n.delete(c.id) : n.add(c.id); return n })}>
                <img src={c.image_url} alt="" />@{c.name}
              </div>
            ))}
            <div className="cmp-chip add" onClick={() => setAddCharOpen(o => !o)}>
              {addCharOpen ? <><X size={13} /> {t('addpart.close')}</> : <><Plus size={13} /> {t('addpart.add_new_char')}</>}
            </div>
          </div>
          {addCharOpen && (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 16 }}>
              <input className="cmp-sel" placeholder="Tên (vd: hero)" value={newCharName} onChange={e => setNewCharName(e.target.value)} style={{ flex: '0 0 160px' }} />
              <label className="cmp-ghost" style={{ cursor: 'pointer', flex: 1, padding: '9px 12px' }}>
                {newCharFile ? `📷 ${newCharFile.name.slice(0, 14)}` : t('addpart.select_photo')}
                <input ref={charFileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => setNewCharFile(e.target.files?.[0] || null)} />
              </label>
              <button type="button" className="cmp-cta" onClick={addCharacter} disabled={addingChar || !newCharName.trim() || !newCharFile} style={{ padding: '10px 16px', margin: 0 }}>
                {addingChar ? <Loader2 size={13} className="spin" /> : t('addpart.save')}
              </button>
            </div>
          )}

          <button className="btn btn-primary" style={{ width: '100%' }} onClick={preview} disabled={!!busy || (mode === 'storyboard' ? !sbFiles.length : !idea.trim())}>
            {busy === 'gen' ? <><Loader2 size={14} className="spin" /> {t('addpart.writing_script')}</>
              : busy === 'create' ? <><Loader2 size={14} className="spin" /> {t('addpart.adding')}</>
              : (mode === 'manual' || mode === 'storyboard' || mode === 'prompts' ? t('addpart.analyze_and_add') : t('addpart.ai_write_and_add'))}
          </button>
      </div>
    </div>
  )
}
