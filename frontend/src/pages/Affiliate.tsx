import { useEffect, useRef, useState } from 'react'
import { affiliateApi, billingApi } from '../api/client'
import { useToast } from '../components/Toast'
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
const KIND_LABEL: Record<string, string> = {
  commission: 'Hoa hồng', topup: 'Nạp ví', withdraw: 'Rút tiền',
  renew: 'Tự gia hạn', refund: 'Hoàn tiền', adjust: 'Điều chỉnh',
}

export default function Affiliate() {
  const toast = useToast()
  const [d, setD] = useState<any>(null)
  const [busy, setBusy] = useState(false)
  const [wAmount, setWAmount] = useState(1)
  const [wBank, setWBank] = useState('')
  const [showWithdraw, setShowWithdraw] = useState(false)
  const [topupAmount, setTopupAmount] = useState(200000)
  const [method, setMethod] = useState<'payos' | 'binance'>('payos')
  const [order, setOrder] = useState<PaymentOrder | null>(null)
  const copyRef = useRef<HTMLInputElement>(null)

  function load() { affiliateApi.me().then(setD).catch(() => {}) }
  useEffect(load, [])

  function copyLink() {
    if (!d?.link) return
    navigator.clipboard?.writeText(d.link).then(() => toast('Đã chép link giới thiệu', 'success'))
  }

  async function doWithdraw() {
    if (wAmount < 1) return toast('Rút tối thiểu 1 T', 'error')
    if (!wBank.trim()) return toast('Nhập thông tin nhận tiền', 'error')
    setBusy(true)
    try {
      const r = await affiliateApi.withdraw(wAmount, wBank.trim())
      toast(`Đã gửi yêu cầu rút. Nhận ${fmtVND(r.net)} (trừ thuế ${fmtVND(r.tax)})`, 'success')
      setShowWithdraw(false); setWBank(''); load()
    } catch (e: any) { toast(e.response?.data?.detail || 'Lỗi rút tiền', 'error') }
    finally { setBusy(false) }
  }

  async function toggleAutoRenew() {
    try { const r = await affiliateApi.setAutoRenew(!d.auto_renew); setD({ ...d, auto_renew: r.auto_renew }) }
    catch { toast('Lỗi', 'error') }
  }

  async function doTopup() {
    if (topupAmount < 10000) return toast('Nạp tối thiểu 10.000đ', 'error')
    setBusy(true)
    try {
      const r = await billingApi.topup(topupAmount, method)
      if (method === 'payos' && r.qr_code || (method === 'binance' && (r.qr_content || r.qr_url))) {
        setOrder(r as PaymentOrder)
      } else { toast('Đã tạo đơn nạp. Liên hệ admin nếu chưa cộng.', 'info') }
    } catch (e: any) { toast(e.response?.data?.detail || 'Lỗi tạo đơn nạp', 'error') }
    finally { setBusy(false) }
  }

  if (!d) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--text2)' }}>Đang tải...</div>

  const rankColor = RANK_COLOR[d.rank] || '#fb923c'

  return (
    <div style={{ maxWidth: 920, margin: '0 auto' }}>
      <div className="page-header">
        <div>
          <div className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Share2 size={22} color="#34d399" /> Cộng tác viên
          </div>
          <div className="page-subtitle">Giới thiệu bạn bè · nhận hoa hồng vào ví · lên cảnh giới</div>
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
              Cảnh giới hiện tại
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Crown size={26} color={rankColor} fill={rankColor} />
              <span style={{ fontSize: 30, fontWeight: 900, color: rankColor, letterSpacing: '-0.02em' }}>{d.rank}</span>
            </div>
            <div style={{ fontSize: 13, color: 'var(--text2)', marginTop: 4 }}>
              Hoa hồng <b style={{ color: rankColor }}>{d.rate}%</b> mỗi đơn người bạn giới thiệu mua
              {d.rank_locked && <span style={{ color: 'var(--text3)' }}> · (mức riêng do admin đặt)</span>}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 34, fontWeight: 900, color: 'var(--text)', lineHeight: 1 }}>{d.paid_referrals}</div>
            <div style={{ fontSize: 12, color: 'var(--text3)' }}>khách đã mua · {d.total_referrals} đăng ký</div>
          </div>
        </div>

        {d.next && !d.rank_locked && (
          <div style={{ marginTop: 18 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 5 }}>
              <span style={{ color: 'var(--text3)' }}>
                Còn <b style={{ color: 'var(--text)' }}>{Math.max(0, d.next.threshold - d.paid_referrals)}</b> khách nữa lên <b style={{ color: RANK_COLOR[d.next.rank] || '#fff' }}>{d.next.rank}</b> ({d.next.rate}%)
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
            <Sparkles size={14} style={{ verticalAlign: 'middle' }} /> Đã đạt cảnh giới cao nhất!
          </div>
        )}
      </div>

      {/* ── Ranks ladder ── */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-header"><TrendingUp size={15} /> Bậc cộng tác viên</div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {d.tiers.map((t: any) => {
            const on = t.rank === d.rank
            const c = RANK_COLOR[t.rank] || '#fb923c'
            return (
              <div key={t.rank} style={{
                flex: '1 1 130px', padding: '12px 14px', borderRadius: 12,
                background: on ? `${c}1c` : 'rgba(255,255,255,0.025)',
                border: `1px solid ${on ? c + '55' : 'rgba(255,255,255,0.06)'}`,
              }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: c }}>{t.rank}</div>
                <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 2 }}>{t.rate}% hoa hồng</div>
                <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>từ {t.threshold} khách mua</div>
              </div>
            )
          })}
        </div>
      </div>

      {/* ── Referral link ── */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-header"><Gift size={15} /> Link giới thiệu của bạn</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input ref={copyRef} readOnly value={d.link} className="form-input" style={{ flex: 1, fontSize: 13 }}
            onFocus={e => e.currentTarget.select()} />
          <button className="btn btn-primary btn-sm" onClick={copyLink}><Copy size={13} /> Chép</button>
        </div>
        <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 8 }}>
          Mã: <b style={{ color: 'var(--text2)' }}>{d.referral_code}</b> · Ai đăng ký qua link này & mua gói → bạn nhận {d.rate}% vào ví.
        </div>
      </div>

      {/* ── Wallet ── */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <div className="card-header" style={{ marginBottom: 0 }}><Wallet size={15} /> Ví T coin</div>
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
              <ArrowUpRight size={14} /> Rút tiền
            </button>
            <button className="btn btn-primary btn-sm" onClick={() => { const el = document.getElementById('topup-box'); el?.scrollIntoView({ behavior: 'smooth' }) }}>
              <Plus size={14} /> Nạp ví
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', fontSize: 13, color: 'var(--text2)', marginBottom: showWithdraw ? 16 : 0 }}>
          <span>Tổng hoa hồng: <b style={{ color: 'var(--green)' }}>{fmtVND(d.earned_total)}</b></span>
          <label style={{ display: 'flex', alignItems: 'center', gap: 7, cursor: 'pointer' }}>
            <input type="checkbox" checked={d.auto_renew} onChange={toggleAutoRenew} />
            Tự động gia hạn gói từ ví (đảm bảo không gián đoạn)
          </label>
        </div>

        {showWithdraw && (
          <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <div>
                <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Số T muốn rút</div>
                <input type="number" min={1} value={wAmount} onChange={e => setWAmount(+e.target.value)}
                  className="form-input" style={{ width: 120 }} />
              </div>
              <div style={{ flex: 1, minWidth: 200 }}>
                <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Thông tin nhận (ngân hàng / STK / tên — hoặc địa chỉ USDT)</div>
                <input value={wBank} onChange={e => setWBank(e.target.value)} className="form-input"
                  placeholder="VD: MB Bank 0901234567 Nguyen Van A" />
              </div>
            </div>
            <div style={{ fontSize: 12, color: 'var(--text3)' }}>
              Rút {wAmount} T = {fmtVND(wAmount * d.t_coin_vnd)} · trừ thuế {d.withdraw_tax_pct}% → thực nhận <b style={{ color: 'var(--text2)' }}>{fmtVND(Math.round(wAmount * d.t_coin_vnd * (1 - d.withdraw_tax_pct / 100)))}</b>
            </div>
            <button className="btn btn-primary btn-sm" style={{ alignSelf: 'flex-start' }} disabled={busy} onClick={doWithdraw}>
              {busy ? <Loader2 size={13} className="spin" /> : <ArrowUpRight size={13} />} Gửi yêu cầu rút
            </button>
          </div>
        )}
      </div>

      {/* ── Top-up ── */}
      <div className="card" id="topup-box" style={{ marginBottom: 16 }}>
        <div className="card-header"><Plus size={15} /> Nạp ví</div>
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
            }}>{m === 'payos' ? 'Chuyển khoản VN' : 'USDT Binance'}</button>
          ))}
          <button className="btn btn-primary btn-sm" style={{ marginLeft: 'auto' }} disabled={busy} onClick={doTopup}>
            {busy ? <Loader2 size={13} className="spin" /> : <Plus size={13} />} Nạp {(topupAmount / 10000)} T
          </button>
        </div>
      </div>

      {/* ── History ── */}
      <div className="card">
        <div className="card-header"><Wallet size={15} /> Lịch sử ví</div>
        {d.txns.length === 0 ? (
          <div style={{ color: 'var(--text3)', fontSize: 13, padding: '10px 0' }}>Chưa có giao dịch</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {d.txns.map((t: any, i: number) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: i < d.txns.length - 1 ? '1px solid var(--border)' : 'none' }}>
                <div style={{ width: 30, height: 30, borderRadius: 9, display: 'grid', placeItems: 'center', flexShrink: 0, background: t.amount >= 0 ? 'rgba(74,222,128,0.12)' : 'rgba(239,68,68,0.1)' }}>
                  {t.amount >= 0 ? <ArrowDownLeft size={15} color="var(--green)" /> : <ArrowUpRight size={15} color="#f87171" />}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>
                    {KIND_LABEL[t.kind] || t.kind}
                    {t.status === 'pending' && <span style={{ fontSize: 11, color: '#fbbf24', marginLeft: 6 }}>(đang chờ)</span>}
                    {t.status === 'rejected' && <span style={{ fontSize: 11, color: '#f87171', marginLeft: 6 }}>(bị từ chối)</span>}
                  </div>
                  {t.note && <div style={{ fontSize: 11, color: 'var(--text3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.note}</div>}
                </div>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: t.amount >= 0 ? 'var(--green)' : '#f87171', whiteSpace: 'nowrap' }}>
                  {t.amount >= 0 ? '+' : ''}{fmtVND(t.amount)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {order && (
        <PaymentModal
          order={order}
          planLabel="Nạp ví"
          onSuccess={() => { setOrder(null); toast('Nạp ví thành công!', 'success'); load() }}
          onClose={() => setOrder(null)}
        />
      )}
    </div>
  )
}
