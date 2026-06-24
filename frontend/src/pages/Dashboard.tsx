import { useEffect, useState, useRef, useCallback } from 'react'
import { Routes, Route, useNavigate, useLocation, Link } from 'react-router-dom'
import {
  Zap, FolderOpen, Library, Wrench, Settings,
  LogOut, Wifi, WifiOff, Gem, Terminal, ChevronUp, ChevronDown,
  Video, Shield, Plus, RefreshCw, Crown, PanelLeftClose, PanelLeftOpen
} from 'lucide-react'
import { authApi, mediaApi, projectsApi, statusApi, extensionApi } from '../api/client'
import CreateVideo from './CreateVideo'
import Projects from './Projects'
import ProjectDetail from './ProjectDetail'
import MyVideos from './MyVideos'
import Tools from './Tools'
import Settings2 from './Settings'
import Admin from './Admin'
import Billing from './Billing'

export const logStore: { msg: string; level: string; ts: string }[] = []
export let logListeners: (() => void)[] = []
export function pushLog(msg: string, level = 'info') {
  logStore.push({ msg, level, ts: new Date().toLocaleTimeString('vi-VN') })
  if (logStore.length > 500) logStore.shift()
  logListeners.forEach(l => l())
}

type NavItem = { path: string; icon: any; label: string; exact?: boolean; userOnly?: boolean; adminOnly?: boolean }
// userOnly = chỉ user thường (admin không tạo video, ẩn đi). adminOnly = chỉ admin.
const NAV: NavItem[] = [
  { path: '/', icon: Zap, label: 'Tạo Video', exact: true, userOnly: true },
  { path: '/projects', icon: FolderOpen, label: 'Dự án', userOnly: true },
  { path: '/videos', icon: Library, label: 'Thư viện', userOnly: true },
  { path: '/tools', icon: Wrench, label: 'Công cụ', userOnly: true },
  { path: '/billing', icon: Crown, label: 'Nâng gói', userOnly: true },
  { path: '/settings', icon: Settings, label: 'Cài đặt' },
  { path: '/admin', icon: Shield, label: 'Admin', adminOnly: true },
]

