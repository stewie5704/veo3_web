import { useEffect, useRef, useState } from 'react'
import { billingApi } from '../api/client'
import { useToast } from '../components/Toast'
import {
  Crown, Check, Loader2, CalendarCheck, RefreshCw, Shield, Sparkles,
  Zap, CreditCard, Coins, X, ExternalLink, Bot,
} from 'lucide-react'

type PayMethod = 'payos' | 'binance'

type BinanceModal = {
  orderId: string
  usdt: number
  qrUrl: string
  universalUrl: string
}

const BASE_FEATURES = [
  'Tạo video không giới hạn',
  'Mọi model: Lite, Fast, Quality',
  'Ưu tiên hàng đợi render',
  'Giữ mặt nhân vật xuyên cảnh',
]

// ─── Binance QR modal ──────────────────────────────────────────────────────

function BinanceQRModal({ data, onClose }: { data: BinanceModal; onClose: () => void }) {
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 999,
        background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(6px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 20,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'linear-gradient(160deg,#1a1614,#120f0d)',
          border: '1px solid rgba(249,115,22,0.22)',
          borderRadius: 22, padding: '28px 26px', width: '100%', maxWidth: 360,
          boxShadow: '0 40px 100px -20px rgba(0,0,0,0.9)',
          position: 'relative',
        }}
      >
        <button
          onClick={onClose}
          style={{
            position: 'absolute', top: 14, right: 14,
            background: 'rgba(255,255,255,0.06)', border: 'none',
            borderRadius: 8, width: 30, height: 30, cursor: 'pointer',
            display: 'grid', placeItems: 'center', color: 'var(--text3)',
          }}
        >
          <X size={14} />
        </button>

        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>
          Thanh toán USDT
        </div>
        <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 20 }}>
          Mở app Binance → quét mã QR bên dưới
        </div>

        {data.qrUrl ? (
          <div style={{
            background: '#fff', borderRadius: 14, padding: 12, marginBottom: 18,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <img
              src={data.qrUrl}
              alt="Binance Pay QR code"
              style={{ width: 220, height: 220, display: 'block' }}
            />
          </div>
        ) : (
          <div style={{
            height: 244, borderRadius: 14, marginBottom: 18,
            background: 'rgba(255,255,255,0.04)', border: '1px dashed rgba(255,255,255,0.1)',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            gap: 8, color: 'var(--text3)', fontSize: 12,
          }}>
            <Loader2 size={20} className="spin" />
            Đang tải mã QR...
          </div>
        )}

        <div style={{ textAlign: 'center', marginBottom: 18 }}>
          <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Số tiền</div>
          <div style={{
            fontSize: 28, fontWeight: 900, letterSpacing: '-0.03em',
            background: 'linear-gradient(115deg,#F5A623,#F7931A)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
          }}>
            {data.usdt.toFixed(2)}
            <span style={{ fontSize: 14, fontWeight: 600, WebkitTextFillColor: 'transparent' }}> USDT</span>
          </div>
        </div>

        {data.universalUrl && (
          <a
            href={data.universalUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
              width: '100%', padding: '11px 0', borderRadius: 11, marginBottom: 12,
              background: 'linear-gradient(115deg,#F5A623,#F7931A)',
              color: '#fff', fontWeight: 700, fontSize: 13, textDecoration: 'none',
              fontFamily: 'inherit',
            }}
          >
            <ExternalLink size={13} /> Mở app Binance
          </a>
        )}

        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
          fontSize: 12, color: 'var(--text3)',
        }}>
          <Loader2 size={12} className="spin" /> Đang chờ xác nhận thanh toán...
        </div>
      </div>
    </div>
  )
}

// ─── Main component ────────────────────────────────────────────────────────

