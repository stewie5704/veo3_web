import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { projectsApi, videosApi, extensionApi } from '../api/client'
import { useToast } from '../components/Toast'
import DownloadMenu from '../components/DownloadMenu'
import { Trash2, Search, RefreshCw, Play, Loader2, FolderOpen, AlertCircle } from 'lucide-react'

type SortBy = 'newest' | 'oldest'

export default function MyVideos({ onUpdate }: { onUpdate?: () => void }) {
  const toast = useToast()
  const nav = useNavigate()
  const [projects, setProjects] = useState<any[]>([])   // mỗi item = project + scenes[]
  const [videos, setVideos] = useState<any[]>([])       // video lẻ (Tạo Video)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState<SortBy>('newest')
  const [extOk, setExtOk] = useState<boolean | null>(null)   // extension kết nối? (null = chưa biết)

  async function load() {
    setLoading(true)
    try {
      const list = await projectsApi.list()
      // lấy chi tiết (scenes) song song để có preview + đếm cảnh xong
      const detailed = await Promise.all(list.map((p: any) => projectsApi.get(p.id).catch(() => ({ ...p, scenes: [] }))))
      setProjects(detailed)
    } catch { setProjects([]) }
    try { setVideos(await videosApi.list(100)) } catch { setVideos([]) }
    setLoading(false)
  }
  async function retryVideo(id: string) {
    try { await videosApi.retry(id); toast('Đang tạo lại...', 'success'); load() }
    catch (e: any) { toast(e?.response?.data?.detail || 'Tạo lại thất bại', 'error') }
  }
  useEffect(() => { load() }, [])
  useEffect(() => { extensionApi.status().then(s => setExtOk(!!s.connected)).catch(() => setExtOk(null)) }, [])

  const sortFn = (a: any, b: any) => sortBy === 'newest'
    ? new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    : new Date(a.created_at).getTime() - new Date(b.created_at).getTime()

  const projList = projects
    .filter(p => !search || p.name?.toLowerCase().includes(search.toLowerCase()))
    .sort(sortFn)

  const vidList = videos
    .filter(v => !search || v.prompt?.toLowerCase().includes(search.toLowerCase()))
    .sort(sortFn)

  async function delProject(id: string, e: React.MouseEvent) {
    e.stopPropagation()
    if (!confirm('Xoá dự án này?')) return
    try {
      await projectsApi.delete(id)
      setProjects(ps => ps.filter(p => p.id !== id))
      toast('Đã xoá dự án', 'success')
      onUpdate?.()
    } catch (err: any) {
      toast(err?.response?.data?.detail || 'Xoá thất bại', 'error')
    }
  }

  const doneCount = (p: any) => (p.scenes || []).filter((s: any) => s.video_file).length

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Thư viện</div>
          <div className="page-subtitle">{projects.length} dự án · {videos.length} video lẻ</div>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={load}><RefreshCw size={13} /></button>
      </div>

      {extOk === false && (
        <div className="alert alert-warn" style={{ marginBottom: 18 }}>
          <AlertCircle size={15} /> Tiện ích trên Chrome chưa kết nối — chưa tạo video được. Mở tiện ích và <strong>đăng nhập lại</strong>, rồi mở 1 tab Google Flow (labs.google).
        </div>
      )}

      {/* Search + sort */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 22, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
          <Search size={13} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)' }} />
          <input className="form-input" style={{ paddingLeft: 34, height: 36 }} placeholder="Tìm dự án / video..."
            value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          {(['newest', 'oldest'] as SortBy[]).map(s => (
            <button key={s} onClick={() => setSortBy(s)} className={sortBy === s ? 'btn btn-primary btn-sm' : 'btn btn-ghost btn-sm'}>
              {s === 'newest' ? '↓ Mới nhất' : '↑ Cũ nhất'}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--text3)' }}>
          <Loader2 size={24} className="spin" style={{ marginBottom: 12 }} /><div>Đang tải...</div>
        </div>
      ) : (projList.length === 0 && vidList.length === 0) ? (
        <div className="empty-state">
          <div className="ico"><FolderOpen size={26} color="var(--accent2)" strokeWidth={1.8} /></div>
          <h3>Thư viện trống</h3>
          <p>Chưa có video nào. Tạo một dự án phim AI nhiều cảnh, hoặc dựng nhanh 1 clip ở mục Công cụ.</p>
          <p style={{ fontSize: 13, color: 'var(--text3)', marginTop: -4 }}>
            Nhớ kết nối Google Ultra trước khi tạo (xem <a href="/settings" onClick={(e) => { e.preventDefault(); nav('/settings') }} style={{ color: 'var(--accent2)' }}>Cài đặt</a>).
          </p>
          <button className="btn btn-primary" onClick={() => nav('/projects')}>+ Tạo dự án mới</button>
        </div>
      ) : (
        <>
          {/* ── DỰ ÁN ── */}
          {projList.length > 0 && (
            <>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text2)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 7 }}>
                <FolderOpen size={15} color="var(--accent2)" /> Dự án
              </div>
              <div className="stagger" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16, marginBottom: 32 }}>
                {projList.map(p => {
                  const scenes = p.scenes || []
                  const preview = scenes.find((s: any) => s.video_file)
                  const done = doneCount(p)
                  const total = scenes.length || p.scene_count || 0
                  return (
                    <div key={p.id} className="video-card" style={{ cursor: 'pointer' }} onClick={() => nav(`/projects/${p.id}`)}>
                      <div className="video-preview" style={{ position: 'relative' }}>
                        {preview ? (
                          <video src={`/uploads/${preview.video_file}`} preload="metadata"
                            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                        ) : (
                          <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, color: 'var(--text3)' }}>
                            <FolderOpen size={28} strokeWidth={1.5} style={{ opacity: 0.4 }} />
                            <span style={{ fontSize: 11 }}>{done > 0 ? `${done} cảnh xong` : 'Chưa có cảnh nào xong'}</span>
                          </div>
                        )}
                        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0)', opacity: 0, transition: 'all .2s' }}
                          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.opacity = '1'; (e.currentTarget as HTMLElement).style.background = 'rgba(0,0,0,0.45)' }}
                          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.opacity = '0'; (e.currentTarget as HTMLElement).style.background = 'rgba(0,0,0,0)' }}>
                          <Play size={34} color="#fff" />
                        </div>
                        <div style={{ position: 'absolute', top: 8, left: 8 }}>
                          <span className="badge badge-done" style={{ fontSize: 10 }}>{done}/{total} cảnh</span>
                        </div>
                      </div>
                      <div className="video-card-body">
                        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                          <span style={{ fontSize: 10, color: 'var(--text3)' }}>{p.aspect_ratio}</span>
                          <span style={{ fontSize: 10, color: 'var(--text3)' }}>·</span>
                          <span style={{ fontSize: 10, color: 'var(--text3)' }}>{new Date(p.created_at).toLocaleDateString('vi-VN')}</span>
                        </div>
                        <div className="video-card-actions" onClick={e => e.stopPropagation()}>
                          <button className="btn btn-primary btn-sm" style={{ flex: 1 }} onClick={() => nav(`/projects/${p.id}`)}>
                            <Play size={11} /> Xem
                          </button>
                          <button className="btn btn-danger btn-sm btn-icon" onClick={(e) => delProject(p.id, e)}><Trash2 size={12} /></button>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </>
          )}

          {/* ── VIDEO LẺ (Tạo Video) ── */}
          {vidList.length > 0 && (
            <>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text2)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 7 }}>
                🎬 Video lẻ
              </div>
              <div className="stagger" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16 }}>
                {vidList.map(v => {
                  const files = typeof v.output_files === 'string' ? JSON.parse(v.output_files || '[]') : (v.output_files || [])
                  const firstFile = files[0]
                  return (
                    <div key={v.id} className="video-card">
                      <div className="video-preview" style={{ position: 'relative' }}>
                        {v.status === 'done' && firstFile ? (
                          <video src={`/uploads/${firstFile}`} preload="metadata" controls
                            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                        ) : (
                          <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                            {v.status === 'processing' && <><Loader2 size={22} className="spin" color="var(--accent2)" /><span style={{ fontSize: 11, color: 'var(--text3)' }}>Đang tạo...</span></>}
                            {v.status === 'pending' && <span style={{ fontSize: 28 }}>⏳</span>}
                            {v.status === 'failed' && <><span style={{ fontSize: 26 }}>❌</span><span style={{ fontSize: 11, color: 'var(--red)', textAlign: 'center', padding: '0 8px' }}>{v.error_msg?.slice(0, 60)}</span></>}
                          </div>
                        )}
                      </div>
                      <div className="video-card-body">
                        <div className="video-card-prompt">{v.prompt}</div>
                        <div className="video-card-actions">
                          {v.status === 'done' && firstFile && (
                            <DownloadMenu base={`/videos/${v.id}/download/0`} filename={`veo3_${v.id.slice(0, 6)}.mp4`} flex />
                          )}
                          {v.status === 'failed' && (
                            <button className="btn btn-primary btn-sm" style={{ flex: 1 }} onClick={() => retryVideo(v.id)}>
                              <RefreshCw size={12} /> Tạo lại
                            </button>
                          )}
                          <button className="btn btn-danger btn-sm btn-icon" onClick={async () => { await videosApi.delete(v.id); setVideos(vs => vs.filter(x => x.id !== v.id)) }}>
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}
