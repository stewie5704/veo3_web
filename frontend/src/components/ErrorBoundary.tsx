import { Component, ReactNode } from 'react'

interface Props { children: ReactNode }
interface State { hasError: boolean }

/** Chặn crash 1 route làm trắng cả app. Bắt lỗi render, hiện màn hình lỗi + nút tải lại.
 *  KHÔNG log ra ngoài (tránh lộ chi tiết) — chỉ console.error cho dev. */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  render() {
    if (!this.state.hasError) return this.props.children
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24,
        textAlign: 'center', color: 'var(--text, #e5e7eb)', background: 'var(--bg, #0b0b0f)',
      }}>
        <div style={{ fontSize: 40 }}>⚠️</div>
        <h2 style={{ margin: 0, fontSize: 20 }}>Đã có lỗi xảy ra</h2>
        <p style={{ margin: 0, color: 'var(--text3, #9ca3af)', maxWidth: 420, fontSize: 14 }}>
          Giao diện gặp sự cố. Bạn thử tải lại trang, nếu vẫn lỗi hãy báo hỗ trợ.
        </p>
        <button
          onClick={() => window.location.reload()}
          style={{
            padding: '10px 22px', borderRadius: 10, border: 'none', cursor: 'pointer',
            fontWeight: 600, color: '#fff',
            background: 'linear-gradient(115deg,#F97316,#EC4899 56%,#A855F7)',
          }}
        >Tải lại trang</button>
      </div>
    )
  }
}
