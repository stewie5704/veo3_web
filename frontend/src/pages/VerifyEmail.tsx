import { useState, useEffect } from 'react'
import { authApi } from '../api/client'
import { MailCheck, RotateCw, LogOut } from 'lucide-react'
import { useT } from '../i18n'

/** Màn chặn: hiện khi hệ thống bật xác minh email và user CHƯA xác minh. Nhập mã 6 số -> vào app. */
export default function VerifyEmail({ email, onVerified }: { email: string; onVerified: () => void }) {
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [msg, setMsg] = useState('')
  const [loading, setLoading] = useState(false)
  const [resending, setResending] = useState(false)
  const [cooldown, setCooldown] = useState(0)
  const t = useT()

  useEffect(() => {
    if (cooldown <= 0) return
    const t = setInterval(() => setCooldown(c => Math.max(0, c - 1)), 1000)
    return () => clearInterval(t)
  }, [cooldown])

  async function submit(e?: React.FormEvent) {
    e?.preventDefault()
    if (code.length < 6) { setError(t('auth.verify.enter_6_digits')); return }
    setError(''); setLoading(true)
    try {
      await authApi.verifyEmail(code)
      onVerified()
    } catch (err: any) {
      setError(err.response?.data?.detail || t('auth.verify.failed'))
    } finally { setLoading(false) }
  }

  async function resend() {
    setError(''); setMsg(''); setResending(true)
    try {
      await authApi.resendVerification()
      setMsg(t('auth.verify.resent'))
      setCooldown(60)
    } catch (err: any) {
      setError(err.response?.data?.detail || t('auth.verify.resend_failed'))
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
          <h1>{t('auth.verify.title')}</h1>
          <p>{t('auth.verify.sent_code')}<br /><b style={{ color: 'var(--text2)' }}>{email}</b></p>
        </div>

        {error && <div className="alert alert-error"><span>⚠️</span> {error}</div>}
        {msg && <div className="alert alert-success">{msg}</div>}

        <form onSubmit={submit}>
          <div className="form-group">
            <label className="form-label">{t('auth.verify.code_label')}</label>
            <input className="form-input" inputMode="numeric" maxLength={6} placeholder="••••••" autoFocus
              value={code} onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              style={{ textAlign: 'center', fontSize: 24, letterSpacing: 8, fontWeight: 700 }} />
          </div>
          <button type="submit" className="btn btn-primary btn-lg" style={{ width: '100%' }} disabled={loading || code.length < 6}>
            {loading ? <><span className="spinner" /> {t('auth.verify.verifying')}</> : t('auth.verify.submit')}
          </button>
        </form>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16, fontSize: 13 }}>
          <button onClick={resend} disabled={resending || cooldown > 0}
            style={{ background: 'none', border: 'none', fontFamily: 'inherit', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 6, cursor: cooldown > 0 ? 'default' : 'pointer', color: cooldown > 0 ? 'var(--text3)' : 'var(--accent2)' }}>
            <RotateCw size={13} className={resending ? 'spin' : ''} /> {cooldown > 0 ? t('auth.verify.resend_cooldown', { seconds: cooldown }) : t('auth.verify.resend')}
          </button>
          <button onClick={logout}
            style={{ background: 'none', border: 'none', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer', color: 'var(--text3)' }}>
            <LogOut size={13} /> {t('auth.logout')}
          </button>
        </div>
      </div>
    </div>
  )
}
