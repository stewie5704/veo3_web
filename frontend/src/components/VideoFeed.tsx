import DownloadMenu from './DownloadMenu'
import { Film, AlertCircle, Loader2 } from 'lucide-react'

// Feed sản phẩm kiểu Flow: video đã/đang tạo xếp ở trên, mới nhất trước. Load từ server -> F5 vẫn còn.
export default function VideoFeed({ jobs }: { jobs: any[] }) {
  if (!jobs.length) return (
    <div className="empty-state" style={{ padding: '44px 20px' }}>
      <div className="ico"><Film size={24} color="var(--accent2)" /></div>
      <h3>Chưa có video nào</h3>
      <p>Tạo video đầu tiên bằng ô bên dưới — kết quả hiện ở đây, để lâu/F5 vẫn giữ.</p>
    </div>
  )
  return (
    <div className="stagger" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', gap: 14 }}>
      {jobs.map(j => {
        const file = (j.output_files || [])[0]
        return (
          <div key={j.id} className="video-card">
            <div className="video-preview" style={{ position: 'relative' }}>
              {j.status === 'done' && file ? (
                <video src={`/uploads/${file}`} controls preload="metadata"
                  style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
              ) : (
                <div className={`scene-ph${j.status === 'processing' ? ' shimmer' : ''}`} style={{ width: '100%', height: '100%' }}>
                  {j.status === 'failed' ? (
                    <><div className="scene-ph-orb fail"><AlertCircle size={20} /></div>
                      <span style={{ fontSize: 11, color: '#fca5a5', textAlign: 'center', padding: '0 10px' }}>{(j.error_msg || 'Lỗi').slice(0, 70)}</span></>
                  ) : (
                    <><div className="scene-ph-orb wait"><Loader2 size={20} className="spin" /></div><span>Đang tạo...</span></>
                  )}
                </div>
              )}
            </div>
            <div className="video-card-body">
              <div className="video-card-prompt">{j.prompt}</div>
              {j.status === 'done' && file && (
                <div style={{ marginTop: 8 }}>
                  <DownloadMenu base={`/videos/${j.id}/download/0`} filename={`veo3_${j.id.slice(0, 6)}.mp4`} />
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
