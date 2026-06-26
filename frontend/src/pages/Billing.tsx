import { useEffect, useState } from 'react'
import { billingApi } from '../api/client'
import { useToast } from '../components/Toast'
import { Crown, Check, Loader2, CalendarCheck, RefreshCw, Shield, Sparkles, Zap } from 'lucide-react'

type PlanType = 'basic' | 'pro' | 'annual'

function getPlanType(p: any): PlanType {
  if ((p.days ?? 0) >= 365) return 'annual'
  if ((p.label || '').toLowerCase().includes('pro')) return 'pro'
  return 'basic'
}

const FEATURES: Record<PlanType, string[]> = {
  annual: [
    'Mọi thứ của Pro tháng',
    'Tiết kiệm ~17% so với tháng',
    'Thanh toán 1 lần mỗi năm',
    'Ưu tiên hàng đợi cao nhất',
  ],
  pro: [
    'Tạo video không giới hạn',
    'Mọi model: Lite, Fast, Quality',
    'Ưu tiên hàng đợi render',
    'Giữ mặt nhân vật xuyên cảnh',
    'Hỗ trợ ưu tiên',
  ],
  basic: [
    'Tạo dự án không giới hạn',
    'Model Veo 3.1 Lite (FREE)',
    'Giữ mặt nhân vật',
    'Ghép phim tự động',
  ],
}

