import { useEffect, useState } from 'react'
import { billingApi } from '../api/client'
import { useToast } from '../components/Toast'
import { Crown, Check, Loader2 } from 'lucide-react'

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
        window.location.href = r.pay_url            // gateway có sẵn → chuyển tới trang thanh toán
      } else {
        toast('Đã tạo đơn. Thanh toán tự động đang cập nhật — chuyển khoản xong admin sẽ kích hoạt gói.', 'info')
      }
    } catch (e: any) {
      toast(e.response?.data?.detail || 'Lỗi tạo đơn', 'error')
    } finally {
      setBusy(null)
    }
  }

  const fmt = (n: number) => (n ?? 0).toLocaleString('vi-VN')

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Crown size={22} color="#fbbf24" /> Nâng gói
          </div>
          <div className="page-subtitle">Mua gói để tạo video không giới hạn trong thời hạn</div>
        </div>
      </div>

      {/* Trạng thái hiện tại */}
      <div className="card" style={{ marginBottom: 20 }}>
        {sub?.active ? (
          <div style={{ fontSize: 14 }}>
            ✅ Đang dùng gói <b style={{ color: '#fbbf24' }}>{sub.plan}</b> — còn <b>{sub.days_left}</b> ngày
            {sub.expires_at && <span style={{ color: 'var(--text3)' }}> (hết hạn {String(sub.expires_at).slice(0, 10)})</span>}
          </div>
        ) : (
          <div style={{ color: 'var(--text2)', fontSize: 14 }}>
            🔒 Chưa có gói đang hoạt động. Chọn 1 gói bên dưới để bắt đầu tạo video.
          </div>
        )}
      </div>

      {/* Danh sách gói */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
        {plans.map(p => (
          <div key={p.id} className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ fontSize: 16, fontWeight: 700 }}>{p.label}</div>
            <div style={{ fontSize: 26, fontWeight: 800, color: '#fbbf24' }}>
              {fmt(p.price)} <span style={{ fontSize: 13, color: 'var(--text3)' }}>{p.currency}</span>
            </div>
            <div style={{ fontSize: 13, color: 'var(--text2)', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Check size={14} color="var(--green)" /> {p.days} ngày · tạo không giới hạn
            </div>
            <button className="btn btn-primary" disabled={busy === p.id} onClick={() => buy(p.id)} style={{ marginTop: 'auto' }}>
              {busy === p.id ? <><Loader2 size={13} className="spin" /> Đang xử lý...</> : (sub?.active ? 'Gia hạn / Nâng' : 'Mua gói')}
            </button>
          </div>
        ))}
      </div>

      <p className="hint" style={{ marginTop: 16 }}>
        Mua thêm = cộng dồn ngày vào hạn hiện tại. Thanh toán tự động (VNPay/MoMo) sẽ sớm có; tạm thời chuyển khoản rồi admin kích hoạt.
      </p>
    </div>
  )
}
