import { useEffect, useRef, useState } from 'react'
import { Download, ChevronDown, Loader2, Sparkles } from 'lucide-react'
import { downloadVideoFile } from '../api/client'
import { useToast } from './Toast'

/**
 * "Tải về" với lựa chọn độ phân giải. 720p = bản gốc (tải ngay);
 * 1080p = server upscale theo yêu cầu (lần đầu chờ vài giây, sau đó có cache).
 * `base` là path tương đối /api/v1 (không kèm query), vd /projects/x/scenes/y/download.
 */
export default function DownloadMenu({
  base, filename, flex,
}: {
  base: string
  filename: string
  flex?: boolean
}) {
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState<'720' | '1080' | null>(null)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])

  async function pick(res: '720' | '1080') {
    setOpen(false)
    setBusy(res)
    try {
      const sep = base.includes('?') ? '&' : '?'
      await downloadVideoFile(`${base}${sep}res=${res}`, filename.replace(/\.mp4$/i, `_${res}p.mp4`))
    } catch {
      toast(res === '1080' ? 'Tạo bản 1080p thất bại, thử lại sau' : 'Tải thất bại', 'error')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div ref={ref} style={{ position: 'relative', flex: flex ? 1 : undefined }}>
      <button
        className="btn btn-primary btn-sm"
        style={{ width: flex ? '100%' : undefined }}
        disabled={busy !== null}
        onClick={() => setOpen(o => !o)}
      >
        {busy
          ? <><Loader2 size={12} className="spin" /> {busy === '1080' ? 'Đang tạo 1080p…' : 'Đang tải…'}</>
          : <><Download size={12} /> Tải về <ChevronDown size={11} style={{ opacity: 0.8 }} /></>}
      </button>

      {open && (
        <div style={{
          position: 'absolute', bottom: 'calc(100% + 6px)', left: 0, zIndex: 30, minWidth: 188,
          background: '#171311', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12,
          padding: 5, boxShadow: '0 16px 40px -12px rgba(0,0,0,0.8)',
        }}>
          <button onClick={() => pick('720')} style={menuItem}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>720p</div>
              <div style={{ fontSize: 11, color: 'var(--text3)' }}>Bản gốc · tải ngay</div>
            </div>
          </button>
          <button onClick={() => pick('1080')} style={menuItem}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 6 }}>
                1080p
                <span style={{
                  fontSize: 9, fontWeight: 800, letterSpacing: '.05em', padding: '1px 5px', borderRadius: 5,
                  color: '#fff', background: 'linear-gradient(115deg,#F97316,#EC4899)',
                }}>HD</span>
              </div>
              <div style={{ fontSize: 11, color: 'var(--text3)' }}>Nâng cấp · chờ vài giây</div>
            </div>
            <Sparkles size={14} color="#fbbf24" />
          </button>
        </div>
      )}
    </div>
  )
}

const menuItem: React.CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
  width: '100%', textAlign: 'left', padding: '9px 11px', borderRadius: 8,
  background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
}
