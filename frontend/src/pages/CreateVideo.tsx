import { useState, useEffect } from 'react'
import { videosApi } from '../api/client'
import VideoCard from '../components/VideoCard'

const MODELS = [
  { key: 'veo_3_1_t2v_lite_low_priority', label: 'Veo 3.1 Lite (Free)' },
  { key: 'veo_3_1_t2v_lite', label: 'Veo 3.1 Lite' },
  { key: 'veo_3_1_t2v_fast_portrait_ultra', label: 'Veo 3.1 Fast' },
  { key: 'veo_3_1_t2v_portrait', label: 'Veo 3.1 Quality' },
]

const ASPECTS = ['16:9', '9:16', '1:1', '4:3']
const DURATIONS = [4, 6, 8]

export default function CreateVideo({ user }: { user: any }) {
  const [prompt, setPrompt] = useState('')
  const [aspectRatio, setAspectRatio] = useState('16:9')
  const [duration, setDuration] = useState(8)
  const [count, setCount] = useState(2)
  const [modelKey, setModelKey] = useState(MODELS[0].key)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [currentJob, setCurrentJob] = useState<any>(null)
  const [polling, setPolling] = useState(false)

  // Poll for job status
  useEffect(() => {
    if (!currentJob || currentJob.status === 'done' || currentJob.status === 'failed') {
      setPolling(false)
      return
    }
    setPolling(true)
    const interval = setInterval(async () => {
      try {
        const updated = await videosApi.get(currentJob.id)
        setCurrentJob(updated)
        if (updated.status === 'done' || updated.status === 'failed') {
          clearInterval(interval)
          setPolling(false)
        }
      } catch {
        clearInterval(interval)
        setPolling(false)
      }
    }, 3000)
    return () => clearInterval(interval)
  }, [currentJob?.id, currentJob?.status])

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault()
    if (!prompt.trim()) return
    setError(''); setLoading(true); setCurrentJob(null)
    try {
      const job = await videosApi.create({
        prompt: prompt.trim(),
        aspect_ratio: aspectRatio,
        duration_seconds: duration,
        count,
        model_key: modelKey,
      })
      setCurrentJob(job)
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Tạo video thất bại')
    } finally {
      setLoading(false)
    }
  }

  const notReady = user && !user.google_connected && !user.has_gemini_key

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">🎬 Tạo Video</div>
          <div className="page-subtitle">Nhập prompt, chọn cấu hình và bấm Generate</div>
        </div>
      </div>

      {notReady && (
        <div className="alert alert-info" style={{ marginBottom: 20 }}>
          ⚠️ Bạn chưa kết nối tài khoản Google Ultra. Vào{' '}
          <a href="/settings" style={{ color: 'var(--accent2)' }}>⚙️ Cài đặt</a>{' '}
          để cài Extension hoặc nhập Gemini API key.
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, alignItems: 'start' }}>
        {/* Form */}
        <div className="card">
          <div className="card-header">✏️ Cấu hình</div>
          <form onSubmit={handleGenerate}>
            <div className="form-group">
              <label className="form-label">Prompt mô tả video</label>
              <textarea
                className="form-textarea"
                placeholder="Mô tả video bạn muốn tạo... Ví dụ: A cinematic shot of a mountain landscape at golden hour, with dramatic clouds rolling in..."
                value={prompt}
                onChange={e => setPrompt(e.target.value)}
                rows={5}
                required
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Model</label>
                <select className="form-select" value={modelKey} onChange={e => setModelKey(e.target.value)}>
                  {MODELS.map(m => <option key={m.key} value={m.key}>{m.label}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Tỉ lệ khung hình</label>
                <select className="form-select" value={aspectRatio} onChange={e => setAspectRatio(e.target.value)}>
                  {ASPECTS.map(a => <option key={a} value={a}>{a}</option>)}
                </select>
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Thời lượng (giây)</label>
                <select className="form-select" value={duration} onChange={e => setDuration(+e.target.value)}>
                  {DURATIONS.map(d => <option key={d} value={d}>{d}s</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Số video ({count})</label>
                <input
                  className="form-input"
                  type="range" min={1} max={4}
                  value={count}
                  onChange={e => setCount(+e.target.value)}
                />
              </div>
            </div>

            {error && <div className="alert alert-error">{error}</div>}

            <button
              type="submit"
              className="btn btn-primary btn-lg"
              style={{ width: '100%', justifyContent: 'center' }}
              disabled={loading || !prompt.trim()}
            >
              {loading ? <><span className="spinner" /> Đang tạo...</> : '⚡ Generate Video'}
            </button>
          </form>
        </div>

        {/* Result */}
        <div>
          {currentJob ? (
            <div className="card">
              <div className="card-header">
                📽️ Kết quả
                <span className={`badge badge-${currentJob.status}`} style={{ marginLeft: 'auto' }}>
                  {currentJob.status === 'pending' && '⏳ Chờ xử lý'}
                  {currentJob.status === 'processing' && '🔄 Đang tạo...'}
                  {currentJob.status === 'done' && '✅ Hoàn thành'}
                  {currentJob.status === 'failed' && '❌ Thất bại'}
                </span>
              </div>

              {(currentJob.status === 'pending' || currentJob.status === 'processing') && (
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 6 }}>
                    {currentJob.progress}% hoàn thành... Video AI mất khoảng 2-5 phút.
                  </div>
                  <div className="progress-bar">
                    <div className="progress-fill" style={{ width: `${Math.max(currentJob.progress, 5)}%` }} />
                  </div>
                </div>
              )}

              {currentJob.status === 'failed' && (
                <div className="alert alert-error">{currentJob.error_msg}</div>
              )}

              {currentJob.status === 'done' && currentJob.output_files.length > 0 && (
                <div>
                  <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 12 }}>
                    🎉 Tạo được {currentJob.output_files.length} video! Xem preview và tải về cái bạn thích:
                  </div>
                  <div className="video-grid" style={{ gridTemplateColumns: '1fr' }}>
                    {currentJob.output_files.map((_: string, i: number) => (
                      <VideoCard key={i} job={currentJob} fileIndex={i} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="card">
              <div className="empty-state">
                <div style={{ fontSize: 48 }}>🎬</div>
                <h3>Chưa có video nào</h3>
                <p>Nhập prompt và bấm Generate để bắt đầu tạo video AI</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
