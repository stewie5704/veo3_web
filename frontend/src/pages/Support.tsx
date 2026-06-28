import { useState } from 'react'
import { LifeBuoy, Copy, Check, ExternalLink, Users } from 'lucide-react'

// Liên hệ hỗ trợ — sửa tại đây khi đổi.
const TELEGRAM = 'thaidem57'
const ZALO_PHONE = '0366566303'
const ZALO_GROUP = ''   // TODO: dán link nhóm Zalo hỗ trợ khi có (để rỗng -> hiện "Sắp có")

// Logo Telegram (lucide không có icon thương hiệu) — máy bay giấy.
function TgIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="#fff" aria-hidden="true">
      <path d="M9.78 18.65l.28-4.23 7.68-6.92c.34-.31-.07-.46-.52-.19L7.74 13.3 3.64 12c-.88-.25-.89-.86.2-1.3l15.97-6.16c.73-.33 1.43.18 1.15 1.3l-2.72 12.81c-.19.91-.74 1.13-1.5.71L12.6 16.3l-1.99 1.93c-.23.23-.42.42-.83.42z" />
    </svg>
  )
}

export default function Support() {
  const [copied, setCopied] = useState<string | null>(null)
  const copy = async (text: string, key: string) => {
    try { await navigator.clipboard.writeText(text); setCopied(key); setTimeout(() => setCopied(null), 1800) } catch { /* ignore */ }
  }

  const row: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }

  return (
    <div style={{ maxWidth: 600, margin: '0 auto' }}>
      <div className="page-header">
        <div>
          <div className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <LifeBuoy size={22} color="#fb923c" /> Hỗ trợ
          </div>
          <div className="page-subtitle">Liên hệ đội ngũ AI AutoCut — phản hồi nhanh qua Telegram / Zalo</div>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {/* Telegram */}
        <div className="card" style={row}>
          <div style={{ width: 46, height: 46, borderRadius: 13, background: '#229ED9', display: 'grid', placeItems: 'center', flexShrink: 0, boxShadow: '0 6px 16px -6px rgba(34,158,217,.7)' }}><TgIcon /></div>
          <div style={{ flex: 1, minWidth: 120 }}>
            <div style={{ fontSize: 13.5, fontWeight: 700 }}>Telegram</div>
            <div style={{ fontSize: 13, color: 'var(--text2)', fontFamily: 'var(--mono)' }}>@{TELEGRAM}</div>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={() => copy('@' + TELEGRAM, 'tg')}>
            {copied === 'tg' ? <><Check size={13} /> Đã chép</> : <><Copy size={13} /> Chép</>}
          </button>
          <a className="btn btn-primary btn-sm" href={`https://t.me/${TELEGRAM}`} target="_blank" rel="noreferrer">
            <ExternalLink size={13} /> Nhắn
          </a>
        </div>

        {/* Zalo */}
        <div className="card" style={row}>
          <div style={{ width: 46, height: 46, borderRadius: 13, background: '#0068FF', display: 'grid', placeItems: 'center', flexShrink: 0, color: '#fff', fontWeight: 800, fontSize: 13.5, letterSpacing: '-.4px', boxShadow: '0 6px 16px -6px rgba(0,104,255,.7)' }}>Zalo</div>
          <div style={{ flex: 1, minWidth: 120 }}>
            <div style={{ fontSize: 13.5, fontWeight: 700 }}>Zalo</div>
            <div style={{ fontSize: 13, color: 'var(--text2)', fontFamily: 'var(--mono)' }}>{ZALO_PHONE}</div>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={() => copy(ZALO_PHONE, 'zalo')}>
            {copied === 'zalo' ? <><Check size={13} /> Đã chép</> : <><Copy size={13} /> Chép</>}
          </button>
          <a className="btn btn-primary btn-sm" href={`https://zalo.me/${ZALO_PHONE}`} target="_blank" rel="noreferrer">
            <ExternalLink size={13} /> Nhắn
          </a>
        </div>

        {/* Nhóm Zalo hỗ trợ */}
        <div className="card" style={row}>
          <div style={{ width: 46, height: 46, borderRadius: 13, background: 'rgba(0,104,255,.15)', display: 'grid', placeItems: 'center', flexShrink: 0, color: '#4d9bff' }}><Users size={20} /></div>
          <div style={{ flex: 1, minWidth: 120 }}>
            <div style={{ fontSize: 13.5, fontWeight: 700 }}>Nhóm Zalo hỗ trợ</div>
            <div style={{ fontSize: 12.5, color: 'var(--text3)' }}>{ZALO_GROUP ? 'Tham gia nhóm để được hỗ trợ & cập nhật nhanh' : 'Đang cập nhật — sắp có'}</div>
          </div>
          {ZALO_GROUP
            ? <a className="btn btn-primary btn-sm" href={ZALO_GROUP} target="_blank" rel="noreferrer"><ExternalLink size={13} /> Vào nhóm</a>
            : <span className="badge" style={{ background: 'rgba(255,255,255,0.06)', color: 'var(--text3)' }}>Sắp có</span>}
        </div>
      </div>

      <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 18, lineHeight: 1.6, textAlign: 'center' }}>
        Khi nhắn hỗ trợ, gửi kèm <b>email tài khoản</b> của bạn để được tra cứu nhanh.
      </div>
    </div>
  )
}
