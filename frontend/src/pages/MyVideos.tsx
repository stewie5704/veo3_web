import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { projectsApi, videosApi, extensionApi, removeDeletedSellId } from '../api/client'
import { useToast } from '../components/Toast'
import DownloadMenu from '../components/DownloadMenu'
import { Trash2, Search, RefreshCw, Play, Loader2, FolderOpen, AlertCircle, X, Film, Sparkles, CheckCircle2, Clock } from 'lucide-react'
import { useT } from '../i18n'

type SortBy = 'newest' | 'oldest'
type FilterType = 'all' | 'projects' | 'videos' | 'done'

export default function MyVideos({ onUpdate }: { onUpdate?: () => void }) {
  const t = useT()
  const toast = useToast()
  const nav = useNavigate()
  const [projects, setProjects] = useState<any[]>([])   // mỗi item = project + scenes[]
  const [videos, setVideos] = useState<any[]>([])       // video lẻ (Tạo Video)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState<SortBy>('newest')
  const [filter, setFilter] = useState<FilterType>('all')
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
    try { await videosApi.retry(id); toast(t('video.retrying'), 'success'); load() }
    catch (e: any) { toast(e?.response?.data?.detail || t('video.retry_failed'), 'error') }
  }

  useEffect(() => { load() }, [])
  useEffect(() => { extensionApi.status().then(s => setExtOk(!!s.connected)).catch(() => setExtOk(null)) }, [])

  const sortFn = (a: any, b: any) => sortBy === 'newest'
    ? new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    : new Date(a.created_at).getTime() - new Date(b.created_at).getTime()

  const doneCount = (p: any) => (p.scenes || []).filter((s: any) => s.video_file).length

  let projList = projects
    .filter(p => !search || p.name?.toLowerCase().includes(search.toLowerCase()))
    .sort(sortFn)

  let vidList = videos
    .filter(v => !search || v.prompt?.toLowerCase().includes(search.toLowerCase()))
    .sort(sortFn)

  if (filter === 'projects') {
    vidList = []
  } else if (filter === 'videos') {
    projList = []
  } else if (filter === 'done') {
    projList = projList.filter(p => {
      const total = p.scenes?.length || p.scene_count || 0
      return total > 0 && doneCount(p) === total
    })
    vidList = vidList.filter(v => v.status === 'done')
  }

  async function delProject(id: string, e: React.MouseEvent) {
    e.stopPropagation()
    if (!confirm(t('video.confirm_delete_project'))) return
    try {
      await projectsApi.delete(id)
      removeDeletedSellId(id)
      setProjects(ps => ps.filter(p => p.id !== id))
      toast(t('video.deleted_project'), 'success')
      onUpdate?.()
    } catch (err: any) {
      toast(err?.response?.data?.detail || t('video.delete_failed'), 'error')
    }
  }

  const totalProjects = projects.length
  const totalVideos = videos.length

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto' }}>
      {/* Header */}
      <div className="page-header" style={{ alignItems: 'center', marginBottom: 20 }}>
        <div>
          <div className="page-title" style={{ gap: 10 }}>
            <Film size={22} className="text-orange-400" />
            <span>{t('video.library')}</span>
          </div>
          <div className="page-subtitle">
            {t('video.library_subtitle', { projects: totalProjects, videos: totalVideos })}
          </div>
        </div>

        <button 
          className="btn btn-ghost btn-sm" 
          onClick={load} 
          disabled={loading}
          title="Tải lại thư viện"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 12px' }}
        >
          <RefreshCw size={13} className={loading ? 'spin' : ''} />
          <span style={{ fontSize: 12 }}>Làm mới</span>
        </button>
      </div>

      {extOk === false && (
        <div className="alert alert-warn" style={{ marginBottom: 18 }}>
          <AlertCircle size={15} /> {t('video.extension_not_connected')}
        </div>
      )}

      {/* Search, Filter & Sort Controls */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
        {/* Search */}
        <div style={{ position: 'relative', flex: '1 1 280px', maxWidth: 420 }}>
          <Search size={14} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)' }} />
          <input 
            className="form-input" 
            style={{ paddingLeft: 38, paddingRight: search ? 34 : 14, height: 40, borderRadius: 12, background: 'rgba(255,255,255,0.03)' }} 
            placeholder={t('video.search_placeholder')}
            value={search} 
            onChange={e => setSearch(e.target.value)} 
          />
          {search && (
            <button 
              type="button" 
              onClick={() => setSearch('')}
              style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', padding: 4 }}
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Filter Pills */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <button type="button" className={`filter-pill ${filter === 'all' ? 'on' : ''}`} onClick={() => setFilter('all')}>
            Tất cả ({totalProjects + totalVideos})
          </button>
          <button type="button" className={`filter-pill ${filter === 'projects' ? 'on' : ''}`} onClick={() => setFilter('projects')}>
            Dự án ({totalProjects})
          </button>
          <button type="button" className={`filter-pill ${filter === 'videos' ? 'on' : ''}`} onClick={() => setFilter('videos')}>
            Video lẻ ({totalVideos})
          </button>
          <button type="button" className={`filter-pill ${filter === 'done' ? 'on' : ''}`} onClick={() => setFilter('done')}>
            <CheckCircle2 size={12} /> Đã xong
          </button>
        </div>

        {/* Sort */}
        <div className="seg2" style={{ height: 38, minWidth: 160 }}>
          <button type="button" className={sortBy === 'newest' ? 'on' : ''} onClick={() => setSortBy('newest')}>
            {t('video.sort_newest')}
          </button>
          <button type="button" className={sortBy === 'oldest' ? 'on' : ''} onClick={() => setSortBy('oldest')}>
            {t('video.sort_oldest')}
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '80px 20px', color: 'var(--text3)' }}>
          <Loader2 size={28} className="spin" style={{ margin: '0 auto 14px', color: 'var(--accent2)' }} />
          <div style={{ fontSize: 14, fontWeight: 500 }}>{t('video.loading')}</div>
        </div>
      ) : (projList.length === 0 && vidList.length === 0) ? (
        <div className="empty-state">
          <div className="ico"><FolderOpen size={28} color="var(--accent2)" strokeWidth={1.8} /></div>
          <h3>{t('video.library_empty')}</h3>
          <p>{t('video.library_empty_desc')}</p>
          <p style={{ fontSize: 13, color: 'var(--text3)', marginTop: -4 }}>
            {t('video.remember_connect_google')} <a href="/settings" onClick={(e) => { e.preventDefault(); nav('/settings') }} style={{ color: 'var(--accent2)' }}>{t('video.settings_link')}</a>).
          </p>
          <button className="cmp-cta" style={{ marginTop: 18 }} onClick={() => nav('/projects')}>
            <Sparkles size={15} /> {t('video.create_new_project')}
          </button>
        </div>
      ) : (
        <>
          {/* ── DỰ ÁN (Bento Cards) ── */}
          {projList.length > 0 && (
            <div style={{ marginBottom: 36 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text2)', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 7, textTransform: 'uppercase', letterSpacing: '.05em' }}>
                <FolderOpen size={15} color="var(--accent2)" /> {t('video.projects_section')} ({projList.length})
              </div>

              <div className="stagger" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))', gap: 20 }}>
                {projList.map(p => {
                  const scenes = p.scenes || []
                  const preview = scenes.find((s: any) => s.video_file)
                  const done = doneCount(p)
                  const total = scenes.length || p.scene_count || 0
                  const isDone = total > 0 && done === total
                  const isPortrait = p.aspect_ratio === '9:16'
                  const progressPct = total > 0 ? Math.round((done / total) * 100) : 0

                  return (
                    <div 
                      key={p.id} 
                      className="bento-card" 
                      style={{ cursor: 'pointer' }} 
                      onClick={() => nav(`/projects/${p.id}`)}
                    >
                      {/* Video Thumbnail with Hover Preview */}
                      <div className={`bento-thumb ${isPortrait ? 'portrait' : ''}`}>
                        {preview ? (
                          <video 
                            src={`/uploads/${preview.video_file}`} 
                            preload="metadata"
                            muted
                            loop
                            onMouseEnter={e => { e.currentTarget.play().catch(() => {}) }}
                            onMouseLeave={e => { e.currentTarget.pause(); e.currentTarget.currentTime = 0 }}
                          />
                        ) : (
                          <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, color: 'var(--text3)' }}>
                            <FolderOpen size={30} strokeWidth={1.4} style={{ opacity: 0.35, color: 'var(--accent2)' }} />
                            <span style={{ fontSize: 11 }}>{done > 0 ? t('video.scenes_done', { count: done }) : t('video.no_scenes_done')}</span>
                          </div>
                        )}

                        {/* Top Badges */}
                        <div className="bento-badge-top">
                          <span className={`clean-pill ${isDone ? 'done' : done > 0 ? 'active' : 'pending'}`}>
                            {isDone ? <CheckCircle2 size={11} /> : <Clock size={11} />}
                            {t('video.scene_count_badge', { done, total })}
                          </span>
                          {p.aspect_ratio && (
                            <span className="clean-pill" style={{ opacity: 0.85 }}>
                              {p.aspect_ratio}
                            </span>
                          )}
                        </div>

                        {/* Hover Play Button */}
                        <div className="bento-play-overlay">
                          <div className="bento-play-btn">
                            <Play size={20} fill="currentColor" style={{ marginLeft: 2 }} />
                          </div>
                        </div>

                        {/* Bottom Progress Bar */}
                        <div className="bento-progress">
                          <div className="bento-progress-bar" style={{ width: `${progressPct}%` }} />
                        </div>
                      </div>

                      {/* Card Body */}
                      <div className="bento-body">
                        <div>
                          <div style={{ fontSize: 14.5, fontWeight: 700, color: '#f3f4f6', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 4 }} title={p.name}>
                            {p.name}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: 'var(--text3)' }}>
                            <span>{new Date(p.created_at).toLocaleDateString('vi-VN')}</span>
                            <span>•</span>
                            <span>{p.model_key ? p.model_key.replace(/^veo_3_1_t2v_/, '').replace(/_/g, ' ') : 'Veo 3.1'}</span>
                          </div>
                        </div>

                        <div style={{ display: 'flex', gap: 8, marginTop: 'auto', paddingTop: 6 }} onClick={e => e.stopPropagation()}>
                          <button 
                            className="cmp-ghost" 
                            style={{ flex: 1, padding: '7px 12px', fontSize: 12.5, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }} 
                            onClick={() => nav(`/projects/${p.id}`)}
                          >
                            <Play size={12} fill="currentColor" /> {t('video.view')}
                          </button>
                          <button 
                            className="btn btn-danger btn-sm btn-icon" 
                            style={{ padding: '7px 10px', borderRadius: 10 }}
                            title="Xóa dự án"
                            onClick={(e) => delProject(p.id, e)}
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* ── VIDEO LẺ (Tạo Video) ── */}
          {vidList.length > 0 && (
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text2)', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 7, textTransform: 'uppercase', letterSpacing: '.05em' }}>
                <Film size={15} color="var(--accent2)" /> {t('video.standalone_videos')} ({vidList.length})
              </div>

              <div className="stagger" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))', gap: 20 }}>
                {vidList.map(v => {
                  const files = typeof v.output_files === 'string' ? JSON.parse(v.output_files || '[]') : (v.output_files || [])
                  const firstFile = files[0]
                  const isPortrait = v.aspect_ratio === '9:16'

                  return (
                    <div key={v.id} className="bento-card">
                      <div className={`bento-thumb ${isPortrait ? 'portrait' : ''}`}>
                        {v.status === 'done' && firstFile ? (
                          <video 
                            src={`/uploads/${firstFile}`} 
                            preload="metadata" 
                            controls
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                          />
                        ) : (
                          <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, padding: 16 }}>
                            {v.status === 'processing' && (
                              <>
                                <Loader2 size={24} className="spin" color="var(--accent2)" />
                                <span style={{ fontSize: 12, color: 'var(--text2)', fontWeight: 600 }}>{t('video.creating')}</span>
                              </>
                            )}
                            {v.status === 'pending' && (
                              <>
                                <span style={{ fontSize: 26 }}>⏳</span>
                                <span style={{ fontSize: 12, color: 'var(--text3)' }}>Đang chờ lượt...</span>
                              </>
                            )}
                            {v.status === 'failed' && (
                              <>
                                <AlertCircle size={26} color="var(--red)" />
                                <span style={{ fontSize: 11.5, color: 'var(--red)', textAlign: 'center', lineHeight: 1.4 }}>
                                  {v.error_msg?.slice(0, 70) || 'Lỗi render'}
                                </span>
                              </>
                            )}
                          </div>
                        )}

                        <div className="bento-badge-top">
                          <span className={`clean-pill ${v.status === 'done' ? 'done' : v.status === 'failed' ? 'pending' : 'active'}`}>
                            {v.status === 'done' ? '✓ Đã xong' : v.status === 'failed' ? '✗ Lỗi' : '⏳ Đang tạo'}
                          </span>
                        </div>
                      </div>

                      <div className="bento-body">
                        <div style={{ fontSize: 12.5, color: 'var(--text2)', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', lineHeight: 1.6, minHeight: 40 }} title={v.prompt}>
                          {v.prompt}
                        </div>

                        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 'auto', paddingTop: 6 }}>
                          {v.status === 'done' && firstFile && (
                            <DownloadMenu base={`/videos/${v.id}/download/0`} filename={`veo3_${v.id.slice(0, 6)}.mp4`} flex />
                          )}
                          {v.status === 'failed' && (
                            <button className="cmp-ghost" style={{ flex: 1, padding: '7px 12px', fontSize: 12 }} onClick={() => retryVideo(v.id)}>
                              <RefreshCw size={12} /> {t('video.retry')}
                            </button>
                          )}
                          <button 
                            className="btn btn-danger btn-sm btn-icon" 
                            style={{ padding: '7px 10px', borderRadius: 10 }}
                            title="Xóa video"
                            onClick={async () => { await videosApi.delete(v.id); setVideos(vs => vs.filter(x => x.id !== v.id)) }}
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
