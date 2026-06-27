import { Download, Trash2 } from 'lucide-react'
import { videosApi } from '../api/client'

interface Props {
  job: any
  fileIndex: number
  onDelete?: () => void
}

export default function VideoCard({ job, fileIndex, onDelete }: Props) {
  const videoUrl = `/uploads/${job.output_files[fileIndex]}`
  const downloadUrl = videosApi.downloadUrl(job.id, fileIndex)

  return (
    <div className="video-card">
      <div className="video-preview" style={{ position: 'relative' }}>
        {job.hd && <span className="hd-badge">HD</span>}
        <video
          src={videoUrl}
          controls
          preload="metadata"
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
      </div>
      <div className="video-card-body">
        <div className="video-card-prompt">{job.prompt}</div>
        <div style={{ fontSize: 11, color: 'var(--text2)', marginBottom: 10 }}>
          {job.aspect_ratio} · {job.duration_seconds}s ·{' '}
          {new Date(job.created_at).toLocaleDateString('vi-VN')}
        </div>
        <div className="video-card-actions">
          <a
            href={downloadUrl}
            download={`veo3_video_${fileIndex + 1}.mp4`}
            className="btn btn-primary btn-sm"
          >
            <Download size={12} /> Tải về
          </a>
          {onDelete && (
            <button className="btn btn-danger btn-sm" onClick={onDelete}>
              <Trash2 size={12} />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
