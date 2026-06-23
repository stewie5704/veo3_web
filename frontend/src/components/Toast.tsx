import { createContext, useContext, useState, useCallback, ReactNode } from 'react'
import { CheckCircle, XCircle, AlertCircle, Info, X } from 'lucide-react'

type ToastType = 'success' | 'error' | 'warn' | 'info'
interface Toast { id: number; type: ToastType; msg: string }

const ToastCtx = createContext<(msg: string, type?: ToastType) => void>(() => {})
export const useToast = () => useContext(ToastCtx)

let _counter = 0

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const add = useCallback((msg: string, type: ToastType = 'info') => {
    const id = ++_counter
    setToasts(ts => [...ts, { id, type, msg }])
    setTimeout(() => setToasts(ts => ts.filter(t => t.id !== id)), 4000)
  }, [])

  const remove = (id: number) => setToasts(ts => ts.filter(t => t.id !== id))

  const ICONS = { success: CheckCircle, error: XCircle, warn: AlertCircle, info: Info }
  const COLORS = {
    success: { bg: 'rgba(74,222,128,0.1)', border: 'rgba(74,222,128,0.25)', color: '#4ade80' },
    error: { bg: 'rgba(248,113,113,0.1)', border: 'rgba(248,113,113,0.25)', color: '#f87171' },
    warn: { bg: 'rgba(251,191,36,0.1)', border: 'rgba(251,191,36,0.25)', color: '#fbbf24' },
    info: { bg: 'rgba(124,92,252,0.1)', border: 'rgba(124,92,252,0.25)', color: '#a78bfa' },
  }

  return (
    <ToastCtx.Provider value={add}>
      {children}
      <div style={{ position: 'fixed', bottom: 70, right: 24, zIndex: 9999, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {toasts.map(t => {
          const Icon = ICONS[t.type]
          const c = COLORS[t.type]
          return (
            <div key={t.id} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              background: c.bg, border: `1px solid ${c.border}`,
              backdropFilter: 'blur(12px)', borderRadius: 10,
              padding: '10px 14px', fontSize: 13, color: '#f0f0ff',
              boxShadow: '0 8px 30px rgba(0,0,0,0.3)',
              animation: 'toast-in 0.2s ease', minWidth: 260, maxWidth: 380,
            }}>
              <Icon size={15} color={c.color} />
              <span style={{ flex: 1 }}>{t.msg}</span>
              <button onClick={() => remove(t.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.3)', padding: 2 }}>
                <X size={13} />
              </button>
            </div>
          )
        })}
      </div>
    </ToastCtx.Provider>
  )
}
