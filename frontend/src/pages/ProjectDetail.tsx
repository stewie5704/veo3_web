import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { projectsApi, mediaApi, charactersApi } from '../api/client'
import { pushLog } from './Dashboard'
import {
  Pencil, RefreshCw, Play, Copy, Upload, ImagePlus, Save, ChevronDown, ChevronUp, Plus,
  FileText, Film, Trash2, Pause, FolderOpen, ArrowLeft, Check, Cpu, RectangleHorizontal, Clock,
  Languages, Calendar, ScrollText, Clapperboard, Loader2, AlertCircle, MoreHorizontal,
} from 'lucide-react'
import AddPartPanel from '../components/AddPartPanel'
import DownloadMenu from '../components/DownloadMenu'

// Thu gọn mô tả còn 2 dòng (bấm "Xem thêm" để bung)
const CLAMP: React.CSSProperties = { display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }

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
  const [expanded, setExpanded] = useState<Set<string>>(new Set())   // scene id -> đang bung mô tả
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
  // Bố cục 2 cột khi truyện nhiều phần: phần đang xem + ô tìm phần + lọc + menu "⋯" của cảnh
  const [selectedPart, setSelectedPart] = useState<number | null>(null)
  const [partSearch, setPartSearch] = useState('')
  const [partFilter, setPartFilter] = useState<'all' | 'active' | 'failed' | 'unrendered'>('all')
  const [menuScene, setMenuScene] = useState<string | null>(null)   // scene đang mở menu "⋯"
  const [genningPortraits, setGenningPortraits] = useState(false)   // đang tạo ảnh chân dung giữ mặt

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

  // Giữ "phần đang chọn" luôn hợp lệ khi dự án đổi (mặc định phần đầu tiên)
  useEffect(() => {
    if (!project) return
    const nums: number[] = [...new Set<number>((project.scenes || []).map((s: any) => s.part || 1))].sort((a, b) => a - b)
    if (nums.length && (selectedPart == null || !nums.includes(selectedPart))) {
      setSelectedPart(nums[0])
    }
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

  async function doRerenderBatch(part: number | null) {
    if (!id) return
    const all: any[] = project?.scenes || []
    const scope = part == null ? all : all.filter((s: any) => (s.part || 1) === part)
    const n = scope.filter((s: any) => s.status !== 'processing').length
    if (n === 0) { notify('Không có cảnh nào để tạo lại (cảnh đang render được bỏ qua).'); return }
    const label = part == null ? 'TOÀN BỘ dự án' : `Phần ${part}`
    if (!window.confirm(`Tạo lại ${n} cảnh của ${label}? Mỗi cảnh tốn credit/Gem như render thường. Tiếp tục?`)) return
    try {
      const r = await projectsApi.rerenderBatch(id, part)
      notify(`Đang tạo lại ${r.rerendered} cảnh — áp ảnh giữ mặt / kịch bản mới.`)
      load(true)
    } catch (e: any) {
      notify(e?.response?.data?.detail || 'Tạo lại hàng loạt thất bại', 'error')
    }
  }

  async function doGenPortraits() {
    if (!id) return
    setGenningPortraits(true)
    try {
      const r = await projectsApi.genPortraits(id)
      if (!r.generating) { notify(r.detail || 'Mọi nhân vật đã có ảnh chân dung'); return }
      notify(`Đang tạo ${r.generating} ảnh chân dung giữ mặt — chờ ~30–60 giây...`)
      // Sinh ảnh chạy nền (lâu hơn 4s nhiều) -> poll tới khi có chân dung, giữ nút khoá suốt lúc đó.
      const before = project?.characters?.length || 0
      let appeared = false
      for (let i = 0; i < 9; i++) {
        await new Promise(res => setTimeout(res, 6000))
        try {
          const p = await projectsApi.get(id)
          detectTransitions(p); setProject(p)
          if ((p.characters?.length || 0) > before) { appeared = true; break }
        } catch { /* ignore, thử vòng sau */ }
      }
      notify(
        appeared
          ? 'Đã tạo ảnh giữ mặt. Cảnh chưa render sẽ tự dùng; cảnh đã xong thì bấm "Tạo lại" để áp.'
          : 'Chưa tạo được ảnh — kiểm tra kết nối Google/extension rồi thử lại.',
        appeared ? 'success' : 'error')
    } catch (e: any) {
      notify(e?.response?.data?.detail || 'Tạo chân dung thất bại', 'error')
    } finally {
      setGenningPortraits(false)
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
  // Cảnh báo giữ mặt: có hồ sơ nhân vật (bible) nhưng CHƯA có ảnh chân dung nào -> mặt dễ lệch giữa các cảnh/phần.
  // Chỉ cảnh khi portraitCount === 0 (chưa neo mặt gì); có ≥1 ảnh thì coi như đã neo, không nag (tránh false-positive khi bible > số ảnh).
  const bibleCount = project.character_bible?.length || 0
  const portraitCount = project.characters?.length || 0
  const missingPortraits = bibleCount > 0 && portraitCount === 0

  // ── Gom cảnh theo Phần (cho bố cục 2 cột khi truyện nhiều phần) ──
  const scenes: any[] = project.scenes
  const partNums: number[] = [...new Set(scenes.map(s => s.part || 1))].sort((a, b) => a - b)
  const multiPart = partNums.length > 1
  const scenesOfPart = (p: number) => scenes.filter(s => (s.part || 1) === p)
  const partScript = (p: number) => p <= 1 ? (project.idea || '') : ((project.part_scripts || {})[String(p)] || '')
  const partStatusOf = (ps: any[]) => {
    if (ps.some(s => s.status === 'failed')) return 'failed'
    if (ps.some(s => s.status === 'processing')) return 'processing'
    if (ps.length && ps.every(s => s.status === 'done')) return 'done'
    return 'pending'
  }
  const dotColor = (st: string) =>
    st === 'done' ? 'var(--green)' : st === 'failed' ? 'var(--red)' : st === 'processing' ? 'var(--accent)' : 'var(--border2)'
  // Phần có khớp bộ lọc chip không
  const partMatchesFilter = (p: number) => {
    const ps = scenesOfPart(p)
    if (partFilter === 'active') return ps.some(s => s.status === 'pending' || s.status === 'processing')
    if (partFilter === 'failed') return ps.some(s => s.status === 'failed')
    if (partFilter === 'unrendered') return ps.some(s => !s.video_file)
    return true
  }

  // Khối kịch bản của 1 phần (sửa / hiển thị / nút thêm) — dùng chung cho 1 & nhiều phần
  const renderPartScript = (partNum: number) => {
    const script = partScript(partNum)
    if (editPart === partNum) {
      return (
        <div style={{ background: 'var(--inset)', border: '1px solid var(--border)', borderRadius: 12, padding: '12px 14px' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text3)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 7 }}>
            <ScrollText size={14} style={{ color: 'var(--accent2)' }} /> Kịch bản{multiPart ? ` Phần ${partNum}` : ''}
          </div>
          <textarea className="form-textarea" rows={6} value={partDraft} onChange={e => setPartDraft(e.target.value)}
            placeholder="Dán / nhập kịch bản của phần này..." style={{ fontSize: 12.5, marginBottom: 8 }} />
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-primary btn-sm" onClick={() => savePartScript(partNum)}><Save size={13} /> Lưu</button>
            <button className="btn btn-ghost btn-sm" onClick={() => setEditPart(null)}>Hủy</button>
          </div>
        </div>
      )
    }
    if (script) {
      return (
        <details open style={{ background: 'var(--inset)', border: '1px solid var(--border)', borderRadius: 12, padding: '12px 14px' }}>
          <summary style={{ cursor: 'pointer', fontSize: 12, fontWeight: 700, color: 'var(--text3)', display: 'flex', alignItems: 'center', gap: 7, listStyle: 'none' }}>
            <ScrollText size={14} style={{ color: 'var(--accent2)' }} /> Kịch bản{multiPart ? ` Phần ${partNum}` : ''}
            <button onClick={e => { e.preventDefault(); setEditPart(partNum); setPartDraft(script) }}
              title="Sửa kịch bản" style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
              <Pencil size={13} />
            </button>
          </summary>
          <div style={{ marginTop: 10, fontSize: 12.5, lineHeight: 1.7, color: 'var(--text3)', whiteSpace: 'pre-wrap', maxHeight: 240, overflowY: 'auto' }}>{script}</div>
        </details>
      )
    }
    return (
      <button className="btn btn-ghost btn-sm" onClick={() => { setEditPart(partNum); setPartDraft('') }} style={{ borderStyle: 'dashed' }}>
        <ScrollText size={13} /> + Thêm kịch bản cho phần này
      </button>
    )
  }

  // Một card cảnh — lưới gọn: thumbnail trên (badge đè) + mô tả 2 dòng + nút.
  // Nút phụ (sao chép / tải video lên / ảnh khung đầu) gom vào menu "⋯". Khi sửa thì card bung rộng.
  const renderSceneCard = (scene: any) => {
    const st = scene.status
    const editing = editingScene === scene.id
    const open = menuScene === scene.id
    const vertical = scene.aspect_ratio === '9:16'
    const stColor = st === 'done' ? 'var(--green)' : st === 'failed' ? 'var(--red)' : st === 'processing' ? 'var(--accent)' : 'var(--border)'
    return (
      <div key={scene.id} className="card" style={{
        padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column',
        borderTop: `3px solid ${stColor}`,
        ...(editing ? { gridColumn: '1 / -1' } : {}),
      }}>
        {/* Thumbnail / preview */}
        <div style={{ position: 'relative', aspectRatio: vertical ? '9 / 16' : '16 / 9', background: 'var(--bg3)' }}>
          {st === 'done' && scene.video_file ? (
            <video src={`/uploads/${scene.video_file}`} controls preload="metadata"
              style={{ width: '100%', height: '100%', objectFit: 'contain', background: '#000', display: 'block' }} />
          ) : (
            <div className={`scene-ph${st === 'processing' ? ' shimmer' : ''}`} style={{ width: '100%', height: '100%', borderRadius: 0 }}>
              {st === 'pending' && (<><div className="scene-ph-orb wait"><Clapperboard size={20} /></div><span>Chờ tạo</span></>)}
              {st === 'processing' && (<><div className="scene-ph-orb run"><Loader2 size={20} className="spin" /></div><span>Đang tạo...</span></>)}
              {st === 'failed' && (<><div className="scene-ph-orb fail"><AlertCircle size={20} /></div>
                <span style={{ color: '#fca5a5', textAlign: 'center', padding: '0 12px', fontSize: 11, lineHeight: 1.4 }}>{scene.error_msg?.slice(0, 90)}</span></>)}
            </div>
          )}
          <span style={{ position: 'absolute', top: 8, left: 8, fontSize: 10.5, fontWeight: 800, padding: '2px 8px', borderRadius: 6, color: '#fff', background: 'var(--grad)' }}>
            Cảnh {scene.index + 1}
          </span>
        </div>

        {/* Body */}
        <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
          {editing ? (
            <>
              <div style={{ fontSize: 11, color: 'var(--text3)' }}>Mô tả cảnh:</div>
              <textarea className="form-textarea" rows={4} value={editPrompt} onChange={e => setEditPrompt(e.target.value)} style={{ fontSize: 13 }} />
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-primary btn-sm" onClick={() => saveScene(scene.id)}><Save size={13} /> Lưu</button>
                <button className="btn btn-ghost btn-sm" onClick={() => setEditingScene(null)}>Hủy</button>
              </div>
            </>
          ) : (
            <>
              <div style={{ fontSize: 12.5, lineHeight: 1.6, color: 'var(--text)', ...(expanded.has(scene.id) ? {} : CLAMP) }}>
                {scene.prompt}
              </div>
              {scene.prompt && scene.prompt.length > 110 && (
                <button onClick={() => toggleExpand(scene.id)}
                  style={{ background: 'none', border: 'none', color: 'var(--accent2)', cursor: 'pointer', fontSize: 11.5, fontWeight: 600, padding: 0, display: 'inline-flex', alignItems: 'center', gap: 3, alignSelf: 'flex-start' }}>
                  {expanded.has(scene.id) ? <><ChevronUp size={12} /> Thu gọn</> : <><ChevronDown size={12} /> Xem thêm</>}
                </button>
              )}
              {scene.narration && (
                <div style={{ fontSize: 11.5, color: 'var(--text2)', fontStyle: 'italic', borderLeft: '2px solid var(--border2)', paddingLeft: 8,
                  ...(expanded.has(scene.id) ? {} : { whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }) }}>
                  🎙️ {scene.narration}
                </div>
              )}

              {/* Hàng nút chính */}
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 'auto', alignItems: 'center' }}>
                {st === 'pending' && (
                  <button className="btn btn-primary btn-sm" title="Tạo video" onClick={async () => {
                    if (!id) return
                    try {
                      notify(`Đang tạo cảnh ${scene.index + 1}...`)
                      await projectsApi.renderScene(id, scene.id)
                      load(true)
                    } catch {
                      notify('Tạo cảnh thất bại. Thử lại hoặc kiểm tra extension đã đăng nhập chưa.', 'error')
                    }
                  }}><Play size={14} /></button>
                )}
                {st === 'done' && scene.video_file && (
                  <DownloadMenu base={`/projects/${id}/scenes/${scene.id}/download`} filename={`canh_${scene.index + 1}.mp4`} iconOnly />
                )}
                <button className="btn btn-ghost btn-sm" title="Sửa mô tả" onClick={() => { setEditingScene(scene.id); setEditPrompt(scene.prompt) }}>
                  <Pencil size={14} />
                </button>
                <button className="btn btn-ghost btn-sm" title="Tạo lại cảnh" onClick={() => rerenderScene(scene.id)}>
                  <RefreshCw size={14} />
                </button>
                <button className="btn btn-ghost btn-sm" title="Thêm thao tác"
                  onClick={() => setMenuScene(m => m === scene.id ? null : scene.id)}
                  style={{ marginLeft: 'auto', color: open ? 'var(--accent2)' : undefined }}>
                  <MoreHorizontal size={15} />
                </button>
              </div>

              {/* Menu "⋯" — thao tác phụ */}
              {open && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, paddingTop: 8, borderTop: '1px solid var(--border)' }}>
                  {st === 'done' && scene.video_file && (
                    <button className="btn btn-ghost btn-sm" style={{ justifyContent: 'flex-start' }}
                      onClick={async () => {
                        try { await navigator.clipboard.writeText(scene.prompt); notify('Đã sao chép mô tả cảnh') }
                        catch { notify('Sao chép thất bại. Thử lại nhé.', 'error') }
                      }}><Copy size={13} /> Sao chép mô tả</button>
                  )}
                  <label className="btn btn-ghost btn-sm" style={{ cursor: 'pointer', justifyContent: 'flex-start' }}>
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
                  <label className="btn btn-ghost btn-sm" style={{ cursor: 'pointer', justifyContent: 'flex-start' }} title="Dùng ảnh này làm khung đầu (i2v)">
                    <ImagePlus size={13} /> Dùng ảnh làm khung đầu
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
              )}
            </>
          )}
        </div>
      </div>
    )
  }

  return (
    <div>
      {/* CSS bố cục 2 cột + lưới cảnh + responsive */}
      <style>{`
        .tp-grid{display:grid;grid-template-columns:286px 1fr;gap:16px;align-items:stretch}
        .tp-left{position:sticky;top:16px}
        .tp-row:hover{background:rgba(255,255,255,0.04)}
        .scene-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(258px,1fr));gap:14px;align-items:start}
        @media(max-width:860px){
          .tp-grid{grid-template-columns:1fr}
          .tp-left{position:static}
          .tp-list{max-height:240px}
        }
      `}</style>

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
          {multiPart && <span className="badge" style={{ background: 'rgba(168,85,247,0.14)', color: 'var(--accent3)' }}>{partNums.length} phần</span>}
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
          {totalCount > 0 && (
            <button className="btn btn-ghost btn-sm" onClick={() => doRerenderBatch(null)}
              title="Tạo lại TẤT CẢ cảnh (áp ảnh giữ mặt / kịch bản mới cho cả cảnh đã xong)">
              <RefreshCw size={13} /> Tạo lại tất cả
            </button>
          )}
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
          <DownloadMenu base={`/projects/${id}/download-merged`} filename="phim.mp4" />
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

      {/* Cảnh báo giữ mặt — thiếu ảnh chân dung nhân vật */}
      {missingPortraits && (
        <div className="alert" style={{
          marginBottom: 20, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
          background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.3)',
        }}>
          <AlertCircle size={16} style={{ color: 'var(--yellow)', flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 220, fontSize: 12.5, lineHeight: 1.55 }}>
            <b style={{ color: 'var(--yellow)' }}>Nhân vật chưa có ảnh giữ mặt</b> — mặt dễ <b>lệch giữa các cảnh / phần</b>.
            Bấm tạo ảnh: cảnh chưa render sẽ tự dùng, cảnh đã xong thì bấm <b>Tạo lại</b> để áp.
          </div>
          {user?.google_connected ? (
            <button className="btn btn-primary btn-sm" onClick={doGenPortraits} disabled={genningPortraits}>
              {genningPortraits ? <><span className="spinner" style={{ width: 12, height: 12 }} /> Đang tạo...</> : <><ImagePlus size={13} /> Tạo ảnh giữ mặt</>}
            </button>
          ) : (
            <span style={{ fontSize: 12, color: 'var(--text3)' }}>Kết nối Google Ultra ở Cài đặt để tạo.</span>
          )}
        </div>
      )}

      {/* Cảnh — 2 cột khi truyện nhiều phần, lưới cảnh 1 cột khi 1 phần */}
      {multiPart ? (
        <>
          {/* Chip lọc phần */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
            {([
              ['all', 'Tất cả phần', ''],
              ['active', 'Đang tạo', 'var(--accent)'],
              ['failed', 'Có lỗi', 'var(--red)'],
              ['unrendered', 'Chưa render', 'var(--border2)'],
            ] as const).map(([key, label, dot]) => {
              const count = key === 'all' ? partNums.length : partNums.filter(p => {
                const ps = scenesOfPart(p)
                if (key === 'active') return ps.some(s => s.status === 'pending' || s.status === 'processing')
                if (key === 'failed') return ps.some(s => s.status === 'failed')
                return ps.some(s => !s.video_file)
              }).length
              const on = partFilter === key
              return (
                <button key={key} onClick={() => {
                  setPartFilter(key)
                  const first = partNums.find(p => {
                    const ps = scenesOfPart(p)
                    if (key === 'active') return ps.some(s => s.status === 'pending' || s.status === 'processing')
                    if (key === 'failed') return ps.some(s => s.status === 'failed')
                    if (key === 'unrendered') return ps.some(s => !s.video_file)
                    return true
                  })
                  if (first != null) setSelectedPart(first)
                }} style={{
                  fontSize: 12.5, fontWeight: 600, padding: '6px 13px', borderRadius: 99, cursor: 'pointer',
                  border: `1px solid ${on ? 'rgba(249,115,22,0.4)' : 'var(--border)'}`,
                  background: on ? 'rgba(249,115,22,0.13)' : 'transparent',
                  color: on ? 'var(--accent2)' : 'var(--text3)', display: 'inline-flex', alignItems: 'center', gap: 6,
                }}>
                  {dot && <span style={{ width: 7, height: 7, borderRadius: '50%', background: dot }} />}
                  {label}{key !== 'all' ? ` · ${count}` : ''}
                </button>
              )
            })}
          </div>

          <div className="tp-grid">
            {/* Cột trái: danh sách Phần */}
            <div className="card tp-left" style={{ padding: 0, maxHeight: 'calc(100dvh - 96px)', display: 'flex', flexDirection: 'column' }}>
              <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 13, fontWeight: 700 }}>Các phần</span>
                <span style={{ fontSize: 11, color: 'var(--text3)' }}>{partNums.length}</span>
              </div>
              <div style={{ padding: '8px 10px', borderBottom: '1px solid var(--border)' }}>
                <input className="form-input" placeholder="Tìm phần…" value={partSearch}
                  onChange={e => setPartSearch(e.target.value)} style={{ fontSize: 12, padding: '6px 10px', width: '100%' }} />
              </div>
              <div className="tp-list" style={{ overflowY: 'auto', padding: 6, flex: 1 }}>
                {partNums.filter(p => {
                  if (!partMatchesFilter(p)) return false
                  const q = partSearch.trim().toLowerCase()
                  if (!q) return true
                  return String(p).includes(q) || `phần ${p}`.includes(q) || partScript(p).toLowerCase().includes(q)
                }).map(p => {
                  const ps = scenesOfPart(p)
                  const done = ps.filter(s => s.status === 'done').length
                  const st = partStatusOf(ps)
                  const title = partScript(p)
                  const sel = p === selectedPart
                  return (
                    <button key={p} className="tp-row" onClick={() => setSelectedPart(p)} style={{
                      display: 'flex', alignItems: 'center', gap: 10, width: '100%', textAlign: 'left',
                      padding: '9px 10px', borderRadius: 10, cursor: 'pointer', marginBottom: 2,
                      border: `1px solid ${sel ? 'rgba(249,115,22,0.3)' : 'transparent'}`,
                      background: sel ? 'rgba(249,115,22,0.1)' : 'transparent', color: 'inherit',
                    }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', flexShrink: 0, background: dotColor(st) }} />
                      <span style={{ flex: 1, minWidth: 0 }}>
                        <span style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                          <span style={{ fontSize: 12.5, fontWeight: 700, color: sel ? 'var(--accent2)' : 'var(--text)' }}>Phần {p}</span>
                          <span style={{ fontSize: 11, color: 'var(--text3)', fontVariantNumeric: 'tabular-nums' }}>{done}/{ps.length}</span>
                        </span>
                        {title && <span style={{ display: 'block', fontSize: 11, color: 'var(--text2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 2 }}>{title}</span>}
                        <span style={{ display: 'block', height: 3, borderRadius: 99, background: 'var(--border)', overflow: 'hidden', marginTop: 5 }}>
                          <span style={{ display: 'block', height: '100%', borderRadius: 99, width: `${ps.length ? (done / ps.length) * 100 : 0}%`, background: st === 'failed' ? 'var(--red)' : 'var(--accent)' }} />
                        </span>
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Cột phải: cảnh của phần đang chọn */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
              {selectedPart != null && (() => {
                const ps = scenesOfPart(selectedPart)
                const done = ps.filter(s => s.status === 'done').length
                return (
                  <>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 16, fontWeight: 800, color: 'var(--accent2)' }}>📖 Phần {selectedPart}</span>
                      <span className="badge badge-done">{done}/{ps.length} cảnh</span>
                      <button className="btn btn-ghost btn-sm" style={{ marginLeft: 'auto' }}
                        onClick={() => doRerenderBatch(selectedPart)}
                        title="Tạo lại tất cả cảnh của phần này (áp ảnh giữ mặt / kịch bản mới)">
                        <RefreshCw size={13} /> Tạo lại phần
                      </button>
                    </div>
                    {renderPartScript(selectedPart)}
                    <div className="scene-grid">
                      {ps.map(scene => renderSceneCard(scene))}
                    </div>
                  </>
                )
              })()}
            </div>
          </div>
        </>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {(partScript(1) || editPart === 1) ? renderPartScript(1) : null}
          <div className="scene-grid">
            {scenes.map(scene => renderSceneCard(scene))}
          </div>
        </div>
      )}

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