export default function Billing() {
  const toast = useToast()
  const [plans, setPlans] = useState<any[]>([])
  const [sub, setSub] = useState<any>(null)
  const [busy, setBusy] = useState<string | null>(null)

  function load() {
    billingApi.plans().then(d => setPlans(d.plans || [])).catch(() => {})
    billingApi.me().then(setSub).catch(() => {})
  }
  useEffect(load, [])

  async function buy(planId: string) {
    setBusy(planId)
    try {
      const r = await billingApi.checkout(planId)
      if (r.pay_url) {
        window.location.href = r.pay_url
      } else {
        toast('Đã tạo đơn. Chuyển khoản xong admin sẽ kích hoạt gói.', 'info')
      }
    } catch (e: any) {
      toast(e.response?.data?.detail || 'Lỗi tạo đơn', 'error')
    } finally {
      setBusy(null)
    }
  }

  const fmt = (n: number) => (n ?? 0).toLocaleString('vi-VN')
  const hasFeaturedCenter = plans.length === 3 && getPlanType(plans[1]) === 'pro'

  return (
    <div style={{ maxWidth: 880, margin: '0 auto' }}>

      {/* ── Header ── */}
      <div className="page-header">
        <div>
          <div className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Crown size={22} color="#fbbf24" /> Nâng gói
          </div>
          <div className="page-subtitle">Bắt đầu miễn phí. Nâng gói khi cần. Hủy bất cứ lúc nào.</div>
        </div>
      </div>

      {/* ── Current plan status ── */}
      {sub && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 14,
          background: sub.active
            ? 'linear-gradient(130deg, rgba(249,115,22,0.1), rgba(236,72,153,0.06))'
            : 'rgba(255,255,255,0.025)',
          border: `1px solid ${sub.active ? 'rgba(249,115,22,0.28)' : 'rgba(255,255,255,0.07)'}`,
          borderRadius: 16, padding: '14px 20px', marginBottom: 36,
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
                Chưa có gói hoạt động — chọn gói bên dưới để bắt đầu
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

      {/* ── Plan cards ── */}
      {plans.length === 0 ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16 }}>
          {[0, 1, 2].map(i => (
            <div key={i} style={{
              borderRadius: 22, padding: '26px 22px', height: 320,
              background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.06)',
              animation: 'shimmer 1.6s infinite', opacity: 0.6,
            }} />
          ))}
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: hasFeaturedCenter ? '1fr 1.07fr 1fr' : `repeat(${plans.length}, 1fr)`,
          gap: 14,
          alignItems: 'center',
        }}>
          {plans.map((p) => {
            const type = getPlanType(p)
            const featured = type === 'pro'
            const annual = type === 'annual'
            const features = FEATURES[type]
            const period = (p.days ?? 0) >= 365 ? '/năm' : '/tháng'

            return (
              <div key={p.id} style={{
                position: 'relative',
                borderRadius: 22,
                padding: featured ? '36px 26px 28px' : '30px 22px 24px',
                display: 'flex', flexDirection: 'column', gap: 0,
                background: featured
                  ? 'linear-gradient(155deg, rgba(249,115,22,0.11), rgba(236,72,153,0.08), rgba(168,85,247,0.05))'
                  : annual
                    ? 'linear-gradient(155deg, rgba(168,85,247,0.07), rgba(59,130,246,0.04))'
                    : 'rgba(255,255,255,0.025)',
                border: featured
                  ? '1px solid rgba(249,115,22,0.38)'
                  : annual
                    ? '1px solid rgba(139,92,246,0.28)'
                    : '1px solid rgba(255,255,255,0.07)',
                boxShadow: featured
                  ? '0 0 0 1px rgba(249,115,22,0.12), 0 32px 72px -20px rgba(249,115,22,0.22)'
                  : 'none',
              }}>

                {/* Badge */}
                {(featured || annual) && (
                  <div style={{
                    position: 'absolute', top: -13, left: '50%', transform: 'translateX(-50%)',
                    background: featured
                      ? 'linear-gradient(115deg, #F97316, #EC4899)'
                      : 'linear-gradient(115deg, #8B5CF6, #3B82F6)',
                    color: '#fff', fontSize: 10.5, fontWeight: 800,
                    padding: '4px 14px', borderRadius: 99, whiteSpace: 'nowrap',
                    letterSpacing: '.06em', textTransform: 'uppercase',
                    boxShadow: featured
                      ? '0 6px 18px -6px rgba(249,115,22,0.55)'
                      : '0 6px 18px -6px rgba(139,92,246,0.55)',
                  }}>
                    {featured ? 'Phổ biến nhất' : 'Tiết kiệm 17%'}
                  </div>
                )}

                {/* Plan name */}
                <div style={{
                  fontSize: 12, fontWeight: 600, letterSpacing: '.08em', textTransform: 'uppercase',
                  color: featured ? 'rgba(251,146,60,0.75)' : 'var(--text3)',
                  marginBottom: 12,
                }}>
                  {p.label}
                </div>

                {/* Price */}
                <div style={{ marginBottom: 4 }}>
                  <span style={{
                    fontSize: featured ? 52 : 46, fontWeight: 900,
                    letterSpacing: '-0.035em', lineHeight: 1,
                    ...(featured
                      ? { background: 'linear-gradient(115deg,#fb923c,#f472b6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }
                      : { color: 'var(--text)' }),
                  }}>
                    {fmt(p.price)}
                  </span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text3)', marginLeft: 5 }}>
                    {p.currency}
                  </span>
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
                <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 24px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {features.map((f, i) => (
                    <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 9, fontSize: 13, color: 'var(--text2)', lineHeight: 1.5 }}>
                      <span style={{
                        flexShrink: 0, marginTop: 1,
                        width: 18, height: 18, borderRadius: '50%',
                        background: featured ? 'rgba(249,115,22,0.14)' : 'rgba(74,222,128,0.1)',
                        display: 'grid', placeItems: 'center',
                      }}>
                        <Check size={10} color={featured ? '#fb923c' : 'var(--green)'} strokeWidth={3} />
                      </span>
                      {f}
                    </li>
                  ))}
                </ul>

                {/* CTA */}
                <button
                  disabled={busy === p.id}
                  onClick={() => buy(p.id)}
                  style={{
                    marginTop: 'auto', width: '100%', padding: '13px 0',
                    borderRadius: 13, fontSize: 13.5, fontWeight: 700,
                    cursor: busy === p.id ? 'not-allowed' : 'pointer',
                    border: 'none', fontFamily: 'inherit',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                    transition: 'filter .18s, transform .14s',
                    ...(featured
                      ? {
                          background: 'linear-gradient(115deg, #F97316, #EC4899 56%, #A855F7)',
                          color: '#fff',
                          boxShadow: '0 8px 28px -8px rgba(249,115,22,0.55), inset 0 1px 0 rgba(255,255,255,0.22)',
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
                  onMouseEnter={e => { if (busy !== p.id) (e.currentTarget as HTMLElement).style.filter = 'brightness(1.1)' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.filter = 'brightness(1)' }}
                >
                  {busy === p.id
                    ? <><Loader2 size={13} className="spin" /> Đang xử lý...</>
                    : <><Zap size={13} /> {sub?.active ? 'Gia hạn / Nâng' : 'Bắt đầu ngay'}</>
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
          { icon: Sparkles,   text: 'Mọi tính năng trong mọi gói' },
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

      <p style={{ marginTop: 16, fontSize: 12, color: 'var(--text3)', textAlign: 'center', lineHeight: 1.7 }}>
        Thanh toán VNPay/MoMo sẽ sớm có. Hiện tại: chuyển khoản rồi admin kích hoạt thủ công.
      </p>
    </div>
  )
}
