import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Scissors, Gift } from 'lucide-react'
import { authApi } from '../api/client'
import { useT } from '../i18n'

export default function Register() {
  const nav = useNavigate()
  const [params] = useSearchParams()
  // Check if we have a valid 30-day cookie
  let savedRef = localStorage.getItem('veo_ref_code') || ''
  const savedTime = parseInt(localStorage.getItem('veo_ref_time') || '0', 10)
  if (savedRef && Date.now() - savedTime > 30 * 24 * 3600 * 1000) {
    savedRef = '' // expired > 30 days
  }

  const [ref, setRef] = useState((params.get('ref') || savedRef || '').trim())
  const [form, setForm] = useState({ email: '', username: '', password: '', confirm: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const t = useT()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (form.password !== form.confirm) { setError(t('auth.password_mismatch')); return }
    if (form.password.length < 6) { setError(t('auth.password_min_length')); return }
    setLoading(true)
    try {
      const res = await authApi.register({ 
        email: form.email, 
        username: form.username, 
        password: form.password, 
        ref: ref || undefined,
        cookie_ref: savedRef || undefined 
      })
      localStorage.setItem('token', res.access_token)
      // Clear cookie after successful reg
      localStorage.removeItem('veo_ref_code')
      localStorage.removeItem('veo_ref_time')
      nav('/', { replace: true })
    } catch (err: any) {
      setError(err.response?.data?.detail || t('auth.register_failed'))
    } finally {
      setLoading(false)
    }
  }

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }))

  return (
    <div className="auth-page">
      <div style={{ position: 'fixed', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
        <div style={{ position: 'absolute', width: 700, height: 700, background: 'radial-gradient(circle, rgba(124,92,252,0.12) 0%, transparent 70%)', top: '-25%', right: '-15%', borderRadius: '50%' }} />
        <div style={{ position: 'absolute', width: 400, height: 400, background: 'radial-gradient(circle, rgba(244,114,182,0.08) 0%, transparent 70%)', bottom: '10%', left: '-5%', borderRadius: '50%' }} />
      </div>

      <div className="auth-card" style={{ position: 'relative', zIndex: 1 }}>
        <div className="auth-logo">
          <div style={{
            width: 48, height: 48, borderRadius: 12, margin: '0 auto 12px',
            background: 'var(--grad)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 6px 18px -4px rgba(236,72,153,0.5)',
          }}>
            <Scissors size={24} color="#fff" strokeWidth={2.2} />
          </div>
          <h1>AI AutoCut</h1>
          <p>{t('auth.tagline')}</p>
        </div>

        {error && <div className="alert alert-error"><span>⚠️</span> {error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Email</label>
            <input className="form-input" type="email" placeholder="you@example.com"
              value={form.email} onChange={set('email')} required />
          </div>
          <div className="form-group">
            <label className="form-label">Username</label>
            <input className="form-input" type="text" placeholder="username"
              value={form.username} onChange={set('username')} required />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">{t('auth.password')}</label>
              <input className="form-input" type="password" placeholder="••••••••"
                value={form.password} onChange={set('password')} required />
            </div>
            <div className="form-group">
              <label className="form-label">{t('auth.confirm_password')}</label>
              <input className="form-input" type="password" placeholder="••••••••"
                value={form.confirm} onChange={set('confirm')} required />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Gift size={12} /> {t('auth.referral_code')} <span style={{ color: 'var(--text3)', fontWeight: 400 }}>({t('auth.optional')})</span>
            </label>
            <input className="form-input" type="text" placeholder={t('auth.referral_placeholder')}
              value={ref} onChange={e => setRef(e.target.value)} />
          </div>
          <button type="submit" className="btn btn-primary btn-lg"
            style={{ width: '100%', marginTop: 8 }} disabled={loading}>
            {loading ? <><span className="spinner" /> {t('auth.creating')}</> : t('auth.register_btn')}
          </button>
        </form>

        <div className="auth-footer">
          {t('auth.has_account')} <Link to="/login">{t('auth.login_link')}</Link>
        </div>
      </div>
    </div>
  )
}
