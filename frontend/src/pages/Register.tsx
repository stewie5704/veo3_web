import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Scissors, Gift } from 'lucide-react'
import { authApi } from '../api/client'

export default function Register() {
  const nav = useNavigate()
  const [params] = useSearchParams()
  const [ref, setRef] = useState((params.get('ref') || '').trim())
  const [form, setForm] = useState({ email: '', username: '', password: '', confirm: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (form.password !== form.confirm) { setError('Mật khẩu không khớp'); return }
    if (form.password.length < 6) { setError('Mật khẩu tối thiểu 6 ký tự'); return }
    setLoading(true)
    try {
      const res = await authApi.register({ email: form.email, username: form.username, password: form.password, ref: ref || undefined })
      localStorage.setItem('token', res.access_token)
      nav('/', { replace: true })
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Đăng ký thất bại')
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
          <p>Tạo phim AI bằng Veo 3.1</p>
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
              <label className="form-label">Mật khẩu</label>
              <input className="form-input" type="password" placeholder="••••••••"
                value={form.password} onChange={set('password')} required />
            </div>
            <div className="form-group">
              <label className="form-label">Xác nhận</label>
              <input className="form-input" type="password" placeholder="••••••••"
                value={form.confirm} onChange={set('confirm')} required />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Gift size={12} /> Mã giới thiệu <span style={{ color: 'var(--text3)', fontWeight: 400 }}>(không bắt buộc)</span>
            </label>
            <input className="form-input" type="text" placeholder="Nhập mã nếu có — có thể điền sau ở Hồ sơ"
              value={ref} onChange={e => setRef(e.target.value)} />
          </div>
          <button type="submit" className="btn btn-primary btn-lg"
            style={{ width: '100%', marginTop: 8 }} disabled={loading}>
            {loading ? <><span className="spinner" /> Đang tạo...</> : '✨ Tạo tài khoản'}
          </button>
        </form>

        <div className="auth-footer">
          Đã có tài khoản? <Link to="/login">Đăng nhập →</Link>
        </div>
      </div>
    </div>
  )
}
