import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { adminApi, billingApi } from '../api/client'
import { useToast } from '../components/Toast'
import {
  Users, Shield, BarChart3, Trash2, Ban, CheckCircle, Search, RefreshCw,
  CreditCard, DollarSign, Crown, Bot, Loader2, Zap, Wallet, Clock,
  Share2, Copy, Gift, Percent,
} from 'lucide-react'

type Tab = 'overview' | 'users' | 'payments' | 'affiliate'
const TABS: Tab[] = ['overview', 'users', 'payments', 'affiliate']

const fmtVND = (n: number) => (n ?? 0).toLocaleString('vi-VN') + '₫'
const fmtNum = (n: number) => (n ?? 0).toLocaleString('vi-VN')
function fmtBytes(b: number) {
  if (!b) return '0'
  if (b >= 1024 ** 3) return (b / 1024 ** 3).toFixed(2) + ' GB'
  if (b >= 1024 ** 2) return (b / 1024 ** 2).toFixed(1) + ' MB'
  if (b >= 1024) return (b / 1024).toFixed(0) + ' KB'
  return b + ' B'
}

const GATEWAY_LABEL: Record<string, string> = { payos: 'Banking', binance: 'USDT', manual: 'Thủ công' }

function statusBadge(s: string) {
  if (s === 'paid') return <span className="badge badge-done">Đã trả</span>
  if (s === 'pending') return <span className="badge badge-pending">Chờ</span>
  return <span className="badge badge-failed">Hủy/Lỗi</span>
}

