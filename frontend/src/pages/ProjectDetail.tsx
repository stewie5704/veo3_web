import { useState, useEffect, useRef, Fragment } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { projectsApi, mediaApi, charactersApi } from '../api/client'
import { pushLog } from './Dashboard'
import {
  Pencil, RefreshCw, Play, Download, Copy, Upload, ImagePlus, Save, ChevronDown, ChevronUp, Plus,
  FileText, Film, Trash2, Pause, FolderOpen, ArrowLeft, Check, Cpu, RectangleHorizontal, Clock,
  Languages, Calendar, ScrollText, Clapperboard, Loader2, AlertCircle,
} from 'lucide-react'
import AddPartPanel from '../components/AddPartPanel'

// Thu gọn prompt còn 3 dòng (bấm "Xem thêm" để bung)
const CLAMP: React.CSSProperties = { display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }

export default function ProjectDetail({ user, onUpdate }: { user: any; onUpdate?: () => void }) {
  const { id } = useParams<{ id: string }>()
  const nav = useNavigate()
  const [project, setProject] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [editingScene, setEditingScene] = useState<string | null>(null)
  const [editPrompt, setEditPrompt] = useState('')
  const [addPartOpen, setAddPartOpen] = useState(false)   // mở panel thêm kịch bản/phần mới
  const [editPart, setEditPart] = useState<number | null>(null)   // đang sửa kịch bản phần nào
  const [partDraft, setPartDraft] = useState('')
  const [expanded, setExpanded] = useState<Set<string>>(new Set())   // scene id -> đang bung prompt
  const toggleExpand = (sid: string) => setExpanded(s => {
    const n = new Set(s); n.has(sid) ? n.delete(sid) : n.add(sid); return n
  })
  const [merging, setMerging] = useState(false)
  const [mergeUrl, setMergeUrl] = useState<string | null>(null)
  const [exporting, setExporting] = useState(false)
  const [toast, setToast] = useState<{ msg: string; kind: 'success' | 'error' } | null>(null)
  const toastTimer = useRef<any>(null)
  const prevStatus = useRef<Record<string, string>>({})   // scene id -> status đã thấy lần trước
  const seeded = useRef(false)                             // đã ghi nhận trạng thái ban đầu chưa
  const notifiedDone = useRef(false)                       // đã báo "dự án xong" chưa (báo 1 lần)
  // Nhân vật của dự án
  const [globalChars, setGlobalChars] = useState<any[]>([])
  const [charMode, setCharMode] = useState<'' | 'upload' | 'pick'>('')
  const [pcName, setPcName] = useState('')
  const [pcFile, setPcFile] = useState<File | null>(null)
  const [pcBusy, setPcBusy] = useState(false)
  const pcFileRef = useRef<HTMLInputElement>(null)

  async function load(silent = false) {
    if (!id) return
    try {
      const p = await projectsApi.get(id)
      detectTransitions(p)
      setProject(p)
    } catch {
      if (!silent) nav('/projects')
    } finally {
      setLoading(false)
    }
  }

  // Toast trong app + thông báo trình duyệt khi cảnh xong / dự án xong / cảnh lỗi.
  function notify(msg: string, kind: 'success' | 'error' = 'success', browser = false) {
    pushLog(msg, kind === 'error' ? 'error' : undefined)
    setToast({ msg, kind })
    clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(null), 4500)
    if (browser && 'Notification' in window && Notification.permission === 'granted') {
      try { new Notification('AI AutoCut 🎬', { body: msg }) } catch { /* ignore */ }
    }
  }

  // So trạng thái cảnh lần này với lần trước -> bắn thông báo khi có cảnh chuyển done/failed.
  function detectTransitions(p: any) {
    const scenes: any[] = p?.scenes || []
    if (!seeded.current) {   // lần load đầu: chỉ ghi nhận, KHÔNG báo cho cảnh đã xong từ trước
      scenes.forEach(s => { prevStatus.current[s.id] = s.status })
      notifiedDone.current = scenes.length > 0 && scenes.every(s => s.status === 'done')
      seeded.current = true
      return
    }
    let newlyDone = 0
    scenes.forEach(s => {
      const prev = prevStatus.current[s.id]
      if (prev && prev !== 'done' && s.status === 'done') newlyDone++
      if (prev && prev !== 'failed' && s.status === 'failed') notify(`❌ Cảnh ${s.index + 1} lỗi`, 'error', document.hidden)
      prevStatus.current[s.id] = s.status
    })
    const allDone = scenes.length > 0 && scenes.every(s => s.status === 'done')
    if (allDone && !notifiedDone.current) {
      notifiedDone.current = true
      notify(`🎬 Dự án "${p.name}" đã render xong toàn bộ ${scenes.length} cảnh!`, 'success', true)
    } else if (newlyDone > 0) {
      const doneN = scenes.filter(s => s.status === 'done').length
      notify(`✅ Xong cảnh ${doneN}/${scenes.length}`, 'success', document.hidden)
    }
  }

  useEffect(() => { load() }, [id])
  useEffect(() => () => clearTimeout(toastTimer.current), [])   // dọn timer khi rời trang

  // Auto-poll while scenes are active
  useEffect(() => {
    if (!project) return
    const hasActive = project.scenes.some((s: any) => s.status === 'pending' || s.status === 'processing')
    if (!hasActive) return
    // Xin quyền thông báo 1 lần khi đang render -> để báo lúc xong dù user đang ở tab/app khác.
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {})
    }
    const t = setInterval(() => load(true), 4000)
    return () => clearInterval(t)
  }, [project])

  async function saveScene(sceneId: string) {
    if (!id) return
    await projectsApi.updateScene(id, sceneId, { prompt: editPrompt })
    setEditingScene(null)
    pushLog(`Đã lưu prompt scene`)
    load(true)
  }

  async function savePartScript(part: number) {
    if (!id) return
    try {
      await projectsApi.updatePartScript(id, part, partDraft)
      setEditPart(null)
      notify('Đã lưu kịch bản')
      load(true)
    } catch {
      notify('Lưu kịch bản thất bại', 'error')
    }
  }

  async function rerenderScene(sceneId: string) {
    if (!id) return
    try {
      notify('Đang tạo lại cảnh...')
      await projectsApi.rerenderScene(id, sceneId)
      load(true)
    } catch {
      notify('Tạo lại cảnh thất bại. Thử lại hoặc kiểm tra extension đã đăng nhập chưa.', 'error')
    }
  }

  async function doMerge() {
    if (!id) return
    setMerging(true); setMergeUrl(null)
    pushLog('🎬 Bắt đầu ghép phim...')
    try {
      const res = await mediaApi.merge(id)
      setMergeUrl(res.url)
      pushLog(`✅ Ghép xong: ${res.filename}`)
    } catch (e: any) {
      pushLog(`❌ Ghép thất bại: ${e.response?.data?.detail || e.message}`, 'error')
    } finally {
      setMerging(false)
    }
  }

  async function uploadProjChar() {
    if (!id || !pcName.trim() || !pcFile) return
    setPcBusy(true)
    try {
      await charactersApi.add(pcName.trim(), pcFile, id)   // gắn riêng project này
      setPcName(''); setPcFile(null); setCharMode('')
      if (pcFileRef.current) pcFileRef.current.value = ''
      pushLog(`Đã thêm nhân vật vào dự án`)
      load(true)
    } catch (e: any) { pushLog(`❌ ${e.response?.data?.detail || 'Thêm thất bại'}`, 'error') }
    finally { setPcBusy(false) }
  }

  async function openPick() {
    setCharMode('pick')
    try { setGlobalChars(await charactersApi.list()) } catch { /* ignore */ }
  }

  async function pickFromKho(c: any) {
    if (!id) return
    setPcBusy(true)
    try {
      await charactersApi.copyInto(c.id, id, c.name)   // copy kho chung -> project
      pushLog(`Đã thêm @${c.name} vào dự án`)
      setCharMode('')
      load(true)
    } catch (e: any) { pushLog(`❌ ${e.response?.data?.detail || 'Thất bại'}`, 'error') }
    finally { setPcBusy(false) }
  }

  async function delProjChar(charId: string) {
    if (!confirm('Gỡ nhân vật này khỏi dự án?')) return
    await charactersApi.delete(charId)
    load(true)
  }

  async function doExport() {
    if (!id) return
    setExporting(true)
    try {
      const res = await projectsApi.exportPrompts(id)
      await navigator.clipboard.writeText(res.text)
      notify(`📋 Đã copy ${res.scene_count} prompts`)
    } catch {
      pushLog('❌ Không copy được', 'error')
    } finally {
      setExporting(false)
    }
  }

  async function stopProject() {
    if (!id) return
    await projectsApi.stop(id); pushLog('⏸ Đã dừng dự án'); load(true)
  }
  async function resumeProject() {
    if (!id) return
    try { const r = await projectsApi.resume(id); pushLog(`▶ Tiếp tục: ${r.resumed} cảnh`); load(true) }
    catch (e: any) { pushLog(`❌ ${e.response?.data?.detail || 'Lỗi tiếp tục'}`, 'error') }
  }
  async function renameProject() {
    if (!id) return
    const name = window.prompt('Tên dự án mới:', project?.name || '')
    if (name && name.trim()) { await projectsApi.rename(id, name.trim()); load(true) }
  }
  async function removeProject() {
    if (!id) return
    if (!confirm('Xoá dự án này? Không thể hoàn tác.')) return
    try {
      await projectsApi.delete(id); onUpdate?.(); nav('/projects')
    } catch (e: any) {
      notify(e?.response?.data?.detail || 'Xoá thất bại', 'error')
    }
  }

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--text2)' }}>Đang tải...</div>
  if (!project) return null

  const doneCount = project.scenes.filter((s: any) => s.status === 'done').length
  const totalCount = project.scenes.length
  const allDone = doneCount === totalCount && totalCount > 0
  const hasActive = project.scenes.some((s: any) => s.status === 'pending' || s.status === 'processing')
  const hasUnrendered = project.scenes.some((s: any) => !s.video_file)

  return (
    <div>
      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', top: 20, right: 20, zIndex: 9999,
          background: toast.kind === 'error' ? 'var(--red)' : 'var(--green)', color: '#fff', borderRadius: 8,
          padding: '10px 16px', fontSize: 13, fontWeight: 500, maxWidth: 360,
          boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
        }}>{toast.msg}</div>
      )}

      {/* Header */}
      <div className="page-header" style={{ flexWrap: 'wrap', gap: 12 }}>
        <div>
          <button className="btn btn-ghost btn-sm" onClick={() => nav('/projects')} style={{ marginBottom: 8 }}>
            <ArrowLeft size={13} /> Dự án
          </button>
          <div className="page-title">{project.name}</div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <span className="badge badge-done">{doneCount}/{totalCount} cảnh</span>
          <div className="progress-bar" style={{ width: 100 }}>
            <div className="progress-fill" style={{ width: `${totalCount ? (doneCount / totalCount) * 100 : 0}%` }} />
          </div>
          <button className="btn btn-ghost btn-sm" onClick={doExport} disabled={exporting}>
            <FileText size={13} /> Export prompts
          </button>
          {hasActive ? (
            <button className="btn btn-danger btn-sm" onClick={stopProject} title="Dừng render các cảnh chưa xong">
              <Pause size={13} /> Dừng
            </button>
          ) : (project.stopped || hasUnrendered) && totalCount > 0 ? (
            <button className="btn btn-ghost btn-sm" onClick={resumeProject} title="Render lại các cảnh chưa xong">
              <Play size={13} /> Tiếp tục
            </button>
          ) : null}
          <button className="btn btn-ghost btn-sm" onClick={renameProject} title="Đổi tên dự án"><Pencil size={13} /> Đổi tên</button>
          <button className="btn btn-ghost btn-sm" onClick={() => setAddPartOpen(true)} title="Thêm kịch bản / phần tiếp theo (giữ nhân vật)">
            <Plus size={13} /> Thêm kịch bản
          </button>
          <button
            className="btn btn-primary btn-sm"
            onClick={doMerge}
            disabled={merging || !allDone}
            title={!allDone ? 'Chờ tất cả scene xong' : 'Ghép tất cả scene thành final.mp4'}
          >
            {merging ? <><span className="spinner" style={{ width: 12, height: 12 }} /> Đang ghép...</> : <><Film size={13} /> Ghép phim</>}
          </button>
          <button className="btn btn-danger btn-sm" onClick={removeProject} title="Xoá dự án"><Trash2 size={13} /> Xoá</button>
        </div>
      </div>

      {/* Merge result */}
      {mergeUrl && (
        <div className="alert alert-success" style={{ marginBottom: 20, display: 'flex', alignItems: 'center', gap: 12 }}>
          <Check size={15} /> Ghép xong!
          <video src={mergeUrl} controls style={{ maxWidth: 400, borderRadius: 8 }} />
          <a href={mergeUrl} download="final.mp4" className="btn btn-primary btn-sm"><Download size={13} /> Tải final.mp4</a>
        </div>
      )}

      {/* Project meta */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
          {([
            [Cpu, 'Chất lượng', project.model_key.replace(/_/g, ' ')],
            [RectangleHorizontal, 'Tỉ lệ', project.aspect_ratio],
            [Clock, 'Thời lượng', `${project.duration_seconds}s/cảnh`],
            [Languages, 'Ngôn ngữ', project.language === 'vi' ? 'Tiếng Việt' : 'English'],
            [Calendar, 'Tạo lúc', new Date(project.created_at).toLocaleDateString('vi-VN')],
          ] as const).map(([Icon, k, v]) => (
            <div key={k} style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Icon size={13} style={{ color: 'var(--text3)' }} />
              <span style={{ color: 'var(--text2)' }}>{k}:</span>
              <span style={{ fontWeight: 500 }}>{v}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Nhân vật giữ mặt của dự án */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <div style={{ fontSize: 13, fontWeight: 600 }}>👤 Nhân vật giữ mặt của dự án</div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button className="btn btn-ghost btn-sm" onClick={() => setCharMode(m => m === 'upload' ? '' : 'upload')}><Upload size={12} /> Upload</button>
            <button className="btn btn-ghost btn-sm" onClick={() => charMode === 'pick' ? setCharMode('') : openPick()}><FolderOpen size={12} /> Lấy từ kho</button>
          </div>
        </div>

        {(project.characters?.length ?? 0) > 0 ? (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {project.characters.map((c: any) => (
              <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 6px 4px 4px', borderRadius: 99, border: '1px solid var(--border)', background: 'rgba(249,115,22,0.08)' }}>
                <img src={c.image_url} style={{ width: 24, height: 24, borderRadius: '50%', objectFit: 'cover' }} />
                <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--accent3)' }}>@{c.name}</span>
                <button onClick={() => delProjChar(c.id)} title="Gỡ khỏi dự án"
                  style={{ background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', fontSize: 13, lineHeight: 1, padding: '0 2px' }}>✕</button>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ fontSize: 12, color: 'var(--text2)' }}>Chưa có nhân vật riêng. Thêm để dùng <strong>@tên</strong> trong prompt nhằm giữ mặt nhân vật.</div>
        )}

        {charMode === 'upload' && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
            <input className="form-input" placeholder="Tên (vd: hero)" value={pcName} onChange={e => setPcName(e.target.value)} style={{ flex: '0 0 160px', fontSize: 12 }} />
            <label className="btn btn-ghost btn-sm" style={{ cursor: 'pointer', fontSize: 12 }}>
              {pcFile ? `📷 ${pcFile.name.slice(0, 16)}` : '📁 Chọn ảnh'}
              <input ref={pcFileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => setPcFile(e.target.files?.[0] || null)} />
            </label>
            <button className="btn btn-primary btn-sm" onClick={uploadProjChar} disabled={pcBusy || !pcName.trim() || !pcFile} style={{ fontSize: 12 }}>
              {pcBusy ? '...' : 'Lưu'}
            </button>
          </div>
        )}

        {charMode === 'pick' && (
          <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 8 }}>Chọn từ kho chung để copy vào dự án:</div>
            {globalChars.length ? (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {globalChars.map(c => (
                  <button key={c.id} className="btn btn-ghost btn-sm" disabled={pcBusy} onClick={() => pickFromKho(c)}
                    style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                    <img src={c.image_url} style={{ width: 20, height: 20, borderRadius: '50%', objectFit: 'cover' }} /> @{c.name}
                  </button>
                ))}
              </div>
            ) : <div style={{ fontSize: 12, color: 'var(--text2)' }}>Kho chung trống.</div>}
          </div>
        )}
      </div>

      {/* Scenes list — gom theo Phần (truyện nhiều phần) */}
      <div className="stagger" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {(() => {
          const sc: any[] = project.scenes
          const multiPart = new Set(sc.map((s: any) => s.part || 1)).size > 1
          const partScript = (p: number) => p <= 1 ? (project.idea || '') : ((project.part_scripts || {})[String(p)] || '')
          return sc.map((scene: any, i: number) => {
            const partNum = scene.part || 1
            const isPartStart = i === 0 || partNum !== (sc[i - 1].part || 1)
            const script = isPartStart ? partScript(partNum) : ''
            return (
            <Fragment key={scene.id}>
              {isPartStart && (
                <div style={{ marginTop: i === 0 ? 0 : 12 }}>
                  {multiPart && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                      <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--accent2)', whiteSpace: 'nowrap' }}>📖 Phần {partNum}</span>
                      <div style={{ flex: 1, height: 1, background: 'var(--border2)' }} />
                    </div>
                  )}
                  {editPart === partNum ? (
                    <div style={{ background: 'var(--inset)', border: '1px solid var(--border)', borderRadius: 12, padding: '12px 14px' }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text2)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 7 }}>
                        <ScrollText size={14} style={{ color: 'var(--accent2)' }} /> Kịch bản{multiPart ? ` Phần ${partNum}` : ''}
                      </div>
                      <textarea className="form-textarea" rows={6} value={partDraft} onChange={e => setPartDraft(e.target.value)}
                        placeholder="Dán / nhập kịch bản của phần này..." style={{ fontSize: 12.5, marginBottom: 8 }} />
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button className="btn btn-primary btn-sm" onClick={() => savePartScript(partNum)}><Save size={13} /> Lưu</button>
                        <button className="btn btn-ghost btn-sm" onClick={() => setEditPart(null)}>Hủy</button>
                      </div>
                    </div>
                  ) : script ? (
                    <details open style={{ background: 'var(--inset)', border: '1px solid var(--border)', borderRadius: 12, padding: '12px 14px' }}>
                      <summary style={{ cursor: 'pointer', fontSize: 12, fontWeight: 700, color: 'var(--text2)', display: 'flex', alignItems: 'center', gap: 7, listStyle: 'none' }}>
                        <ScrollText size={14} style={{ color: 'var(--accent2)' }} /> Kịch bản{multiPart ? ` Phần ${partNum}` : ''}
                        <button onClick={e => { e.preventDefault(); setEditPart(partNum); setPartDraft(script) }}
                          title="Sửa kịch bản" style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                          <Pencil size={13} />
                        </button>
                      </summary>
                      <div style={{ marginTop: 10, fontSize: 12.5, lineHeight: 1.7, color: 'var(--text2)', whiteSpace: 'pre-wrap', maxHeight: 240, overflowY: 'auto' }}>{script}</div>
                    </details>
                  ) : (
                    <button className="btn btn-ghost btn-sm" onClick={() => { setEditPart(partNum); setPartDraft('') }}
                      style={{ borderStyle: 'dashed' }}>
                      <ScrollText size={13} /> + Thêm kịch bản cho phần này
                    </button>
                  )}
                </div>
              )}
          <div className="card" style={{
            borderLeft: `3px solid ${
              scene.status === 'done' ? 'var(--green)' :
              scene.status === 'failed' ? 'var(--red)' :
              scene.status === 'processing' ? 'var(--accent)' : 'var(--border)'
            }`,
          }}>
            <div style={{ display: 'flex', gap: 20 }}>
              {/* Video preview */}
              <div style={{ width: 260, flexShrink: 0, position: 'relative' }}>
                {scene.hd && scene.status === 'done' && scene.video_file && <span className="hd-badge">HD</span>}
                {scene.status === 'done' && scene.video_file ? (
                  <video src={`/uploads/${scene.video_file}`} controls preload="metadata"
                    style={{ width: '100%', borderRadius: 8, background: '#000', display: 'block' }} />
                ) : (
                  <div className={`scene-ph${scene.status === 'processing' ? ' shimmer' : ''}`}
                    style={{ width: '100%', aspectRatio: scene.aspect_ratio === '9:16' ? '9/16' : '16/9', maxHeight: 160 }}>
                    {scene.status === 'pending' && (
                      <><div className="scene-ph-orb wait"><Clapperboard size={22} /></div><span>Chờ tạo</span></>
                    )}
                    {scene.status === 'processing' && (
                      <><div className="scene-ph-orb run"><Loader2 size={22} className="spin" /></div><span>Đang tạo...</span></>
                    )}
                    {scene.status === 'failed' && (
                      <><div className="scene-ph-orb fail"><AlertCircle size={22} /></div>
                        <span style={{ color: '#fca5a5', textAlign: 'center', padding: '0 10px', fontSize: 11 }}>{scene.error_msg?.slice(0, 80)}</span></>
                    )}
                  </div>
                )}
              </div>

              {/* Scene info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent2)' }}>
                    Cảnh {scene.index + 1}
                  </span>
                  <span className={`badge badge-${scene.status}`}>
                    {scene.status === 'pending' && '⏳ Chờ'}
                    {scene.status === 'processing' && '🔄 Đang tạo'}
                    {scene.status === 'done' && '✅ Xong'}
                    {scene.status === 'failed' && '❌ Lỗi'}
                  </span>
                </div>

                {editingScene === scene.id ? (
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--text2)', marginBottom: 4 }}>Mô tả cảnh:</div>
                    <textarea className="form-textarea" rows={3}
                      value={editPrompt}
                      onChange={e => setEditPrompt(e.target.value)}
                      style={{ marginBottom: 8, fontSize: 13 }}
                    />
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button className="btn btn-primary btn-sm" onClick={() => saveScene(scene.id)}><Save size={13} /> Lưu</button>
                      <button className="btn btn-ghost btn-sm" onClick={() => setEditingScene(null)}>Hủy</button>
                    </div>
                  </div>
                ) : (
                  <div>
                    <div style={{ fontSize: 13, lineHeight: 1.7, marginBottom: 6, color: 'var(--text)',
                      ...(expanded.has(scene.id) ? {} : CLAMP) }}>
                      {scene.prompt}
                    </div>
                    {scene.prompt && scene.prompt.length > 160 && (
                      <button onClick={() => toggleExpand(scene.id)}
                        style={{ background: 'none', border: 'none', color: 'var(--accent2)', cursor: 'pointer',
                          fontSize: 12, fontWeight: 600, padding: 0, marginBottom: 10,
                          display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                        {expanded.has(scene.id)
                          ? <><ChevronUp size={13} /> Thu gọn</>
                          : <><ChevronDown size={13} /> Xem thêm</>}
                      </button>
                    )}
                    {scene.narration && (
                      <div style={{
                        fontSize: 12, color: 'var(--text2)', fontStyle: 'italic',
                        marginBottom: 10, borderLeft: '2px solid var(--border2)',
                        paddingLeft: 8,
                      }}>
                        🎙️ {scene.narration}
                      </div>
                    )}
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      <button className="btn btn-ghost btn-sm"
                        onClick={() => { setEditingScene(scene.id); setEditPrompt(scene.prompt) }}>
                        <Pencil size={13} /> Sửa
                      </button>
                      <button className="btn btn-ghost btn-sm" onClick={() => rerenderScene(scene.id)}>
                        <RefreshCw size={13} /> Tạo lại
                      </button>
                      {scene.status === 'pending' && (
                        <button className="btn btn-primary btn-sm" onClick={async () => {
                          if (!id) return
                          try {
                            notify(`Đang tạo cảnh ${scene.index + 1}...`)
                            await projectsApi.renderScene(id, scene.id)
                            load(true)
                          } catch {
                            notify('Tạo cảnh thất bại. Thử lại hoặc kiểm tra extension đã đăng nhập chưa.', 'error')
                          }
                        }}><Play size={13} /> Tạo video</button>
                      )}
                      {scene.status === 'done' && scene.video_file && (
                        <>
                          <a href={`/uploads/${scene.video_file}`} download={`scene_${scene.index + 1}.mp4`}
                            className="btn btn-primary btn-sm"><Download size={13} /> Tải</a>
                          <button className="btn btn-ghost btn-sm"
                            onClick={async () => {
                              try {
                                await navigator.clipboard.writeText(scene.prompt)
                                notify('Đã sao chép mô tả cảnh')
                              } catch {
                                notify('Sao chép thất bại. Thử lại nhé.', 'error')
                              }
                            }}><Copy size={13} /> Sao chép mô tả</button>
                        </>
                      )}
                      {/* Tải video lên thay thế (thủ công) */}
                      <label className="btn btn-ghost btn-sm" style={{ cursor: 'pointer' }}>
                        <Upload size={13} /> Tải video lên thay thế
                        <input type="file" accept="video/*" style={{ display: 'none' }}
                          onChange={async e => {
                            const f = e.target.files?.[0]; if (!f || !id) return
                            try {
                              notify(`Đang tải video lên cảnh ${scene.index + 1}...`)
                              await projectsApi.importVideo(id, scene.id, f)
                              notify(`Đã tải video lên cảnh ${scene.index + 1}`)
                              load(true)
                            } catch {
                              notify('Tải video thất bại. Thử lại hoặc kiểm tra extension đã đăng nhập chưa.', 'error')
                            }
                          }} />
                      </label>
                      {/* Đặt ảnh khung đầu (i2v) */}
                      <label className="btn btn-ghost btn-sm" style={{ cursor: 'pointer' }} title="Dùng ảnh này làm khung đầu">
                        <ImagePlus size={13} /> Dùng ảnh này làm khung đầu
                        <input type="file" accept="image/*" style={{ display: 'none' }}
                          onChange={async e => {
                            const f = e.target.files?.[0]; if (!f || !id) return
                            try {
                              await projectsApi.setStartImage(id, scene.id, f)
                              notify(`Đã đặt ảnh khung đầu cho cảnh ${scene.index + 1}`)
                              load(true)
                            } catch {
                              notify('Đặt ảnh khung đầu thất bại. Thử lại hoặc kiểm tra extension đã đăng nhập chưa.', 'error')
                            }
                          }} />
                      </label>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
            </Fragment>
            )
          })
        })()}
      </div>

      {addPartOpen && (
        <AddPartPanel
          project={project}
          onClose={() => setAddPartOpen(false)}
          onDone={() => { setAddPartOpen(false); notify('Đã thêm phần mới — đang render...'); load(true) }}
        />
      )}
    </div>
  )
}
