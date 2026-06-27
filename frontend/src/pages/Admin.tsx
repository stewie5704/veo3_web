import { useState, useEffect } from 'react'
import { adminApi, billingApi } from '../api/client'
import { useToast } from '../components/Toast'
import {
  Users, Shield, BarChart3, Trash2, Ban, CheckCircle, Search, RefreshCw,
  CreditCard, DollarSign, Crown, Bot, Loader2, ShieldCheck, Zap, Wallet, Clock,
} from 'lucide-react'

type Tab = 'overview' | 'users' | 'payments'

const fmtVND = (n: number) => (n ?? 0).toLocaleString('vi-VN') + '₫'
const fmtNum = (n: number) => (n ?? 0).toLocaleString('vi-VN')

const GATEWAY_LABEL: Record<string, string> = { payos: 'Banking', binance: 'USDT', manual: 'Thủ công' }

function statusBadge(s: string) {
  if (s === 'paid') return <span className="badge badge-done">Đã trả</span>
  if (s === 'pending') return <span className="badge badge-pending">Chờ</span>
  return <span className="badge badge-failed">Hủy/Lỗi</span>
}

export default function Admin() {
  const toast = useToast()
  const [tab, setTab] = useState<Tab>('overview')
  const [stats, setStats] = useState<any>(null)
  const [pool, setPool] = useState<any>(null)
  const [users, setUsers] = useState<any[]>([])
  const [payments, setPayments] = useState<any[]>([])
  const [plans, setPlans] = useState<any[]>([])
  const [search, setSearch] = useState('')
  const [payFilter, setPayFilter] = useState('')
  const [loading, setLoading] = useState(false)
  const [editing, setEditing] = useState<string | null>(null)
  const [editQuota, setEditQuota] = useState(100)
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

  useEffect(() => {
    loadOverview()
    loadUsers()
    billingApi.plans().then(d => setPlans(d.plans || [])).catch(() => {})
  }, [])
  useEffect(() => { if (tab === 'payments') loadPayments(payFilter) }, [tab, payFilter])

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

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 24 }}>
        {([
          { k: 'overview', l: 'Tổng quan', i: BarChart3 },
          { k: 'users', l: 'Người dùng', i: Users },
          { k: 'payments', l: 'Đơn hàng', i: CreditCard },
        ] as const).map(t => {
          const Icon = t.i
          const on = tab === t.k
          return (
            <button key={t.k} onClick={() => setTab(t.k)} style={{
              display: 'flex', alignItems: 'center', gap: 7, padding: '8px 16px', borderRadius: 9,
              border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600, transition: 'all .15s',
              background: on ? 'rgba(168,85,247,0.15)' : 'rgba(255,255,255,0.04)',
              color: on ? '#c4b5fd' : 'var(--text3)',
              outline: on ? '1px solid rgba(168,85,247,0.3)' : '1px solid transparent', fontFamily: 'inherit',
            }}>
              <Icon size={14} /> {t.l}
            </button>
          )
        })}
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
                  {['Người dùng', 'Trạng thái', 'Google', 'Gói', 'Quota', 'Videos', 'Tạo', 'Thao tác'].map(h => (
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
                        <select defaultValue="" title="Cấp / gia hạn gói"
                          onChange={e => { if (e.target.value) { patch(u.id, { grant_plan: e.target.value }); e.currentTarget.value = '' } }}
                          style={{ fontSize: 11, padding: '2px 4px', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 5, color: 'var(--text2)' }}>
                          <option value="">+ Cấp</option>
                          {plans.map((p: any) => <option key={p.id} value={p.id}>{p.label} · {p.days}d</option>)}
                        </select>
                      </div>
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      {editing === u.id ? (
                        <div style={{ display: 'flex', gap: 4 }}>
                          <input type="number" value={editQuota} onChange={e => setEditQuota(+e.target.value)}
                            style={{ width: 64, padding: '2px 6px', background: 'var(--bg3)', border: '1px solid var(--accent)', borderRadius: 5, color: 'var(--text)', fontSize: 12 }} />
                          <button className="btn btn-primary btn-sm" onClick={() => { patch(u.id, { quota_videos: editQuota }); setEditing(null) }}>✓</button>
                          <button className="btn btn-ghost btn-sm" onClick={() => setEditing(null)}>✕</button>
                        </div>
                      ) : (
                        <span style={{ cursor: 'pointer', color: 'var(--accent2)' }} onClick={() => { setEditing(u.id); setEditQuota(u.quota_videos) }}>
                          {u.quota_videos === -1 ? '∞' : u.quota_videos}
                        </span>
                      )}
                    </td>
                    <td style={{ padding: '10px 12px', color: 'var(--text2)' }}>{u.videos_generated}</td>
                    <td style={{ padding: '10px 12px', color: 'var(--text3)', fontSize: 11 }}>{new Date(u.created_at).toLocaleDateString('vi-VN')}</td>
                    <td style={{ padding: '10px 12px' }}>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button className="btn btn-ghost btn-sm btn-icon" title={u.is_admin ? 'Gỡ quyền admin' : 'Cấp quyền admin'}
                          onClick={() => patch(u.id, { is_admin: !u.is_admin })}>
                          <ShieldCheck size={12} color={u.is_admin ? '#fbbf24' : 'var(--text3)'} />
                        </button>
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
