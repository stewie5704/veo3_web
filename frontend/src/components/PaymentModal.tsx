import { useEffect, useRef, useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { billingApi } from '../api/client'
import {
  X, Copy, Check, Loader2, Clock, ShieldCheck, ExternalLink, Landmark, Coins, Sparkles,
} from 'lucide-react'

export type PaymentOrder = {
  order_id: string
  method: 'payos' | 'binance'
  amount: number
  currency: string
  expires_at: string
  // payos
  qr_code?: string
  account_number?: string
  account_name?: string
  bank_name?: string
  description?: string
  checkout_url?: string
  // binance
  usdt_amount?: number
  qr_content?: string
  qr_url?: string
  universal_url?: string
}

const BRAND = 'linear-gradient(120deg,#F97316,#EC4899,#A855F7,#F97316)'

function CopyField({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false)
  function copy() {
    navigator.clipboard?.writeText(value).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1400)
    })
  }
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '9px 0' }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 2 }}>{label}</div>
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {value}
        </div>
      </div>
      <button
        onClick={copy}
        style={{
          flexShrink: 0, display: 'flex', alignItems: 'center', gap: 5,
          background: copied ? 'rgba(74,222,128,0.14)' : 'rgba(255,255,255,0.06)',
          border: `1px solid ${copied ? 'rgba(74,222,128,0.3)' : 'rgba(255,255,255,0.1)'}`,
          borderRadius: 8, padding: '6px 10px', cursor: 'pointer',
          fontSize: 11.5, fontWeight: 600, color: copied ? 'var(--green)' : 'var(--text2)',
          fontFamily: 'inherit', transition: 'all .15s',
        }}
      >
        <span style={{ display: 'inline-flex', animation: copied ? 'popIn .3s ease' : undefined }}>
          {copied ? <Check size={12} /> : <Copy size={12} />}
        </span>
        {copied ? 'Đã chép' : 'Sao chép'}
      </button>
    </div>
  )
}

