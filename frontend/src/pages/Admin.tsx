import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { adminApi, billingApi } from '../api/client'
import { useToast } from '../components/Toast'
import { useT } from '../i18n'
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

function statusBadge(s: string, t: (key: string) => string) {
  if (s === 'paid') return <span className="badge badge-done">{t('admin.status_paid')}</span>
  if (s === 'pending') return <span className="badge badge-pending">{t('admin.status_pending')}</span>
  return <span className="badge badge-failed">{t('admin.status_cancelled')}</span>
}

export default function Admin() {
  const toast = useToast()
  const t = useT()
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
  const [withdrawals, setWithdrawals] = useState<any[]>([])
  const [affSearch, setAffSearch] = useState('')
  const [affResults, setAffResults] = useState<any[]>([])
  const [search, setSearch] = useState('')
  const [payFilter, setPayFilter] = useState('')
  const [loading, setLoading] = useState(false)
  const [activating, setActivating] = useState<string | null>(null)

  const GATEWAY_LABEL: Record<string, string> = { payos: 'Banking', binance: 'USDT', manual: t('admin.gateway_manual') }

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
  function loadWithdrawals() { adminApi.withdrawals('pending').then(setWithdrawals).catch(() => {}) }

  useEffect(() => {
    loadOverview()
    loadUsers()
    billingApi.plans().then(d => setPlans(d.plans || [])).catch(() => {})
  }, [])
  useEffect(() => { if (tab === 'payments') loadPayments(payFilter) }, [tab, payFilter])
  useEffect(() => { if (tab === 'affiliate') { loadAffiliates(); loadCommissions(); loadWithdrawals() } }, [tab])

  function copyRefLink(code: string) {
    const link = `${window.location.origin}/register?ref=${code}`
    navigator.clipboard?.writeText(link).then(() => toast(t('admin.copied_ref_link'), 'success'))
  }
  async function voidCommission(id: string) {
    if (!confirm(t('admin.confirm_void_commission'))) return
    try { await adminApi.voidCommission(id); toast(t('admin.commission_voided'), 'success'); loadCommissions(); loadAffiliates() }
    catch { toast(t('common.error'), 'error') }
  }
  async function affSearchRun() {
    if (!affSearch.trim()) { setAffResults([]); return }
    try { setAffResults(await adminApi.users(affSearch.trim())) } catch { /* ignore */ }
  }
  async function setRate(id: string, rate: number) {
    try {
      await adminApi.updateUser(id, { affiliate_rate: Math.max(0, Math.min(100, rate)) })
      toast(t('admin.rate_set'), 'success'); loadAffiliates(); affSearchRun()
    } catch { toast(t('common.error'), 'error') }
  }
  async function setBuyerRate(id: string, rate: number) {
    try {
      await adminApi.updateUser(id, { buyer_discount_rate: Math.max(0, Math.min(100, rate)) })
      toast(t('admin.discount_rate_set'), 'success'); loadAffiliates(); affSearchRun()
    } catch { toast(t('common.error'), 'error') }
  }
  async function approveW(id: string) {
    try { await adminApi.approveWithdrawal(id); toast(t('admin.withdrawal_approved'), 'success'); loadWithdrawals() }
    catch { toast(t('common.error'), 'error') }
  }
  async function rejectW(id: string) {
    if (!confirm(t('admin.confirm_reject_withdrawal'))) return
    try { await adminApi.rejectWithdrawal(id); toast(t('admin.withdrawal_rejected'), 'info'); loadWithdrawals() }
    catch { toast(t('common.error'), 'error') }
  }

  async function patch(id: string, data: any) {
    try {
      await adminApi.updateUser(id, data)
      toast(t('admin.updated'), 'success')
      loadUsers(search)
    } catch (e: any) { toast(e.response?.data?.detail || t('admin.update_error'), 'error') }
  }
  async function delUser(id: string, name: string) {
    if (!confirm(t('admin.confirm_delete_user', { name }))) return
    try {
      await adminApi.deleteUser(id)
      toast(t('admin.user_deleted', { name }), 'success')
      setUsers(us => us.filter(u => u.id !== id))
    } catch (e: any) { toast(e.response?.data?.detail || t('admin.delete_failed'), 'error') }
  }
  async function activate(id: string) {
    setActivating(id)
    try {
      await adminApi.activatePayment(id)
      toast(t('admin.payment_activated'), 'success')
      loadPayments(payFilter); loadOverview()
    } catch (e: any) { toast(e.response?.data?.detail || t('admin.activation_error'), 'error') }
    finally { setActivating(null) }
  }

  const successRate = stats?.total_videos > 0 ? Math.round((stats.done_videos / stats.total_videos) * 100) : 0

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Shield size={22} color="#a78bfa" /> {t('admin.title')}
          </div>
          <div className="page-subtitle">{t('admin.subtitle')}</div>
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
                <BigCard icon={DollarSign} grad="linear-gradient(135deg,#F97316,#EC4899)" label={t('admin.total_revenue')} value={fmtVND(stats.revenue_total)} sub={t('admin.paid_orders', { count: String(stats.paid_orders) })} />
                <BigCard icon={Wallet} grad="linear-gradient(135deg,#10b981,#22d3ee)" label={t('admin.month_revenue')} value={fmtVND(stats.revenue_month)} sub={stats.pending_orders > 0 ? t('admin.pending_orders', { count: String(stats.pending_orders) }) : t('admin.no_pending_orders')} />
                <BigCard icon={Crown} grad="linear-gradient(135deg,#8B5CF6,#3B82F6)" label={t('admin.active_subs')} value={fmtNum(stats.active_subs)} sub={t('admin.google_accounts', { count: String(stats.google_users) })} />
                <BigCard icon={Users} grad="linear-gradient(135deg,#f472b6,#a855f7)" label={t('admin.users_label')} value={fmtNum(stats.total_users)} sub={t('admin.users_detail', { active: String(stats.active_users), banned: String(stats.banned_users) })} />
              </div>

              {/* Secondary row */}
              <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: 14, marginBottom: 14 }}>
                {/* Plan breakdown */}
                <div className="card">
                  <div className="card-header"><Zap size={15} /> {t('admin.plans_by_type')}</div>
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
                  <div className="card-header"><Bot size={15} /> {t('admin.assistant_pool')}</div>
                  {pool ? (
                    <>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 6 }}>
                        <span style={{ fontSize: 30, fontWeight: 900, color: '#fbbf24', letterSpacing: '-0.02em' }}>{pool.gifted}</span>
                        <span style={{ fontSize: 13, color: 'var(--text3)' }}>{t('admin.assistants_distributed')}</span>
                      </div>
                      <div style={{ fontSize: 12.5, color: 'var(--text3)' }}>{t('admin.pool_info', { recipients: String(pool.recipients), total: String(pool.pool_total) })}</div>
                    </>
                  ) : <div style={{ color: 'var(--text3)', fontSize: 13 }}>—</div>}
                </div>
              </div>

              {/* Video stats */}
              <div className="card">
                <div className="card-header"><BarChart3 size={15} /> {t('admin.video_production')}</div>
                <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', marginBottom: 12 }}>
                  <Mini label={t('admin.total_videos')} value={fmtNum(stats.total_videos)} />
                  <Mini label={t('admin.success_videos')} value={fmtNum(stats.done_videos)} color="var(--green)" />
                  <Mini label={t('admin.failed_videos')} value={fmtNum(stats.failed_videos)} color="#f87171" />
                  <Mini label={t('admin.projects')} value={fmtNum(stats.total_projects)} />
                  <Mini label={t('admin.scenes')} value={fmtNum(stats.total_scenes)} />
                </div>
                <div style={{ fontSize: 12.5, color: 'var(--text2)', marginBottom: 6 }}>{t('admin.success_rate', { rate: String(successRate) })}</div>
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
              <input className="form-input" style={{ paddingLeft: 36 }} placeholder={t('admin.search_users_placeholder')}
                value={search} onChange={e => setSearch(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && loadUsers(search)} />
            </div>
            <button className="btn btn-ghost btn-sm" onClick={() => loadUsers(search)}><RefreshCw size={13} /> {t('admin.refresh')}</button>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  {[t('admin.th_user'), t('admin.th_status'), 'Google', t('admin.th_plan'), 'Storage', t('admin.th_created_content'), t('admin.th_created_at'), t('admin.th_actions')].map(h => (
                    <th key={h} style={{ padding: '8px 12px', textAlign: 'left', color: 'var(--text3)', fontWeight: 500, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={8} style={{ textAlign: 'center', padding: 40, color: 'var(--text3)' }}>{t('admin.loading')}</td></tr>
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
                      {u.is_banned ? <span className="badge badge-failed">{t('admin.banned')}</span>
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
                          ? <span className="badge badge-done" title={u.plan_expires_at ? t('admin.expires_at', { date: String(u.plan_expires_at).slice(0, 10) }) : ''}>{u.plan}</span>
                          : <span style={{ color: 'var(--text3)', fontSize: 11 }}>{u.plan || 'free'}</span>}
                        <select defaultValue="" title={t('admin.change_plan_tooltip')}
                          onChange={e => { const v = e.target.value; if (v) { patch(u.id, { set_plan: v }); e.currentTarget.value = '' } }}
                          style={{
                            fontSize: 11, padding: '3px 20px 3px 6px', minWidth: 72, maxWidth: 120,
                            background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 6,
                            color: 'var(--text2)', cursor: 'pointer',
                            appearance: 'none', WebkitAppearance: 'none',
                            backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' fill='none'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%239b93ad' stroke-width='1.3' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`,
                            backgroundRepeat: 'no-repeat', backgroundPosition: 'right 5px center',
                          }}>
                          <option value="">{t('admin.change_plan')}</option>
                          {plans.map((p: any) => <option key={p.id} value={p.id}>{p.label}</option>)}
                          <option value="free">{t('admin.cancel_plan')}</option>
                        </select>
                      </div>
                    </td>
                    <td style={{ padding: '10px 12px', color: 'var(--text2)', fontVariantNumeric: 'tabular-nums' }}>
                      <div>{fmtBytes(u.storage_bytes)}</div>
                      <div style={{ marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }} title={t('admin.extra_storage_tooltip')}>
                        <span style={{ fontSize: 11, color: 'var(--text3)' }}>+GB:</span>
                        <input
                          type="number" min={0} defaultValue={u.extra_storage_gb || 0}
                          style={{ width: 40, fontSize: 11, padding: '2px 4px', background: 'var(--bg3)', border: '1px solid var(--border)', color: 'var(--text)', borderRadius: 4 }}
                          onBlur={e => {
                            const val = parseInt(e.target.value) || 0;
                            if (val !== (u.extra_storage_gb || 0)) {
                              patch(u.id, { extra_storage_gb: val });
                            }
                          }}
                        />
                      </div>
                    </td>
                    <td style={{ padding: '10px 12px', color: 'var(--text2)', whiteSpace: 'nowrap' }}>
                      <span style={{ color: 'var(--text)' }}>{u.clips}</span> clip
                      <span style={{ color: 'var(--text3)' }}> · </span>
                      <span style={{ color: 'var(--text)' }}>{u.images}</span> {t('admin.images')}
                    </td>
                    <td style={{ padding: '10px 12px', color: 'var(--text3)', fontSize: 11 }}>{new Date(u.created_at).toLocaleDateString('vi-VN')}</td>
                    <td style={{ padding: '10px 12px' }}>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button className="btn btn-ghost btn-sm btn-icon" title={u.is_banned ? t('admin.unban') : t('admin.ban')}
                          onClick={() => patch(u.id, { is_banned: !u.is_banned })}>
                          <Ban size={12} color={u.is_banned ? 'var(--green)' : 'var(--red)'} />
                        </button>
                        <button className="btn btn-danger btn-sm btn-icon" title={t('admin.delete_user')} onClick={() => delUser(u.id, u.username)}>
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {!loading && users.length === 0 && (
                  <tr><td colSpan={8} style={{ textAlign: 'center', padding: 40, color: 'var(--text3)' }}>{t('admin.no_users')}</td></tr>
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
            {([['', t('admin.filter_all')], ['pending', t('admin.filter_pending')], ['paid', t('admin.filter_paid')], ['failed', t('admin.filter_failed')]] as const).map(([v, l]) => (
              <button key={v} onClick={() => setPayFilter(v)} style={{
                padding: '6px 13px', borderRadius: 8, fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                background: payFilter === v ? 'rgba(168,85,247,0.15)' : 'rgba(255,255,255,0.04)',
                color: payFilter === v ? '#c4b5fd' : 'var(--text3)',
                border: `1px solid ${payFilter === v ? 'rgba(168,85,247,0.3)' : 'transparent'}`,
              }}>{l}</button>
            ))}
            <button className="btn btn-ghost btn-sm" style={{ marginLeft: 'auto' }} onClick={() => loadPayments(payFilter)}>
              <RefreshCw size={13} /> {t('admin.refresh')}
            </button>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  {[t('admin.th_user'), t('admin.th_plan'), t('admin.th_amount'), t('admin.th_gateway'), t('admin.th_status'), t('admin.th_created_time'), t('admin.th_paid_time'), ''].map(h => (
                    <th key={h} style={{ padding: '8px 12px', textAlign: 'left', color: 'var(--text3)', fontWeight: 500, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={8} style={{ textAlign: 'center', padding: 40, color: 'var(--text3)' }}>{t('admin.loading')}</td></tr>
                ) : payments.map(p => (
                  <tr key={p.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '10px 12px' }}>
                      <div style={{ fontWeight: 600 }}>{p.username || '—'}</div>
                      <div style={{ fontSize: 11, color: 'var(--text3)' }}>{p.email}</div>
                    </td>
                    <td style={{ padding: '10px 12px', color: 'var(--text2)' }}>{p.plan_label}</td>
                    <td style={{ padding: '10px 12px', fontWeight: 700, color: 'var(--text)' }}>{fmtVND(p.amount)}</td>
                    <td style={{ padding: '10px 12px', color: 'var(--text2)' }}>{GATEWAY_LABEL[p.gateway] || '—'}</td>
                    <td style={{ padding: '10px 12px' }}>{statusBadge(p.status, t)}</td>
                    <td style={{ padding: '10px 12px', color: 'var(--text3)', fontSize: 11 }}>{p.created_at ? new Date(p.created_at).toLocaleString('vi-VN') : '—'}</td>
                    <td style={{ padding: '10px 12px', color: 'var(--text3)', fontSize: 11 }}>{p.paid_at ? new Date(p.paid_at).toLocaleString('vi-VN') : '—'}</td>
                    <td style={{ padding: '10px 12px' }}>
                      {p.status !== 'paid' && (
                        <button className="btn btn-primary btn-sm" disabled={activating === p.id} onClick={() => activate(p.id)}>
                          {activating === p.id ? <Loader2 size={12} className="spin" /> : <CheckCircle size={12} />} {t('admin.activate')}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {!loading && payments.length === 0 && (
                  <tr><td colSpan={8} style={{ textAlign: 'center', padding: 40, color: 'var(--text3)' }}>
                    <Clock size={22} style={{ opacity: 0.4, marginBottom: 6 }} /><div>{t('admin.no_orders')}</div>
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
          {/* Withdrawal requests */}
          <div className="card">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div className="card-header" style={{ marginBottom: 0 }}>
                <Wallet size={15} /> {t('admin.withdrawal_requests')} {withdrawals.length > 0 && <span style={{ color: '#fbbf24' }}>({withdrawals.length})</span>}
              </div>
              <button className="btn btn-ghost btn-sm" onClick={loadWithdrawals}><RefreshCw size={13} /> {t('admin.refresh')}</button>
            </div>
            {withdrawals.length === 0 ? (
              <div style={{ fontSize: 13, color: 'var(--text3)' }}>{t('admin.no_pending_withdrawals')}</div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <tbody>
                    {withdrawals.map(w => (
                      <tr key={w.id} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '10px 12px' }}>
                          <div style={{ fontWeight: 600 }}>{w.username || '—'}</div>
                          <div style={{ fontSize: 11, color: 'var(--text3)' }}>{w.email}</div>
                        </td>
                        <td style={{ padding: '10px 12px', fontWeight: 700 }}>{fmtVND(w.amount)}</td>
                        <td style={{ padding: '10px 12px', fontSize: 12, color: 'var(--text2)', maxWidth: 360 }}>{w.note}</td>
                        <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>
                          <div style={{ display: 'flex', gap: 4 }}>
                            <button className="btn btn-primary btn-sm" onClick={() => approveW(w.id)}><CheckCircle size={12} /> {t('admin.paid_out')}</button>
                            <button className="btn btn-ghost btn-sm" onClick={() => rejectW(w.id)}>{t('admin.reject')}</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Set % for a chosen user */}
          <div className="card">
            <div className="card-header"><Percent size={15} /> {t('admin.set_commission_rate')}</div>
            <div style={{ fontSize: 12.5, color: 'var(--text3)', marginBottom: 14 }}>
              {t('admin.commission_rate_desc')}
            </div>
            <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
              <div style={{ position: 'relative', flex: 1 }}>
                <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)' }} />
                <input className="form-input" style={{ paddingLeft: 36 }} placeholder={t('admin.search_user_for_rate')}
                  value={affSearch} onChange={e => setAffSearch(e.target.value)} onKeyDown={e => e.key === 'Enter' && affSearchRun()} />
              </div>
              <button className="btn btn-primary btn-sm" onClick={affSearchRun}><Search size={13} /> {t('admin.search')}</button>
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
                          <button className="btn btn-ghost btn-sm" onClick={() => copyRefLink(u.referral_code)} title={t('admin.copy_ref_link')}>
                            <Copy size={12} /> {u.referral_code || '—'}
                          </button>
                        </td>
                        <td style={{ padding: '9px 12px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ fontSize: 11, color: 'var(--text3)' }}>{t('admin.commission_label')}:</span>
                            <input type="number" defaultValue={u.affiliate_rate ?? 10} min={0} max={100}
                              onBlur={e => { const v = +e.target.value; if (v !== (u.affiliate_rate ?? 10)) setRate(u.id, v) }}
                              style={{ width: 56, padding: '3px 6px', background: 'var(--bg3)', border: '1px solid var(--accent)', borderRadius: 6, color: 'var(--text)', fontSize: 12.5 }} />
                            <span style={{ fontSize: 11, color: 'var(--text3)', marginLeft: 8 }}>{t('admin.buyer_discount_label')}:</span>
                            <input type="number" defaultValue={u.buyer_discount_rate ?? 0} min={0} max={100}
                              onBlur={e => { const v = +e.target.value; if (v !== (u.buyer_discount_rate ?? 0)) setBuyerRate(u.id, v) }}
                              style={{ width: 56, padding: '3px 6px', background: 'var(--bg3)', border: '1px solid var(--accent)', borderRadius: 6, color: 'var(--text)', fontSize: 12.5 }} />
                            <span style={{ fontSize: 11, color: 'var(--text3)' }}>% (Enter/blur)</span>
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
              <div className="card-header" style={{ marginBottom: 0 }}><Share2 size={15} /> {t('admin.active_affiliates')}</div>
              <button className="btn btn-ghost btn-sm" onClick={loadAffiliates}><RefreshCw size={13} /> {t('admin.refresh')}</button>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)' }}>
                    {[t('admin.th_affiliate'), t('admin.th_ref_link'), t('admin.th_referred'), t('admin.th_commission_pct'), t('admin.th_buyer_discount_pct'), t('admin.th_paid_out'), t('admin.th_balance')].map(h => (
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
                        <button className="btn btn-ghost btn-sm" onClick={() => copyRefLink(a.referral_code)} title={t('admin.copy_ref_link')}>
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
                      <td style={{ padding: '10px 12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <Percent size={11} color="var(--text3)" />
                          <input type="number" defaultValue={a.buyer_discount_rate || 0} min={0} max={100}
                            onBlur={e => { const v = +e.target.value; if (v !== (a.buyer_discount_rate || 0)) setBuyerRate(a.id, v) }}
                            style={{ width: 52, padding: '2px 6px', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 5, color: 'var(--text)', fontSize: 12 }} />
                        </div>
                      </td>
                      <td style={{ padding: '10px 12px', color: 'var(--green)', fontWeight: 600 }}>{fmtVND(a.earned)}</td>
                      <td style={{ padding: '10px 12px', color: a.pending > 0 ? '#fbbf24' : 'var(--text3)', fontWeight: 600 }}>{fmtVND(a.pending)}</td>
                    </tr>
                  ))}
                  {affiliates.length === 0 && (
                    <tr><td colSpan={7} style={{ textAlign: 'center', padding: 36, color: 'var(--text3)' }}>
                      <Gift size={22} style={{ opacity: 0.4, marginBottom: 6 }} /><div>{t('admin.no_affiliates')}</div>
                    </td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Commissions */}
          <div className="card">
            <div className="card-header"><DollarSign size={15} /> {t('admin.commissions')}</div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)' }}>
                    {[t('admin.th_affiliate'), t('admin.th_buyer'), t('admin.th_commission'), '%', t('admin.th_status'), t('admin.th_date'), ''].map(h => (
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
                        {c.status === 'paid'
                          ? <span className="badge badge-done">{t('admin.commission_paid')}</span>
                          : c.status === 'voided'
                            ? <span className="badge badge-failed">{t('admin.commission_voided')}</span>
                            : <span className="badge badge-pending">{t('admin.status_pending')}</span>}
                      </td>
                      <td style={{ padding: '10px 12px', color: 'var(--text3)', fontSize: 11 }}>{c.created_at ? new Date(c.created_at).toLocaleDateString('vi-VN') : '—'}</td>
                      <td style={{ padding: '10px 12px' }}>
                        {c.status === 'paid' && (
                          <button className="btn btn-ghost btn-sm btn-icon" title={t('admin.void_commission')} onClick={() => voidCommission(c.id)}>
                            <Trash2 size={12} />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {commissions.length === 0 && (
                    <tr><td colSpan={7} style={{ textAlign: 'center', padding: 36, color: 'var(--text3)' }}>{t('admin.no_commissions')}</td></tr>
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
