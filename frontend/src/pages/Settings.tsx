import { useState, useEffect } from 'react'
import { useToast } from '../components/Toast'
import api, { authApi, billingApi } from '../api/client'
import {
  User, KeyRound, Wifi, Shield, Save, Loader2, Crown, HardDrive, Sparkles,
  Gem, Check, AtSign, Mail, Gift, Bot, ExternalLink, Search,
} from 'lucide-react'

const PLAN_LABEL: Record<string, string> = { m1: '1 tháng', m6: '6 tháng', m12: '12 tháng' }
const fmtBytes = (b: number) =>
  b >= 1024 ** 3 ? (b / 1024 ** 3).toFixed(2) + ' GB'
    : b >= 1024 ** 2 ? (b / 1024 ** 2).toFixed(0) + ' MB'
    : (b / 1024).toFixed(0) + ' KB'

export default function Settings({ user, onUpdate }: { user: any; onUpdate: (u: any) => void }) {
  const toast = useToast()
  const [tab, setTab] = useState<'profile' | 'assistants' | 'security' | 'api'>('profile')
  const [sub, setSub] = useState<any>(null)

  const [displayName, setDisplayName] = useState('')
  const [username, setUsername] = useState('')
  const [saving, setSaving] = useState(false)

  const [curPwd, setCurPwd] = useState('')
  const [newPwd, setNewPwd] = useState('')
  const [confirmPwd, setConfirmPwd] = useState('')
  const [pwdSaving, setPwdSaving] = useState(false)

  const [geminiKey, setGeminiKey] = useState('')
  const [keySaving, setKeySaving] = useState(false)

  const [refCode, setRefCode] = useState('')
  const [refSaving, setRefSaving] = useState(false)

  // Trợ lý AI được tặng kèm gói (quà) — link ChatGPT ẩn dưới tên
  const [gift, setGift] = useState<any>(null)
  const [asstQ, setAsstQ] = useState('')

  useEffect(() => {
    if (user) { setDisplayName(user.display_name || ''); setUsername(user.username || '') }
  }, [user])
  useEffect(() => { billingApi.me().then(setSub).catch(() => {}) }, [])
  useEffect(() => { billingApi.myAssistants().then(setGift).catch(() => {}) }, [])

  async function saveProfile() {
    setSaving(true)
    try {
      await api.patch('/profile/me', { display_name: displayName, username })
      onUpdate(await authApi.me())
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
      onUpdate(await authApi.me())
      toast('Đã lưu Gemini API key', 'success'); setGeminiKey('')
    } catch (e: any) { toast(e.response?.data?.detail || 'Lỗi', 'error') }
    finally { setKeySaving(false) }
  }
  async function applyRefCode() {
    if (!refCode.trim()) return
    setRefSaving(true)
    try {
      await authApi.applyRef(refCode.trim())
      onUpdate(await authApi.me())
      toast('Đã áp mã giới thiệu', 'success'); setRefCode('')
    } catch (e: any) { toast(e.response?.data?.detail || 'Lỗi', 'error') }
    finally { setRefSaving(false) }
  }

  // Tab "Trợ lý AI" chỉ hiện khi user thực sự được tặng (quà kèm gói)
  const hasGift = !!(gift?.gifted && (gift?.assistants?.length || 0) > 0)
  const TABS: { k: 'profile' | 'assistants' | 'security' | 'api'; l: string; i: any }[] = [
    { k: 'profile', l: 'Hồ sơ', i: User },
    ...(hasGift ? [{ k: 'assistants' as const, l: 'Trợ lý AI', i: Bot }] : []),
    { k: 'security', l: 'Bảo mật', i: Shield },
    { k: 'api', l: 'Kết nối & API Key', i: Wifi },
  ]

  // Plan / trial state
  const active = sub?.active
  const inTrial = sub?.in_trial && !active
  const trialHrs = sub?.trial_ends_at ? Math.max(0, Math.round((new Date(sub.trial_ends_at).getTime() - Date.now()) / 3600000)) : 0
  const stUsed = sub?.storage_used || 0
  const stLimit = sub?.storage_limit || 150 * 1024 * 1024
  const stPct = Math.min(100, Math.round((stUsed / stLimit) * 100))
  const stNear = stPct >= 85

  // Trợ lý tặng: lọc theo ô tìm + gom nhóm theo danh mục (giữ thứ tự)
  const allAssts: any[] = gift?.assistants || []
  const asstQuery = asstQ.trim().toLowerCase()
  const asstFiltered = asstQuery
    ? allAssts.filter(a => `${a.name || ''} ${a.category || ''}`.toLowerCase().includes(asstQuery))
    : allAssts
  const asstGroups: [string, any[]][] = []
  const asstIdx: Record<string, any[]> = {}
  for (const a of asstFiltered) {
    const cat = a.category || 'Khác'
    if (!asstIdx[cat]) { asstIdx[cat] = []; asstGroups.push([cat, asstIdx[cat]]) }
    asstIdx[cat].push(a)
  }

  return (
    <div style={{ maxWidth: 600, margin: '0 auto' }}>
      <div className="page-header">
        <div>
          <div className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Gem size={22} color="#fb923c" /> Cài đặt
          </div>
          <div className="page-subtitle">Tài khoản · bảo mật · kết nối · lưu trữ</div>
        </div>
      </div>

      {/* ── VIP account card ── */}
      <div style={{
        position: 'relative', borderRadius: 20, padding: '22px 24px', marginBottom: 18, overflow: 'hidden',
        background: 'linear-gradient(140deg, rgba(249,115,22,0.10), rgba(236,72,153,0.06) 45%, rgba(168,85,247,0.05))',
        border: '1px solid rgba(249,115,22,0.22)',
        boxShadow: '0 24px 60px -28px rgba(236,72,153,0.4)',
      }}>
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: 'var(--grad)' }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          {/* avatar with gradient ring */}
          <div style={{ padding: 2.5, borderRadius: '50%', background: 'var(--grad)', flexShrink: 0, boxShadow: '0 6px 20px -6px rgba(236,72,153,0.6)' }}>
            <div style={{
              width: 64, height: 64, borderRadius: '50%', background: '#15110f',
              display: 'grid', placeItems: 'center', fontSize: 26, fontWeight: 800,
            }}>
              <span style={{ background: 'var(--grad)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
                {(user?.display_name || user?.username || '?')[0]?.toUpperCase()}
              </span>
            </div>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 19, fontWeight: 800, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              {user?.display_name || user?.username}
              {user?.is_admin && <Crown size={16} color="#fbbf24" fill="#fbbf24" />}
            </div>
            <div style={{ fontSize: 12.5, color: 'var(--text3)', marginBottom: 8 }}>{user?.email}</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {active ? (
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 11px', borderRadius: 99,
                  fontSize: 11.5, fontWeight: 700, color: '#fff', background: 'var(--grad)',
                  boxShadow: '0 4px 12px -4px rgba(236,72,153,0.6)',
                }}>
                  <Crown size={12} /> Gói {PLAN_LABEL[sub.plan] || sub.plan}{sub.days_left != null ? ` · còn ${Math.round(sub.days_left)}d` : ''}
                </span>
              ) : inTrial ? (
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 11px', borderRadius: 99,
                  fontSize: 11.5, fontWeight: 700, color: '#fbbf24',
                  background: 'rgba(251,191,36,0.12)', border: '1px solid rgba(251,191,36,0.3)',
                }}>
                  <Sparkles size={12} /> Dùng thử · còn {trialHrs}h
                </span>
              ) : (
                <span className="badge" style={{ background: 'rgba(255,255,255,0.06)', color: 'var(--text3)' }}>Miễn phí</span>
              )}
              {user?.is_admin && <span className="badge badge-processing">Admin</span>}
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 10px', borderRadius: 99,
                fontSize: 11.5, fontWeight: 600, color: 'var(--text2)', background: 'rgba(255,255,255,0.05)',
              }}>
                🎬 {user?.videos_generated || 0} video
              </span>
            </div>
          </div>
        </div>

        {/* storage bar */}
        <div style={{ marginTop: 18, borderTop: '1px solid rgba(255,255,255,0.07)', paddingTop: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12.5, marginBottom: 7 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 7, color: 'var(--text2)' }}>
              <HardDrive size={14} color={stNear ? '#f87171' : '#fb923c'} /> Dung lượng lưu trữ
            </span>
            <span style={{ color: stNear ? '#f87171' : 'var(--text3)', fontVariantNumeric: 'tabular-nums' }}>
              {fmtBytes(stUsed)} / {fmtBytes(stLimit)}{active ? '' : ' (free)'}
            </span>
          </div>
          <div style={{ height: 8, borderRadius: 99, background: 'rgba(255,255,255,0.07)', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${stPct}%`, borderRadius: 99, transition: 'width .4s', background: stNear ? 'linear-gradient(90deg,#f87171,#ef4444)' : 'var(--grad)' }} />
          </div>
          <div style={{ fontSize: 11.5, color: 'var(--text3)', marginTop: 7 }}>
            {stNear
              ? <span style={{ color: '#f87171' }}>Sắp đầy! {active ? 'Xóa bớt video cũ.' : 'Nâng gói để có 1GB.'}</span>
              : active ? 'Gói trả phí: tối đa 1GB.' : 'Tài khoản free: 150MB. Nâng gói để lên 1GB.'}
          </div>
        </div>
      </div>

      {/* ── Tabs ── */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 18 }}>
        {TABS.map(t => {
          const Icon = t.i; const on = tab === t.k
          return (
            <button key={t.k} onClick={() => setTab(t.k)} style={{
              display: 'flex', alignItems: 'center', gap: 7, padding: '8px 16px', borderRadius: 10,
              border: `1px solid ${on ? 'rgba(249,115,22,0.35)' : 'transparent'}`, cursor: 'pointer',
              fontSize: 13, fontWeight: 600, transition: 'all .15s', fontFamily: 'inherit',
              background: on ? 'rgba(249,115,22,0.13)' : 'rgba(255,255,255,0.04)',
              color: on ? '#fb923c' : 'var(--text3)',
            }}>
              <Icon size={14} /> {t.l}
            </button>
          )
        })}
      </div>

      {/* Profile */}
      {tab === 'profile' && (
        <div className="card">
          <div className="card-header"><User size={15} /> Thông tin hồ sơ</div>
          <div className="form-group">
            <label className="form-label">Tên hiển thị</label>
            <input className="form-input" placeholder="Tên của bạn"
              value={displayName} onChange={e => setDisplayName(e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}><AtSign size={12} /> Tên đăng nhập</label>
            <input className="form-input" placeholder="tên đăng nhập"
              value={username} onChange={e => setUsername(e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Mail size={12} /> Email</label>
            <input className="form-input" value={user?.email || ''} disabled style={{ opacity: 0.5, cursor: 'not-allowed' }} />
          </div>
          <div className="form-group">
            <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Gift size={12} /> Mã giới thiệu</label>
            {user?.referred_by ? (
              <div className="alert alert-success" style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 6, marginBottom: 0 }}>
                <Check size={13} /> Bạn đã có người giới thiệu.
              </div>
            ) : (
              <div style={{ display: 'flex', gap: 8 }}>
                <input className="form-input" placeholder="Nhập mã nếu được ai đó giới thiệu (chỉ áp 1 lần)"
                  value={refCode} onChange={e => setRefCode(e.target.value)} style={{ flex: 1 }} />
                <button type="button" className="btn btn-ghost" onClick={applyRefCode} disabled={refSaving || !refCode.trim()}>
                  {refSaving ? <Loader2 size={13} className="spin" /> : 'Áp mã'}
                </button>
              </div>
            )}
          </div>
          <button className="btn btn-primary" onClick={saveProfile} disabled={saving}>
            {saving ? <><Loader2 size={13} className="spin" /> Đang lưu...</> : <><Save size={13} /> Lưu thay đổi</>}
          </button>
        </div>
      )}

      {/* Trợ lý AI được tặng (quà kèm gói) — bấm tên để mở ChatGPT (link ẩn dưới tên) */}
      {tab === 'assistants' && hasGift && (
        <div className="card">
          <div className="card-header" style={{ justifyContent: 'space-between' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Bot size={15} color="#fb923c" /> Trợ lý AI được tặng</span>
            <span className="badge" style={{ background: 'var(--grad)', color: '#fff', border: 'none' }}>{gift.count} trợ lý</span>
          </div>
          <div className="alert alert-info" style={{ fontSize: 12, marginBottom: 14 }}>
            Quà kèm theo gói của bạn. Bấm vào <b>tên trợ lý</b> để mở trên ChatGPT (mở tab mới).
          </div>
          {allAssts.length > 8 && (
            <div style={{ position: 'relative', marginBottom: 14 }}>
              <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)', pointerEvents: 'none' }} />
              <input className="form-input" style={{ paddingLeft: 34 }} placeholder="Tìm trợ lý..."
                value={asstQ} onChange={e => setAsstQ(e.target.value)} />
            </div>
          )}
          <div className="gift-asst-list">
            {asstGroups.length === 0 ? (
              <div style={{ fontSize: 13, color: 'var(--text3)', padding: '18px 4px', textAlign: 'center' }}>Không tìm thấy trợ lý nào.</div>
            ) : asstGroups.map(([cat, items]) => (
              <div key={cat}>
                <div className="gift-asst-cat">{cat}</div>
                {items.map((a: any, i: number) => (
                  <a key={a.id ?? `${cat}-${i}`} className="gift-asst" href={a.url} target="_blank" rel="noreferrer" title={a.name}>
                    <span className="ai-ico"><Bot size={15} /></span>
                    <span className="ai-name">{a.name}</span>
                    <ExternalLink size={13} className="ai-ext" />
                  </a>
                ))}
              </div>
            ))}
          </div>
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

          <div className="card">
            <div className="card-header"><KeyRound size={15} /> Gemini API Key</div>
            {user?.has_gemini_key && (
              <div className="alert alert-success" style={{ marginBottom: 12, fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Check size={13} /> Đã có API key. Nhập key mới để thay thế.
              </div>
            )}
            <div className="form-group">
              <label className="form-label">API Key</label>
              <input className="form-input" type="password" placeholder="AIzaSy..."
                value={geminiKey} onChange={e => setGeminiKey(e.target.value)} />
            </div>
            <div className="alert alert-info" style={{ fontSize: 12, marginBottom: 12 }}>
              Dùng để viết kịch bản, đọc giọng nói và tạo ảnh. Lấy key tại <a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer" style={{ color: 'var(--accent2)' }}>aistudio.google.com</a>
            </div>
            <button className="btn btn-primary" onClick={saveGeminiKey} disabled={keySaving || !geminiKey.trim()}>
              {keySaving ? <><Loader2 size={13} className="spin" /> Đang lưu...</> : <><Save size={13} /> Lưu API Key</>}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