export default function PaymentModal({
  order, planLabel, onSuccess, onClose,
}: {
  order: PaymentOrder
  planLabel: string
  onSuccess: (info: { status: any }) => void
  onClose: () => void
}) {
  const isBinance = order.method === 'binance'
  const hasQr = isBinance ? !!(order.qr_content || order.qr_url) : !!order.qr_code
  const [remaining, setRemaining] = useState(() =>
    Math.max(0, Math.floor((new Date(order.expires_at).getTime() - Date.now()) / 1000)))
  const [expired, setExpired] = useState(() =>
    (new Date(order.expires_at).getTime() - Date.now()) <= 0)
  const [cancelling, setCancelling] = useState(false)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Countdown
  useEffect(() => {
    tickRef.current = setInterval(() => {
      const left = Math.max(0, Math.floor((new Date(order.expires_at).getTime() - Date.now()) / 1000))
      setRemaining(left)
      if (left <= 0) {
        setExpired(true)
        if (tickRef.current) clearInterval(tickRef.current)
        if (pollRef.current) clearInterval(pollRef.current)
      }
    }, 1000)
    return () => { if (tickRef.current) clearInterval(tickRef.current) }
  }, [order.expires_at])

  // Poll payment status
  useEffect(() => {
    let alive = true
    pollRef.current = setInterval(async () => {
      try {
        const s = await billingApi.orderStatus(order.order_id)
        if (!alive) return   // modal closed mid-request — don't touch state/parent
        if (s.status === 'paid') {
          if (pollRef.current) clearInterval(pollRef.current)
          if (tickRef.current) clearInterval(tickRef.current)
          onSuccess({ status: s })
        } else if (s.status === 'expired' || s.status === 'failed') {
          setExpired(true)
          if (pollRef.current) clearInterval(pollRef.current)
          if (tickRef.current) clearInterval(tickRef.current)
        }
      } catch { /* keep polling */ }
    }, 3000)
    return () => {
      alive = false
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [order.order_id])

  async function cancel() {
    setCancelling(true)
    try { await billingApi.cancelOrder(order.order_id) } catch { /* ignore */ }
    onClose()
  }

  const mm = String(Math.floor(remaining / 60)).padStart(2, '0')
  const ss = String(remaining % 60).padStart(2, '0')
  const lowTime = remaining <= 60
  const pct = Math.max(0, Math.min(100, (remaining / 300) * 100))
  const fmt = (n: number) => (n ?? 0).toLocaleString('vi-VN')
  const accent = isBinance ? '#F5A623' : '#fb923c'

  return (
    <div
      onClick={cancelling ? undefined : onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 999,
        background: 'rgba(0,0,0,0.74)', backdropFilter: 'blur(7px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
        animation: 'fadeIn .2s ease',
      }}
    >
      {/* Animated gradient border shell */}
      <div
        onClick={e => e.stopPropagation()}
        style={{
          position: 'relative', width: '100%', maxWidth: 404, borderRadius: 24, padding: 1.5,
          background: BRAND, backgroundSize: '300% 100%',
          animation: 'popIn .42s cubic-bezier(.2,.9,.3,1.3), gradShift 5s linear infinite',
          boxShadow: '0 40px 110px -20px rgba(236,72,153,0.42), 0 0 0 1px rgba(255,255,255,0.04)',
        }}
      >
        {/* Sparkles */}
        <Sparkles size={16} color="#fbbf24" style={{ position: 'absolute', top: -7, left: 26, animation: 'sparkleTwinkle 2.4s ease-in-out infinite', filter: 'drop-shadow(0 0 5px rgba(251,191,36,.8))' }} />
        <Sparkles size={12} color="#f472b6" style={{ position: 'absolute', top: 40, right: -6, animation: 'sparkleTwinkle 2.8s ease-in-out infinite .9s', filter: 'drop-shadow(0 0 5px rgba(244,114,182,.8))' }} />
        <Sparkles size={13} color="#a855f7" style={{ position: 'absolute', bottom: 30, left: -6, animation: 'sparkleTwinkle 3.1s ease-in-out infinite 1.6s', filter: 'drop-shadow(0 0 5px rgba(168,85,247,.8))' }} />

        <div style={{
          background: 'linear-gradient(160deg,#1a1614,#110e0c)',
          borderRadius: 22.5, overflow: 'hidden',
        }}>
          {/* Header */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 11,
            padding: '18px 20px 14px', borderBottom: '1px solid rgba(255,255,255,0.06)',
          }}>
            <div style={{ position: 'relative', width: 36, height: 36, flexShrink: 0 }}>
              {/* pulse ring */}
              <div style={{
                position: 'absolute', inset: 0, borderRadius: 11,
                border: `1.5px solid ${accent}`, animation: 'pulseRing 2s ease-out infinite',
              }} />
              <div style={{
                position: 'absolute', inset: 0, borderRadius: 11, display: 'grid', placeItems: 'center',
                background: isBinance ? 'rgba(245,166,35,0.16)' : 'rgba(249,115,22,0.16)',
              }}>
                {isBinance ? <Coins size={18} color="#F5A623" /> : <Landmark size={18} color="#fb923c" />}
              </div>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>
                {isBinance ? 'Thanh toán USDT' : 'Chuyển khoản ngân hàng'}
              </div>
              <div style={{ fontSize: 11.5, color: 'var(--text3)' }}>Gói {planLabel}</div>
            </div>
            <button
              onClick={onClose}
              style={{
                background: 'rgba(255,255,255,0.06)', border: 'none', borderRadius: 8,
                width: 30, height: 30, cursor: 'pointer', display: 'grid', placeItems: 'center', color: 'var(--text3)',
              }}
            >
              <X size={14} />
            </button>
          </div>

          {expired ? (
            /* ── Expired state ── */
            <div style={{ padding: '40px 26px', textAlign: 'center' }}>
              <div style={{
                width: 56, height: 56, borderRadius: '50%', margin: '0 auto 16px',
                background: 'rgba(255,255,255,0.05)', display: 'grid', placeItems: 'center',
              }}>
                <Clock size={26} color="var(--text3)" />
              </div>
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>
                Đơn đã hết hạn
              </div>
              <div style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 22, lineHeight: 1.5 }}>
                Đơn hàng quá 5 phút chưa thanh toán. Vui lòng tạo đơn mới.
              </div>
              <button
                onClick={onClose}
                style={{
                  width: '100%', padding: '12px 0', borderRadius: 11, border: 'none',
                  background: 'rgba(255,255,255,0.08)', color: 'var(--text)', fontWeight: 700,
                  fontSize: 13.5, cursor: 'pointer', fontFamily: 'inherit',
                }}
              >
                Đóng
              </button>
            </div>
          ) : (
            <div style={{ padding: '18px 22px 22px' }}>
              {/* Countdown */}
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                marginBottom: 8, padding: '8px 0', borderRadius: 10,
                background: lowTime ? 'rgba(239,68,68,0.1)' : 'rgba(255,255,255,0.03)',
                border: `1px solid ${lowTime ? 'rgba(239,68,68,0.25)' : 'rgba(255,255,255,0.06)'}`,
              }}>
                <Clock size={14} color={lowTime ? '#f87171' : 'var(--text3)'} />
                <span style={{ fontSize: 13, color: 'var(--text3)' }}>Đơn có hiệu lực trong</span>
                <span style={{
                  fontSize: 15, fontWeight: 800, fontVariantNumeric: 'tabular-nums',
                  color: lowTime ? '#f87171' : 'var(--text)',
                }}>
                  {mm}:{ss}
                </span>
              </div>
              {/* Depleting time bar */}
              <div style={{ height: 3, borderRadius: 99, background: 'rgba(255,255,255,0.06)', overflow: 'hidden', marginBottom: 16 }}>
                <div style={{
                  height: '100%', width: `${pct}%`, borderRadius: 99,
                  background: lowTime ? 'linear-gradient(90deg,#f87171,#ef4444)' : BRAND,
                  backgroundSize: lowTime ? 'auto' : '300% 100%',
                  animation: lowTime ? undefined : 'gradShift 5s linear infinite',
                  boxShadow: lowTime ? '0 0 8px rgba(239,68,68,.6)' : '0 0 8px rgba(236,72,153,.5)',
                  transition: 'width 1s linear',
                }} />
              </div>

              {/* QR with scanner viewfinder */}
              {hasQr ? (
                <div style={{ position: 'relative', width: 'fit-content', margin: '0 auto 14px' }}>
                  {/* breathing glow behind */}
                  <div style={{
                    position: 'absolute', inset: -10, borderRadius: 20,
                    background: 'radial-gradient(circle, rgba(236,72,153,0.28), rgba(168,85,247,0.12) 55%, transparent 72%)',
                    filter: 'blur(10px)', animation: 'breathe 3s ease-in-out infinite', pointerEvents: 'none',
                  }} />
                  <div style={{ position: 'relative', background: '#fff', borderRadius: 14, padding: 12, overflow: 'hidden' }}>
                    {isBinance
                      ? (order.qr_content
                          ? <QRCodeSVG value={order.qr_content} size={208} level="M" marginSize={3} />
                          : <img src={order.qr_url} alt="QR Binance Pay" style={{ width: 208, height: 208, display: 'block' }} />)
                      : <QRCodeSVG value={order.qr_code!} size={208} level="M" marginSize={3} />
                    }
                    {/* scan line */}
                    <div style={{
                      position: 'absolute', left: 12, right: 12, height: 2, top: '6%',
                      background: 'linear-gradient(90deg,transparent,#fb923c,#f472b6,transparent)',
                      boxShadow: '0 0 12px 2px rgba(244,114,182,0.7)',
                      borderRadius: 2, animation: 'scanline 2.6s ease-in-out infinite', pointerEvents: 'none',
                    }} />
                  </div>
                  {/* corner brackets */}
                  <div style={{ position: 'absolute', top: -3, left: -3, width: 17, height: 17, borderTop: '2.5px solid #fb923c', borderLeft: '2.5px solid #fb923c', borderTopLeftRadius: 7, filter: 'drop-shadow(0 0 4px rgba(251,146,60,.6))' }} />
                  <div style={{ position: 'absolute', top: -3, right: -3, width: 17, height: 17, borderTop: '2.5px solid #f472b6', borderRight: '2.5px solid #f472b6', borderTopRightRadius: 7, filter: 'drop-shadow(0 0 4px rgba(244,114,182,.6))' }} />
                  <div style={{ position: 'absolute', bottom: -3, left: -3, width: 17, height: 17, borderBottom: '2.5px solid #a855f7', borderLeft: '2.5px solid #a855f7', borderBottomLeftRadius: 7, filter: 'drop-shadow(0 0 4px rgba(168,85,247,.6))' }} />
                  <div style={{ position: 'absolute', bottom: -3, right: -3, width: 17, height: 17, borderBottom: '2.5px solid #fb923c', borderRight: '2.5px solid #fb923c', borderBottomRightRadius: 7, filter: 'drop-shadow(0 0 4px rgba(251,146,60,.6))' }} />
                </div>
              ) : (
                <div style={{
                  marginBottom: 14, padding: '20px 16px', borderRadius: 14, textAlign: 'center',
                  background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.22)',
                }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#f87171', marginBottom: 4 }}>
                    Không tạo được mã QR
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text3)', lineHeight: 1.5 }}>
                    Vui lòng thử lại hoặc liên hệ hỗ trợ.
                    {order.checkout_url && (
                      <> <a href={order.checkout_url} target="_blank" rel="noopener noreferrer" style={{ color: '#fb923c' }}>Mở trang thanh toán</a></>
                    )}
                  </div>
                </div>
              )}

              <div style={{ textAlign: 'center', fontSize: 12, color: 'var(--text3)', marginBottom: 16 }}>
                {isBinance ? 'Mở app Binance → quét mã QR' : 'Mở app ngân hàng bất kỳ → quét mã VietQR'}
              </div>

              {/* Details */}
              {isBinance ? (
                <div style={{ textAlign: 'center', marginBottom: 16 }}>
                  <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Số tiền</div>
                  <div style={{
                    fontSize: 28, fontWeight: 900, letterSpacing: '-0.03em',
                    background: 'linear-gradient(115deg,#F5A623,#F7931A)',
                    WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
                  }}>
                    {(order.usdt_amount ?? 0).toFixed(2)}
                    <span style={{ fontSize: 14, fontWeight: 600 }}> USDT</span>
                  </div>
                </div>
              ) : (
                <div style={{
                  background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.06)',
                  borderRadius: 13, padding: '4px 14px', marginBottom: 14,
                }}>
                  {order.bank_name && (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                      <span style={{ fontSize: 11, color: 'var(--text3)' }}>Ngân hàng</span>
                      <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text)' }}>{order.bank_name}</span>
                    </div>
                  )}
                  {order.account_number && <CopyField label="Số tài khoản" value={order.account_number} />}
                  {order.account_name && (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 0', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                      <span style={{ fontSize: 11, color: 'var(--text3)' }}>Chủ tài khoản</span>
                      <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text)', textAlign: 'right' }}>{order.account_name}</span>
                    </div>
                  )}
                  <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                    <CopyField label="Số tiền" value={`${fmt(order.amount)}`} />
                  </div>
                  {order.description && (
                    <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                      <CopyField label="Nội dung chuyển khoản" value={order.description} />
                    </div>
                  )}
                </div>
              )}

              {/* Binance deep-link */}
              {isBinance && order.universal_url && (
                <a
                  href={order.universal_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                    width: '100%', padding: '11px 0', borderRadius: 11, marginBottom: 12,
                    background: 'linear-gradient(115deg,#F5A623,#F7931A)', color: '#fff',
                    fontWeight: 700, fontSize: 13, textDecoration: 'none', fontFamily: 'inherit',
                  }}
                >
                  <ExternalLink size={13} /> Mở app Binance
                </a>
              )}

              {/* Waiting (shimmer text) */}
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, marginBottom: 14,
              }}>
                <Loader2 size={13} className="spin" color={accent} />
                <span style={{
                  fontSize: 12, fontWeight: 600,
                  background: 'linear-gradient(90deg,#7c7068,#ffffff,#7c7068)', backgroundSize: '200% 100%',
                  WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
                  animation: 'shimmerText 2.2s linear infinite',
                }}>
                  Đang chờ xác nhận thanh toán...
                </span>
              </div>

              <div style={{
                display: 'flex', alignItems: 'flex-start', gap: 7, marginBottom: 14,
                fontSize: 11, color: 'var(--text3)', lineHeight: 1.5,
              }}>
                <ShieldCheck size={13} style={{ flexShrink: 0, marginTop: 1 }} />
                Chuyển khoản đúng số tiền và nội dung. Gói được kích hoạt tự động sau khi nhận tiền.
              </div>

              {/* Cancel */}
              <button
                onClick={cancel}
                disabled={cancelling}
                style={{
                  width: '100%', padding: '11px 0', borderRadius: 11,
                  background: 'transparent', border: '1px solid rgba(255,255,255,0.12)',
                  color: 'var(--text3)', fontWeight: 600, fontSize: 13,
                  cursor: cancelling ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                }}
              >
                {cancelling ? <><Loader2 size={13} className="spin" /> Đang hủy...</> : 'Hủy đơn'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
