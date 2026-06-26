import { useState, useEffect } from 'react'
import { useToast } from '../components/Toast'
import api, { authApi } from '../api/client'
import { User, KeyRound, Wifi, Shield, Save, Loader2 } from 'lucide-react'

export default function Settings({ user, onUpdate }: { user: any; onUpdate: (u: any) => void }) {
  const toast = useToast()
  const [tab, setTab] = useState<'profile'|'security'|'api'>('profile')

  // Profile
  const [displayName, setDisplayName] = useState('')
  const [username, setUsername] = useState('')
  const [saving, setSaving] = useState(false)

  // Password
  const [curPwd, setCurPwd] = useState('')
  const [newPwd, setNewPwd] = useState('')
  const [confirmPwd, setConfirmPwd] = useState('')
  const [pwdSaving, setPwdSaving] = useState(false)

  // API key
  const [geminiKey, setGeminiKey] = useState('')
  const [keySaving, setKeySaving] = useState(false)

  useEffect(() => {
    if (user) {
      setDisplayName(user.display_name || '')
      setUsername(user.username || '')
    }
  }, [user])

  async function saveProfile() {
    setSaving(true)
    try {
      await api.patch('/profile/me', { display_name: displayName, username })
      const me = await authApi.me()
      onUpdate(me)
      toast('Đã cập nhật hồ sơ', 'success')
    } catch (e: any) { toast(e.response?.data?.detail || 'Lỗi', 'error') }
    finally { setSaving(false) }
  }

  async function changePassword() {
    if (newPwd !== confirmPwd) { toast('Mật khẩu không khớp', 'error'); return }
    if (newPwd.length < 6) { toast('Tối thiểu 6 ký tự', 'error'); return }
    setPwdSaving(true)
    try {
      await api.post('/profile/change-password', { current_password: curPwd, new_password: newPwd })
      setCurPwd(''); setNewPwd(''); setConfirmPwd('')
      toast('Đã đổi mật khẩu', 'success')
    } catch (e: any) { toast(e.response?.data?.detail || 'Lỗi', 'error') }
    finally { setPwdSaving(false) }
  }

  async function saveGeminiKey() {
    if (!geminiKey.trim()) return
    setKeySaving(true)
    try {
      await authApi.saveGeminiKey(geminiKey)
      const me = await authApi.me()
      onUpdate(me)
      toast('Đã lưu Gemini API key', 'success')
      setGeminiKey('')
    } catch (e: any) { toast(e.response?.data?.detail || 'Lỗi', 'error') }
    finally { setKeySaving(false) }
  }

  const TABS = [
    { k: 'profile', l: 'Hồ sơ', i: User },
    { k: 'security', l: 'Bảo mật', i: Shield },
    { k: 'api', l: 'Kết nối & API Key', i: Wifi },
  ]

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Cài đặt</div>
          <div className="page-subtitle">Tài khoản, bảo mật và kết nối</div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 4, marginBottom: 28 }}>
        {TABS.map(t => {
          const Icon = t.i
          return (
            <button key={t.k} onClick={() => setTab(t.k as any)} style={{
              display: 'flex', alignItems: 'center', gap: 7, padding: '8px 16px', borderRadius: 9,
              border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600, transition: 'all 0.15s',
              background: tab === t.k ? 'rgba(124,92,252,0.15)' : 'rgba(255,255,255,0.04)',
              color: tab === t.k ? '#a78bfa' : '#6060a0',
              outline: tab === t.k ? '1px solid rgba(124,92,252,0.25)' : '1px solid transparent',
            }}>
              <Icon size={14} /> {t.l}
            </button>
          )
        })}
      </div>

      <div style={{ maxWidth: 520 }}>

        {/* Profile */}
        {tab === 'profile' && (
          <div className="card">
            <div className="card-header"><User size={15} /> Thông tin hồ sơ</div>

            {/* Avatar */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
              <div style={{
                width: 60, height: 60, borderRadius: '50%',
                background: 'linear-gradient(135deg, #7c5cfc, #f472b6)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 24, fontWeight: 700, color: '#fff', flexShrink: 0,
              }}>{user?.username?.[0]?.toUpperCase()}</div>
              <div>
                <div style={{ fontWeight: 600, fontSize: 16 }}>{user?.display_name || user?.username}</div>
                <div style={{ fontSize: 12, color: 'var(--text3)' }}>{user?.email}</div>
                <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                  {user?.is_admin && <span className="badge badge-processing">👑 Admin</span>}
                  <span className="badge badge-done">
                    {user?.videos_generated || 0}/{user?.quota_videos === -1 ? '∞' : user?.quota_videos} video
                  </span>
                </div>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Tên hiển thị</label>
              <input className="form-input" placeholder="Tên của bạn"
                value={displayName} onChange={e => setDisplayName(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Tên đăng nhập</label>
              <input className="form-input" placeholder="tên đăng nhập"
                value={username} onChange={e => setUsername(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Email</label>
              <input className="form-input" value={user?.email || ''} disabled
                style={{ opacity: 0.5, cursor: 'not-allowed' }} />
            </div>
            <button className="btn btn-primary" onClick={saveProfile} disabled={saving}>
              {saving ? <><Loader2 size={13} className="spin" /> Đang lưu...</> : <><Save size={13} /> Lưu thay đổi</>}
            </button>
          </div>
        )}

        {/* Security */}
        {tab === 'security' && (
          <div className="card">
            <div className="card-header"><Shield size={15} /> Đổi mật khẩu</div>
            <div className="form-group">
              <label className="form-label">Mật khẩu hiện tại</label>
              <input className="form-input" type="password" placeholder="••••••••"
                value={curPwd} onChange={e => setCurPwd(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Mật khẩu mới</label>
              <input className="form-input" type="password" placeholder="Tối thiểu 6 ký tự"
                value={newPwd} onChange={e => setNewPwd(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Xác nhận mật khẩu mới</label>
              <input className="form-input" type="password" placeholder="••••••••"
                value={confirmPwd} onChange={e => setConfirmPwd(e.target.value)} />
            </div>
            {newPwd && confirmPwd && newPwd !== confirmPwd && (
              <div className="alert alert-error" style={{ marginBottom: 12 }}>Mật khẩu không khớp</div>
            )}
            <button className="btn btn-primary" onClick={changePassword}
              disabled={pwdSaving || !curPwd || !newPwd || newPwd !== confirmPwd}>
              {pwdSaving ? <><Loader2 size={13} className="spin" /> Đang đổi...</> : <><KeyRound size={13} /> Đổi mật khẩu</>}
            </button>
          </div>
        )}

        {/* API & Connections */}
        {tab === 'api' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Google Ultra */}
            <div className="card">
              <div className="card-header"><Wifi size={15} /> Kết nối Google Ultra</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                <div className={`connection-badge ${user?.google_connected ? 'connected' : 'disconnected'}`}>
                  <span className="connection-dot" />
                  {user?.google_connected ? 'Đã kết nối' : 'Chưa kết nối'}
                </div>
              </div>
              <div className="alert alert-info" style={{ fontSize: 12 }}>
                Cài tiện ích trên trình duyệt Chrome, đăng nhập tài khoản Google, rồi bấm Kết nối trong tiện ích.
              </div>
            </div>

            {/* Gemini API */}
            <div className="card">
              <div className="card-header"><KeyRound size={15} /> Gemini API Key (cho AI viết kịch bản, đọc giọng nói, tạo ảnh)</div>
              {user?.has_gemini_key && (
                <div className="alert alert-success" style={{ marginBottom: 12, fontSize: 12 }}>
                  ✓ Đã có API key. Nhập key mới để thay thế.
                </div>
              )}
              <div className="form-group">
                <label className="form-label">API Key</label>
                <input className="form-input" type="password" placeholder="AIzaSy..."
                  value={geminiKey} onChange={e => setGeminiKey(e.target.value)} />
              </div>
              <div className="alert alert-info" style={{ fontSize: 12, marginBottom: 12 }}>
                Dùng để viết kịch bản, đọc giọng nói và tạo ảnh. Lấy key tại <a href="https://aistudio.google.com/apikey" target="_blank" style={{ color: 'var(--accent2)' }}>aistudio.google.com</a>
              </div>
              <button className="btn btn-primary" onClick={saveGeminiKey} disabled={keySaving || !geminiKey.trim()}>
                {keySaving ? <><Loader2 size={13} className="spin" /> Đang lưu...</> : <><Save size={13} /> Lưu API Key</>}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