export default function Billing() {
  const toast = useToast()
  const [plans, setPlans] = useState<any[]>([])
  const [sub, setSub] = useState<any>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [method, setMethod] = useState<PayMethod>('payos')
  const [binanceModal, setBinanceModal] = useState<BinanceModal | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  function load() {
    billingApi.plans().then(d => setPlans(d.plans || [])).catch(() => {})
    billingApi.me().then(setSub).catch(() => {})
  }
  useEffect(load, [])
  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current) }, [])

  function startPolling(orderId: string) {
    if (pollRef.current) clearInterval(pollRef.current)
    pollRef.current = setInterval(async () => {
      try {
        const s = await billingApi.orderStatus(orderId)
        if (s.status === 'paid') {
          clearInterval(pollRef.current!)
          pollRef.current = null
          setBinanceModal(null)
          toast('Thanh toán thành công! Gói đã được kích hoạt.', 'success')
          load()
        }
      } catch { /* ignore poll errors */ }
    }, 3000)
  }

  function closeModal() {
    if (pollRef.current) clearInterval(pollRef.current)
    pollRef.current = null
    setBinanceModal(null)
  }

  async function buy(planId: string) {
    setBusy(planId)
    try {
      const r = await billingApi.checkout(planId, method)
      if (method === 'payos' && r.pay_url) {
        window.location.href = r.pay_url
      } else if (method === 'binance' && r.qr_url) {
        setBinanceModal({
          orderId: r.order_id,
          usdt: r.usdt_amount,
          qrUrl: r.qr_url,
          universalUrl: r.universal_url || r.deeplink || '',
        })
        startPolling(r.order_id)
      } else {
        toast('Đã tạo đơn hàng. Liên hệ admin để kích hoạt gói.', 'info')
      }
    } catch (e: any) {
      toast(e.response?.data?.detail || 'Lỗi tạo đơn hàng', 'error')
    } finally {
      setBusy(null)
    }
  }

  const fmt = (n: number) => (n ?? 0).toLocaleString('vi-VN')
  // m6 is center-featured when all 3 plans load in order
  const hasFeaturedCenter = plans.length === 3 && plans[1]?.id === 'm6'

  return (
    <div style={{ maxWidth: 880, margin: '0 auto' }}>

      {/* ── Header ── */}
      <div className="page-header">
        <div>
          <div className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Crown size={22} color="#fbbf24" /> Nâng gói
          </div>
          <div className="page-subtitle">Mua một lần, dùng bao lâu. Không tự gia hạn.</div>
        </div>
      </div>

      {/* ── Current plan banner ── */}
      {sub && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 14,
          background: sub.active
            ? 'linear-gradient(130deg,rgba(249,115,22,0.1),rgba(236,72,153,0.06))'
            : 'rgba(255,255,255,0.025)',
          border: `1px solid ${sub.active ? 'rgba(249,115,22,0.28)' : 'rgba(255,255,255,0.07)'}`,
          borderRadius: 16, padding: '14px 20px', marginBottom: 30,
        }}>
          <div style={{
            width: 38, height: 38, borderRadius: 11, flexShrink: 0,
            background: sub.active ? 'rgba(249,115,22,0.18)' : 'rgba(255,255,255,0.05)',
            display: 'grid', placeItems: 'center',
          }}>
            <Crown size={18} color={sub.active ? '#fb923c' : '#605040'} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            {sub.active ? (
              <>
                <div style={{ fontSize: 11.5, color: 'var(--text3)', marginBottom: 2, letterSpacing: '.04em', textTransform: 'uppercase' }}>
                  Gói đang dùng
                </div>
                <div style={{ fontSize: 14.5, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ color: '#fbbf24' }}>{sub.plan}</span>
                  <span style={{ color: 'rgba(255,255,255,0.15)', fontSize: 12 }}>|</span>
                  <span style={{ color: 'var(--text2)', fontWeight: 500 }}>còn {sub.days_left} ngày</span>
                </div>
              </>
            ) : (
              <div style={{ fontSize: 14, color: 'var(--text2)' }}>
                Chưa có gói hoạt động — chọn gói bên dưới
              </div>
            )}
          </div>
          {sub.active && sub.expires_at && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0,
              background: 'rgba(249,115,22,0.07)', border: '1px solid rgba(249,115,22,0.18)',
              borderRadius: 9, padding: '5px 12px', fontSize: 11.5, color: 'var(--text3)',
            }}>
              <CalendarCheck size={12} />
              Hết hạn {String(sub.expires_at).slice(0, 10)}
            </div>
          )}
        </div>
      )}

      {/* ── Payment method selector ── */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 11.5, color: 'var(--text3)', letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: 10 }}>
          Phương thức thanh toán
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          {([
            { id: 'payos',   Icon: CreditCard, label: 'Chuyển khoản VN', sub: 'Banking / Ví điện tử' },
            { id: 'binance', Icon: Coins,      label: 'USDT Binance',    sub: 'Binance Pay' },
          ] as const).map(m => (
            <button
              key={m.id}
              onClick={() => setMethod(m.id)}
              style={{
                flex: 1, display: 'flex', alignItems: 'center', gap: 10,
                padding: '11px 16px', borderRadius: 12, cursor: 'pointer',
                background: method === m.id ? 'rgba(249,115,22,0.08)' : 'rgba(255,255,255,0.025)',
                border: `1.5px solid ${method === m.id ? 'rgba(249,115,22,0.38)' : 'rgba(255,255,255,0.08)'}`,
                fontFamily: 'inherit', transition: 'all .15s',
              }}
            >
              <m.Icon size={17} color={method === m.id ? '#fb923c' : 'var(--text3)'} />
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: method === m.id ? 'var(--text)' : 'var(--text2)' }}>
                  {m.label}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text3)' }}>{m.sub}</div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* ── Plan cards ── */}
      {plans.length === 0 ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14 }}>
          {[0, 1, 2].map(i => (
            <div key={i} style={{
              borderRadius: 22, padding: '26px 22px', height: 340,
              background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.06)',
              animation: 'shimmer 1.6s infinite', opacity: 0.6,
            }} />
          ))}
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: hasFeaturedCenter ? '1fr 1.07fr 1fr' : `repeat(${plans.length},1fr)`,
          gap: 14,
          alignItems: 'center',
        }}>
          {plans.map((p) => {
            const featured = p.id === 'm6'
            const annual = p.id === 'm12'
            const hasDiscount = (p.discount_pct ?? 0) > 0
            const period = p.days >= 365 ? '/năm' : p.days >= 180 ? '/6 tháng' : '/tháng'

            const features = [
              ...BASE_FEATURES,
              `Tặng ${p.assistants} trợ lí AI`,
              ...(hasDiscount ? [`Tiết kiệm ${p.discount_pct}% so với mua tháng`] : []),
            ]

            return (
              <div key={p.id} style={{
                position: 'relative',
                borderRadius: 22,
                padding: featured ? '36px 24px 28px' : '30px 22px 24px',
                display: 'flex', flexDirection: 'column',
                background: featured
                  ? 'linear-gradient(155deg,rgba(249,115,22,0.11),rgba(236,72,153,0.08),rgba(168,85,247,0.05))'
                  : annual
                    ? 'linear-gradient(155deg,rgba(168,85,247,0.07),rgba(59,130,246,0.04))'
                    : 'rgba(255,255,255,0.025)',
                border: featured
                  ? '1px solid rgba(249,115,22,0.38)'
                  : annual
                    ? '1px solid rgba(139,92,246,0.28)'
                    : '1px solid rgba(255,255,255,0.07)',
                boxShadow: featured
                  ? '0 0 0 1px rgba(249,115,22,0.12),0 32px 72px -20px rgba(249,115,22,0.22)'
                  : 'none',
              }}>

                {/* Badge */}
                {(featured || annual) && (
                  <div style={{
                    position: 'absolute', top: -13, left: '50%', transform: 'translateX(-50%)',
                    background: featured
                      ? 'linear-gradient(115deg,#F97316,#EC4899)'
                      : 'linear-gradient(115deg,#8B5CF6,#3B82F6)',
                    color: '#fff', fontSize: 10.5, fontWeight: 800,
                    padding: '4px 14px', borderRadius: 99, whiteSpace: 'nowrap',
                    letterSpacing: '.06em', textTransform: 'uppercase',
                    boxShadow: featured
                      ? '0 6px 18px -6px rgba(249,115,22,0.55)'
                      : '0 6px 18px -6px rgba(139,92,246,0.55)',
                  }}>
                    {featured ? 'Phổ biến nhất' : `Tiết kiệm ${p.discount_pct}%`}
                  </div>
                )}

                {/* Plan name */}
                <div style={{
                  fontSize: 12, fontWeight: 600, letterSpacing: '.08em', textTransform: 'uppercase',
                  color: featured ? 'rgba(251,146,60,0.8)' : 'var(--text3)',
                  marginBottom: 12,
                }}>
                  {p.label}
                </div>

                {/* Price */}
                <div style={{ marginBottom: 2 }}>
                  {hasDiscount && (
                    <div style={{ fontSize: 12, color: 'var(--text3)', textDecoration: 'line-through', marginBottom: 2 }}>
                      {fmt(p.original_price)} ₫
                    </div>
                  )}
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                    <span style={{
                      fontSize: featured ? 50 : 44, fontWeight: 900,
                      letterSpacing: '-0.035em', lineHeight: 1,
                      ...(featured
                        ? { background: 'linear-gradient(115deg,#fb923c,#f472b6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }
                        : { color: 'var(--text)' }),
                    }}>
                      {fmt(p.price)}
                    </span>
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text3)' }}>₫</span>
                  </div>
                </div>
                <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 20 }}>
                  {period} · {p.days} ngày
                </div>

                {/* Divider */}
                <div style={{
                  height: 1, marginBottom: 18,
                  background: featured ? 'rgba(249,115,22,0.18)' : 'rgba(255,255,255,0.06)',
                }} />

                {/* Features */}
                <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 24px', display: 'flex', flexDirection: 'column', gap: 9 }}>
                  {features.map((f, i) => {
                    const isGift = f.startsWith('Tặng')
                    const isSaving = f.startsWith('Tiết kiệm')
                    return (
                      <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 9, fontSize: 13, color: 'var(--text2)', lineHeight: 1.45 }}>
                        <span style={{
                          flexShrink: 0, marginTop: 2,
                          width: 18, height: 18, borderRadius: '50%',
                          background: isGift
                            ? 'rgba(251,191,36,0.12)'
                            : isSaving
                              ? 'rgba(139,92,246,0.12)'
                              : featured ? 'rgba(249,115,22,0.14)' : 'rgba(74,222,128,0.1)',
                          display: 'grid', placeItems: 'center',
                        }}>
                          {isGift
                            ? <Bot size={10} color="#fbbf24" strokeWidth={2.5} />
                            : <Check size={10} color={featured ? '#fb923c' : isSaving ? '#a78bfa' : 'var(--green)'} strokeWidth={3} />
                          }
                        </span>
                        <span style={{ color: isGift ? '#fbbf24' : isSaving ? '#a78bfa' : undefined, fontWeight: (isGift || isSaving) ? 600 : undefined }}>
                          {f}
                        </span>
                      </li>
                    )
                  })}
                </ul>

                {/* CTA */}
                <button
                  disabled={busy === p.id}
                  onClick={() => buy(p.id)}
                  style={{
                    marginTop: 'auto', width: '100%', padding: '13px 0',
                    borderRadius: 12, fontSize: 13.5, fontWeight: 700,
                    cursor: busy === p.id ? 'not-allowed' : 'pointer',
                    border: 'none', fontFamily: 'inherit',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                    transition: 'filter .18s, transform .14s',
                    ...(featured
                      ? {
                          background: 'linear-gradient(115deg,#F97316,#EC4899 56%,#A855F7)',
                          color: '#fff',
                          boxShadow: '0 8px 28px -8px rgba(249,115,22,0.55),inset 0 1px 0 rgba(255,255,255,0.22)',
                        }
                      : annual
                        ? {
                            background: 'rgba(139,92,246,0.14)',
                            color: '#a78bfa',
                            border: '1px solid rgba(139,92,246,0.35)',
                          }
                        : {
                            background: 'rgba(255,255,255,0.06)',
                            color: 'var(--text2)',
                            border: '1px solid rgba(255,255,255,0.1)',
                          }),
                  }}
                  onMouseEnter={e => { if (busy !== p.id) (e.currentTarget as HTMLElement).style.filter = 'brightness(1.12)' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.filter = 'brightness(1)' }}
                >
                  {busy === p.id
                    ? <><Loader2 size={13} className="spin" /> Đang xử lý...</>
                    : <><Zap size={13} /> {sub?.active ? 'Gia hạn / Mua thêm' : 'Bắt đầu ngay'}</>
                  }
                </button>
              </div>
            )
          })}
        </div>
      )}

      {/* ── Trust signals ── */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'center', marginTop: 28 }}>
        {[
          { icon: RefreshCw,  text: 'Mua thêm = cộng dồn ngày' },
          { icon: Shield,     text: 'Không tự động gia hạn' },
          { icon: Sparkles,   text: 'Tặng trợ lí AI lần đầu mua' },
        ].map(({ icon: Icon, text }) => (
          <div key={text} style={{
            display: 'flex', alignItems: 'center', gap: 7,
            fontSize: 12.5, color: 'var(--text3)',
            background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
            borderRadius: 99, padding: '6px 14px',
          }}>
            <Icon size={12} /> {text}
          </div>
        ))}
      </div>

      {/* ── Binance QR modal ── */}
      {binanceModal && <BinanceQRModal data={binanceModal} onClose={closeModal} />}
    </div>
  )
}
