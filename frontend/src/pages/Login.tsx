import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { authApi } from '../api/client'

export default function Login() {
  const nav = useNavigate()
  const [form, setForm] = useState({ email: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(''); setLoading(true)
    try {
      const res = await authApi.login(form)
      localStorage.setItem('token', res.access_token)
      nav('/', { replace: true })
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Email hoặc mật khẩu không đúng')
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
          <h1>VEO3 Web</h1>
          <p>AI Video Generation Platform</p>
        </div>

        {error && (
          <div className="alert alert-error">
            <span>⚠️</span> {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Email</label>
            <input id="login-email" className="form-input" type="email"
              placeholder="you@example.com"
              value={form.email}
              onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              autoComplete="email" required />
          </div>
          <div className="form-group" style={{ marginBottom: 24 }}>
            <label className="form-label">Mật khẩu</label>
            <input id="login-password" className="form-input" type="password"
              placeholder="••••••••"
              value={form.password}
              onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
              autoComplete="current-password" required />
          </div>
          <button id="login-submit" type="submit" className="btn btn-primary btn-lg"
            style={{ width: '100%' }} disabled={loading}>
            {loading ? <><span className="spinner" /> Đang đăng nhập...</> : '🚀 Đăng nhập'}
          </button>
        </form>

        <div className="auth-footer">
          Chưa có tài khoản? <Link to="/register">Đăng ký ngay →</Link>
        </div>
      </div>
    </div>
  )
}
