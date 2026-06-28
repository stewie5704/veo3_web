import { useState, useEffect } from 'react'
import { authApi } from '../api/client'
import { MailCheck, RotateCw, LogOut } from 'lucide-react'

/** Màn chặn: hiện khi hệ thống bật xác minh email và user CHƯA xác minh. Nhập mã 6 số -> vào app. */
export default function VerifyEmail({ email, onVerified }: { email: string; onVerified: () => void }) {
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [msg, setMsg] = useState('')
  const [loading, setLoading] = useState(false)
  const [resending, setResending] = useState(false)
  const [cooldown, setCooldown] = useState(0)

  useEffect(() => {
    if (cooldown <= 0) return
    const t = setInterval(() => setCooldown(c => Math.max(0, c - 1)), 1000)
    return () => clearInterval(t)
  }, [cooldown])

  async function submit(e?: React.FormEvent) {
    e?.preventDefault()
    if (code.length < 6) { setError('Nhập đủ 6 số'); return }
    setError(''); setLoading(true)
    try {
      await authApi.verifyEmail(code)
      onVerified()
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Xác minh thất bại')
    } finally { setLoading(false) }
  }

  async function resend() {
    setError(''); setMsg(''); setResending(true)
    try {
      await authApi.resendVerification()
      setMsg('Đã gửi lại mã — kiểm tra email (cả mục Spam/Quảng cáo).')
      setCooldown(60)
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Gửi lại thất bại')
    } finally { setResending(false) }
  }

  function logout() {
    localStorage.removeItem('token')
    location.href = '/login'
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo">
          <div style={{
            width: 48, height: 48, borderRadius: 12, margin: '0 auto 12px', background: 'var(--grad)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 6px 18px -4px rgba(236,72,153,0.5)',
          }}>
            <MailCheck size={24} color="#fff" strokeWidth={2.2} />
          </div>
          <h1>Xác minh email</h1>
          <p>Bọn mình đã gửi mã 6 số tới<br /><b style={{ color: 'var(--text2)' }}>{email}</b></p>
        </div>

        {error && <div className="alert alert-error"><span>⚠️</span> {error}</div>}
        {msg && <div className="alert alert-success">{msg}</div>}

        <form onSubmit={submit}>
          <div className="form-group">
            <label className="form-label">Mã xác minh</label>
            <input className="form-input" inputMode="numeric" maxLength={6} placeholder="••••••" autoFocus
              value={code} onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              style={{ textAlign: 'center', fontSize: 24, letterSpacing: 8, fontWeight: 700 }} />
          </div>
          <button type="submit" className="btn btn-primary btn-lg" style={{ width: '100%' }} disabled={loading || code.length < 6}>
            {loading ? <><span className="spinner" /> Đang xác minh...</> : 'Xác minh & vào app'}
          </button>
        </form>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16, fontSize: 13 }}>
          <button onClick={resend} disabled={resending || cooldown > 0}
            style={{ background: 'none', border: 'none', fontFamily: 'inherit', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 6, cursor: cooldown > 0 ? 'default' : 'pointer', color: cooldown > 0 ? 'var(--text3)' : 'var(--accent2)' }}>
            <RotateCw size={13} className={resending ? 'spin' : ''} /> {cooldown > 0 ? `Gửi lại sau ${cooldown}s` : 'Gửi lại mã'}
          </button>
          <button onClick={logout}
            style={{ background: 'none', border: 'none', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer', color: 'var(--text3)' }}>
            <LogOut size={13} /> Đăng xuất
          </button>
        </div>
      </div>
    </div>
  )
}
