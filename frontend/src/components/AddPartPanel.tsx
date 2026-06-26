import { useState } from 'react'
import { toolsApi, projectsApi } from '../api/client'
import { Loader2, X } from 'lucide-react'

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

  const [mode, setMode] = useState<'ai' | 'manual'>('ai')
  const [step, setStep] = useState<'setup' | 'review'>('setup')
  const [idea, setIdea] = useState('')
  const [sceneCount, setSceneCount] = useState(6)
  const [duration, setDuration] = useState(project.duration_seconds || 8)
  const [model, setModel] = useState(project.model_key || MODELS[0].key)
  const [audioMode, setAudioMode] = useState<string>(project.audio_mode || 'voiceover')
  const [loading, setLoading] = useState(false)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')
  const [scenes, setScenes] = useState<any[]>([])
  const [prompts, setPrompts] = useState<string[]>([])
  const [narrations, setNarrations] = useState<string[]>([])
  const [bibleChars, setBibleChars] = useState<any[]>([])

  const modelObj = MODELS.find(m => m.key === model) || MODELS[0]
  const reviewN = (scenes.length || prompts.length) || sceneCount
  const reviewCost = modelObj.cost * reviewN
  const updateScene = (i: number, key: string, val: string) =>
    setScenes(prev => prev.map((x, idx) => idx === i ? { ...x, [key]: val } : x))

  // Ngữ cảnh nối tiếp: nhắc AI giữ nhân vật + bám phần trước (giữ mạch truyện).
  function continuationIdea() {
    const parts: string[] = ['Đây là PHẦN TIẾP THEO của câu chuyện.']
    if (charNames.length) parts.push(`Giữ NGUYÊN các nhân vật đã có: ${charNames.map(n => '@' + n).join(', ')} (cùng ngoại hình).`)
    if (project.idea) parts.push(`Bối cảnh/nội dung phần trước: ${project.idea}.`)
    parts.push('Yêu cầu nội dung cho PHẦN MỚI này:')
    return parts.join(' ') + '\n' + idea
  }

  async function generate() {
    if (!idea.trim()) { setError(mode === 'manual' ? 'Dán kịch bản phần mới' : 'Nhập ý tưởng phần mới'); return }
    setError(''); setScenes([]); setPrompts([]); setNarrations([]); setBibleChars([])
    setLoading(true); setStep('review')
    try {
      const res = mode === 'manual'
        ? await toolsApi.parseScript({ script: idea, scene_count: sceneCount, language: project.language, aspect_ratio: project.aspect_ratio })
        : await toolsApi.autoprompt({ idea: continuationIdea(), scene_count: sceneCount, language: project.language, aspect_ratio: project.aspect_ratio })
      setPrompts(res.prompts || []); setNarrations(res.narrations || []); setScenes(res.scenes || [])
      setBibleChars(res.characters || [])
    } catch (e: any) { setError(e.response?.data?.detail || 'Tạo kịch bản thất bại'); setStep('setup') }
    finally { setLoading(false) }
  }

  async function submit() {
    const basePrompts = scenes.length ? scenes.map(s => s.prompt || s.image || '') : prompts
    const baseNarr = scenes.length
      ? scenes.map(s => ((s.speaker || '').trim() ? `${s.speaker}: ` : '') + (s.dialogue || ''))
      : narrations
    const valid = basePrompts.filter(p => (p || '').trim())
    if (!valid.length) { setError('Chưa có cảnh nào'); return }
    const msg = reviewCost === 0
      ? `Thêm ${valid.length} cảnh (Phần ${nextPart}) — model Miễn phí, KHÔNG tốn credit. Tiếp tục?`
      : `Thêm ${valid.length} cảnh (Phần ${nextPart}) — tốn khoảng ${reviewCost} 💎. Tiếp tục?`
    if (!window.confirm(msg)) return
    setError(''); setCreating(true)
    try {
      await projectsApi.addScenes(project.id, {
        idea: idea.trim(),
        prompts: basePrompts, narrations: baseNarr,
        model_key: model, duration_seconds: duration, audio_mode: audioMode,
        character_bible: bibleChars, auto_render: true,
      })
      onDone()
    } catch (e: any) { setError(e.response?.data?.detail || 'Thêm phần thất bại'); setCreating(false) }
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

        {step === 'setup' && (<>
          <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 12, lineHeight: 1.5 }}>
            Nối tiếp dự án — <strong>giữ nguyên {charNames.length} nhân vật</strong>
            {charNames.length > 0 && <> ({charNames.map(n => '@' + n).join(', ')})</>} và <strong>tỉ lệ {project.aspect_ratio}</strong> để ghép phim liền mạch.
          </div>

          <div className="cmp-tabs" style={{ marginBottom: 12 }}>
            <button className={mode === 'ai' ? 'on' : ''} onClick={() => setMode('ai')}>🤖 AI viết tiếp</button>
            <button className={mode === 'manual' ? 'on' : ''} onClick={() => setMode('manual')}>✍️ Tự nhập kịch bản</button>
          </div>

          <textarea className="form-textarea" style={{ minHeight: mode === 'manual' ? 150 : 90, marginBottom: 14 }}
            value={idea} onChange={e => setIdea(e.target.value)}
            placeholder={mode === 'manual'
              ? 'Dán kịch bản phần tiếp theo (kèm lời thoại + tên nhân vật)...'
              : 'Phần này diễn biến tiếp thế nào? (VD: Mẹ và Nam mở rộng spa, gặp khó khăn mới...)'} />

          <div className="form-row" style={{ marginBottom: 12 }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Số cảnh</label>
              <input className="form-input" type="number" min={1} max={600} value={sceneCount}
                onChange={e => setSceneCount(Math.min(600, Math.max(1, +e.target.value || 1)))} />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Thời lượng / cảnh</label>
              <select className="form-select" value={duration} onChange={e => setDuration(+e.target.value)}>
                {DURATIONS.map(d => <option key={d} value={d}>{d}s</option>)}
              </select>
            </div>
          </div>
          <div className="form-row" style={{ marginBottom: 12 }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Chất lượng video</label>
              <select className="form-select" value={model} onChange={e => setModel(e.target.value)}>
                {MODELS.map(m => <option key={m.key} value={m.key}>{m.label}</option>)}
              </select>
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Âm thanh</label>
              <select className="form-select" value={audioMode} onChange={e => setAudioMode(e.target.value)}>
                {AUDIO.map(a => <option key={a.v} value={a.v}>{a.t}</option>)}
              </select>
            </div>
          </div>

          <button className="btn btn-primary" style={{ width: '100%' }} onClick={generate} disabled={loading || !idea.trim()}>
            {loading ? <><Loader2 size={14} className="spin" /> Đang xử lý...</> : (mode === 'manual' ? 'Phân tích kịch bản →' : 'AI viết tiếp →')}
          </button>
        </>)}

        {step === 'review' && (<>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 13, fontWeight: 600 }}>📝 Phần {nextPart}: {reviewN} cảnh</span>
            <span style={{ fontSize: 12, color: reviewCost === 0 ? 'var(--green)' : 'var(--yellow)', fontWeight: 600 }}>
              {reviewCost === 0 ? 'FREE' : `${reviewCost} 💎`}
            </span>
            <button className="btn btn-ghost btn-sm" style={{ marginLeft: 'auto' }} onClick={() => setStep('setup')} disabled={creating}>← Sửa lại</button>
          </div>

          <div style={{ maxHeight: '46vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 14 }}>
            {loading ? Array.from({ length: Math.min(sceneCount, 6) }).map((_, i) => (
              <div key={i} className="card" style={{ margin: 0 }}>
                <div className="skel" style={{ height: 12, width: 80, marginBottom: 8 }} />
                <div className="skel" style={{ height: 26, width: '100%' }} />
              </div>
            )) : scenes.length > 0 ? scenes.map((s, i) => (
              <div key={i} style={{ padding: '12px 14px', background: 'var(--inset)', borderRadius: 11, border: '1px solid var(--border)' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#fff', background: 'var(--grad)', borderRadius: 6, padding: '2px 9px', display: 'inline-block', marginBottom: 8 }}>Cảnh {i + 1}</div>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text3)', textTransform: 'none', marginBottom: 5 }}>🎬 Mô tả hình ảnh</div>
                <textarea className="form-textarea" rows={2} style={{ fontSize: 12.5, minHeight: 'auto', marginBottom: 8 }} value={s.image || ''} onChange={e => updateScene(i, 'image', e.target.value)} />
                <div style={{ display: 'flex', gap: 6 }}>
                  <input className="form-input" style={{ fontSize: 12.5, flex: '0 0 110px' }} placeholder="Người nói" value={s.speaker || ''} onChange={e => updateScene(i, 'speaker', e.target.value)} />
                  <input className="form-input" style={{ fontSize: 12.5, flex: 1 }} placeholder="Lời thoại..." value={s.dialogue || ''} onChange={e => updateScene(i, 'dialogue', e.target.value)} />
                </div>
                <details style={{ marginTop: 8 }}>
                  <summary style={{ fontSize: 11, color: 'var(--text3)', cursor: 'pointer' }}>⚙ Mô tả cảnh — sửa nếu cần</summary>
                  <textarea className="form-textarea" rows={2} style={{ fontSize: 12, minHeight: 'auto', marginTop: 6 }} value={s.prompt || ''} onChange={e => updateScene(i, 'prompt', e.target.value)} />
                </details>
              </div>
            )) : prompts.map((p, i) => (
              <div key={i} style={{ padding: '10px 12px', background: 'var(--bg3)', borderRadius: 9, border: '1px solid var(--border)' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#fff', background: 'var(--grad)', borderRadius: 5, padding: '1px 7px', display: 'inline-block', marginBottom: 6 }}>Cảnh {i + 1}</div>
                <textarea className="form-textarea" rows={2} style={{ fontSize: 12, marginBottom: 6 }} value={p}
                  onChange={e => { const np = [...prompts]; np[i] = e.target.value; setPrompts(np) }} />
                {narrations[i] !== undefined && (
                  <input className="form-input" style={{ fontSize: 12 }} value={narrations[i]} placeholder="🔊 Lời thoại"
                    onChange={e => { const nn = [...narrations]; nn[i] = e.target.value; setNarrations(nn) }} />
                )}
              </div>
            ))}
          </div>

          <button className="btn btn-primary" style={{ width: '100%' }} onClick={submit} disabled={creating || loading}>
            {creating ? <><Loader2 size={14} className="spin" /> Đang thêm & render...</> : `➕ Thêm Phần ${nextPart} vào dự án`}
          </button>
        </>)}
      </div>
    </div>
  )
}
