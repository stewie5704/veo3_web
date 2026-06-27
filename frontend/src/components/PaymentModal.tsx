import { useEffect, useRef, useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { billingApi } from '../api/client'
import {
  X, Copy, Check, Loader2, Clock, ShieldCheck, ExternalLink, Landmark, Coins,
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
        {copied ? <Check size={12} /> : <Copy size={12} />}
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
  const fmt = (n: number) => (n ?? 0).toLocaleString('vi-VN')

  return (
    <div
      onClick={cancelling ? undefined : onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 999,
        background: 'rgba(0,0,0,0.74)', backdropFilter: 'blur(6px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'linear-gradient(160deg,#1a1614,#110e0c)',
          border: `1px solid ${isBinance ? 'rgba(245,166,35,0.22)' : 'rgba(249,115,22,0.2)'}`,
          borderRadius: 22, width: '100%', maxWidth: 400, overflow: 'hidden',
          boxShadow: '0 40px 100px -20px rgba(0,0,0,0.9)', position: 'relative',
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '18px 20px 14px', borderBottom: '1px solid rgba(255,255,255,0.06)',
        }}>
          <div style={{
            width: 34, height: 34, borderRadius: 10, display: 'grid', placeItems: 'center',
            background: isBinance ? 'rgba(245,166,35,0.14)' : 'rgba(249,115,22,0.14)',
          }}>
            {isBinance ? <Coins size={17} color="#F5A623" /> : <Landmark size={17} color="#fb923c" />}
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
          <div style={{ padding: '20px 22px 22px' }}>
            {/* Countdown */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
              marginBottom: 16, padding: '8px 0', borderRadius: 10,
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

            {/* QR */}
            {hasQr ? (
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 14 }}>
                <div style={{ background: '#fff', borderRadius: 14, padding: 12 }}>
                  {isBinance
                    ? (order.qr_content
                        ? <QRCodeSVG value={order.qr_content} size={208} level="M" marginSize={3} />
                        : <img src={order.qr_url} alt="QR Binance Pay" style={{ width: 208, height: 208, display: 'block' }} />)
                    : <QRCodeSVG value={order.qr_code!} size={208} level="M" marginSize={3} />
                  }
                </div>
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

            {/* Waiting + warning */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
              fontSize: 12, color: 'var(--text3)', marginBottom: 14,
            }}>
              <Loader2 size={13} className="spin" /> Đang chờ xác nhận thanh toán...
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
  )
}
