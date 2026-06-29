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
  const [idea, setIdea] = useState('')
  const [sceneCount, setSceneCount] = useState(6)
  const [duration, setDuration] = useState(project.duration_seconds || 8)
  const [model, setModel] = useState(project.model_key || MODELS[0].key)
  const [audioMode, setAudioMode] = useState<string>(project.audio_mode || 'voiceover')
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
    if (!idea.trim()) { setError(mode === 'manual' ? 'Dán kịch bản phần mới' : 'Nhập ý tưởng phần mới'); return }
    setError(''); setBusy('gen')
    const cast = project.character_bible || []   // KHÓA nhân vật đã có -> phần này dùng lại y nguyên
    let res: any
    try {
      res = mode === 'manual'
        ? await toolsApi.parseScript({ script: idea, scene_count: sceneCount, language: project.language, aspect_ratio: project.aspect_ratio, cast })
        : await toolsApi.autoprompt({ idea: continuationIdea(), scene_count: sceneCount, language: project.language, aspect_ratio: project.aspect_ratio, cast })
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

          <button className="btn btn-primary" style={{ width: '100%' }} onClick={run} disabled={!!busy || !idea.trim()}>
            {busy === 'gen' ? <><Loader2 size={14} className="spin" /> Đang viết kịch bản...</>
              : busy === 'create' ? <><Loader2 size={14} className="spin" /> Đang thêm & render...</>
              : (mode === 'manual' ? 'Phân tích & tạo →' : 'AI viết tiếp & tạo →')}
          </button>
      </div>
    </div>
  )
}
