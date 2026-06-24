import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { projectsApi, mediaApi, charactersApi } from '../api/client'
import { pushLog } from './Dashboard'

export default function ProjectDetail({ user, onUpdate }: { user: any; onUpdate?: () => void }) {
  const { id } = useParams<{ id: string }>()
  const nav = useNavigate()
  const [project, setProject] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [editingScene, setEditingScene] = useState<string | null>(null)
  const [editPrompt, setEditPrompt] = useState('')
  const [merging, setMerging] = useState(false)
  const [mergeUrl, setMergeUrl] = useState<string | null>(null)
  const [exporting, setExporting] = useState(false)
  const [copyToast, setCopyToast] = useState(false)
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
      setProject(p)
    } catch {
      if (!silent) nav('/projects')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [id])

  // Auto-poll while scenes are active
  useEffect(() => {
    if (!project) return
    const hasActive = project.scenes.some((s: any) => s.status === 'pending' || s.status === 'processing')
    if (!hasActive) return
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

  async function rerenderScene(sceneId: string) {
    if (!id) return
    await projectsApi.rerenderScene(id, sceneId)
    pushLog('🔄 Đang render lại scene...')
    load(true)
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
      setCopyToast(true)
      setTimeout(() => setCopyToast(false), 2500)
      pushLog(`📋 Đã copy ${res.scene_count} prompts`)
    } catch {
      pushLog('❌ Không copy được', 'error')
    } finally {
      setExporting(false)
    }
  }

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--text2)' }}>Đang tải...</div>
  if (!project) return null

  const doneCount = project.scenes.filter((s: any) => s.status === 'done').length
  const totalCount = project.scenes.length
  const allDone = doneCount === totalCount && totalCount > 0

  return (
    <div>
      {/* Toast */}
      {copyToast && (
        <div style={{
          position: 'fixed', top: 20, right: 20, zIndex: 9999,
          background: 'var(--green)', color: '#fff', borderRadius: 8,
          padding: '10px 16px', fontSize: 13, fontWeight: 500,
          boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
        }}>✅ Đã copy toàn bộ prompts!</div>
      )}

      {/* Header */}
      <div className="page-header" style={{ flexWrap: 'wrap', gap: 12 }}>
        <div>
          <button className="btn btn-ghost btn-sm" onClick={() => nav('/projects')} style={{ marginBottom: 8 }}>
            ← Dự án
          </button>
          <div className="page-title">{project.name}</div>
          {project.idea && <div className="page-subtitle">{project.idea}</div>}
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <span className="badge badge-done">{doneCount}/{totalCount} scenes</span>
          <div className="progress-bar" style={{ width: 100 }}>
            <div className="progress-fill" style={{ width: `${totalCount ? (doneCount / totalCount) * 100 : 0}%` }} />
          </div>
          <button className="btn btn-ghost btn-sm" onClick={doExport} disabled={exporting}>
            📋 Export prompts
          </button>
          <button
            className="btn btn-primary btn-sm"
            onClick={doMerge}
            disabled={merging || !allDone}
            title={!allDone ? 'Chờ tất cả scene xong' : 'Ghép tất cả scene thành final.mp4'}
          >
            {merging ? <><span className="spinner" style={{ width: 12, height: 12 }} /> Đang ghép...</> : '🎬 Ghép phim'}
          </button>
        </div>
      </div>

      {/* Merge result */}
      {mergeUrl && (
        <div className="alert alert-success" style={{ marginBottom: 20, display: 'flex', alignItems: 'center', gap: 12 }}>
          ✅ Ghép xong!
          <video src={mergeUrl} controls style={{ maxWidth: 400, borderRadius: 8 }} />
          <a href={mergeUrl} download="final.mp4" className="btn btn-primary btn-sm">⬇️ Tải final.mp4</a>
        </div>
      )}

      {/* Project meta */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
          {[
            ['🤖 Model', project.model_key.replace(/_/g, ' ')],
            ['📐 Tỉ lệ', project.aspect_ratio],
            ['⏱️ Thời lượng', `${project.duration_seconds}s/scene`],
            ['🗣️ Ngôn ngữ', project.language === 'vi' ? '🇻🇳 Tiếng Việt' : '🇺🇸 English'],
            ['📅 Tạo lúc', new Date(project.created_at).toLocaleDateString('vi-VN')],
          ].map(([k, v]) => (
            <div key={k as string} style={{ fontSize: 12 }}>
              <span style={{ color: 'var(--text2)' }}>{k}: </span>
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
            <button className="btn btn-ghost btn-sm" onClick={() => setCharMode(m => m === 'upload' ? '' : 'upload')}>+ Upload</button>
            <button className="btn btn-ghost btn-sm" onClick={() => charMode === 'pick' ? setCharMode('') : openPick()}>+ Lấy từ kho</button>
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

      {/* Scenes list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {project.scenes.map((scene: any) => (
          <div key={scene.id} className="card" style={{
            borderLeft: `3px solid ${
              scene.status === 'done' ? 'var(--green)' :
              scene.status === 'failed' ? 'var(--red)' :
              scene.status === 'processing' ? 'var(--accent)' : 'var(--border)'
            }`,
          }}>
            <div style={{ display: 'flex', gap: 20 }}>
              {/* Video preview */}
              <div style={{ width: 260, flexShrink: 0 }}>
                {scene.status === 'done' && scene.video_file ? (
                  <video src={`/uploads/${scene.video_file}`} controls preload="metadata"
                    style={{ width: '100%', borderRadius: 8, background: '#000', display: 'block' }} />
                ) : (
                  <div style={{
                    width: '100%', aspectRatio: scene.aspect_ratio === '9:16' ? '9/16' : '16/9',
                    maxHeight: 160,
                    background: 'var(--bg3)', borderRadius: 8,
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    gap: 8, color: 'var(--text2)', fontSize: 12,
                  }}>
                    {scene.status === 'pending' && <><span style={{ fontSize: 28 }}>⏳</span>Chờ render</>}
                    {scene.status === 'processing' && <><span className="spinner" /><span>Đang render...</span></>}
                    {scene.status === 'failed' && (
                      <>
                        <span style={{ fontSize: 28 }}>❌</span>
                        <span style={{ color: '#fca5a5', textAlign: 'center', padding: '0 8px', fontSize: 11 }}>
                          {scene.error_msg?.slice(0, 80)}
                        </span>
                      </>
                    )}
                  </div>
                )}
              </div>

              {/* Scene info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent2)' }}>
                    Scene {scene.index + 1}
                  </span>
                  <span className={`badge badge-${scene.status}`}>
                    {scene.status === 'pending' && '⏳ Chờ'}
                    {scene.status === 'processing' && '🔄 Đang render'}
                    {scene.status === 'done' && '✅ Xong'}
                    {scene.status === 'failed' && '❌ Lỗi'}
                  </span>
                </div>

                {editingScene === scene.id ? (
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--text2)', marginBottom: 4 }}>Video Prompt (English):</div>
                    <textarea className="form-textarea" rows={3}
                      value={editPrompt}
                      onChange={e => setEditPrompt(e.target.value)}
                      style={{ marginBottom: 8, fontSize: 13 }}
                    />
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button className="btn btn-primary btn-sm" onClick={() => saveScene(scene.id)}>💾 Lưu</button>
                      <button className="btn btn-ghost btn-sm" onClick={() => setEditingScene(null)}>Hủy</button>
                    </div>
                  </div>
                ) : (
                  <div>
                    <div style={{ fontSize: 13, lineHeight: 1.7, marginBottom: 8, color: 'var(--text)' }}>
                      {scene.prompt}
                    </div>
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
                        ✏️ Sửa
                      </button>
                      <button className="btn btn-ghost btn-sm" onClick={() => rerenderScene(scene.id)}>
                        🔄 Render lại
                      </button>
                      {scene.status === 'pending' && (
                        <button className="btn btn-primary btn-sm" onClick={async () => {
                          if (!id) return
                          await projectsApi.renderScene(id, scene.id)
                          pushLog(`Đang render scene ${scene.index + 1}...`)
                          load(true)
                        }}>▶ Render</button>
                      )}
                      {scene.status === 'done' && scene.video_file && (
                        <>
                          <a href={`/uploads/${scene.video_file}`} download={`scene_${scene.index + 1}.mp4`}
                            className="btn btn-primary btn-sm">⬇️ Tải</a>
                          <button className="btn btn-ghost btn-sm"
                            onClick={() => navigator.clipboard.writeText(scene.prompt)}>📋 Copy</button>
                        </>
                      )}
                      {/* Import video thủ công */}
                      <label className="btn btn-ghost btn-sm" style={{ cursor: 'pointer' }}>
                        📥 Import
                        <input type="file" accept="video/*" style={{ display: 'none' }}
                          onChange={async e => {
                            const f = e.target.files?.[0]; if (!f || !id) return
                            await projectsApi.importVideo(id, scene.id, f)
                            pushLog(`Import video vào scene ${scene.index + 1}`)
                            load(true)
                          }} />
                      </label>
                      {/* Set start image for I2V */}
                      <label className="btn btn-ghost btn-sm" style={{ cursor: 'pointer' }} title="Đặt ảnh gốc cho I2V">
                        🖼 I2V
                        <input type="file" accept="image/*" style={{ display: 'none' }}
                          onChange={async e => {
                            const f = e.target.files?.[0]; if (!f || !id) return
                            await projectsApi.setStartImage(id, scene.id, f)
                            pushLog(`Set start image scene ${scene.index + 1}`)
                            load(true)
                          }} />
                      </label>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