export default function Dashboard() {
  const [user, setUser] = useState<any>(null)
  const [extConnected, setExtConnected] = useState(false)
  const [credits, setCredits] = useState<number | null>(null)
  const [logOpen, setLogOpen] = useState(false)
  const [logs, setLogs] = useState<typeof logStore>([])
  const [unread, setUnread] = useState(0)
  const [projects, setProjects] = useState<any[]>([])
  const [activeProject, setActiveProject] = useState<string | null>(null)
  const [workerStatus, setWorkerStatus] = useState<{processing:number;pending:number;active_workers:number} | null>(null)
  const logEndRef = useRef<HTMLDivElement>(null)
  const nav = useNavigate()
  const loc = useLocation()
  const [navExpanded, setNavExpanded] = useState(() => localStorage.getItem('navExpanded') !== '0')
  const navWidth = navExpanded ? 208 : 58
  const toggleNav = () => setNavExpanded(v => { localStorage.setItem('navExpanded', v ? '0' : '1'); return !v })

  useEffect(() => {
    authApi.me().then(u => {
      setUser(u)
      if (u.google_connected) {
        mediaApi.credits().then(r => setCredits(r.credits)).catch(() => {})
      }
    }).catch(() => nav('/login'))
  }, [])

  // Admin chỉ quản lý → vào thẳng trang Admin (không phải trang Tạo Video)
  useEffect(() => {
    if (user?.is_admin && loc.pathname === '/') nav('/admin', { replace: true })
  }, [user, loc.pathname])

  // Load project list
  const loadProjects = useCallback(() => {
    projectsApi.list().then(setProjects).catch(() => {})
  }, [])

  useEffect(() => { loadProjects() }, [])

  // Poll worker status every 5s
  useEffect(() => {
    const poll = () => statusApi.get().then(setWorkerStatus).catch(() => {})
    poll()
    const t = setInterval(poll, 5000)
    return () => clearInterval(t)
  }, [])


  // Poll extension status (do NOT open a /ws/extension socket here — that would shadow the
  // real extension's connection on the server and break captcha).
  useEffect(() => {
    const poll = () => extensionApi.status().then(s => setExtConnected(!!s.connected)).catch(() => setExtConnected(false))
    poll()
    const t = setInterval(poll, 5000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    const l = () => { setLogs([...logStore]); if (!logOpen) setUnread(n => n + 1) }
    logListeners.push(l)
    return () => { logListeners = logListeners.filter(x => x !== l) }
  }, [logOpen])

  useEffect(() => {
    if (logOpen) logEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [logs, logOpen])

  // Detect active project from URL
  useEffect(() => {
    const m = loc.pathname.match(/^\/projects\/(.+)/)
    if (m) setActiveProject(m[1])
    else if (loc.pathname === '/projects') setActiveProject(null)
  }, [loc.pathname])

  function isActive(path: string, exact?: boolean) {
    return exact ? loc.pathname === path : loc.pathname === path || loc.pathname.startsWith(path + '/')
  }

  // Panel danh sách dự án chỉ hiện khi XEM chi tiết 1 dự án; màn "Tạo dự án" (/projects) để trống cho composer rộng.
  const isProjectDetail = /^\/projects\/[^/]+/.test(loc.pathname)

  return (
    <div className="app-layout">

      {/* ── Sidebar (thu gọn / xả ra) ── */}
      <nav style={{
        width: navWidth, minHeight: '100vh', position: 'fixed', top: 0, left: 0, bottom: 0, zIndex: 60,
        background: 'rgba(10,8,6,0.96)', borderRight: '1px solid rgba(249,115,22,0.08)',
        display: 'flex', flexDirection: 'column', alignItems: navExpanded ? 'stretch' : 'center',
        padding: navExpanded ? '14px 10px' : '14px 0', gap: 4,
        transition: 'width 0.2s ease',
      }}>
        {/* Logo + brand + toggle */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, width: '100%',
          flexDirection: navExpanded ? 'row' : 'column',
          justifyContent: navExpanded ? 'space-between' : 'center',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, overflow: 'hidden' }}>
            <div style={{
              width: 34, height: 34, borderRadius: 10, flexShrink: 0,
              background: 'linear-gradient(135deg, #f97316, #ea580c)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 0 20px rgba(249,115,22,0.4)',
            }}>
              <Video size={17} color="#fff" strokeWidth={2.5} />
            </div>
            {navExpanded && <span style={{ fontWeight: 800, fontSize: 15, color: '#fff', whiteSpace: 'nowrap', letterSpacing: '0.3px' }}>AI AutoCut</span>}
          </div>
          <button onClick={toggleNav} title={navExpanded ? 'Thu gọn' : 'Mở rộng'} style={{
            width: 30, height: 30, borderRadius: 8, flexShrink: 0,
            background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)',
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#a08060',
          }}>
            {navExpanded ? <PanelLeftClose size={15} /> : <PanelLeftOpen size={15} />}
          </button>
        </div>

        {NAV.filter(n => (!n.adminOnly || user?.is_admin) && (!n.userOnly || !user?.is_admin)).map(n => {
          const Icon = n.icon
          const active = isActive(n.path, n.exact)
          return (
            <Link key={n.path} to={n.path} title={n.label} style={{
              width: navExpanded ? '100%' : 40, height: 40, borderRadius: 10, boxSizing: 'border-box',
              display: 'flex', alignItems: 'center', gap: 11,
              justifyContent: navExpanded ? 'flex-start' : 'center',
              padding: navExpanded ? '0 12px' : 0,
              background: active ? 'rgba(249,115,22,0.18)' : 'transparent',
              border: `1px solid ${active ? 'rgba(249,115,22,0.35)' : 'transparent'}`,
              color: active ? '#fb923c' : '#80705c',
              transition: 'background 0.18s, color 0.18s', textDecoration: 'none',
              position: 'relative',
            }}
              onMouseEnter={e => { if (!active) { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.05)'; (e.currentTarget as HTMLElement).style.color = '#e0c0a0' } }}
              onMouseLeave={e => { if (!active) { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = '#80705c' } }}
            >
              <Icon size={17} strokeWidth={2} style={{ flexShrink: 0 }} />
              {navExpanded && <span style={{ fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap' }}>{n.label}</span>}
              {active && !navExpanded && (
                <div style={{ position: 'absolute', left: 0, top: '20%', bottom: '20%', width: 2, borderRadius: '0 2px 2px 0', background: '#f97316' }} />
              )}
            </Link>
          )
        })}

        {/* Bottom: credits + user */}
        <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
          {credits !== null && (
            <div title={`${credits} credits`} style={{
              width: 34, height: 34, borderRadius: 8,
              background: 'rgba(249,115,22,0.1)', border: '1px solid rgba(249,115,22,0.2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Gem size={14} color="#fb923c" />
            </div>
          )}
          {/* Worker status */}
          {workerStatus && (workerStatus.processing > 0 || workerStatus.pending > 0) && (
            <div title={`${workerStatus.processing} đang render · ${workerStatus.pending} chờ`}
              style={{
                width: 34, height: 34, borderRadius: 8, position: 'relative',
                background: 'rgba(74,222,128,0.1)', border: '1px solid rgba(74,222,128,0.2)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexDirection: 'column', gap: 0,
              }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--green)', boxShadow: '0 0 8px var(--green)', animation: 'pulse-dot 1.4s infinite' }} />
              <span style={{ fontSize: 9, color: 'var(--green)', fontWeight: 700, marginTop: 1 }}>{workerStatus.processing}</span>
            </div>
          )}

          <div style={{
            width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
            background: 'linear-gradient(135deg, #f97316, #ea580c)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 13, fontWeight: 700, color: '#fff', cursor: 'pointer',
          }} title={user?.username} onClick={() => nav('/settings')}>
            {user?.username?.[0]?.toUpperCase()}
          </div>
          <button title="Đăng xuất" onClick={() => { localStorage.removeItem('token'); nav('/login') }}
            style={{
              width: 34, height: 34, borderRadius: 8, background: 'transparent',
              border: '1px solid rgba(255,255,255,0.06)', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#50402e',
              transition: 'all 0.15s',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#f87171'; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(248,113,113,0.3)' }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = '#50402e'; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.06)' }}
          >
            <LogOut size={14} />
          </button>
        </div>
      </nav>

      {/* ── Left panel: project list (chỉ khi xem chi tiết dự án) ── */}
      {isProjectDetail && (
        <div style={{
          width: 280, minHeight: '100vh', position: 'fixed', top: 0, left: navWidth, bottom: 0, zIndex: 50,
          background: 'rgba(12,9,6,0.9)', borderRight: '1px solid rgba(249,115,22,0.07)',
          transition: 'left 0.2s ease',
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
          paddingBottom: logOpen ? 240 : 36,
        }}>
          {/* Panel header */}
          <div style={{ padding: '18px 16px 12px', borderBottom: '1px solid rgba(255,255,255,0.05)', flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text2)', letterSpacing: '0.6px', textTransform: 'uppercase' }}>
                Dự Án
              </div>
              <div style={{ display: 'flex', gap: 4 }}>
                <button onClick={loadProjects}
                  style={{ width: 26, height: 26, borderRadius: 7, background: 'transparent', border: '1px solid var(--border)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text3)' }}>
                  <RefreshCw size={11} />
                </button>
                <button onClick={() => nav('/projects')}
                  style={{ width: 26, height: 26, borderRadius: 7, background: 'rgba(249,115,22,0.15)', border: '1px solid rgba(249,115,22,0.25)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fb923c' }}>
                  <Plus size={12} />
                </button>
              </div>
            </div>
            {/* Connection status inline */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: extConnected ? 'var(--green)' : 'rgba(248,113,113,0.6)', flexShrink: 0 }} />
              <span style={{ color: extConnected ? 'var(--green)' : 'rgba(248,113,113,0.7)' }}>
                {extConnected ? 'Ultra kết nối' : 'Chưa kết nối'}
              </span>
            </div>
          </div>

          {/* Project list */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '8px 8px' }}>
            {projects.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '36px 16px', color: 'var(--text3)', fontSize: 12 }}>
                <div style={{
                  width: 46, height: 46, margin: '0 auto 12px', borderRadius: 14,
                  background: 'rgba(249,115,22,0.08)', border: '1px solid rgba(249,115,22,0.15)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <FolderOpen size={20} color="#fb923c" />
                </div>
                <div style={{ color: 'var(--text2)', fontWeight: 600, marginBottom: 4 }}>Chưa có dự án</div>
                <div style={{ marginBottom: 14, lineHeight: 1.5 }}>Tạo dự án đầu tiên để bắt đầu làm phim AI</div>
                <button className="btn btn-primary btn-sm" onClick={() => nav('/projects')}>
                  <Plus size={12} /> Tạo dự án
                </button>
              </div>
            ) : projects.map(p => {
              const isSelected = activeProject === p.id
              return (
                <div key={p.id}
                  onClick={() => nav(`/projects/${p.id}`)}
                  style={{
                    padding: '10px 11px', borderRadius: 9, cursor: 'pointer', marginBottom: 3,
                    border: `1px solid ${isSelected ? 'rgba(249,115,22,0.35)' : 'rgba(255,255,255,0.04)'}`,
                    background: isSelected ? 'rgba(249,115,22,0.1)' : 'rgba(255,255,255,0.02)',
                    transition: 'all 0.15s', position: 'relative',
                  }}
                  onMouseEnter={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)' }}
                  onMouseLeave={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.02)' }}
                >
                  {isSelected && <div style={{ position: 'absolute', left: 0, top: '15%', bottom: '15%', width: 2, borderRadius: '0 2px 2px 0', background: '#f97316' }} />}
                  <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: isSelected ? '#fdba74' : 'var(--text)' }}>
                    {p.name}
                  </div>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <span style={{ fontSize: 10, color: isSelected ? 'rgba(249,115,22,0.7)' : 'var(--text3)' }}>{p.scene_count} scenes</span>
                    {p.chain_mode && <span style={{ fontSize: 9, color: '#fb923c' }}>⛓</span>}
                    <span style={{ fontSize: 10, color: 'var(--text3)', marginLeft: 'auto' }}>
                      {new Date(p.created_at).toLocaleDateString('vi-VN')}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Main content ── */}
      <div style={{
        marginLeft: navWidth + (isProjectDetail ? 280 : 0),
        flex: 1, display: 'flex', flexDirection: 'column', minHeight: '100vh',
        transition: 'margin-left 0.2s',
      }}>
        <main className="main-content" style={{ flex: 1, paddingBottom: logOpen ? 250 : 56 }}>
          <Routes>
            <Route path="/" element={<CreateVideo user={user} />} />
            <Route path="/projects" element={<Projects user={user} onCreated={loadProjects} />} />
            <Route path="/projects/:id" element={<ProjectDetail user={user} onUpdate={loadProjects} />} />
            <Route path="/videos" element={<MyVideos />} />
            <Route path="/tools" element={<Tools user={user} />} />
            <Route path="/billing" element={<Billing />} />
            <Route path="/settings" element={<Settings2 user={user} onUpdate={setUser} />} />
            {user?.is_admin && <Route path="/admin" element={<Admin />} />}
          </Routes>
        </main>

        {/* ── Log console ── */}
        <div style={{
          position: 'fixed', bottom: 0, left: navWidth + (isProjectDetail ? 280 : 0), right: 0,
          background: 'rgba(8,6,4,0.97)', backdropFilter: 'blur(20px)',
          borderTop: '1px solid rgba(249,115,22,0.08)', zIndex: 100,
          transition: 'left 0.2s',
        }}>
          <div onClick={() => { setLogOpen(o => !o); setUnread(0) }}
            style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '7px 18px', cursor: 'pointer', userSelect: 'none',
            }}>
            <Terminal size={12} color="#50402e" />
            <span style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 500, fontFamily: 'monospace' }}>Nhật ký</span>
            {unread > 0 && (
              <span style={{ background: 'var(--accent)', color: '#fff', borderRadius: 99, padding: '1px 7px', fontSize: 10, fontWeight: 700 }}>
                {unread}
              </span>
            )}
            <span style={{ marginLeft: 'auto', color: 'var(--text3)' }}>
              {logOpen ? <ChevronDown size={13} /> : <ChevronUp size={13} />}
            </span>
          </div>
          {logOpen && (
            <div style={{ height: 200, overflowY: 'auto', padding: '8px 18px', fontFamily: 'monospace', fontSize: 11, lineHeight: 1.7, background: 'rgba(0,0,0,0.3)' }}>
              {logs.length === 0 && <div style={{ color: 'var(--text3)' }}>No logs yet...</div>}
              {logs.map((l, i) => (
                <div key={i} style={{ color: l.level === 'error' ? '#f87171' : l.level === 'warn' ? '#fbbf24' : '#504030' }}>
                  <span style={{ color: '#302010', marginRight: 10 }}>{l.ts}</span>
                  <span style={{ color: l.level === 'error' ? '#f87171' : l.level === 'warn' ? '#fbbf24' : '#a08060' }}>{l.msg}</span>
                </div>
              ))}
              <div ref={logEndRef} />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
