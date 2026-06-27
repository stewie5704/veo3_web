import { Trash2 } from 'lucide-react'
import DownloadMenu from './DownloadMenu'

interface Props {
  job: any
  fileIndex: number
  onDelete?: () => void
}

export default function VideoCard({ job, fileIndex, onDelete }: Props) {
  const videoUrl = `/uploads/${job.output_files[fileIndex]}`

  return (
    <div className="video-card">
      <div className="video-preview">
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
          <DownloadMenu
            base={`/videos/${job.id}/download/${fileIndex}`}
            filename={`veo3_video_${fileIndex + 1}.mp4`}
            flex
          />
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
