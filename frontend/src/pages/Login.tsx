import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Scissors, Eye, EyeOff } from 'lucide-react'
import { authApi } from '../api/client'
import { useT } from '../i18n'

export default function Login() {
  const [form, setForm] = useState({ email: '', password: '' })
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const t = useT()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const email = form.email.trim()
    const password = form.password
    if (!email || !password) {
      setError('Vui lòng nhập đầy đủ email và mật khẩu')
      return
    }

    setError('')
    setLoading(true)
    try {
      const res = await authApi.login({ email, password })
      if (!res?.access_token) {
        throw new Error('Không nhận được token xác thực từ máy chủ')
      }
      localStorage.setItem('token', res.access_token)

      // Kiểm tra vai trò tài khoản để chuyển thẳng vào đúng trang
      let target = '/projects'
      try {
        const u = await authApi.me()
        if (u?.is_admin) target = '/admin'
      } catch {
        // Fallback sang /projects nếu call me() tạm thời lỗi mạng
      }
      window.location.href = target
    } catch (err: any) {
      const msg = err.response?.data?.detail || err.message || t('auth.login_failed')
      setError(typeof msg === 'string' ? msg : JSON.stringify(msg))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-page">
      {/* Background orbs */}
      <div style={{
        position: 'fixed', inset: 0, overflow: 'hidden', pointerEvents: 'none', zIndex: 0,
      }}>
        <div style={{
          position: 'absolute', width: 600, height: 600,
          background: 'radial-gradient(circle, rgba(249,115,22,0.14) 0%, transparent 70%)',
          top: '-20%', left: '-10%', borderRadius: '50%',
        }} />
        <div style={{
          position: 'absolute', width: 500, height: 500,
          background: 'radial-gradient(circle, rgba(234,88,12,0.08) 0%, transparent 70%)',
          bottom: '-10%', right: '-5%', borderRadius: '50%',
        }} />
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

        {error && (
          <div className="alert alert-error" style={{
            display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px',
            borderRadius: 8, background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)',
            color: '#fca5a5', fontSize: 13, marginBottom: 18,
          }}>
            <span style={{ fontSize: 16 }}>⚠️</span> <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate>
          <div className="form-group">
            <label className="form-label">Email</label>
            <input
              id="login-email"
              className="form-input"
              type="email"
              placeholder="you@example.com"
              value={form.email}
              onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck="false"
              autoComplete="email"
              required
            />
          </div>
          <div className="form-group" style={{ marginBottom: 24 }}>
            <label className="form-label">{t('auth.password')}</label>
            <div style={{ position: 'relative' }}>
              <input
                id="login-password"
                className="form-input"
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                value={form.password}
                onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck="false"
                autoComplete="current-password"
                style={{ paddingRight: 42 }}
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(s => !s)}
                style={{
                  position: 'absolute',
                  right: 12,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  color: '#9ca3af',
                  cursor: 'pointer',
                  padding: 4,
                  display: 'flex',
                  alignItems: 'center',
                }}
                tabIndex={-1}
                title={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>
          <button id="login-submit" type="submit" className="btn btn-primary btn-lg"
            style={{ width: '100%' }} disabled={loading}>
            {loading ? <><span className="spinner" /> {t('auth.logging_in')}</> : t('auth.login_btn')}
          </button>
        </form>

        <div className="auth-footer">
          {t('auth.no_account')} <Link to="/register">{t('auth.register_link')}</Link>
        </div>
      </div>
    </div>
  )
}
