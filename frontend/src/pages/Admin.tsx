import { useState, useEffect } from 'react'
import api from '../api/client'
import { useToast } from '../components/Toast'
import { Users, Shield, BarChart3, Trash2, Ban, CheckCircle, Search, RefreshCw } from 'lucide-react'

export default function Admin() {
  const toast = useToast()
  const [tab, setTab] = useState<'stats'|'users'>('stats')
  const [stats, setStats] = useState<any>(null)
  const [users, setUsers] = useState<any[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)
  const [editing, setEditing] = useState<string | null>(null)
  const [editQuota, setEditQuota] = useState(100)

  async function loadStats() {
    const r = await api.get('/admin/stats')
    setStats(r.data)
  }

  async function loadUsers(q = '') {
    setLoading(true)
    const r = await api.get(`/admin/users?search=${q}`)
    setUsers(r.data)
    setLoading(false)
  }

  useEffect(() => { loadStats(); loadUsers() }, [])

  async function patch(id: string, data: any) {
    await api.patch(`/admin/users/${id}`, data)
    toast('Đã cập nhật', 'success')
    loadUsers(search)
  }

  async function delUser(id: string, name: string) {
    if (!confirm(`Xóa user @${name}?`)) return
    await api.delete(`/admin/users/${id}`)
    toast(`Đã xóa @${name}`, 'success')
    setUsers(us => us.filter(u => u.id !== id))
  }

  const STAT_CARDS = stats ? [
    { label: 'Tổng user', value: stats.total_users, color: '#7c5cfc', icon: Users },
    { label: 'User active', value: stats.active_users, color: '#4ade80', icon: CheckCircle },
    { label: 'Tổng video', value: stats.total_videos, color: '#22d3ee', icon: BarChart3 },
    { label: 'Video thành công', value: stats.done_videos, color: '#f472b6', icon: CheckCircle },
    { label: 'Dự án', value: stats.total_projects, color: '#fbbf24', icon: BarChart3 },
    { label: 'Tổng scene', value: stats.total_scenes, color: '#a78bfa', icon: BarChart3 },
  ] : []

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Shield size={22} color="#a78bfa" /> Admin Panel
          </div>
          <div className="page-subtitle">Quản lý user, xem thống kê hệ thống</div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 4, marginBottom: 24 }}>
        {[{ k: 'stats', l: 'Thống kê', i: BarChart3 }, { k: 'users', l: 'Users', i: Users }].map(t => {
          const Icon = t.i
          return (
            <button key={t.k} onClick={() => setTab(t.k as any)} style={{
              display: 'flex', alignItems: 'center', gap: 7, padding: '8px 16px', borderRadius: 9,
              border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600, transition: 'all 0.15s',
              background: tab === t.k ? 'rgba(124,92,252,0.15)' : 'rgba(255,255,255,0.04)',
              color: tab === t.k ? '#a78bfa' : '#6060a0',
              outline: tab === t.k ? '1px solid rgba(124,92,252,0.25)' : '1px solid transparent',
            }}>
              <Icon size={14} /> {t.l}
            </button>
          )
        })}
      </div>

      {tab === 'stats' && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
            {STAT_CARDS.map(s => {
              const Icon = s.icon
              return (
                <div key={s.label} className="stat-card" style={{ '--grad': `linear-gradient(90deg, ${s.color}, transparent)` } as any}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div className="stat-value" style={{ color: s.color }}>{s.value?.toLocaleString()}</div>
                      <div className="stat-label">{s.label}</div>
                    </div>
                    <Icon size={20} color={s.color} style={{ opacity: 0.4 }} />
                  </div>
                </div>
              )
            })}
          </div>
          {stats && (
            <div className="card">
              <div className="card-header"><BarChart3 size={15} /> Tỷ lệ thành công</div>
              <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 8 }}>
                {stats.total_videos > 0
                  ? `${Math.round((stats.done_videos / stats.total_videos) * 100)}% video render thành công`
                  : 'Chưa có video'}
              </div>
              <div className="progress-bar" style={{ height: 6 }}>
                <div className="progress-fill" style={{ width: stats.total_videos > 0 ? `${(stats.done_videos / stats.total_videos) * 100}%` : '0%' }} />
              </div>
            </div>
          )}
        </div>
      )}

      {tab === 'users' && (
        <div className="card">
          <div style={{ display: 'flex', gap: 12, marginBottom: 16, alignItems: 'center' }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)' }} />
              <input className="form-input" style={{ paddingLeft: 36 }} placeholder="Tìm theo username / email..."
                value={search} onChange={e => setSearch(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && loadUsers(search)} />
            </div>
            <button className="btn btn-ghost btn-sm" onClick={() => loadUsers(search)}>
              <RefreshCw size={13} /> Làm mới
            </button>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  {['Username', 'Email', 'Trạng thái', 'Google', 'Quota', 'Videos', 'Ngày tạo', 'Actions'].map(h => (
                    <th key={h} style={{ padding: '8px 12px', textAlign: 'left', color: 'var(--text3)', fontWeight: 500, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={8} style={{ textAlign: 'center', padding: 40, color: 'var(--text3)' }}>Đang tải...</td></tr>
                ) : users.map(u => (
                  <tr key={u.id} style={{ borderBottom: '1px solid var(--border)', transition: 'background 0.15s' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg3)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                    <td style={{ padding: '10px 12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{
                          width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                          background: 'linear-gradient(135deg, #7c5cfc, #f472b6)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 12, fontWeight: 700, color: '#fff',
                        }}>{u.username[0].toUpperCase()}</div>
                        <div>
                          <div style={{ fontWeight: 600 }}>{u.username}</div>
                          {u.is_admin && <span style={{ fontSize: 10, color: '#fbbf24' }}>👑 Admin</span>}
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '10px 12px', color: 'var(--text2)' }}>{u.email}</td>
                    <td style={{ padding: '10px 12px' }}>
                      {u.is_banned
                        ? <span className="badge badge-failed">Banned</span>
                        : u.is_active
                          ? <span className="badge badge-done">Active</span>
                          : <span className="badge badge-pending">Inactive</span>
                      }
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      {u.google_connected
                        ? <span className="badge badge-done">Ultra ✓</span>
                        : u.has_gemini_key
                          ? <span className="badge badge-processing">Gemini</span>
                          : <span style={{ color: 'var(--text3)', fontSize: 11 }}>—</span>}
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      {editing === u.id ? (
                        <div style={{ display: 'flex', gap: 4 }}>
                          <input type="number" value={editQuota} onChange={e => setEditQuota(+e.target.value)}
                            style={{ width: 70, padding: '2px 6px', background: 'var(--bg3)', border: '1px solid var(--accent)', borderRadius: 5, color: 'var(--text)', fontSize: 12 }} />
                          <button className="btn btn-primary btn-sm" onClick={() => { patch(u.id, { quota_videos: editQuota }); setEditing(null) }}>✓</button>
                          <button className="btn btn-ghost btn-sm" onClick={() => setEditing(null)}>✕</button>
                        </div>
                      ) : (
                        <span style={{ cursor: 'pointer', color: 'var(--accent2)' }}
                          onClick={() => { setEditing(u.id); setEditQuota(u.quota_videos) }}>
                          {u.quota_videos === -1 ? '∞' : u.quota_videos}
                        </span>
                      )}
                    </td>
                    <td style={{ padding: '10px 12px', color: 'var(--text2)' }}>{u.videos_generated}</td>
                    <td style={{ padding: '10px 12px', color: 'var(--text3)', fontSize: 11 }}>
                      {new Date(u.created_at).toLocaleDateString('vi-VN')}
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button className="btn btn-ghost btn-sm btn-icon" title={u.is_banned ? 'Unban' : 'Ban'}
                          onClick={() => patch(u.id, { is_banned: !u.is_banned })}>
                          <Ban size={12} color={u.is_banned ? 'var(--green)' : 'var(--red)'} />
                        </button>
                        <button className="btn btn-danger btn-sm btn-icon" title="Xóa user"
                          onClick={() => delUser(u.id, u.username)}>
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
