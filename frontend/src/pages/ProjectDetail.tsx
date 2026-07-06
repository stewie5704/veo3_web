import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { projectsApi, mediaApi, charactersApi, removeDeletedSellId } from '../api/client'
import { pushLog } from './Dashboard'
import {
  Pencil, RefreshCw, Play, Copy, Upload, ImagePlus, Save, ChevronDown, ChevronUp, Plus,
  FileText, Film, Trash2, Pause, FolderOpen, ArrowLeft, Check, Cpu, RectangleHorizontal, Clock,
  Languages, Calendar, ScrollText, Clapperboard, Loader2, AlertCircle, MoreHorizontal,
} from 'lucide-react'
import AddPartPanel from '../components/AddPartPanel'
import DownloadMenu from '../components/DownloadMenu'
import { useT } from '../i18n'

// Thu gọn mô tả còn 2 dòng (bấm "Xem thêm" để bung)
const CLAMP: React.CSSProperties = { display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }

export default function ProjectDetail({ user, onUpdate }: { user: any; onUpdate?: () => void }) {
  const t = useT()
  const { id } = useParams<{ id: string }>()
  const nav = useNavigate()
  const [project, setProject] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [editingScene, setEditingScene] = useState<string | null>(null)
  const [editPrompt, setEditPrompt] = useState('')
  const [editNarration, setEditNarration] = useState('')
  const [addPartOpen, setAddPartOpen] = useState(false)   // mở panel thêm kịch bản/phần mới
  const [editPart, setEditPart] = useState<number | null>(null)   // đang sửa kịch bản phần nào
  const [partDraft, setPartDraft] = useState('')
  const [expanded, setExpanded] = useState<Set<string>>(new Set())   // scene id -> đang bung mô tả
  const toggleExpand = (sid: string) => setExpanded(s => {
    const n = new Set(s); n.has(sid) ? n.delete(sid) : n.add(sid); return n
  })
  const [merging, setMerging] = useState(false)
  const [mergeUrl, setMergeUrl] = useState<string | null>(null)
  const [mergeFilename, setMergeFilename] = useState<string | null>(null)
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
      if (prev && prev !== 'failed' && s.status === 'failed') notify(t('scene.scene_failed', { index: s.index + 1 }), 'error', document.hidden)
      prevStatus.current[s.id] = s.status
    })
    const allDone = scenes.length > 0 && scenes.every(s => s.status === 'done')
    if (allDone && !notifiedDone.current) {
      notifiedDone.current = true
      notify(t('scene.project_render_done', { name: p.name, count: scenes.length }), 'success', true)
    } else if (newlyDone > 0) {
      const doneN = scenes.filter(s => s.status === 'done').length
      notify(t('scene.scene_done_count', { done: doneN, total: scenes.length }), 'success', document.hidden)
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
    const tm = setInterval(() => load(true), 4000)
    return () => clearInterval(tm)
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
    await projectsApi.updateScene(id, sceneId, { prompt: editPrompt, narration: editNarration })
    setEditingScene(null)
    pushLog(`Đã lưu prompt scene`)
    load(true)
  }

  async function savePartScript(part: number) {
    if (!id) return
    try {
      await projectsApi.updatePartScript(id, part, partDraft)
      setEditPart(null)
      notify(t('scene.script_saved'))
      load(true)
    } catch {
      notify(t('scene.script_save_failed'), 'error')
    }
  }

  async function rerenderScene(sceneId: string) {
    if (!id) return
    try {
      notify(t('scene.rerendering'))
      await projectsApi.rerenderScene(id, sceneId)
      load(true)
    } catch {
      notify(t('scene.rerender_failed'), 'error')
    }
  }

  async function deleteScene(sceneId: string, sceneIdx: number) {
    if (!id) return
    if (!window.confirm(t('scene.confirm_delete', { index: sceneIdx + 1 }))) return
    setMenuScene(null)
    try {
      await projectsApi.deleteScene(id, sceneId)
      notify(t('scene.deleted', { index: sceneIdx + 1 }))
      load(true)
    } catch (e: any) {
      notify(e?.response?.data?.detail || t('scene.delete_failed'), 'error')
    }
  }

  async function doMerge(part: number | null = null) {
    if (!id) return
    setMerging(true); setMergeUrl(null); setMergeFilename(null)
    const label = part != null ? t('scene.part_label', { part }) : t('scene.entire_film')
    pushLog(`🎬 ${t('scene.merge_start', { label })}`)
    try {
      const res = await mediaApi.merge(id, part)
      setMergeUrl(res.url)
      setMergeFilename(res.filename || null)
      pushLog(`✅ ${t('scene.merge_done', { filename: res.filename })}`)
    } catch (e: any) {
      pushLog(`❌ ${t('scene.merge_failed', { detail: e.response?.data?.detail || e.message })}`, 'error')
    } finally {
      setMerging(false)
    }
  }

  async function doRerenderBatch(part: number | null, failed_only: boolean = false) {
    if (!id) return
    const all: any[] = project?.scenes || []
    let scope = part == null ? all : all.filter((s: any) => (s.part || 1) === part)
    if (failed_only) {
      scope = scope.filter((s: any) => s.status === 'failed')
    }
    const n = scope.filter((s: any) => s.status !== 'processing').length
    if (n === 0) { notify(failed_only ? t('scene.no_failed_scenes') : t('scene.no_scenes_to_rerender')); return }
    const label = part == null ? t('scene.entire_project') : t('scene.part_num', { part })
    const msg = failed_only ? t('scene.confirm_rerender_failed', { n, label }) : t('scene.confirm_rerender_all', { n, label })
    if (!window.confirm(msg)) return
    try {
      const r = await projectsApi.rerenderBatch(id, part, failed_only)
      notify(t('scene.rerendering_batch', { count: r.rerendered }))
      load(true)
    } catch (e: any) {
      notify(e?.response?.data?.detail || t('scene.batch_rerender_failed'), 'error')
    }
  }

  async function doGenPortraits() {
    if (!id) return
    setGenningPortraits(true)
    try {
      const r = await projectsApi.genPortraits(id)
      if (!r.generating) { notify(r.detail || t('scene.all_chars_have_portraits')); return }
      notify(t('scene.generating_portraits', { count: r.generating }))
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
          ? t('scene.portraits_created')
          : t('scene.portraits_failed_check'),
        appeared ? 'success' : 'error')
    } catch (e: any) {
      notify(e?.response?.data?.detail || t('scene.portrait_gen_failed'), 'error')
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
      pushLog(t('scene.char_added_to_project'))
      load(true)
    } catch (e: any) { pushLog(`❌ ${e.response?.data?.detail || t('scene.add_failed')}`, 'error') }
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
      pushLog(t('scene.char_added_name', { name: c.name }))
      setCharMode('')
      load(true)
    } catch (e: any) { pushLog(`❌ ${e.response?.data?.detail || t('scene.failed')}`, 'error') }
    finally { setPcBusy(false) }
  }

  async function delProjChar(charId: string) {
    if (!confirm(t('scene.confirm_remove_char'))) return
    await charactersApi.delete(charId)
    load(true)
  }

  async function doExport() {
    if (!id) return
    setExporting(true)
    try {
      const res = await projectsApi.exportPrompts(id)
      await navigator.clipboard.writeText(res.text)
      notify(t('scene.copied_prompts', { count: res.scene_count }))
    } catch {
      pushLog('❌ Không copy được', 'error')
    } finally {
      setExporting(false)
    }
  }

  async function stopProject() {
    if (!id) return
    await projectsApi.stop(id); pushLog(`⏸ ${t('scene.project_stopped')}`); load(true)
  }
  async function resumeProject() {
    if (!id) return
    try { const r = await projectsApi.resume(id); pushLog(`▶ ${t('scene.resumed', { count: r.resumed })}`); load(true) }
    catch (e: any) { pushLog(`❌ ${e.response?.data?.detail || t('scene.resume_error')}`, 'error') }
  }
  async function renameProject() {
    if (!id) return
    const name = window.prompt(t('scene.new_project_name'), project?.name || '')
    if (name && name.trim()) { await projectsApi.rename(id, name.trim()); load(true) }
  }
  async function removeProject() {
    if (!id) return
    if (!confirm(t('scene.confirm_delete_project'))) return
    try {
      await projectsApi.delete(id)
      removeDeletedSellId(id)
      onUpdate?.(); nav('/projects')
    } catch (e: any) {
      notify(e?.response?.data?.detail || t('scene.delete_project_failed'), 'error')
    }
  }

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--text2)' }}>{t('scene.loading')}</div>
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
            <ScrollText size={14} style={{ color: 'var(--accent2)' }} /> {t('scene.script')}{multiPart ? ` ${t('scene.part_num', { part: partNum })}` : ''}
          </div>
          <textarea className="form-textarea" rows={6} value={partDraft} onChange={e => setPartDraft(e.target.value)}
            placeholder={t('scene.script_placeholder')} style={{ fontSize: 12.5, marginBottom: 8 }} />
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-primary btn-sm" onClick={() => savePartScript(partNum)}><Save size={13} /> {t('scene.save')}</button>
            <button className="btn btn-ghost btn-sm" onClick={() => setEditPart(null)}>{t('scene.cancel')}</button>
          </div>
        </div>
      )
    }
    if (script) {
      return (
        <details open style={{ background: 'var(--inset)', border: '1px solid var(--border)', borderRadius: 12, padding: '12px 14px' }}>
          <summary style={{ cursor: 'pointer', fontSize: 12, fontWeight: 700, color: 'var(--text3)', display: 'flex', alignItems: 'center', gap: 7, listStyle: 'none' }}>
            <ScrollText size={14} style={{ color: 'var(--accent2)' }} /> {t('scene.script')}{multiPart ? ` ${t('scene.part_num', { part: partNum })}` : ''}
            <button onClick={e => { e.preventDefault(); setEditPart(partNum); setPartDraft(script) }}
              title={t('scene.edit_script')} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
              <Pencil size={13} />
            </button>
          </summary>
          <div style={{ marginTop: 10, fontSize: 12.5, lineHeight: 1.7, color: 'var(--text3)', whiteSpace: 'pre-wrap', maxHeight: 240, overflowY: 'auto' }}>{script}</div>
        </details>
      )
    }
    return (
      <button className="btn btn-ghost btn-sm" onClick={() => { setEditPart(partNum); setPartDraft('') }} style={{ borderStyle: 'dashed' }}>
        <ScrollText size={13} /> + {t('scene.add_script_for_part')}
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
              {st === 'pending' && (<><div className="scene-ph-orb wait"><Clapperboard size={20} /></div><span>{t('scene.waiting')}</span></>)}
              {st === 'processing' && (<><div className="scene-ph-orb run"><Loader2 size={20} className="spin" /></div><span>{t('scene.processing')}</span></>)}
              {st === 'failed' && (<><div className="scene-ph-orb fail"><AlertCircle size={20} /></div>
                <span style={{ color: '#fca5a5', textAlign: 'center', padding: '0 12px', fontSize: 11, lineHeight: 1.4 }}>{scene.error_msg?.slice(0, 90)}</span></>)}
            </div>
          )}
          <span style={{ position: 'absolute', top: 8, left: 8, fontSize: 10.5, fontWeight: 800, padding: '2px 8px', borderRadius: 6, color: '#fff', background: 'var(--grad)' }}>
            {t('scene.label', { index: scene.index + 1 })}
          </span>
        </div>

        {/* Body */}
        <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
          {editing ? (
            <>
              <div style={{ fontSize: 11, color: 'var(--text3)' }}>{t('scene.scene_desc')}:</div>
              <textarea className="form-textarea" rows={4} value={editPrompt} onChange={e => setEditPrompt(e.target.value)} style={{ fontSize: 13 }} />
              <div style={{ fontSize: 11, color: 'var(--text3)' }}>🎙️ {t('scene.dialogue_empty')}:</div>
              <textarea className="form-textarea" rows={2} value={editNarration} onChange={e => setEditNarration(e.target.value)} placeholder={t('scene.narration_edit_placeholder')} style={{ fontSize: 13 }} />
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-primary btn-sm" onClick={() => saveScene(scene.id)}><Save size={13} /> {t('scene.save')}</button>
                <button className="btn btn-ghost btn-sm" onClick={() => setEditingScene(null)}>{t('scene.cancel')}</button>
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
                  {expanded.has(scene.id) ? <><ChevronUp size={12} /> {t('scene.collapse')}</> : <><ChevronDown size={12} /> {t('scene.expand')}</>}
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
                  <button className="btn btn-primary btn-sm" title={t('scene.render_video')} onClick={async () => {
                    if (!id) return
                    try {
                      notify(t('scene.rendering_scene', { index: scene.index + 1 }))
                      await projectsApi.renderScene(id, scene.id)
                      load(true)
                    } catch {
                      notify(t('scene.render_scene_failed'), 'error')
                    }
                  }}><Play size={14} /></button>
                )}
                {st === 'done' && scene.video_file && (
                  <DownloadMenu base={`/projects/${id}/scenes/${scene.id}/download`} filename={`canh_${scene.index + 1}.mp4`} iconOnly />
                )}
                <button className="btn btn-ghost btn-sm" title={t('scene.edit_desc_dialogue')} onClick={() => { setEditingScene(scene.id); setEditPrompt(scene.prompt); setEditNarration(scene.narration || '') }}>
                  <Pencil size={14} />
                </button>
                <button className="btn btn-ghost btn-sm" title={t('scene.rerender_scene')} onClick={() => rerenderScene(scene.id)}>
                  <RefreshCw size={14} />
                </button>
                <button className="btn btn-ghost btn-sm" title={t('scene.more_actions')}
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
                        try { await navigator.clipboard.writeText(scene.prompt); notify(t('scene.copied_desc')) }
                        catch { notify(t('scene.copy_failed'), 'error') }
                      }}><Copy size={13} /> {t('scene.copy_desc')}</button>
                  )}
                  <label className="btn btn-ghost btn-sm" style={{ cursor: 'pointer', justifyContent: 'flex-start' }}>
                    <Upload size={13} /> {t('scene.upload_replace_video')}
                    <input type="file" accept="video/*" style={{ display: 'none' }}
                      onChange={async e => {
                        const f = e.target.files?.[0]; if (!f || !id) return
                        try {
                          notify(t('scene.uploading_video', { index: scene.index + 1 }))
                          await projectsApi.importVideo(id, scene.id, f)
                          notify(t('scene.uploaded_video', { index: scene.index + 1 }))
                          load(true)
                        } catch {
                          notify(t('scene.upload_video_failed'), 'error')
                        }
                      }} />
                  </label>
                  <label className="btn btn-ghost btn-sm" style={{ cursor: 'pointer', justifyContent: 'flex-start' }} title={t('scene.use_image_i2v_tooltip')}>
                    <ImagePlus size={13} /> {t('scene.use_image_first_frame')}
                    <input type="file" accept="image/*" style={{ display: 'none' }}
                      onChange={async e => {
                        const f = e.target.files?.[0]; if (!f || !id) return
                        try {
                          await projectsApi.setStartImage(id, scene.id, f)
                          notify(t('scene.set_start_image', { index: scene.index + 1 }))
                          load(true)
                        } catch {
                          notify(t('scene.set_start_image_failed'), 'error')
                        }
                      }} />
                  </label>
                  <button className="btn btn-ghost btn-sm" style={{ justifyContent: 'flex-start' }}
                    onClick={async () => {
                      if (!id) return
                      try {
                        notify(t('scene.inserting_before'))
                        const res = await projectsApi.insertScene(id, scene.index, scene.part)
                        setMenuScene(null)
                        await load(true)
                        if (res.scene_id) { setEditingScene(res.scene_id); setEditPrompt(''); setEditNarration('') }
                      } catch { notify(t('scene.insert_failed'), 'error') }
                    }} title={t('scene.insert_before_tooltip')}>
                    <Plus size={13} /> {t('scene.insert_before')}
                  </button>
                  <button className="btn btn-ghost btn-sm" style={{ justifyContent: 'flex-start' }}
                    onClick={async () => {
                      if (!id) return
                      try {
                        notify(t('scene.inserting_after'))
                        const res = await projectsApi.insertScene(id, scene.index + 1, scene.part)
                        setMenuScene(null)
                        await load(true)
                        if (res.scene_id) { setEditingScene(res.scene_id); setEditPrompt(''); setEditNarration('') }
                      } catch { notify(t('scene.insert_failed'), 'error') }
                    }} title={t('scene.insert_after_tooltip')}>
                    <Plus size={13} /> {t('scene.insert_after')}
                  </button>
                  <button className="btn btn-ghost btn-sm" style={{ justifyContent: 'flex-start', color: 'var(--red)' }}
                    onClick={() => deleteScene(scene.id, scene.index)} title={t('scene.delete_scene_tooltip')}>
                    <Trash2 size={13} /> {t('scene.delete_scene')}
                  </button>
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
            <ArrowLeft size={13} /> {t('scene.projects')}
          </button>
          <div className="page-title">{project.name}</div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <span className="badge badge-done">{t('scene.scene_badge', { done: doneCount, total: totalCount })}</span>
          {multiPart && <span className="badge" style={{ background: 'rgba(168,85,247,0.14)', color: 'var(--accent3)' }}>{t('scene.parts_badge', { count: partNums.length })}</span>}
          <div className="progress-bar" style={{ width: 100 }}>
            <div className="progress-fill" style={{ width: `${totalCount ? (doneCount / totalCount) * 100 : 0}%` }} />
          </div>
          <button className="btn btn-ghost btn-sm" onClick={doExport} disabled={exporting}>
            <FileText size={13} /> Export prompts
          </button>
          {hasActive ? (
            <button className="btn btn-danger btn-sm" onClick={stopProject} title={t('scene.stop_render_tooltip')}>
              <Pause size={13} /> {t('scene.stop')}
            </button>
          ) : (project.stopped || hasUnrendered) && totalCount > 0 ? (
            <button className="btn btn-ghost btn-sm" onClick={resumeProject} title={t('scene.resume_tooltip')}>
              <Play size={13} /> {t('scene.resume')}
            </button>
          ) : null}
          {totalCount > 0 && project?.scenes?.some((s: any) => s.status === 'failed') && (
            <button className="btn btn-ghost btn-sm" onClick={() => doRerenderBatch(null, true)}
              title={t('scene.rerender_failed_tooltip')}>
              <RefreshCw size={13} style={{ color: 'var(--red)' }} /> {t('scene.rerender_failed')}
            </button>
          )}
          {totalCount > 0 && (
            <button className="btn btn-ghost btn-sm" onClick={() => doRerenderBatch(null)}
              title={t('scene.rerender_all_tooltip')}>
              <RefreshCw size={13} /> {t('scene.rerender_all')}
            </button>
          )}
          <button className="btn btn-ghost btn-sm" onClick={renameProject} title={t('scene.rename_tooltip')}><Pencil size={13} /> {t('scene.rename')}</button>
          <button className="btn btn-ghost btn-sm" onClick={() => setAddPartOpen(true)} title={t('scene.add_script_tooltip')}>
            <Plus size={13} /> {t('scene.add_script')}
          </button>
          {multiPart ? (
            <>
              <button
                className="btn btn-primary btn-sm"
                onClick={() => doMerge(selectedPart)}
                disabled={merging || partStatusOf(scenesOfPart(selectedPart || 1)) !== 'done'}
                title={t('scene.merge_part_tooltip')}
              >
                {merging ? <><span className="spinner" style={{ width: 12, height: 12 }} /> {t('scene.merging')}</> : <><Film size={13} /> {t('scene.merge_part', { part: selectedPart })}</>}
              </button>
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => doMerge(null)}
                disabled={merging || !allDone}
                title={!allDone ? t('scene.wait_all_done') : t('scene.merge_all_tooltip')}
                style={{ border: '1px solid var(--border)' }}
              >
                <Film size={13} /> {t('scene.merge_all')}
              </button>
            </>
          ) : (
            <button
              className="btn btn-primary btn-sm"
              onClick={() => doMerge(null)}
              disabled={merging || !allDone}
              title={!allDone ? t('scene.wait_all_done') : t('scene.merge_final_tooltip')}
            >
              {merging ? <><span className="spinner" style={{ width: 12, height: 12 }} /> {t('scene.merging')}</> : <><Film size={13} /> {t('scene.merge_film')}</>}
            </button>
          )}
          <button className="btn btn-danger btn-sm" onClick={removeProject} title={t('scene.delete_project_tooltip')}><Trash2 size={13} /> {t('scene.delete')}</button>
        </div>
      </div>

      {/* Merge result */}
      {mergeUrl && (
        <div className="alert alert-success" style={{ marginBottom: 20, display: 'flex', alignItems: 'center', gap: 12 }}>
          <Check size={15} /> {t('scene.merge_complete')}
          <video src={mergeUrl} controls style={{ maxWidth: 400, borderRadius: 8 }} />
          <DownloadMenu base={`/projects/${id}/download-merged?${mergeFilename ? `filename=${mergeFilename}&` : ''}_t=${Date.now()}`} filename={mergeFilename || 'phim.mp4'} />
        </div>
      )}

      {/* Project meta */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
          {([
            [Cpu, t('scene.meta_quality'), project.model_key.replace(/_/g, ' ')],
            [RectangleHorizontal, t('scene.meta_ratio'), project.aspect_ratio],
            [Clock, t('scene.meta_duration'), `${project.duration_seconds}s/${t('scene.per_scene')}`],
            [Languages, t('scene.meta_language'), project.language === 'vi' ? 'Tiếng Việt' : 'English'],
            [Calendar, t('scene.meta_created'), new Date(project.created_at).toLocaleDateString('vi-VN')],
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
          <div style={{ fontSize: 13, fontWeight: 600 }}>👤 {t('scene.project_chars')}</div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button className="btn btn-ghost btn-sm" onClick={() => setCharMode(m => m === 'upload' ? '' : 'upload')}><Upload size={12} /> Upload</button>
            <button className="btn btn-ghost btn-sm" onClick={() => charMode === 'pick' ? setCharMode('') : openPick()}><FolderOpen size={12} /> {t('scene.from_library')}</button>
          </div>
        </div>

        {(project.characters?.length ?? 0) > 0 ? (
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            {project.characters.map((c: any) => (
              <div key={c.id} style={{ position: 'relative', height: 160, minWidth: 90, borderRadius: 8, overflow: 'hidden', border: '1px solid var(--border)', background: 'var(--inset)' }}>
                <img src={c.image_url} style={{ height: '100%', width: 'auto', display: 'block' }} />
                <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '4px 6px', background: 'linear-gradient(to top, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0) 100%)', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', height: '40%' }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: '#fff', textShadow: '0 1px 2px rgba(0,0,0,0.8)' }}>@{c.name}</span>
                  <button onClick={() => delProjChar(c.id)} title={t('scene.remove_from_project')}
                    style={{ background: 'none', border: 'none', color: '#ff4444', cursor: 'pointer', fontSize: 13, lineHeight: 1, padding: 0 }}>✕</button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ fontSize: 12, color: 'var(--text2)' }}>{t('scene.no_chars_yet')}</div>
        )}

        {charMode === 'upload' && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
            <input className="form-input" placeholder={t('project.char_name_placeholder')} value={pcName} onChange={e => setPcName(e.target.value)} style={{ flex: '0 0 160px', fontSize: 12 }} />
            <label className="btn btn-ghost btn-sm" style={{ cursor: 'pointer', fontSize: 12 }}>
              {pcFile ? `📷 ${pcFile.name.slice(0, 16)}` : t('project.select_photo')}
              <input ref={pcFileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => setPcFile(e.target.files?.[0] || null)} />
            </label>
            <button className="btn btn-primary btn-sm" onClick={uploadProjChar} disabled={pcBusy || !pcName.trim() || !pcFile} style={{ fontSize: 12 }}>
              {pcBusy ? '...' : t('scene.save')}
            </button>
          </div>
        )}

        {charMode === 'pick' && (
          <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 8 }}>{t('scene.pick_from_library')}</div>
            {globalChars.length ? (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {globalChars.map(c => (
                  <button key={c.id} className="btn btn-ghost btn-sm" disabled={pcBusy} onClick={() => pickFromKho(c)}
                    style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                    <img src={c.image_url} style={{ width: 20, height: 20, borderRadius: '50%', objectFit: 'cover' }} /> @{c.name}
                  </button>
                ))}
              </div>
            ) : <div style={{ fontSize: 12, color: 'var(--text2)' }}>{t('scene.library_empty')}</div>}
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
            <b style={{ color: 'var(--yellow)' }}>{t('scene.missing_portraits_title')}</b> — {t('scene.missing_portraits_desc')}
          </div>
          {user?.google_connected ? (
            <button className="btn btn-primary btn-sm" onClick={doGenPortraits} disabled={genningPortraits}>
              {genningPortraits ? <><span className="spinner" style={{ width: 12, height: 12 }} /> {t('scene.generating')}</> : <><ImagePlus size={13} /> {t('scene.gen_portraits_btn')}</>}
            </button>
          ) : (
            <span style={{ fontSize: 12, color: 'var(--text3)' }}>{t('scene.connect_google_for_portraits')}</span>
          )}
        </div>
      )}

      {/* Cảnh — 2 cột khi truyện nhiều phần, lưới cảnh 1 cột khi 1 phần */}
      {multiPart ? (
        <>
          {/* Chip lọc phần */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
            {([
              ['all', t('scene.filter_all'), ''],
              ['active', t('scene.filter_active'), 'var(--accent)'],
              ['failed', t('scene.filter_failed'), 'var(--red)'],
              ['unrendered', t('scene.filter_unrendered'), 'var(--border2)'],
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
                <span style={{ fontSize: 13, fontWeight: 700 }}>{t('scene.parts_list')}</span>
                <span style={{ fontSize: 11, color: 'var(--text3)' }}>{partNums.length}</span>
              </div>
              <div style={{ padding: '8px 10px', borderBottom: '1px solid var(--border)' }}>
                <input className="form-input" placeholder={t('scene.search_parts')} value={partSearch}
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
                          <span style={{ fontSize: 12.5, fontWeight: 700, color: sel ? 'var(--accent2)' : 'var(--text)' }}>{t('scene.part_num', { part: p })}</span>
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
                      <span style={{ fontSize: 16, fontWeight: 800, color: 'var(--accent2)' }}>📖 {t('scene.part_num', { part: selectedPart })}</span>
                      <span className="badge badge-done">{t('scene.scene_badge', { done, total: ps.length })}</span>
                      {ps.some(s => s.status === 'failed') && (
                        <button className="btn btn-ghost btn-sm" style={{ marginLeft: 'auto' }}
                          onClick={() => doRerenderBatch(selectedPart, true)}
                          title={t('scene.rerender_failed_part_tooltip')}>
                          <RefreshCw size={13} style={{ color: 'var(--red)' }} /> {t('scene.rerender_failed')}
                        </button>
                      )}
                      <button className="btn btn-ghost btn-sm" style={{ marginLeft: ps.some(s => s.status === 'failed') ? 0 : 'auto' }}
                        onClick={() => doRerenderBatch(selectedPart)}
                        title={t('scene.rerender_part_tooltip')}>
                        <RefreshCw size={13} /> {t('scene.rerender_part')}
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
          onDone={() => { setAddPartOpen(false); notify(t('scene.part_added')); load(true) }}
        />
      )}
    </div>
  )
}