export default function Admin() {
  const toast = useToast()
  const [params] = useSearchParams()
  const sp = params.get('s') || 'overview'
  const tab: Tab = (TABS.includes(sp as Tab) ? sp : 'overview') as Tab
  const [stats, setStats] = useState<any>(null)
  const [pool, setPool] = useState<any>(null)
  const [users, setUsers] = useState<any[]>([])
  const [payments, setPayments] = useState<any[]>([])
  const [plans, setPlans] = useState<any[]>([])
  const [affiliates, setAffiliates] = useState<any[]>([])
  const [commissions, setCommissions] = useState<any[]>([])
  const [affSearch, setAffSearch] = useState('')
  const [affResults, setAffResults] = useState<any[]>([])
  const [search, setSearch] = useState('')
  const [payFilter, setPayFilter] = useState('')
  const [loading, setLoading] = useState(false)
  const [activating, setActivating] = useState<string | null>(null)

  function loadOverview() {
    adminApi.stats().then(setStats).catch(() => {})
    adminApi.assistantPool().then(setPool).catch(() => {})
  }
  async function loadUsers(q = '') {
    setLoading(true)
    try { setUsers(await adminApi.users(q)) } finally { setLoading(false) }
  }
  async function loadPayments(f = '') {
    setLoading(true)
    try { setPayments(await adminApi.payments(f)) } finally { setLoading(false) }
  }
  function loadAffiliates() { adminApi.affiliates().then(setAffiliates).catch(() => {}) }
  function loadCommissions() { adminApi.commissions().then(setCommissions).catch(() => {}) }

  useEffect(() => {
    loadOverview()
    loadUsers()
    billingApi.plans().then(d => setPlans(d.plans || [])).catch(() => {})
  }, [])
  useEffect(() => { if (tab === 'payments') loadPayments(payFilter) }, [tab, payFilter])
  useEffect(() => { if (tab === 'affiliate') { loadAffiliates(); loadCommissions() } }, [tab])

  function copyRefLink(code: string) {
    const link = `${window.location.origin}/register?ref=${code}`
    navigator.clipboard?.writeText(link).then(() => toast('Đã chép link giới thiệu', 'success'))
  }
  async function payCommission(id: string) {
    try { await adminApi.payCommission(id); toast('Đã đánh dấu trả hoa hồng', 'success'); loadCommissions(); loadAffiliates() }
    catch { toast('Lỗi', 'error') }
  }
  async function voidCommission(id: string) {
    if (!confirm('Hủy hoa hồng này? (dùng khi khách hoàn tiền / đơn sai)')) return
    try { await adminApi.voidCommission(id); toast('Đã hủy hoa hồng', 'success'); loadCommissions(); loadAffiliates() }
    catch { toast('Lỗi', 'error') }
  }
  async function affSearchRun() {
    if (!affSearch.trim()) { setAffResults([]); return }
    try { setAffResults(await adminApi.users(affSearch.trim())) } catch { /* ignore */ }
  }
  async function setRate(id: string, rate: number) {
    try {
      await adminApi.updateUser(id, { affiliate_rate: Math.max(0, Math.min(100, rate)) })
      toast('Đã đặt % hoa hồng', 'success'); loadAffiliates(); affSearchRun()
    } catch { toast('Lỗi', 'error') }
  }

  async function patch(id: string, data: any) {
    try {
      await adminApi.updateUser(id, data)
      toast('Đã cập nhật', 'success')
      loadUsers(search)
    } catch (e: any) { toast(e.response?.data?.detail || 'Lỗi cập nhật', 'error') }
  }
  async function delUser(id: string, name: string) {
    if (!confirm(`Xóa user @${name}? Hành động này không hoàn tác.`)) return
    try {
      await adminApi.deleteUser(id)
      toast(`Đã xóa @${name}`, 'success')
      setUsers(us => us.filter(u => u.id !== id))
    } catch (e: any) { toast(e.response?.data?.detail || 'Không xóa được', 'error') }
  }
  async function activate(id: string) {
    setActivating(id)
    try {
      await adminApi.activatePayment(id)
      toast('Đã kích hoạt gói cho đơn này', 'success')
      loadPayments(payFilter); loadOverview()
    } catch (e: any) { toast(e.response?.data?.detail || 'Lỗi kích hoạt', 'error') }
    finally { setActivating(null) }
  }

  const successRate = stats?.total_videos > 0 ? Math.round((stats.done_videos / stats.total_videos) * 100) : 0

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Shield size={22} color="#a78bfa" /> Bảng điều khiển Admin
          </div>
          <div className="page-subtitle">Doanh thu · người dùng · đơn hàng · hệ thống</div>
        </div>
      </div>

      {/* ─── OVERVIEW ─── */}
      {tab === 'overview' && (
        <div>
          {!stats ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14 }}>
              {[0, 1, 2, 3].map(i => <div key={i} style={{ height: 104, borderRadius: 16, background: 'rgba(255,255,255,0.03)', animation: 'shimmer 1.6s infinite' }} />)}
            </div>
          ) : (
            <>
              {/* Headline cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 14 }}>
                <BigCard icon={DollarSign} grad="linear-gradient(135deg,#F97316,#EC4899)" label="Doanh thu tổng" value={fmtVND(stats.revenue_total)} sub={`${stats.paid_orders} đơn đã trả`} />
                <BigCard icon={Wallet} grad="linear-gradient(135deg,#10b981,#22d3ee)" label="Doanh thu tháng này" value={fmtVND(stats.revenue_month)} sub={stats.pending_orders > 0 ? `${stats.pending_orders} đơn đang chờ` : 'Không có đơn chờ'} />
                <BigCard icon={Crown} grad="linear-gradient(135deg,#8B5CF6,#3B82F6)" label="Gói đang hoạt động" value={fmtNum(stats.active_subs)} sub={`${stats.google_users} tài khoản Google`} />
                <BigCard icon={Users} grad="linear-gradient(135deg,#f472b6,#a855f7)" label="Người dùng" value={fmtNum(stats.total_users)} sub={`${stats.active_users} active · ${stats.banned_users} bị khóa`} />
              </div>

              {/* Secondary row */}
              <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: 14, marginBottom: 14 }}>
                {/* Plan breakdown */}
                <div className="card">
                  <div className="card-header"><Zap size={15} /> Gói đang chạy theo loại</div>
                  {plans.length === 0 ? <div style={{ color: 'var(--text3)', fontSize: 13 }}>—</div> : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 4 }}>
                      {plans.map((p: any) => {
                        const cnt = stats.plan_breakdown?.[p.id] || 0
                        const max = Math.max(1, ...Object.values(stats.plan_breakdown || { x: 1 }).map(Number))
                        return (
                          <div key={p.id}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, marginBottom: 4 }}>
                              <span style={{ color: 'var(--text2)' }}>{p.label}</span>
                              <span style={{ fontWeight: 700, color: 'var(--text)' }}>{cnt}</span>
                            </div>
                            <div style={{ height: 7, borderRadius: 99, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                              <div style={{ height: '100%', width: `${(cnt / max) * 100}%`, borderRadius: 99, background: 'linear-gradient(90deg,#F97316,#EC4899,#A855F7)' }} />
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>

                {/* Assistant pool */}
                <div className="card">
                  <div className="card-header"><Bot size={15} /> Kho trợ lí AI</div>
                  {pool ? (
                    <>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 6 }}>
                        <span style={{ fontSize: 30, fontWeight: 900, color: '#fbbf24', letterSpacing: '-0.02em' }}>{pool.gifted}</span>
                        <span style={{ fontSize: 13, color: 'var(--text3)' }}>/ {pool.pool_total} đã tặng</span>
                      </div>
                      <div style={{ height: 7, borderRadius: 99, background: 'rgba(255,255,255,0.06)', overflow: 'hidden', marginBottom: 8 }}>
                        <div style={{ height: '100%', width: `${pool.pool_total ? (pool.gifted / pool.pool_total) * 100 : 0}%`, borderRadius: 99, background: 'linear-gradient(90deg,#fbbf24,#f59e0b)' }} />
                      </div>
                      <div style={{ fontSize: 12.5, color: 'var(--text3)' }}>{pool.recipients} người đã nhận quà</div>
                    </>
                  ) : <div style={{ color: 'var(--text3)', fontSize: 13 }}>—</div>}
                </div>
              </div>

              {/* Video stats */}
              <div className="card">
                <div className="card-header"><BarChart3 size={15} /> Sản xuất video</div>
                <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', marginBottom: 12 }}>
                  <Mini label="Tổng video" value={fmtNum(stats.total_videos)} />
                  <Mini label="Thành công" value={fmtNum(stats.done_videos)} color="var(--green)" />
                  <Mini label="Thất bại" value={fmtNum(stats.failed_videos)} color="#f87171" />
                  <Mini label="Dự án" value={fmtNum(stats.total_projects)} />
                  <Mini label="Cảnh" value={fmtNum(stats.total_scenes)} />
                </div>
                <div style={{ fontSize: 12.5, color: 'var(--text2)', marginBottom: 6 }}>{successRate}% video render thành công</div>
                <div className="progress-bar" style={{ height: 6 }}>
                  <div className="progress-fill" style={{ width: `${successRate}%` }} />
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ─── USERS ─── */}
      {tab === 'users' && (
        <div className="card">
          <div style={{ display: 'flex', gap: 12, marginBottom: 16, alignItems: 'center' }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)' }} />
              <input className="form-input" style={{ paddingLeft: 36 }} placeholder="Tìm theo username / email..."
                value={search} onChange={e => setSearch(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && loadUsers(search)} />
            </div>
            <button className="btn btn-ghost btn-sm" onClick={() => loadUsers(search)}><RefreshCw size={13} /> Làm mới</button>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  {['Người dùng', 'Trạng thái', 'Google', 'Gói', 'Storage', 'Đã tạo', 'Tạo', 'Thao tác'].map(h => (
                    <th key={h} style={{ padding: '8px 12px', textAlign: 'left', color: 'var(--text3)', fontWeight: 500, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={8} style={{ textAlign: 'center', padding: 40, color: 'var(--text3)' }}>Đang tải...</td></tr>
                ) : users.map(u => (
                  <tr key={u.id} style={{ borderBottom: '1px solid var(--border)' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg3)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                    <td style={{ padding: '10px 12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 30, height: 30, borderRadius: '50%', flexShrink: 0, background: 'linear-gradient(135deg,#7c5cfc,#f472b6)', display: 'grid', placeItems: 'center', fontSize: 12, fontWeight: 700, color: '#fff' }}>
                          {u.username[0].toUpperCase()}
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 5 }}>
                            {u.username}{u.is_admin && <Crown size={11} color="#fbbf24" />}
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--text3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 180 }}>{u.email}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      {u.is_banned ? <span className="badge badge-failed">Khóa</span>
                        : u.is_active ? <span className="badge badge-done">Active</span>
                        : <span className="badge badge-pending">Inactive</span>}
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      {u.google_connected ? <span className="badge badge-done">Ultra ✓</span>
                        : u.has_gemini_key ? <span className="badge badge-processing">Gemini</span>
                        : <span style={{ color: 'var(--text3)', fontSize: 11 }}>—</span>}
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        {u.plan_active
                          ? <span className="badge badge-done" title={u.plan_expires_at ? `Hết hạn ${String(u.plan_expires_at).slice(0, 10)}` : ''}>{u.plan}</span>
                          : <span style={{ color: 'var(--text3)', fontSize: 11 }}>{u.plan || 'free'}</span>}
                        <select defaultValue="" title="Nâng / hạ / hủy gói (đặt trực tiếp)"
                          onChange={e => { const v = e.target.value; if (v) { patch(u.id, { set_plan: v }); e.currentTarget.value = '' } }}
                          style={{ fontSize: 11, padding: '2px 4px', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 5, color: 'var(--text2)' }}>
                          <option value="">Đổi gói</option>
                          {plans.map((p: any) => <option key={p.id} value={p.id}>→ {p.label} ({p.days}d)</option>)}
                          <option value="free">✕ Hủy gói (free)</option>
                        </select>
                      </div>
                    </td>
                    <td style={{ padding: '10px 12px', color: 'var(--text2)', fontVariantNumeric: 'tabular-nums' }}>
                      {fmtBytes(u.storage_bytes)}
                    </td>
                    <td style={{ padding: '10px 12px', color: 'var(--text2)', whiteSpace: 'nowrap' }}>
                      <span style={{ color: 'var(--text)' }}>{u.clips}</span> clip
                      <span style={{ color: 'var(--text3)' }}> · </span>
                      <span style={{ color: 'var(--text)' }}>{u.images}</span> ảnh
                    </td>
                    <td style={{ padding: '10px 12px', color: 'var(--text3)', fontSize: 11 }}>{new Date(u.created_at).toLocaleDateString('vi-VN')}</td>
                    <td style={{ padding: '10px 12px' }}>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button className="btn btn-ghost btn-sm btn-icon" title={u.is_banned ? 'Mở khóa' : 'Khóa'}
                          onClick={() => patch(u.id, { is_banned: !u.is_banned })}>
                          <Ban size={12} color={u.is_banned ? 'var(--green)' : 'var(--red)'} />
                        </button>
                        <button className="btn btn-danger btn-sm btn-icon" title="Xóa user" onClick={() => delUser(u.id, u.username)}>
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {!loading && users.length === 0 && (
                  <tr><td colSpan={8} style={{ textAlign: 'center', padding: 40, color: 'var(--text3)' }}>Không có người dùng</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ─── PAYMENTS ─── */}
      {tab === 'payments' && (
        <div className="card">
          <div style={{ display: 'flex', gap: 8, marginBottom: 16, alignItems: 'center', flexWrap: 'wrap' }}>
            {([['', 'Tất cả'], ['pending', 'Chờ thanh toán'], ['paid', 'Đã trả'], ['failed', 'Hủy/Lỗi']] as const).map(([v, l]) => (
              <button key={v} onClick={() => setPayFilter(v)} style={{
                padding: '6px 13px', borderRadius: 8, fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                background: payFilter === v ? 'rgba(168,85,247,0.15)' : 'rgba(255,255,255,0.04)',
                color: payFilter === v ? '#c4b5fd' : 'var(--text3)',
                border: `1px solid ${payFilter === v ? 'rgba(168,85,247,0.3)' : 'transparent'}`,
              }}>{l}</button>
            ))}
            <button className="btn btn-ghost btn-sm" style={{ marginLeft: 'auto' }} onClick={() => loadPayments(payFilter)}>
              <RefreshCw size={13} /> Làm mới
            </button>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  {['Người dùng', 'Gói', 'Số tiền', 'Cổng', 'Trạng thái', 'Tạo lúc', 'Trả lúc', ''].map(h => (
                    <th key={h} style={{ padding: '8px 12px', textAlign: 'left', color: 'var(--text3)', fontWeight: 500, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={8} style={{ textAlign: 'center', padding: 40, color: 'var(--text3)' }}>Đang tải...</td></tr>
                ) : payments.map(p => (
                  <tr key={p.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '10px 12px' }}>
                      <div style={{ fontWeight: 600 }}>{p.username || '—'}</div>
                      <div style={{ fontSize: 11, color: 'var(--text3)' }}>{p.email}</div>
                    </td>
                    <td style={{ padding: '10px 12px', color: 'var(--text2)' }}>{p.plan_label}</td>
                    <td style={{ padding: '10px 12px', fontWeight: 700, color: 'var(--text)' }}>{fmtVND(p.amount)}</td>
                    <td style={{ padding: '10px 12px', color: 'var(--text2)' }}>{GATEWAY_LABEL[p.gateway] || '—'}</td>
                    <td style={{ padding: '10px 12px' }}>{statusBadge(p.status)}</td>
                    <td style={{ padding: '10px 12px', color: 'var(--text3)', fontSize: 11 }}>{p.created_at ? new Date(p.created_at).toLocaleString('vi-VN') : '—'}</td>
                    <td style={{ padding: '10px 12px', color: 'var(--text3)', fontSize: 11 }}>{p.paid_at ? new Date(p.paid_at).toLocaleString('vi-VN') : '—'}</td>
                    <td style={{ padding: '10px 12px' }}>
                      {p.status !== 'paid' && (
                        <button className="btn btn-primary btn-sm" disabled={activating === p.id} onClick={() => activate(p.id)}>
                          {activating === p.id ? <Loader2 size={12} className="spin" /> : <CheckCircle size={12} />} Kích hoạt
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {!loading && payments.length === 0 && (
                  <tr><td colSpan={8} style={{ textAlign: 'center', padding: 40, color: 'var(--text3)' }}>
                    <Clock size={22} style={{ opacity: 0.4, marginBottom: 6 }} /><div>Chưa có đơn hàng nào</div>
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ─── AFFILIATE ─── */}
      {tab === 'affiliate' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Set % for a chosen user */}
          <div className="card">
            <div className="card-header"><Percent size={15} /> Đặt % hoa hồng cho người được chọn</div>
            <div style={{ fontSize: 12.5, color: 'var(--text3)', marginBottom: 14 }}>
              Mọi user đều là affiliate, mặc định <b style={{ color: 'var(--text2)' }}>10%</b>. Tìm user để đặt mức riêng (đặt <b>0%</b> = không trả hoa hồng). Mỗi user có sẵn link giới thiệu.
            </div>
            <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
              <div style={{ position: 'relative', flex: 1 }}>
                <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)' }} />
                <input className="form-input" style={{ paddingLeft: 36 }} placeholder="Tìm user theo username / email để đặt %..."
                  value={affSearch} onChange={e => setAffSearch(e.target.value)} onKeyDown={e => e.key === 'Enter' && affSearchRun()} />
              </div>
              <button className="btn btn-primary btn-sm" onClick={affSearchRun}><Search size={13} /> Tìm</button>
            </div>
            {affResults.length > 0 && (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <tbody>
                    {affResults.map(u => (
                      <tr key={u.id} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '9px 12px' }}>
                          <div style={{ fontWeight: 600 }}>{u.username}</div>
                          <div style={{ fontSize: 11, color: 'var(--text3)' }}>{u.email}</div>
                        </td>
                        <td style={{ padding: '9px 12px' }}>
                          <button className="btn btn-ghost btn-sm" onClick={() => copyRefLink(u.referral_code)} title="Sao chép link giới thiệu">
                            <Copy size={12} /> {u.referral_code || '—'}
                          </button>
                        </td>
                        <td style={{ padding: '9px 12px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <Percent size={11} color="var(--text3)" />
                            <input type="number" defaultValue={u.affiliate_rate ?? 10} min={0} max={100}
                              onBlur={e => { const v = +e.target.value; if (v !== (u.affiliate_rate ?? 10)) setRate(u.id, v) }}
                              style={{ width: 56, padding: '3px 6px', background: 'var(--bg3)', border: '1px solid var(--accent)', borderRadius: 6, color: 'var(--text)', fontSize: 12.5 }} />
                            <span style={{ fontSize: 11, color: 'var(--text3)' }}>% (Enter/blur để lưu)</span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Active affiliates */}
          <div className="card">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div className="card-header" style={{ marginBottom: 0 }}><Share2 size={15} /> Affiliate đang hoạt động</div>
              <button className="btn btn-ghost btn-sm" onClick={loadAffiliates}><RefreshCw size={13} /> Làm mới</button>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)' }}>
                    {['Affiliate', 'Link giới thiệu', 'Đã giới thiệu', 'Hoa hồng (%)', 'Đã trả', 'Còn nợ'].map(h => (
                      <th key={h} style={{ padding: '8px 12px', textAlign: 'left', color: 'var(--text3)', fontWeight: 500, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {affiliates.map(a => (
                    <tr key={a.id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '10px 12px' }}>
                        <div style={{ fontWeight: 600 }}>{a.username}</div>
                        <div style={{ fontSize: 11, color: 'var(--text3)' }}>{a.email}</div>
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        <button className="btn btn-ghost btn-sm" onClick={() => copyRefLink(a.referral_code)} title="Sao chép link giới thiệu">
                          <Copy size={12} /> {a.referral_code}
                        </button>
                      </td>
                      <td style={{ padding: '10px 12px', color: 'var(--text2)' }}>{a.referrals}</td>
                      <td style={{ padding: '10px 12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <Percent size={11} color="var(--text3)" />
                          <input type="number" defaultValue={a.rate} min={0} max={100}
                            onBlur={e => { const v = +e.target.value; if (v !== a.rate) setRate(a.id, v) }}
                            style={{ width: 52, padding: '2px 6px', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 5, color: 'var(--text)', fontSize: 12 }} />
                        </div>
                      </td>
                      <td style={{ padding: '10px 12px', color: 'var(--green)', fontWeight: 600 }}>{fmtVND(a.earned)}</td>
                      <td style={{ padding: '10px 12px', color: a.pending > 0 ? '#fbbf24' : 'var(--text3)', fontWeight: 600 }}>{fmtVND(a.pending)}</td>
                    </tr>
                  ))}
                  {affiliates.length === 0 && (
                    <tr><td colSpan={6} style={{ textAlign: 'center', padding: 36, color: 'var(--text3)' }}>
                      <Gift size={22} style={{ opacity: 0.4, marginBottom: 6 }} /><div>Chưa có ai giới thiệu hay được đặt % riêng</div>
                    </td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Commissions */}
          <div className="card">
            <div className="card-header"><DollarSign size={15} /> Hoa hồng</div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)' }}>
                    {['Affiliate', 'Khách đã mua', 'Hoa hồng', '%', 'Trạng thái', 'Ngày', ''].map(h => (
                      <th key={h} style={{ padding: '8px 12px', textAlign: 'left', color: 'var(--text3)', fontWeight: 500, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {commissions.map(c => (
                    <tr key={c.id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '10px 12px', fontWeight: 600 }}>{c.affiliate || '—'}</td>
                      <td style={{ padding: '10px 12px', color: 'var(--text2)' }}>{c.referred_user}</td>
                      <td style={{ padding: '10px 12px', fontWeight: 700 }}>{fmtVND(c.amount)}</td>
                      <td style={{ padding: '10px 12px', color: 'var(--text3)' }}>{c.rate}%</td>
                      <td style={{ padding: '10px 12px' }}>
                        {c.status === 'paid' ? <span className="badge badge-done">Đã trả</span> : <span className="badge badge-pending">Chờ trả</span>}
                      </td>
                      <td style={{ padding: '10px 12px', color: 'var(--text3)', fontSize: 11 }}>{c.created_at ? new Date(c.created_at).toLocaleDateString('vi-VN') : '—'}</td>
                      <td style={{ padding: '10px 12px' }}>
                        <div style={{ display: 'flex', gap: 4 }}>
                          {c.status !== 'paid' && (
                            <button className="btn btn-primary btn-sm" onClick={() => payCommission(c.id)}>
                              <CheckCircle size={12} /> Đã trả
                            </button>
                          )}
                          <button className="btn btn-ghost btn-sm btn-icon" title="Hủy hoa hồng" onClick={() => voidCommission(c.id)}>
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {commissions.length === 0 && (
                    <tr><td colSpan={7} style={{ textAlign: 'center', padding: 36, color: 'var(--text3)' }}>Chưa có hoa hồng nào</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function BigCard({ icon: Icon, grad, label, value, sub }: { icon: any; grad: string; label: string; value: string; sub?: string }) {
  return (
    <div style={{
      position: 'relative', borderRadius: 16, padding: '18px 18px 16px', overflow: 'hidden',
      background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)',
    }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: grad }} />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
        <div style={{ width: 34, height: 34, borderRadius: 10, background: grad, display: 'grid', placeItems: 'center' }}>
          <Icon size={17} color="#fff" />
        </div>
      </div>
      <div style={{ fontSize: 22, fontWeight: 900, letterSpacing: '-0.02em', color: 'var(--text)', lineHeight: 1.1 }}>{value}</div>
      <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 3 }}>{label}</div>
      {sub && <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>{sub}</div>}
    </div>
  )
}

function Mini({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div>
      <div style={{ fontSize: 20, fontWeight: 800, color: color || 'var(--text)' }}>{value}</div>
      <div style={{ fontSize: 11.5, color: 'var(--text3)' }}>{label}</div>
    </div>
  )
}
