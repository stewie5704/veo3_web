import { useEffect } from 'react'
import confetti from 'canvas-confetti'
import { useNavigate } from 'react-router-dom'
import { Crown, Bot, Rocket } from 'lucide-react'

function celebrate() {
  const end = Date.now() + 1400
  const colors = ['#F97316', '#EC4899', '#A855F7', '#fbbf24', '#4ade80']
  confetti({ particleCount: 140, spread: 95, startVelocity: 48, origin: { y: 0.55 }, colors })
  ;(function frame() {
    confetti({ particleCount: 6, angle: 60, spread: 60, origin: { x: 0 }, colors })
    confetti({ particleCount: 6, angle: 120, spread: 60, origin: { x: 1 }, colors })
    if (Date.now() < end) requestAnimationFrame(frame)
  })()
}

export default function WelcomeCelebration({
  planLabel, giftCount, onClose,
}: {
  planLabel: string
  giftCount: number
  onClose: () => void
}) {
  const navigate = useNavigate()

  useEffect(() => { celebrate() }, [])

  function startUsing() {
    onClose()
    navigate('/')
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,0.78)', backdropFilter: 'blur(8px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
        animation: 'fadeIn .25s ease',
      }}
    >
      <div style={{
        position: 'relative', width: '100%', maxWidth: 380, textAlign: 'center',
        background: 'linear-gradient(165deg,#221913,#16100d)',
        border: '1px solid rgba(249,115,22,0.3)', borderRadius: 26,
        padding: '40px 30px 30px',
        boxShadow: '0 40px 110px -20px rgba(249,115,22,0.35), 0 0 0 1px rgba(255,255,255,0.04)',
        animation: 'popIn .42s cubic-bezier(.2,.9,.3,1.3)',
      }}>
        {/* Crown badge */}
        <div style={{
          width: 76, height: 76, borderRadius: '50%', margin: '0 auto 20px',
          background: 'linear-gradient(135deg,#F97316,#EC4899)',
          display: 'grid', placeItems: 'center',
          boxShadow: '0 18px 44px -10px rgba(249,115,22,0.6), inset 0 2px 0 rgba(255,255,255,0.3)',
        }}>
          <Crown size={36} color="#fff" fill="#fff" />
        </div>

        <div style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 6, letterSpacing: '.04em' }}>
          Thanh toán thành công
        </div>
        <div style={{ fontSize: 23, fontWeight: 900, color: 'var(--text)', marginBottom: 8, letterSpacing: '-0.02em' }}>
          Chào mừng đến với
        </div>
        <div style={{
          fontSize: 30, fontWeight: 900, marginBottom: 22, letterSpacing: '-0.03em',
          background: 'linear-gradient(115deg,#fb923c,#f472b6,#a855f7)',
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
        }}>
          Gói {planLabel}
        </div>

        {giftCount > 0 && (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9,
            background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.28)',
            borderRadius: 14, padding: '13px 18px', marginBottom: 24,
          }}>
            <Bot size={20} color="#fbbf24" />
            <span style={{ fontSize: 14, color: 'var(--text)' }}>
              Tặng bạn <b style={{ color: '#fbbf24' }}>{giftCount} trợ lí AI</b>
            </span>
          </div>
        )}

        <button
          onClick={startUsing}
          style={{
            width: '100%', padding: '14px 0', borderRadius: 13, border: 'none',
            background: 'linear-gradient(115deg,#F97316,#EC4899 56%,#A855F7)',
            color: '#fff', fontWeight: 800, fontSize: 14.5, cursor: 'pointer',
            fontFamily: 'inherit', marginBottom: 10,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            boxShadow: '0 10px 30px -8px rgba(249,115,22,0.55), inset 0 1px 0 rgba(255,255,255,0.25)',
          }}
        >
          <Rocket size={16} /> Bắt đầu dùng ngay
        </button>
        <button
          onClick={onClose}
          style={{
            width: '100%', padding: '10px 0', borderRadius: 11, border: 'none',
            background: 'transparent', color: 'var(--text3)', fontWeight: 600, fontSize: 13,
            cursor: 'pointer', fontFamily: 'inherit',
          }}
        >
          Để sau
        </button>
      </div>
    </div>
  )
}
