import { useEffect, useRef, useState } from 'react'
import { affiliateApi, billingApi } from '../api/client'
import { useToast } from '../components/Toast'
import { useT } from '../i18n'
import PaymentModal, { type PaymentOrder } from '../components/PaymentModal'
import {
  Share2, Copy, Wallet, TrendingUp, Gift, Sparkles, Loader2, ArrowUpRight,
  ArrowDownLeft, Plus, RefreshCw, Crown,
} from 'lucide-react'

const RANK_COLOR: Record<string, string> = {
  'Luyện Khí': '#9ca3af', 'Trúc Cơ': '#38bdf8', 'Kim Đan': '#fbbf24',
  'Nguyên Anh': '#a855f7', 'Hóa Thần': '#f472b6', 'Tùy chỉnh': '#34d399',
}
const fmtVND = (n: number) => (n ?? 0).toLocaleString('vi-VN') + '₫'

export default function Affiliate() {
  const toast = useToast()
  const t = useT()
  const [d, setD] = useState<any>(null)
  const [busy, setBusy] = useState(false)
  const [wAmount, setWAmount] = useState(1)
  const [wBank, setWBank] = useState('')
  const [showWithdraw, setShowWithdraw] = useState(false)
  const [topupAmount, setTopupAmount] = useState(200000)
  const [method, setMethod] = useState<'payos' | 'binance'>('payos')
  const [order, setOrder] = useState<PaymentOrder | null>(null)
  const [listTab, setListTab] = useState<'f1' | 'f2'>('f1')
  const copyRef = useRef<HTMLInputElement>(null)

  const KIND_LABEL: Record<string, string> = {
    commission: t('affiliate.kind_commission'), topup: t('affiliate.kind_topup'), withdraw: t('affiliate.kind_withdraw'),
    renew: t('affiliate.kind_renew'), refund: t('affiliate.kind_refund'), adjust: t('affiliate.kind_adjust'),
  }

  function load() { affiliateApi.me().then(setD).catch(() => {}) }
  useEffect(load, [])

  function copyLink() {
    if (!d?.link) return
    navigator.clipboard?.writeText(d.link).then(() => toast(t('affiliate.link_copied'), 'success'))
  }

  async function doWithdraw() {
    if (wAmount < 1) return toast(t('affiliate.withdraw_min'), 'error')
    if (!wBank.trim()) return toast(t('affiliate.enter_bank_info'), 'error')
    setBusy(true)
    try {
      const r = await affiliateApi.withdraw(wAmount, wBank.trim())
      toast(t('affiliate.withdraw_submitted', { net: fmtVND(r.net), tax: fmtVND(r.tax) }), 'success')
      setShowWithdraw(false); setWBank(''); load()
    } catch (e: any) { toast(e.response?.data?.detail || t('affiliate.withdraw_error'), 'error') }
    finally { setBusy(false) }
  }

  async function toggleAutoRenew() {
    try { const r = await affiliateApi.setAutoRenew(!d.auto_renew); setD({ ...d, auto_renew: r.auto_renew }) }
    catch { toast(t('common.error'), 'error') }
  }

  async function doTopup() {
    if (topupAmount < 10000) return toast(t('affiliate.topup_min'), 'error')
    setBusy(true)
    try {
      const r = await billingApi.topup(topupAmount, method)
      if (method === 'payos' && r.qr_code || (method === 'binance' && (r.qr_content || r.qr_url))) {
        setOrder(r as PaymentOrder)
      } else { toast(t('affiliate.topup_created'), 'info') }
    } catch (e: any) { toast(e.response?.data?.detail || t('affiliate.topup_error'), 'error') }
    finally { setBusy(false) }
  }

  if (!d) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--text2)' }}>{t('affiliate.loading')}</div>

  const rankColor = RANK_COLOR[d.rank] || '#fb923c'

  return (
    <div style={{ maxWidth: 920, margin: '0 auto' }}>
      <div className="page-header">
        <div>
          <div className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Share2 size={22} color="#34d399" /> {t('affiliate.title')}
          </div>
          <div className="page-subtitle">{t('affiliate.subtitle')}</div>
        </div>
      </div>

      {/* ── Tier / rank hero ── */}
      <div style={{
        position: 'relative', borderRadius: 20, padding: '24px 26px', marginBottom: 16, overflow: 'hidden',
        background: `linear-gradient(135deg, ${rankColor}22, rgba(255,255,255,0.02) 60%)`,
        border: `1px solid ${rankColor}40`,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <div style={{ fontSize: 12, color: 'var(--text3)', letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: 4 }}>
              {t('affiliate.current_rank')}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Crown size={26} color={rankColor} fill={rankColor} />
              <span style={{ fontSize: 30, fontWeight: 900, color: rankColor, letterSpacing: '-0.02em' }}>{d.rank}</span>
            </div>
            <div style={{ fontSize: 13, color: 'var(--text2)', marginTop: 4 }}>
              {t('affiliate.commission_per_order', { rate: String(d.rate) })}
              {d.rank_locked && <span style={{ color: 'var(--text3)' }}> · {t('affiliate.rate_locked_by_admin')}</span>}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 34, fontWeight: 900, color: 'var(--text)', lineHeight: 1 }}>{d.paid_referrals}</div>
            <div style={{ fontSize: 12, color: 'var(--text3)' }}>{t('affiliate.paid_referrals_info', { total: String(d.total_referrals) })}</div>
          </div>
        </div>

        {d.next && !d.rank_locked && (
          <div style={{ marginTop: 18 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 5 }}>
              <span style={{ color: 'var(--text3)' }}>
                {t('affiliate.next_rank_info', { remaining: String(Math.max(0, d.next.threshold - d.paid_referrals)), rank: d.next.rank, rate: String(d.next.rate) })}
              </span>
              <span style={{ color: 'var(--text3)' }}>{d.paid_referrals}/{d.next.threshold}</span>
            </div>
            <div style={{ height: 8, borderRadius: 99, background: 'rgba(255,255,255,0.07)', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${d.progress}%`, borderRadius: 99, background: `linear-gradient(90deg, ${rankColor}, ${RANK_COLOR[d.next.rank] || '#fff'})`, transition: 'width .4s' }} />
            </div>
          </div>
        )}
        {!d.next && !d.rank_locked && (
          <div style={{ marginTop: 14, fontSize: 13, color: rankColor, fontWeight: 600 }}>
            <Sparkles size={14} style={{ verticalAlign: 'middle' }} /> {t('affiliate.max_rank_reached')}
          </div>
        )}
      </div>

      {/* ── Hoa hồng 2 tầng (F1 trực tiếp + F2 gián tiếp) ── */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-header"><Share2 size={15} /> {t('affiliate.two_tier_commission')}</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
          <div style={{ padding: '14px 16px', borderRadius: 13, background: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.3)' }}>
            <div style={{ fontSize: 11.5, color: 'var(--text3)', fontWeight: 600, marginBottom: 4 }}>{t('affiliate.tier1_label')}</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 7 }}>
              <span style={{ fontSize: 26, fontWeight: 900, color: '#34d399' }}>{d.rate}%</span>
              <span style={{ fontSize: 12, color: 'var(--text3)' }}>{t('affiliate.per_order')}</span>
            </div>
            <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 4 }}>
              {t('affiliate.tier1_stats', { count: String(d.paid_referrals), earned: fmtVND(d.earned_f1 ?? 0) })}
            </div>
          </div>
          <div style={{ padding: '14px 16px', borderRadius: 13, background: 'rgba(168,85,247,0.08)', border: '1px solid rgba(168,85,247,0.3)' }}>
            <div style={{ fontSize: 11.5, color: 'var(--text3)', fontWeight: 600, marginBottom: 4 }}>{t('affiliate.tier2_label')}</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 7 }}>
              <span style={{ fontSize: 26, fontWeight: 900, color: '#c084fc' }}>{d.tier2_rate ?? 5}%</span>
              <span style={{ fontSize: 12, color: 'var(--text3)' }}>{t('affiliate.per_order')}</span>
            </div>
            <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 4 }}>
              {t('affiliate.tier2_stats', { count: String(d.f2_referrals ?? 0), earned: fmtVND(d.earned_f2 ?? 0) })}
            </div>
          </div>
        </div>
        <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 11, lineHeight: 1.6 }}>
          {t('affiliate.two_tier_desc', { rate1: String(d.rate), rate2: String(d.tier2_rate ?? 5) })}
        </div>
      </div>

      {/* ── Ranks ladder ── */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-header"><TrendingUp size={15} /> {t('affiliate.ranks_ladder')}</div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {d.tiers.map((tier: any) => {
            const on = tier.rank === d.rank
            const c = RANK_COLOR[tier.rank] || '#fb923c'
            return (
              <div key={tier.rank} style={{
                flex: '1 1 130px', padding: '12px 14px', borderRadius: 12,
                background: on ? `${c}1c` : 'rgba(255,255,255,0.025)',
                border: `1px solid ${on ? c + '55' : 'rgba(255,255,255,0.06)'}`,
              }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: c }}>{tier.rank}</div>
                <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 2 }}>{t('affiliate.rank_commission', { rate: String(tier.rate) })}</div>
                <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>{t('affiliate.rank_threshold', { threshold: String(tier.threshold) })}</div>
              </div>
            )
          })}
        </div>
      </div>

      {/* ── Referral link ── */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-header"><Gift size={15} /> {t('affiliate.your_ref_link')}</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input ref={copyRef} readOnly value={d.link} className="form-input" style={{ flex: 1, fontSize: 13 }}
            onFocus={e => e.currentTarget.select()} />
          <button className="btn btn-primary btn-sm" onClick={copyLink}><Copy size={13} /> {t('affiliate.copy')}</button>
        </div>
        <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 8 }}>
          {t('affiliate.ref_link_desc', { code: d.referral_code, rate: String(d.rate) })}
        </div>
      </div>

      {/* ── Wallet ── */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <div className="card-header" style={{ marginBottom: 0 }}><Wallet size={15} /> {t('affiliate.wallet_title')}</div>
          <button className="btn btn-ghost btn-sm" onClick={load}><RefreshCw size={12} /></button>
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 16, flexWrap: 'wrap', marginBottom: 16 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
              <span style={{ fontSize: 38, fontWeight: 900, letterSpacing: '-0.03em', background: 'var(--grad)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
                {d.wallet_t}
              </span>
              <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text2)' }}>T</span>
            </div>
            <div style={{ fontSize: 12, color: 'var(--text3)' }}>≈ {fmtVND(d.wallet_vnd)} · 1 T = {fmtVND(d.t_coin_vnd)}</div>
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
            <button className="btn btn-ghost btn-sm" onClick={() => setShowWithdraw(s => !s)}>
              <ArrowUpRight size={14} /> {t('affiliate.withdraw')}
            </button>
            <button className="btn btn-primary btn-sm" onClick={() => { const el = document.getElementById('topup-box'); el?.scrollIntoView({ behavior: 'smooth' }) }}>
              <Plus size={14} /> {t('affiliate.topup')}
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', fontSize: 13, color: 'var(--text2)', marginBottom: showWithdraw ? 16 : 0 }}>
          <span>{t('affiliate.total_commission')}: <b style={{ color: 'var(--green)' }}>{fmtVND(d.earned_total)}</b></span>
          <label style={{ display: 'flex', alignItems: 'center', gap: 7, cursor: 'pointer' }}>
            <input type="checkbox" checked={d.auto_renew} onChange={toggleAutoRenew} />
            {t('affiliate.auto_renew_label')}
          </label>
        </div>

        {showWithdraw && (
          <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <div>
                <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>{t('affiliate.withdraw_amount_label')}</div>
                <input type="number" min={1} value={wAmount} onChange={e => setWAmount(+e.target.value)}
                  className="form-input" style={{ width: 120 }} />
              </div>
              <div style={{ flex: 1, minWidth: 200 }}>
                <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>{t('affiliate.bank_info_label')}</div>
                <input value={wBank} onChange={e => setWBank(e.target.value)} className="form-input"
                  placeholder={t('affiliate.bank_info_placeholder')} />
              </div>
            </div>
            <div style={{ fontSize: 12, color: 'var(--text3)' }}>
              {t('affiliate.withdraw_summary', { amount: String(wAmount), vnd: fmtVND(wAmount * d.t_coin_vnd), tax_pct: String(d.withdraw_tax_pct), net: fmtVND(Math.round(wAmount * d.t_coin_vnd * (1 - d.withdraw_tax_pct / 100))) })}
            </div>
            <button className="btn btn-primary btn-sm" style={{ alignSelf: 'flex-start' }} disabled={busy} onClick={doWithdraw}>
              {busy ? <Loader2 size={13} className="spin" /> : <ArrowUpRight size={13} />} {t('affiliate.submit_withdraw')}
            </button>
          </div>
        )}
      </div>

      {/* ── Top-up ── */}
      <div className="card" id="topup-box" style={{ marginBottom: 16 }}>
        <div className="card-header"><Plus size={15} /> {t('affiliate.topup')}</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
          {[100000, 200000, 500000, 1000000].map(a => (
            <button key={a} onClick={() => setTopupAmount(a)} style={{
              padding: '8px 14px', borderRadius: 10, cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 600,
              background: topupAmount === a ? 'rgba(249,115,22,0.12)' : 'rgba(255,255,255,0.03)',
              border: `1px solid ${topupAmount === a ? 'rgba(249,115,22,0.4)' : 'rgba(255,255,255,0.08)'}`,
              color: topupAmount === a ? '#fb923c' : 'var(--text2)',
            }}>{(a / 10000)} T · {fmtVND(a)}</button>
          ))}
          <input type="number" min={10000} step={10000} value={topupAmount} onChange={e => setTopupAmount(+e.target.value)}
            className="form-input" style={{ width: 130 }} />
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          {(['payos', 'binance'] as const).map(m => (
            <button key={m} onClick={() => setMethod(m)} style={{
              padding: '7px 14px', borderRadius: 9, cursor: 'pointer', fontFamily: 'inherit', fontSize: 12.5, fontWeight: 600,
              background: method === m ? 'rgba(249,115,22,0.1)' : 'rgba(255,255,255,0.03)',
              border: `1px solid ${method === m ? 'rgba(249,115,22,0.35)' : 'rgba(255,255,255,0.08)'}`,
              color: method === m ? '#fb923c' : 'var(--text3)',
            }}>{m === 'payos' ? t('affiliate.method_banking') : 'USDT Binance'}</button>
          ))}
          <button className="btn btn-primary btn-sm" style={{ marginLeft: 'auto' }} disabled={busy} onClick={doTopup}>
            {busy ? <Loader2 size={13} className="spin" /> : <Plus size={13} />} {t('affiliate.topup_amount', { amount: String(topupAmount / 10000) })}
          </button>
        </div>
      </div>

      {/* ── History ── */}
      <div className="card">
        <div className="card-header"><Wallet size={15} /> {t('affiliate.wallet_history')}</div>
        {d.txns.length === 0 ? (
          <div style={{ color: 'var(--text3)', fontSize: 13, padding: '10px 0' }}>{t('affiliate.no_transactions')}</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {d.txns.map((txn: any, i: number) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: i < d.txns.length - 1 ? '1px solid var(--border)' : 'none' }}>
                <div style={{ width: 30, height: 30, borderRadius: 9, display: 'grid', placeItems: 'center', flexShrink: 0, background: txn.amount >= 0 ? 'rgba(74,222,128,0.12)' : 'rgba(239,68,68,0.1)' }}>
                  {txn.amount >= 0 ? <ArrowDownLeft size={15} color="var(--green)" /> : <ArrowUpRight size={15} color="#f87171" />}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>
                    {KIND_LABEL[txn.kind] || txn.kind}
                    {txn.status === 'pending' && <span style={{ fontSize: 11, color: '#fbbf24', marginLeft: 6 }}>({t('affiliate.status_pending')})</span>}
                    {txn.status === 'rejected' && <span style={{ fontSize: 11, color: '#f87171', marginLeft: 6 }}>({t('affiliate.status_rejected')})</span>}
                  </div>
                  {txn.note && <div style={{ fontSize: 11, color: 'var(--text3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{txn.note}</div>}
                </div>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: txn.amount >= 0 ? 'var(--green)' : '#f87171', whiteSpace: 'nowrap' }}>
                  {txn.amount >= 0 ? '+' : ''}{fmtVND(txn.amount)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Referral List (F1 / F2) ── */}
      <div className="card">
        <div className="card-header" style={{ display: 'flex', gap: 20, marginBottom: 12 }}>
          <div onClick={() => setListTab('f1')} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, color: listTab === 'f1' ? '#34d399' : 'var(--text3)' }}>
            <Share2 size={15} /> {t('affiliate.f1_list', { count: String((d.f1_users || []).length) })}
          </div>
          <div onClick={() => setListTab('f2')} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, color: listTab === 'f2' ? '#c084fc' : 'var(--text3)' }}>
            <Share2 size={15} /> {t('affiliate.f2_list', { count: String((d.f2_users || []).length) })}
          </div>
        </div>
        
        {(() => {
          const users = listTab === 'f1' ? (d.f1_users || []) : (d.f2_users || [])
          if (users.length === 0) return <div style={{ color: 'var(--text3)', fontSize: 13, padding: '10px 0' }}>{t('affiliate.no_signups')}</div>
          return (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 10 }}>
              {users.map((u: any, i: number) => (
                <div key={i} style={{ padding: '12px', borderRadius: 10, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(255,255,255,0.1)', display: 'grid', placeItems: 'center', fontSize: 15, fontWeight: 700, color: 'var(--text2)' }}>
                    {u.username[0]?.toUpperCase()}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{u.username}</div>
                    <div style={{ fontSize: 11, color: 'var(--text3)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{u.email}</div>
                  </div>
                  {u.paid && <Crown size={14} color="#fbbf24" style={{ flexShrink: 0 }} />}
                </div>
              ))}
            </div>
          )
        })()}
      </div>

      {order && (
        <PaymentModal
          order={order}
          planLabel={t('affiliate.topup')}
          onSuccess={() => { setOrder(null); toast(t('affiliate.topup_success'), 'success'); load() }}
          onClose={() => setOrder(null)}
        />
      )}
    </div>
  )
}
