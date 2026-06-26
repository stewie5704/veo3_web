import { useState, useEffect } from 'react'
import { videosApi } from '../api/client'
import VideoCard from '../components/VideoCard'

const MODELS = [
  { key: 'veo_3_1_t2v_lite_low_priority', label: 'Veo 3.1 — Miễn phí (chậm, ~5-15 phút)' },
  { key: 'veo_3_1_t2v_lite', label: 'Veo 3.1 — Nhanh vừa' },
  { key: 'veo_3_1_t2v_fast_portrait_ultra', label: 'Veo 3.1 — Nhanh' },
  { key: 'veo_3_1_t2v_portrait', label: 'Veo 3.1 — Nét nhất' },
  { key: 'abra_t2v_10s', label: 'Omni 10 giây' },
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

  async function handleGenerate(e?: React.FormEvent) {
    e?.preventDefault()
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

  // Phải kết nối Google Ultra mới tạo được video. Chỉ có Gemini key thì KHÔNG đủ.
  const notReady = !!user && !user.google_connected

  return (
    <div style={{ maxWidth: 720, margin: '0 auto' }}>
      <div className="page-header" style={{ marginBottom: 18 }}>
        <div>
          <div className="page-title">Tạo Video</div>
          <div className="page-subtitle">Nhập mô tả video, chọn cấu hình rồi tạo video</div>
        </div>
      </div>

      {notReady && (
        <div className="alert alert-warn" style={{ marginBottom: 18, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 220 }}>
            <strong>⚠️ Chưa kết nối Google Ultra.</strong> Bạn cần kết nối Google Ultra mới tạo được video — chỉ nhập Gemini API key thì <strong>chưa đủ</strong>.
          </div>
          <a href="/settings" className="btn btn-primary btn-sm" style={{ whiteSpace: 'nowrap', textDecoration: 'none' }}>Kết nối ngay</a>
        </div>
      )}

      {/* Composer */}
      <div className="composer">
        <div className="cmp-body">
          <div className="cmp-herowrap">
            <svg className="cmp-spark" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M12 4l1.6 5.4L19 11l-5.4 1.6L12 18l-1.6-5.4L5 11l5.4-1.6z" /></svg>
            <textarea className="cmp-hero" style={{ minHeight: 120 }} value={prompt} onChange={e => setPrompt(e.target.value)}
              placeholder="Mô tả video bạn muốn tạo... VD: Cảnh quay điện ảnh một dãy núi lúc hoàng hôn, mây cuộn kịch tính..." />
          </div>

          <div className="cmp-settings">
            <div className="cmp-ctrl">
              <div className="cmp-label">Chất lượng video</div>
              <div className="selwrap">
                <select className="cmp-sel" value={modelKey} onChange={e => setModelKey(e.target.value)}>
                  {MODELS.map(m => <option key={m.key} value={m.key}>{m.label}</option>)}
                </select>
                <svg className="chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
              </div>
            </div>
            <div className="cmp-ctrl">
              <div className="cmp-label">Tỉ lệ khung hình</div>
              <div className="selwrap">
                <select className="cmp-sel" value={aspectRatio} onChange={e => setAspectRatio(e.target.value)}>
                  {ASPECTS.map(a => <option key={a} value={a}>{a}</option>)}
                </select>
                <svg className="chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
              </div>
            </div>
            <div className="cmp-ctrl">
              <div className="cmp-label">Thời lượng <span className="rv">{duration}s</span></div>
              <div className="seg2">
                {DURATIONS.map(d => <button key={d} type="button" className={duration === d ? 'on' : ''} onClick={() => setDuration(d)}>{d}</button>)}
              </div>
            </div>
            <div className="cmp-ctrl">
              <div className="cmp-label">Số video <span className="rv">{count}</span></div>
              <div className="seg2">
                {[1, 2, 3, 4].map(c => <button key={c} type="button" className={count === c ? 'on' : ''} onClick={() => setCount(c)}>{c}</button>)}
              </div>
            </div>
          </div>

          {error && <div className="alert alert-error" style={{ marginBottom: 0 }}>{error}</div>}
        </div>

        <div className="cmp-actionbar">
          {notReady && <div style={{ flex: 1, fontSize: 12, color: 'var(--text2)' }}>Hãy kết nối Google Ultra trong Cài đặt trước khi tạo video.</div>}
          {!notReady && <div style={{ flex: 1 }} />}
          <button className="cmp-cta" onClick={() => handleGenerate()} disabled={loading || !prompt.trim() || notReady}>
            {loading ? <><span className="spinner" /> Đang tạo...</> : <><svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round"><path d="M13 3 4 14h7l-1 7 9-11h-7z" /></svg> Tạo video</>}
          </button>
        </div>
      </div>

      {/* Result (xuống dưới, full width) */}
      {currentJob && (
        <div className="card" style={{ marginTop: 20 }}>
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
            <div style={{ marginBottom: 4 }}>
              <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 6 }}>
                {currentJob.progress}% hoàn thành... Video AI mất khoảng 2-5 phút.
              </div>
              <div className="progress-bar">
                <div className="progress-fill" style={{ width: `${Math.max(currentJob.progress, 5)}%` }} />
              </div>
            </div>
          )}

          {currentJob.status === 'failed' && <div className="alert alert-error" style={{ marginBottom: 0 }}>{currentJob.error_msg}</div>}

          {currentJob.status === 'done' && currentJob.output_files.length > 0 && (
            <div>
              <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 12 }}>
                🎉 Tạo được {currentJob.output_files.length} video — xem preview và tải về:
              </div>
              <div className="video-grid" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(240px,1fr))', display: 'grid', gap: 14 }}>
                {currentJob.output_files.map((_: string, i: number) => (
                  <VideoCard key={i} job={currentJob} fileIndex={i} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
