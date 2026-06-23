import { useState, useEffect } from 'react'
import { videosApi, mediaApi } from '../api/client'
import { useToast } from '../components/Toast'
import { Trash2, Download, Share2, Search, Filter, RefreshCw, Play, Loader2 } from 'lucide-react'

type SortBy = 'newest' | 'oldest'
type FilterStatus = 'all' | 'done' | 'processing' | 'failed'

export default function MyVideos() {
  const toast = useToast()
  const [videos, setVideos] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all')
  const [sortBy, setSortBy] = useState<SortBy>('newest')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [deleting, setDeleting] = useState(false)
  const [thumbs, setThumbs] = useState<Record<string, string>>({})

  async function load() {
    setLoading(true)
    const data = await videosApi.list(100)
    setVideos(data)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  // Generate thumbnails for done videos
  useEffect(() => {
    videos.filter(v => v.status === 'done' && v.output_files?.length).forEach(async v => {
      const files = typeof v.output_files === 'string' ? JSON.parse(v.output_files) : v.output_files
      if (files?.[0] && !thumbs[v.id]) {
        try {
          const r = await mediaApi.thumbnail(files[0])
          setThumbs(t => ({ ...t, [v.id]: r.thumbnail_url }))
        } catch {}
      }
    })
  }, [videos])

  const filtered = videos
    .filter(v => filterStatus === 'all' || v.status === filterStatus)
    .filter(v => !search || v.prompt?.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => sortBy === 'newest'
      ? new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      : new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    )

  async function deleteOne(id: string) {
    await videosApi.delete(id)
    setVideos(vs => vs.filter(v => v.id !== id))
    toast('Đã xóa video', 'success')
  }

  async function deleteBulk() {
    if (!selected.size || !confirm(`Xóa ${selected.size} video?`)) return
    setDeleting(true)
    await Promise.all([...selected].map(id => videosApi.delete(id).catch(() => {})))
    setVideos(vs => vs.filter(v => !selected.has(v.id)))
    setSelected(new Set())
    toast(`Đã xóa ${selected.size} video`, 'success')
    setDeleting(false)
  }

  async function shareVideo(videoFile: string) {
    try {
      const r = await mediaApi.share(videoFile)
      const url = `${window.location.origin}${r.url}`
      await navigator.clipboard.writeText(url)
      toast('Đã copy link chia sẻ!', 'success')
    } catch { toast('Lỗi tạo link', 'error') }
  }

  function toggleSelect(id: string) {
    setSelected(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })
  }

  const STATUS_LABEL: Record<string, string> = {
    pending: '⏳ Chờ', processing: '🔄 Đang render', done: '✅ Xong', failed: '❌ Lỗi'
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Thư viện Video</div>
          <div className="page-subtitle">{videos.length} video · {videos.filter(v => v.status === 'done').length} hoàn thành</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {selected.size > 0 && (
            <button className="btn btn-danger" onClick={deleteBulk} disabled={deleting}>
              {deleting ? <Loader2 size={13} className="spin" /> : <Trash2 size={13} />}
              Xóa {selected.size} video
            </button>
          )}
          <button className="btn btn-ghost btn-sm" onClick={load}><RefreshCw size={13} /></button>
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
          <Search size={13} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)' }} />
          <input className="form-input" style={{ paddingLeft: 34, height: 36 }} placeholder="Tìm theo prompt..."
            value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          {(['all', 'done', 'processing', 'failed'] as FilterStatus[]).map(s => (
            <button key={s} onClick={() => setFilterStatus(s)}
              className={filterStatus === s ? 'btn btn-primary btn-sm' : 'btn btn-ghost btn-sm'}>
              {s === 'all' ? 'Tất cả' : s === 'done' ? '✅ Xong' : s === 'processing' ? '🔄 Đang render' : '❌ Lỗi'}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          {(['newest', 'oldest'] as SortBy[]).map(s => (
            <button key={s} onClick={() => setSortBy(s)}
              className={sortBy === s ? 'btn btn-primary btn-sm' : 'btn btn-ghost btn-sm'}>
              {s === 'newest' ? '↓ Mới nhất' : '↑ Cũ nhất'}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--text3)' }}>
          <Loader2 size={24} className="spin" style={{ marginBottom: 12 }} />
          <div>Đang tải...</div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <Play size={40} strokeWidth={1.5} style={{ opacity: 0.25, marginBottom: 12 }} />
          <h3>Không có video</h3>
          <p>{search || filterStatus !== 'all' ? 'Thử thay đổi bộ lọc' : 'Tạo video đầu tiên từ trang chủ'}</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
          {filtered.map(v => {
            const files = typeof v.output_files === 'string' ? JSON.parse(v.output_files || '[]') : (v.output_files || [])
            const firstFile = files[0]
            const isSelected = selected.has(v.id)
            return (
              <div key={v.id} className="video-card" style={{
                outline: isSelected ? '2px solid var(--accent)' : '2px solid transparent',
                cursor: 'pointer',
              }} onClick={() => toggleSelect(v.id)}>
                {/* Preview */}
                <div className="video-preview" style={{ position: 'relative' }}>
                  {v.status === 'done' && firstFile ? (
                    <>
                      {thumbs[v.id] ? (
                        <img src={thumbs[v.id]} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        <video src={`/uploads/${firstFile}`} preload="metadata"
                          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                      )}
                      <div style={{
                        position: 'absolute', inset: 0, background: 'rgba(0,0,0,0)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        opacity: 0, transition: 'all 0.2s',
                      }} className="video-hover-overlay"
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.opacity = '1'; (e.currentTarget as HTMLElement).style.background = 'rgba(0,0,0,0.5)' }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.opacity = '0'; (e.currentTarget as HTMLElement).style.background = 'rgba(0,0,0,0)' }}>
                        <Play size={36} color="#fff" />
                      </div>
                    </>
                  ) : (
                    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                      {v.status === 'processing' && <><Loader2 size={24} className="spin" color="var(--accent2)" /><span style={{ fontSize: 11, color: 'var(--text3)' }}>Đang render...</span></>}
                      {v.status === 'pending' && <><span style={{ fontSize: 30 }}>⏳</span><span style={{ fontSize: 11, color: 'var(--text3)' }}>Chờ xử lý</span></>}
                      {v.status === 'failed' && <><span style={{ fontSize: 30 }}>❌</span><span style={{ fontSize: 11, color: 'var(--red)', textAlign: 'center', padding: '0 8px' }}>{v.error_msg?.slice(0, 60)}</span></>}
                    </div>
                  )}
                  {isSelected && (
                    <div style={{ position: 'absolute', top: 8, right: 8, width: 22, height: 22, borderRadius: '50%', background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      ✓
                    </div>
                  )}
                  <div style={{ position: 'absolute', top: 8, left: 8 }}>
                    <span className={`badge badge-${v.status}`} style={{ fontSize: 10 }}>
                      {STATUS_LABEL[v.status] || v.status}
                    </span>
                  </div>
                </div>

                {/* Info */}
                <div className="video-card-body">
                  <div className="video-card-prompt">{v.prompt}</div>
                  <div style={{ display: 'flex', gap: 5, marginBottom: 10, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 10, color: 'var(--text3)' }}>{v.aspect_ratio}</span>
                    <span style={{ fontSize: 10, color: 'var(--text3)' }}>·</span>
                    <span style={{ fontSize: 10, color: 'var(--text3)' }}>{v.duration_seconds}s</span>
                    <span style={{ fontSize: 10, color: 'var(--text3)' }}>·</span>
                    <span style={{ fontSize: 10, color: 'var(--text3)' }}>{new Date(v.created_at).toLocaleDateString('vi-VN')}</span>
                  </div>
                  <div className="video-card-actions" onClick={e => e.stopPropagation()}>
                    {v.status === 'done' && firstFile && (
                      <>
                        <a href={`/uploads/${firstFile}`}
                          onClick={e => { e.stopPropagation(); window.open(`/uploads/${firstFile}`) }}
                          className="btn btn-primary btn-sm" style={{ flex: 1 }}>
                          <Play size={11} /> Xem
                        </a>
                        <a href={`/api/v1/videos/${v.id}/download/0`} download className="btn btn-ghost btn-sm btn-icon">
                          <Download size={12} />
                        </a>
                        <button className="btn btn-ghost btn-sm btn-icon" onClick={() => shareVideo(firstFile)} title="Chia sẻ">
                          <Share2 size={12} />
                        </button>
                      </>
                    )}
                    <button className="btn btn-danger btn-sm btn-icon" onClick={() => deleteOne(v.id)}>
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
