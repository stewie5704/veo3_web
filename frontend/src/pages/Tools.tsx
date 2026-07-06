import { useState, useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { toolsApi, charactersApi, mediaApi, videosApi } from '../api/client'
import { pushLog } from './Dashboard'
import { useT } from '../i18n'
import VideoFeed from '../components/VideoFeed'
import {
  Users, Plus, Trash2, Mic, Image, Scissors, Download,
  Volume2, AlertCircle, CheckCircle, Loader2, ExternalLink,
  Upload, Sparkles, Film, Layers
} from 'lucide-react'

type ToolTab = 'chars' | 'i2v' | 'r2v' | 'tts' | 'image' | 'cut' | 'download'

// Lưu kết quả tool (ảnh/audio/file) vào localStorage -> reload vẫn còn (file đã nằm trên server)
const FEED_LIMIT = 24
function loadFeed(key: string): any[] { try { return JSON.parse(localStorage.getItem('aiac_feed_' + key) || '[]') } catch { return [] } }
function saveFeed(key: string, items: any[]) { try { localStorage.setItem('aiac_feed_' + key, JSON.stringify(items.slice(0, FEED_LIMIT))) } catch { /* ignore */ } }

export default function Tools({ user }: { user: any }) {
  const t = useT()

  const TABS = [
    { key: 'chars' as ToolTab, label: t('tools.tab_characters'), icon: Users },
    { key: 'i2v' as ToolTab, label: t('tools.tab_i2v'), icon: Film },
    { key: 'r2v' as ToolTab, label: t('tools.tab_r2v'), icon: Layers },
    { key: 'tts' as ToolTab, label: t('tools.tab_tts'), icon: Volume2 },
    { key: 'image' as ToolTab, label: t('tools.tab_image'), icon: Image },
    { key: 'cut' as ToolTab, label: t('tools.tab_cut'), icon: Scissors },
    { key: 'download' as ToolTab, label: t('tools.tab_download'), icon: Download },
  ]

  // Model gen video (t2v key — runner tự đổi sang i2v/r2v khi render)
  const GEN_MODELS = [
    { key: 'veo_3_1_t2v_lite_low_priority', label: 'Veo 3.1 · Lite (Lower Priority) — FREE' },
    { key: 'veo_3_1_t2v_lite', label: 'Veo 3.1 · Lite — 5💎' },
    { key: 'veo_3_1_t2v_fast_portrait_ultra', label: 'Veo 3.1 · Fast — 10💎' },
    { key: 'veo_3_1_t2v_portrait', label: 'Veo 3.1 · Quality — 100💎' },
    { key: 'abra_t2v_10s', label: 'Omni Flash (10s) — 15💎' },
  ]
  const ASPECTS = [
    { v: '16:9', label: t('tools.aspect_landscape') },
    { v: '9:16', label: t('tools.aspect_portrait') },
    { v: '1:1', label: t('tools.aspect_square') },
  ]

  // Tab điều khiển bởi dropdown "Công cụ" ở sidebar qua URL ?t=...
  const [sp] = useSearchParams()
  const [tab, setTab] = useState<ToolTab>((sp.get('t') as ToolTab) || 'i2v')
  useEffect(() => { const t = sp.get('t'); if (t) setTab(t as ToolTab) }, [sp])
  const [error, setError] = useState('')

  // Character Library
  const [chars, setChars] = useState<any[]>([])
  const [charName, setCharName] = useState('')
  const [charImg, setCharImg] = useState<File | null>(null)
  const [charLoading, setCharLoading] = useState(false)
  const charImgRef = useRef<HTMLInputElement>(null)

  useEffect(() => { charactersApi.list().then(setChars) }, [])

  async function addChar() {
    if (!charName.trim() || !charImg) { setError(t('tools.enter_name_and_image')); return }
    setError(''); setCharLoading(true)
    try {
      const c = await charactersApi.add(charName.trim(), charImg)
      setChars(cs => [...cs, c])
      setCharName(''); setCharImg(null)
      if (charImgRef.current) charImgRef.current.value = ''
      pushLog(t('tools.log_char_added', { name: charName }))
    } catch (e: any) { setError(e.response?.data?.detail || t('tools.add_failed')) }
    finally { setCharLoading(false) }
  }

  async function delChar(id: string, name: string) {
    await charactersApi.delete(id)
    setChars(cs => cs.filter(c => c.id !== id))
    pushLog(t('tools.log_char_deleted', { name }))
  }

  // TTS
  const [ttsText, setTtsText] = useState('')
  const [ttsVoice, setTtsVoice] = useState('Kore')
  const [ttsLoading, setTtsLoading] = useState(false)
  const [ttsFeed, setTtsFeed] = useState<any[]>(() => loadFeed('tts'))

  async function doTTS() {
    if (!ttsText.trim()) return
    setError(''); setTtsLoading(true)
    pushLog(t('tools.log_tts_creating'))
    try {
      const res = await toolsApi.tts({ text: ttsText, voice: ttsVoice })
      pushFeed('tts', setTtsFeed, [{ url: res.audio_url, text: ttsText, voice: ttsVoice }])
      pushLog(t('tools.log_tts_done'))
    } catch (e: any) { const m = e.response?.data?.detail || t('tools.error_tts'); setError(m); pushLog(m, 'error') }
    finally { setTtsLoading(false) }
  }

  // Image gen
  const [imgPrompt, setImgPrompt] = useState('')
  const [imgCount, setImgCount] = useState(1)
  const [imgAspect, setImgAspect] = useState('1:1')
  const [imgLoading, setImgLoading] = useState(false)
  const [imgFeed, setImgFeed] = useState<any[]>(() => loadFeed('img'))
  
  const [imgKol, setImgKol] = useState<File | null>(null)
  const [imgKolPrev, setImgKolPrev] = useState<string | null>(null)
  const [imgProd, setImgProd] = useState<File | null>(null)
  const [imgProdPrev, setImgProdPrev] = useState<string | null>(null)
  const imgKolRef = useRef<HTMLInputElement>(null)
  const imgProdRef = useRef<HTMLInputElement>(null)
  
  const imgPromptRef = useRef<HTMLTextAreaElement>(null)

  async function doImage() {
    if (!imgPrompt.trim()) return
    setError(''); setImgLoading(true)
    pushLog(t('tools.log_image_creating'))
    try {
      let tmpChars: string[] = []
      const stamp = Date.now().toString(36)
      if (imgKol || imgProd) {
         pushLog(t('tools.log_uploading_ref'))
         if (imgKol) {
           const c = await charactersApi.add(`TmpKol_${stamp}`, imgKol)
           tmpChars.push(c.id)
         }
         if (imgProd) {
           const c = await charactersApi.add(`TmpProd_${stamp}`, imgProd)
           tmpChars.push(c.id)
         }
      }

      // @Tên trong prompt -> backend tu resolve thanh anh giu mat (reference)
      const res = await toolsApi.image({ prompt: imgPrompt, count: imgCount, aspect_ratio: imgAspect, char_ids: tmpChars })
      pushFeed('img', setImgFeed, (res.image_urls || []).map((url: string) => ({ url, prompt: imgPrompt })))
      pushLog(t('tools.log_image_done', { count: String(res.image_urls.length) }))
      
      if (tmpChars.length) {
         Promise.allSettled(tmpChars.map(cid => charactersApi.delete(cid)))
      }
    } catch (e: any) { const m = e.response?.data?.detail || t('common.error'); setError(m); pushLog(m, 'error') }
    finally { setImgLoading(false) }
  }

  // Cài đặt chung cho I2V/R2V
  const [genModel, setGenModel] = useState(GEN_MODELS[0].key)
  const [genAspect, setGenAspect] = useState('16:9')
  const [genDur, setGenDur] = useState(8)

  // Feed video (kiểu Flow) — load từ server nên F5/reload vẫn giữ các job đang chạy
  const [vidJobs, setVidJobs] = useState<any[]>([])
  const loadJobs = async () => { try { setVidJobs(await videosApi.list(60)) } catch { /* ignore */ } }
  useEffect(() => { loadJobs() }, [])
  useEffect(() => {
    if (!vidJobs.some(j => j.status === 'pending' || j.status === 'processing')) return
    const id = setInterval(loadJobs, 6000)   // còn job đang chạy -> tự cập nhật feed
    return () => clearInterval(id)
  }, [vidJobs])

  // Thêm item vào feed (mới nhất trước) + lưu localStorage
  function pushFeed(key: string, setter: React.Dispatch<React.SetStateAction<any[]>>, items: any[]) {
    setter(prev => { const next = [...items, ...prev].slice(0, FEED_LIMIT); saveFeed(key, next); return next })
  }

  // Ảnh → Video (I2V)
  const [i2vImg, setI2vImg] = useState<File | null>(null)
  const [i2vPreview, setI2vPreview] = useState<string | null>(null)
  const [i2vPrompt, setI2vPrompt] = useState('')
  const [i2vLoading, setI2vLoading] = useState(false)
  const i2vRef = useRef<HTMLInputElement>(null)
  async function doI2V() {
    if (!i2vImg || !i2vPrompt.trim()) { setError(t('tools.select_image_and_prompt')); return }
    setError(''); setI2vLoading(true)
    try {
      await videosApi.createI2V(i2vImg, { prompt: i2vPrompt, model_key: genModel, aspect_ratio: genAspect, duration_seconds: genDur })
      setI2vImg(null); setI2vPreview(null); setI2vPrompt(''); if (i2vRef.current) i2vRef.current.value = ''
      await loadJobs()
      pushLog(t('tools.log_i2v_sent'))
    } catch (e: any) { const m = e.response?.data?.detail || t('common.error'); setError(m); pushLog(m, 'error') }
    finally { setI2vLoading(false) }
  }

  // Giữ mặt → Video (R2V)
  const [r2vImgs, setR2vImgs] = useState<File[]>([])
  const [r2vPrompt, setR2vPrompt] = useState('')
  const [r2vLoading, setR2vLoading] = useState(false)
  const r2vRef = useRef<HTMLInputElement>(null)
  async function doR2V() {
    if (!r2vImgs.length || !r2vPrompt.trim()) { setError(t('tools.select_images_and_prompt')); return }
    setError(''); setR2vLoading(true)
    try {
      await videosApi.createR2V(r2vImgs, { prompt: r2vPrompt, model_key: genModel, aspect_ratio: genAspect, duration_seconds: genDur })
      setR2vImgs([]); setR2vPrompt(''); if (r2vRef.current) r2vRef.current.value = ''
      await loadJobs()
      pushLog(t('tools.log_r2v_sent'))
    } catch (e: any) { const m = e.response?.data?.detail || t('common.error'); setError(m); pushLog(m, 'error') }
    finally { setR2vLoading(false) }
  }

  // Chèn @Tên vào prompt tại vị trí con trỏ (như mention)
  function insertMention(name: string) {
    const tag = `@${name} `
    const ta = imgPromptRef.current
    if (!ta) { setImgPrompt(p => (p && !p.endsWith(' ') ? p + ' ' : p) + tag); return }
    const start = ta.selectionStart ?? imgPrompt.length
    const end = ta.selectionEnd ?? start
    setImgPrompt(imgPrompt.slice(0, start) + tag + imgPrompt.slice(end))
    requestAnimationFrame(() => { ta.focus(); const pos = start + tag.length; ta.setSelectionRange(pos, pos) })
  }

  // Cut
  const [cutFile, setCutFile] = useState('')
  const [cutMode, setCutMode] = useState('split')
  const [cutSeg, setCutSeg] = useState(8)
  const [cutFps, setCutFps] = useState(1)
  const [cutLoading, setCutLoading] = useState(false)
  const [cutFeed, setCutFeed] = useState<any[]>(() => loadFeed('cut'))

  async function doCut() {
    if (!cutFile.trim()) { setError(t('tools.enter_filename')); return }
    setError(''); setCutLoading(true)
    try {
      const res = await mediaApi.cut({ filename: cutFile, mode: cutMode, segment: cutSeg, fps: cutFps })
      pushFeed('cut', setCutFeed, [{ file: cutFile, mode: cutMode, urls: res.files }]); pushLog(t('tools.log_cut_done', { count: String(res.count) }))
    } catch (e: any) { const m = e.response?.data?.detail || t('common.error'); setError(m); pushLog(m, 'error') }
    finally { setCutLoading(false) }
  }

  // Download URL
  const [dlUrl, setDlUrl] = useState('')
  const [dlLoading, setDlLoading] = useState(false)
  const [dlFeed, setDlFeed] = useState<any[]>(() => loadFeed('dl'))

  async function doDownload() {
    if (!dlUrl.trim()) { setError(t('tools.enter_url')); return }
    setError(''); setDlLoading(true)
    pushLog(t('tools.log_downloading', { url: dlUrl }))
    try {
      const res = await mediaApi.downloadUrl(dlUrl)
      pushFeed('dl', setDlFeed, [{ url: res.url, filename: res.filename, src: dlUrl }]); pushLog(t('tools.log_download_done', { filename: res.filename }))
    } catch (e: any) { const m = e.response?.data?.detail || t('common.error'); setError(m); pushLog(m, 'error') }
    finally { setDlLoading(false) }
  }

  const genSettings = (
    <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 1fr', gap: 10, marginBottom: 12 }}>
      <div className="form-group" style={{ marginBottom: 0 }}><label className="form-label">{t('tools.quality')}</label>
        <select className="form-select" value={genModel} onChange={e => setGenModel(e.target.value)}>
          {GEN_MODELS.map(m => <option key={m.key} value={m.key}>{m.label}</option>)}
        </select></div>
      <div className="form-group" style={{ marginBottom: 0 }}><label className="form-label">{t('tools.aspect_ratio')}</label>
        <select className="form-select" value={genAspect} onChange={e => setGenAspect(e.target.value)}>
          {ASPECTS.map(a => <option key={a.v} value={a.v}>{a.label}</option>)}
        </select></div>
      <div className="form-group" style={{ marginBottom: 0 }}><label className="form-label">{t('tools.duration')}</label>
        <select className="form-select" value={genDur} onChange={e => setGenDur(+e.target.value)}>
          {[4, 6, 8, 10].map(d => <option key={d} value={d}>{d}s</option>)}
        </select></div>
    </div>
  )
  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Sparkles size={22} color="#a78bfa" />
            {t('tools.title')}
          </div>
          <div className="page-subtitle">{TABS.find(tb => tb.key === tab)?.label || t('tools.title')}</div>
        </div>
      </div>

      {error && (
        <div className="alert alert-error" style={{ marginBottom: 16 }}>
          <AlertCircle size={15} /> {error}
        </div>
      )}

      {/* Character Library */}
      {tab === 'chars' && (
        <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: 20 }}>
          <div className="card">
            <div className="card-header"><Plus size={15} /> {t('tools.add_character')}</div>
            <div className="form-group">
              <label className="form-label">{t('tools.character_name')}</label>
              <input className="form-input" placeholder={t('tools.character_name_placeholder')}
                value={charName} onChange={e => setCharName(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">{t('tools.face_image')}</label>
              <label style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
                padding: 20, background: 'var(--bg3)', border: '1px dashed var(--border2)',
                borderRadius: 10, cursor: 'pointer', transition: 'all 0.2s',
              }}
                onDragOver={e => e.preventDefault()}
                onDrop={e => { e.preventDefault(); setCharImg(e.dataTransfer.files[0]) }}>
                {charImg ? (
                  <img src={URL.createObjectURL(charImg)} style={{ width: 70, height: 70, objectFit: 'cover', borderRadius: '50%' }} />
                ) : (
                  <><Upload size={24} color="#6060a0" /><span style={{ fontSize: 12, color: 'var(--text3)' }}>{t('tools.click_or_drag')}</span></>
                )}
                <input ref={charImgRef} type="file" accept="image/*" style={{ display: 'none' }}
                  onChange={e => setCharImg(e.target.files?.[0] || null)} />
              </label>
            </div>
            <button className="btn btn-primary" style={{ width: '100%' }}
              onClick={addChar} disabled={charLoading || !charName || !charImg}>
              {charLoading ? <><Loader2 size={14} className="spin" /> {t('tools.saving')}</> : <><Plus size={14} /> {t('tools.add_character')}</>}
            </button>
            <div className="alert alert-info" style={{ marginTop: 14, fontSize: 12 }}>
              {t('tools.mention_tip')}
            </div>
          </div>

          <div className="card">
            <div className="card-header"><Users size={15} /> {t('tools.character_library', { count: String(chars.length) })}</div>
            {chars.length === 0 ? (
              <div className="empty-state">
                <Users size={40} strokeWidth={1.5} style={{ opacity: 0.3, marginBottom: 12 }} />
                <h3>{t('tools.no_characters')}</h3>
                <p>{t('tools.no_characters_desc')}</p>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px,1fr))', gap: 12 }}>
                {chars.map(c => (
                  <div key={c.id} style={{
                    background: 'var(--bg3)', borderRadius: 12, padding: 14,
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
                    border: '1px solid var(--border)',
                  }}>
                    <img src={c.image_url} alt={c.name}
                      style={{ width: 64, height: 64, objectFit: 'cover', borderRadius: '50%', border: '2px solid rgba(124,92,252,0.4)' }} />
                    <div style={{ fontSize: 12, fontWeight: 600 }}>@{c.name}</div>
                    <button className="btn btn-danger btn-sm" style={{ width: '100%', gap: 4 }}
                      onClick={() => delChar(c.id, c.name)}>
                      <Trash2 size={11} /> {t('tools.delete')}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Ảnh → Video (I2V) — layout kiểu Flow: sản phẩm ở trên, thao tác dưới-giữa */}
      {tab === 'i2v' && (
        <div className="tool-flow">
          <div className="tool-feed">
            <VideoFeed jobs={vidJobs.filter(j => j.kind === 'i2v')} />
          </div>
          <div className="tool-composer">
            <div className="card" style={{ margin: 0 }}>
              <div className="card-header"><Film size={15} /> {t('tools.i2v_header')} <small>{t('tools.i2v_desc')}</small></div>
              <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 12, flexWrap: 'wrap' }}>
                <label className="img-add" title={t('tools.select_first_frame')}>
                  {i2vPreview ? <img src={i2vPreview} alt="" /> : <Plus size={22} />}
                  <input ref={i2vRef} type="file" accept="image/*" style={{ display: 'none' }}
                    onChange={e => { const f = e.target.files?.[0] || null; setI2vImg(f); setI2vPreview(f ? URL.createObjectURL(f) : null) }} />
                </label>
                <textarea className="form-textarea" rows={2} style={{ flex: 1, minWidth: 220, minHeight: 'auto' }}
                  value={i2vPrompt} onChange={e => setI2vPrompt(e.target.value)}
                  placeholder={t('tools.i2v_prompt_placeholder')} />
              </div>
              {genSettings}
              <button className="btn btn-primary" style={{ width: '100%' }} onClick={doI2V} disabled={i2vLoading || !i2vImg || !i2vPrompt.trim()}>
                {i2vLoading ? <><Loader2 size={14} className="spin" /> {t('tools.sending')}</> : <><Film size={14} /> {t('tools.create_video_from_image')}</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Giữ mặt → Video (R2V) — layout kiểu Flow */}
      {tab === 'r2v' && (
        <div className="tool-flow">
          <div className="tool-feed">
            <VideoFeed jobs={vidJobs.filter(j => j.kind === 'r2v')} />
          </div>
          <div className="tool-composer">
            <div className="card" style={{ margin: 0 }}>
              <div className="card-header"><Layers size={15} /> {t('tools.r2v_header')} <small>{t('tools.r2v_desc')}</small></div>
              <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 6, flexWrap: 'wrap' }}>
                <label className="img-add" title={t('tools.select_ref_images')}>
                  {r2vImgs.length ? <span style={{ fontWeight: 800, fontSize: 18 }}>{r2vImgs.length}</span> : <Plus size={22} />}
                  <input ref={r2vRef} type="file" accept="image/*" multiple style={{ display: 'none' }}
                    onChange={e => setR2vImgs(Array.from(e.target.files || []).slice(0, 3))} />
                </label>
                <textarea className="form-textarea" rows={2} style={{ flex: 1, minWidth: 220, minHeight: 'auto' }}
                  value={r2vPrompt} onChange={e => setR2vPrompt(e.target.value)}
                  placeholder={t('tools.r2v_prompt_placeholder')} />
              </div>
              <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 12 }}>
                {t('tools.r2v_filter_note')}
              </div>
              {genSettings}
              <button className="btn btn-primary" style={{ width: '100%' }} onClick={doR2V} disabled={r2vLoading || !r2vImgs.length || !r2vPrompt.trim()}>
                {r2vLoading ? <><Loader2 size={14} className="spin" /> {t('tools.sending')}</> : <><Layers size={14} /> {t('tools.create_face_lock_video')}</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TTS — layout Flow */}
      {tab === 'tts' && (
        <div className="tool-flow">
          <div className="tool-feed">
            {ttsFeed.length === 0 ? (
              <div className="empty-state" style={{ padding: '44px 20px' }}>
                <div className="ico"><Volume2 size={24} color="var(--accent2)" /></div>
                <h3>{t('tools.no_audio')}</h3>
                <p>{t('tools.no_audio_desc')}</p>
              </div>
            ) : (
              <div className="stagger" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {ttsFeed.map((a, i) => (
                  <div key={i} className="card" style={{ margin: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                      <span className="badge badge-done" style={{ fontSize: 10 }}>{a.voice || 'Kore'}</span>
                      <span style={{ fontSize: 12.5, color: 'var(--text2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.text}</span>
                    </div>
                    <audio controls src={a.url} style={{ width: '100%' }} />
                    <a href={a.url} download className="btn btn-ghost btn-sm" style={{ marginTop: 8 }}><Download size={12} /> {t('tools.download_wav')}</a>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="tool-composer">
            <div className="card" style={{ margin: 0 }}>
              <div className="card-header"><Mic size={15} /> {t('tools.tts_header')}</div>
              {!user?.has_gemini_key && (<div className="alert alert-info" style={{ marginBottom: 10 }}><AlertCircle size={14} /> {t('tools.need_gemini_key')}</div>)}
              <textarea className="form-textarea" rows={2} style={{ marginBottom: 10, minHeight: 'auto' }}
                placeholder={t('tools.tts_placeholder')} value={ttsText} onChange={e => setTtsText(e.target.value)} />
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
                {['Kore', 'Charon', 'Fenrir', 'Aoede', 'Puck', 'Orbit', 'Zephyr'].map(v => (
                  <button key={v} className={ttsVoice === v ? 'btn btn-primary btn-sm' : 'btn btn-ghost btn-sm'} onClick={() => setTtsVoice(v)}>{v}</button>
                ))}
              </div>
              <button className="btn btn-primary" style={{ width: '100%' }} onClick={doTTS} disabled={ttsLoading || !ttsText.trim()}>
                {ttsLoading ? <><Loader2 size={14} className="spin" /> {t('tools.creating')}</> : <><Volume2 size={14} /> {t('tools.create_audio')}</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tạo ảnh — layout Flow */}
      {tab === 'image' && (
        <div className="tool-flow">
          <div className="tool-feed">
            {imgFeed.length === 0 ? (
              <div className="empty-state" style={{ padding: '44px 20px' }}>
                <div className="ico"><Image size={24} color="var(--accent2)" /></div>
                <h3>{t('tools.no_images')}</h3>
                <p>{t('tools.no_images_desc')}</p>
              </div>
            ) : (
              <div className="stagger" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px,1fr))', gap: 12 }}>
                {imgFeed.map((it, i) => (
                  <div key={i} style={{ position: 'relative', borderRadius: 10, overflow: 'hidden', border: '1px solid var(--border)' }}>
                    <img src={it.url} alt="" style={{ width: '100%', display: 'block' }} />
                    <div style={{ position: 'absolute', top: 6, right: 6, display: 'flex', gap: 4 }}>
                      <a href={it.url} download className="btn btn-primary btn-sm btn-icon"><Download size={12} /></a>
                      <button className="btn btn-ghost btn-sm btn-icon" onClick={() => window.open(it.url, '_blank')}><ExternalLink size={12} /></button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="tool-composer">
            <div className="card" style={{ margin: 0 }}>
              <div className="card-header"><Image size={15} /> {t('tools.create_image')} <small style={{ color: 'var(--green)' }}>{t('tools.free_ultra')}</small></div>
              
              <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 6, fontWeight: 600 }}>{t('tools.character_photo')} <span style={{ fontWeight: 400 }}>({t('tools.optional')})</span></div>
                  <label className="img-add" title={t('tools.character_photo_tooltip')}>
                    {imgKolPrev ? <img src={imgKolPrev} alt="" /> : <Plus size={22} />}
                    <input ref={imgKolRef} type="file" accept="image/*" style={{ display: 'none' }}
                      onChange={e => { const f = e.target.files?.[0] || null; setImgKol(f); setImgKolPrev(f ? URL.createObjectURL(f) : null) }} />
                  </label>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 6, fontWeight: 600 }}>{t('tools.product_photo')} <span style={{ fontWeight: 400 }}>({t('tools.optional')})</span></div>
                  <label className="img-add" title={t('tools.product_photo_tooltip')}>
                    {imgProdPrev ? <img src={imgProdPrev} alt="" /> : <Plus size={22} />}
                    <input ref={imgProdRef} type="file" accept="image/*" style={{ display: 'none' }}
                      onChange={e => { const f = e.target.files?.[0] || null; setImgProd(f); setImgProdPrev(f ? URL.createObjectURL(f) : null) }} />
                  </label>
                </div>
              </div>

              <textarea ref={imgPromptRef} className="form-textarea" rows={2} style={{ marginBottom: 10, minHeight: 'auto' }}
                placeholder={t('tools.image_prompt_placeholder')} value={imgPrompt} onChange={e => setImgPrompt(e.target.value)} />
              {chars.length > 0 && (
                <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', marginBottom: 12 }}>
                  {chars.map(c => (
                    <button key={c.id} type="button" title={t('tools.insert_mention', { name: c.name })} onClick={() => insertMention(c.name)}
                      style={{ display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer', padding: '3px 9px 3px 3px', borderRadius: 99, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text2)' }}>
                      <img src={c.image_url} style={{ width: 20, height: 20, borderRadius: '50%', objectFit: 'cover' }} />
                      <span style={{ fontSize: 12, fontWeight: 500 }}>@{c.name}</span><Plus size={11} />
                    </button>
                  ))}
                </div>
              )}
              <div className="form-row" style={{ marginBottom: 12 }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">{t('tools.image_count')}</label>
                  <select className="form-select" value={imgCount} onChange={e => setImgCount(+e.target.value)}>
                    {[1, 2, 3, 4].map(n => <option key={n} value={n}>{t('tools.n_images', { n: String(n) })}</option>)}
                  </select>
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">{t('tools.aspect_ratio')}</label>
                  <select className="form-select" value={imgAspect} onChange={e => setImgAspect(e.target.value)}>
                    {ASPECTS.map(a => <option key={a.v} value={a.v}>{a.label}</option>)}
                  </select>
                </div>
              </div>
              <button className="btn btn-primary" style={{ width: '100%' }} onClick={doImage} disabled={imgLoading || !imgPrompt.trim()}>
                {imgLoading ? <><Loader2 size={14} className="spin" /> {t('tools.creating')}</> : <><Sparkles size={14} /> {t('tools.create_image')}</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cắt video — layout Flow */}
      {tab === 'cut' && (
        <div className="tool-flow">
          <div className="tool-feed">
            {cutFeed.length === 0 ? (
              <div className="empty-state" style={{ padding: '44px 20px' }}>
                <div className="ico"><Scissors size={24} color="var(--accent2)" /></div>
                <h3>{t('tools.no_cuts')}</h3>
                <p>{t('tools.no_cuts_desc')}</p>
              </div>
            ) : (
              <div className="stagger" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {cutFeed.map((c, i) => (
                  <div key={i} className="card" style={{ margin: 0 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 600, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Scissors size={13} color="var(--accent2)" /> {c.file} <span style={{ color: 'var(--text3)', fontWeight: 400 }}>· {(c.urls || []).length} file</span>
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {(c.urls || []).map((f: string, j: number) => (
                        <a key={j} href={f} download className="btn btn-ghost btn-sm" style={{ fontSize: 11.5 }}><Download size={11} /> {f.split('/').pop()}</a>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="tool-composer">
            <div className="card" style={{ margin: 0 }}>
              <div className="card-header"><Scissors size={15} /> {t('tools.cut_video')}</div>
              <div className="form-group">
                <label className="form-label">{t('tools.filename_in_library')}</label>
                <input className="form-input" placeholder="scene_abc123.mp4" value={cutFile} onChange={e => setCutFile(e.target.value)} />
              </div>
              <div className="form-row" style={{ marginBottom: 12 }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">{t('tools.mode')}</label>
                  <select className="form-select" value={cutMode} onChange={e => setCutMode(e.target.value)}>
                    <option value="split">{t('tools.mode_split')}</option>
                    <option value="frames">{t('tools.mode_frames')}</option>
                  </select>
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">{cutMode === 'split' ? t('tools.seconds_per_segment') : t('tools.frames_per_second')}</label>
                  <input className="form-input" type="number" min={1} value={cutMode === 'split' ? cutSeg : cutFps}
                    onChange={e => cutMode === 'split' ? setCutSeg(+e.target.value) : setCutFps(+e.target.value)} />
                </div>
              </div>
              <button className="btn btn-primary" style={{ width: '100%' }} onClick={doCut} disabled={cutLoading}>
                {cutLoading ? <><Loader2 size={14} className="spin" /> {t('tools.cutting')}</> : <><Scissors size={14} /> {t('tools.cut_now')}</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tải video từ đường link — layout Flow */}
      {tab === 'download' && (
        <div className="tool-flow">
          <div className="tool-feed">
            {dlFeed.length === 0 ? (
              <div className="empty-state" style={{ padding: '44px 20px' }}>
                <div className="ico"><Download size={24} color="var(--accent2)" /></div>
                <h3>{t('tools.no_downloads')}</h3>
                <p>{t('tools.no_downloads_desc')}</p>
              </div>
            ) : (
              <div className="stagger" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px,1fr))', gap: 14 }}>
                {dlFeed.map((d, i) => (
                  <div key={i} className="video-card">
                    <div className="video-preview"><video src={d.url} controls preload="metadata" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} /></div>
                    <div className="video-card-body">
                      <div className="video-card-prompt">{d.filename || d.src}</div>
                      <a href={d.url} download className="btn btn-ghost btn-sm" style={{ marginTop: 8 }}><Download size={12} /> {t('tools.download_to_device')}</a>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="tool-composer">
            <div className="card" style={{ margin: 0 }}>
              <div className="card-header"><Download size={15} /> {t('tools.download_from_link')}</div>
              <div style={{ fontSize: 11.5, color: 'var(--text3)', marginBottom: 10 }}>{t('tools.supported_sites')}</div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <input className="form-input" style={{ flex: 1, minWidth: 220 }} placeholder="https://youtube.com/watch?v=..." value={dlUrl} onChange={e => setDlUrl(e.target.value)} />
                <button className="btn btn-primary" style={{ flex: 'none' }} onClick={doDownload} disabled={dlLoading || !dlUrl.trim()}>
                  {dlLoading ? <><Loader2 size={14} className="spin" /> {t('tools.downloading')}</> : <><Download size={14} /> {t('tools.download_btn')}</>}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
