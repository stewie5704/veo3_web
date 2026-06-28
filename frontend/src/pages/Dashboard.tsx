import { useEffect, useState, useRef, useCallback } from 'react'
import { Routes, Route, useNavigate, useLocation, Link } from 'react-router-dom'
import {
  FolderOpen, Library, Wrench, Settings,
  LogOut, Wifi, WifiOff, Gem, Terminal, ChevronUp, ChevronDown,
  Shield, Plus, RefreshCw, Crown, PanelLeftClose, PanelLeftOpen, Scissors,
  Film, Layers, Image, Volume2, Download, Users, BookOpen, ShoppingBag, Sparkles, PenLine, Copy,
  Puzzle, Plug, Clapperboard, Ratio, LifeBuoy,
  BarChart3, CreditCard, Share2,
} from 'lucide-react'
import { authApi, mediaApi, projectsApi, statusApi, extensionApi } from '../api/client'
import Projects from './Projects'
import ProjectDetail from './ProjectDetail'
import MyVideos from './MyVideos'
import Tools from './Tools'
import Settings2 from './Settings'
import Admin from './Admin'
import Billing from './Billing'
import Affiliate from './Affiliate'
import Guide from './Guide'
import Support from './Support'

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
  { path: '/projects', icon: FolderOpen, label: 'Tạo video', userOnly: true },
  { path: '/videos', icon: Library, label: 'Thư viện', userOnly: true },
  { path: '/tools', icon: Wrench, label: 'Công cụ', userOnly: true },
  { path: '/billing', icon: Crown, label: 'Nâng gói', userOnly: true },
  { path: '/affiliate', icon: Share2, label: 'Cộng tác viên', userOnly: true },
  { path: '/guide', icon: BookOpen, label: 'Hướng dẫn' },
  { path: '/support', icon: LifeBuoy, label: 'Hỗ trợ' },
  { path: '/settings', icon: Settings, label: 'Cài đặt' },
  { path: '/admin', icon: Shield, label: 'Admin', adminOnly: true },
]

// Mục con của "Tạo video" (dropdown) — điều hướng tới /projects?tab=<tab>
const PROJECTS_SUB = [
  { tab: 'new', label: 'Tạo từ ý tưởng', icon: Sparkles },
  { tab: 'batch', label: 'Từ mô tả từng cảnh', icon: PenLine },
  { tab: 'copy', label: 'Chép ý tưởng', icon: Copy },
  { tab: 'sell', label: 'Video bán hàng', icon: ShoppingBag },
]

// Mục con của "Công cụ" (dropdown) — điều hướng tới /tools?t=<key>
const TOOL_SUB = [
  { t: 'i2v', label: 'Ảnh → Video', icon: Film },
  { t: 'r2v', label: 'Giữ mặt → Video', icon: Layers },
  { t: 'image', label: 'Tạo ảnh', icon: Image },
  { t: 'tts', label: 'Đọc thành giọng nói', icon: Volume2 },
  { t: 'cut', label: 'Cắt video', icon: Scissors },
  { t: 'download', label: 'Tải video từ đường link', icon: Download },
  { t: 'chars', label: 'Nhân vật', icon: Users },
]

// Mục con của "Admin" — điều hướng tới /admin?s=<section>
const ADMIN_SUB = [
  { s: 'overview',  label: 'Tổng quan',   icon: BarChart3 },
  { s: 'users',     label: 'Người dùng',  icon: Users },
  { s: 'payments',  label: 'Đơn hàng',    icon: CreditCard },
  { s: 'affiliate', label: 'Affiliate',   icon: Share2 },
]

// Mục con của "Hướng dẫn" — điều hướng tới /guide?s=<section_id>
const GUIDE_SUB = [
  { s: 'overview',   label: 'Tổng quan',               icon: BookOpen },
  { s: 'extension',  label: 'Cài tiện ích Chrome',      icon: Puzzle },
  { s: 'connect',    label: 'Kết nối Google Ultra',     icon: Plug },
  { s: 'project',    label: 'Tạo phim từ kịch bản',    icon: Clapperboard },
  { s: 'tools',      label: 'Bộ công cụ',               icon: Wrench },
  { s: 'specs',      label: 'Tỉ lệ · Chất lượng · Gem', icon: Ratio },
  { s: 'trouble',    label: 'Gặp lỗi? Khắc phục',      icon: LifeBuoy },
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
  const [projectsOpen, setProjectsOpen] = useState(() => window.location.pathname === '/projects')
  const [toolsOpen, setToolsOpen] = useState(() => window.location.pathname === '/tools')
  const [guideOpen, setGuideOpen] = useState(() => window.location.pathname === '/guide')
  const [adminOpen, setAdminOpen] = useState(() => window.location.pathname === '/admin')
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

  // Trang '/' cũ (Tạo Video) đã bỏ — gộp vào 'Tạo video' (= /projects). Điều hướng '/' theo vai trò.
  useEffect(() => {
    if (user && loc.pathname === '/') nav(user.is_admin ? '/admin' : '/projects', { replace: true })
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
              background: 'var(--grad)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 6px 18px -4px rgba(236,72,153,0.5)',
            }}>
              <Scissors size={16} color="#fff" strokeWidth={2.2} />
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
          if (n.path === '/projects') {
            const curTab = new URLSearchParams(loc.search).get('tab') || 'new'
            return (
              <div key="/projects" style={{ width: navExpanded ? '100%' : 40 }}>
                <button onClick={() => navExpanded ? setProjectsOpen(o => !o) : nav('/projects')} title="Tạo video"
                  style={{
                    width: '100%', height: 40, borderRadius: 10, boxSizing: 'border-box', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: 11,
                    justifyContent: navExpanded ? 'flex-start' : 'center', padding: navExpanded ? '0 12px' : 0,
                    background: active ? 'rgba(249,115,22,0.18)' : 'transparent',
                    border: `1px solid ${active ? 'rgba(249,115,22,0.35)' : 'transparent'}`,
                    color: active ? '#fb923c' : '#80705c', transition: 'all .18s', position: 'relative',
                  }}>
                  <Icon size={17} strokeWidth={2} style={{ flexShrink: 0 }} />
                  {navExpanded && <span style={{ fontSize: 13, fontWeight: 600, flex: 1, textAlign: 'left' }}>Tạo video</span>}
                  {navExpanded && <ChevronDown size={14} style={{ transition: 'transform .2s', transform: projectsOpen ? 'rotate(180deg)' : 'none' }} />}
                  {active && !navExpanded && (
                    <div style={{ position: 'absolute', left: 0, top: '20%', bottom: '20%', width: 2, borderRadius: '0 2px 2px 0', background: '#f97316' }} />
                  )}
                </button>
                {navExpanded && projectsOpen && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2, margin: '3px 0 4px', paddingLeft: 12 }}>
                    {PROJECTS_SUB.map(s => {
                      const SIcon = s.icon
                      const sActive = loc.pathname === '/projects' && curTab === s.tab
                      return (
                        <Link key={s.tab} to={`/projects?tab=${s.tab}`} title={s.label}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 9, padding: '7px 11px', borderRadius: 8,
                            fontSize: 12.5, fontWeight: 500, textDecoration: 'none', transition: 'all .15s',
                            background: sActive ? 'rgba(249,115,22,0.14)' : 'transparent',
                            color: sActive ? '#fb923c' : '#80705c',
                          }}
                          onMouseEnter={e => { if (!sActive) { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.05)'; (e.currentTarget as HTMLElement).style.color = '#e0c0a0' } }}
                          onMouseLeave={e => { if (!sActive) { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = '#80705c' } }}>
                          <SIcon size={14} strokeWidth={2} style={{ flexShrink: 0 }} /> {s.label}
                        </Link>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          }
          if (n.path === '/tools') {
            const curT = new URLSearchParams(loc.search).get('t') || 'i2v'
            return (
              <div key="/tools" style={{ width: navExpanded ? '100%' : 40 }}>
                <button onClick={() => navExpanded ? setToolsOpen(o => !o) : nav('/tools')} title="Công cụ"
                  style={{
                    width: '100%', height: 40, borderRadius: 10, boxSizing: 'border-box', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: 11,
                    justifyContent: navExpanded ? 'flex-start' : 'center', padding: navExpanded ? '0 12px' : 0,
                    background: active ? 'rgba(249,115,22,0.18)' : 'transparent',
                    border: `1px solid ${active ? 'rgba(249,115,22,0.35)' : 'transparent'}`,
                    color: active ? '#fb923c' : '#80705c', transition: 'all .18s', position: 'relative',
                  }}>
                  <Icon size={17} strokeWidth={2} style={{ flexShrink: 0 }} />
                  {navExpanded && <span style={{ fontSize: 13, fontWeight: 600, flex: 1, textAlign: 'left' }}>Công cụ</span>}
                  {navExpanded && <ChevronDown size={14} style={{ transition: 'transform .2s', transform: toolsOpen ? 'rotate(180deg)' : 'none' }} />}
                  {active && !navExpanded && (
                    <div style={{ position: 'absolute', left: 0, top: '20%', bottom: '20%', width: 2, borderRadius: '0 2px 2px 0', background: '#f97316' }} />
                  )}
                </button>
                {navExpanded && toolsOpen && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2, margin: '3px 0 4px', paddingLeft: 12 }}>
                    {TOOL_SUB.map(s => {
                      const SIcon = s.icon
                      const sActive = loc.pathname === '/tools' && curT === s.t
                      return (
                        <Link key={s.t} to={`/tools?t=${s.t}`} title={s.label}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 9, padding: '7px 11px', borderRadius: 8,
                            fontSize: 12.5, fontWeight: 500, textDecoration: 'none', transition: 'all .15s',
                            background: sActive ? 'rgba(249,115,22,0.14)' : 'transparent',
                            color: sActive ? '#fb923c' : '#80705c',
                          }}
                          onMouseEnter={e => { if (!sActive) { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.05)'; (e.currentTarget as HTMLElement).style.color = '#e0c0a0' } }}
                          onMouseLeave={e => { if (!sActive) { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = '#80705c' } }}>
                          <SIcon size={14} strokeWidth={2} style={{ flexShrink: 0 }} /> {s.label}
                        </Link>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          }
          if (n.path === '/guide') {
            const curS = new URLSearchParams(loc.search).get('s') || ''
            return (
              <div key="/guide" style={{ width: navExpanded ? '100%' : 40 }}>
                <button onClick={() => navExpanded ? setGuideOpen(o => !o) : nav('/guide')} title="Hướng dẫn"
                  style={{
                    width: '100%', height: 40, borderRadius: 10, boxSizing: 'border-box', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: 11,
                    justifyContent: navExpanded ? 'flex-start' : 'center', padding: navExpanded ? '0 12px' : 0,
                    background: active ? 'rgba(249,115,22,0.18)' : 'transparent',
                    border: `1px solid ${active ? 'rgba(249,115,22,0.35)' : 'transparent'}`,
                    color: active ? '#fb923c' : '#80705c', transition: 'all .18s', position: 'relative',
                  }}>
                  <Icon size={17} strokeWidth={2} style={{ flexShrink: 0 }} />
                  {navExpanded && <span style={{ fontSize: 13, fontWeight: 600, flex: 1, textAlign: 'left' }}>Hướng dẫn</span>}
                  {navExpanded && <ChevronDown size={14} style={{ transition: 'transform .2s', transform: guideOpen ? 'rotate(180deg)' : 'none' }} />}
                  {active && !navExpanded && (
                    <div style={{ position: 'absolute', left: 0, top: '20%', bottom: '20%', width: 2, borderRadius: '0 2px 2px 0', background: '#f97316' }} />
                  )}
                </button>
                {navExpanded && guideOpen && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2, margin: '3px 0 4px', paddingLeft: 12 }}>
                    {GUIDE_SUB.map(s => {
                      const SIcon = s.icon
                      const sActive = loc.pathname === '/guide' && curS === s.s
                      return (
                        <Link key={s.s} to={`/guide?s=${s.s}`} title={s.label}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 9, padding: '7px 11px', borderRadius: 8,
                            fontSize: 12.5, fontWeight: 500, textDecoration: 'none', transition: 'all .15s',
                            background: sActive ? 'rgba(249,115,22,0.14)' : 'transparent',
                            color: sActive ? '#fb923c' : '#80705c',
                          }}
                          onMouseEnter={e => { if (!sActive) { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.05)'; (e.currentTarget as HTMLElement).style.color = '#e0c0a0' } }}
                          onMouseLeave={e => { if (!sActive) { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = '#80705c' } }}>
                          <SIcon size={14} strokeWidth={2} style={{ flexShrink: 0 }} /> {s.label}
                        </Link>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          }
          if (n.path === '/admin') {
            const curS = new URLSearchParams(loc.search).get('s') || 'overview'
            return (
              <div key="/admin" style={{ width: navExpanded ? '100%' : 40 }}>
                <button onClick={() => navExpanded ? setAdminOpen(o => !o) : nav('/admin')} title="Admin"
                  style={{
                    width: '100%', height: 40, borderRadius: 10, boxSizing: 'border-box', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: 11,
                    justifyContent: navExpanded ? 'flex-start' : 'center', padding: navExpanded ? '0 12px' : 0,
                    background: active ? 'rgba(249,115,22,0.18)' : 'transparent',
                    border: `1px solid ${active ? 'rgba(249,115,22,0.35)' : 'transparent'}`,
                    color: active ? '#fb923c' : '#80705c', transition: 'all .18s', position: 'relative',
                  }}>
                  <Icon size={17} strokeWidth={2} style={{ flexShrink: 0 }} />
                  {navExpanded && <span style={{ fontSize: 13, fontWeight: 600, flex: 1, textAlign: 'left' }}>Admin</span>}
                  {navExpanded && <ChevronDown size={14} style={{ transition: 'transform .2s', transform: adminOpen ? 'rotate(180deg)' : 'none' }} />}
                  {active && !navExpanded && (
                    <div style={{ position: 'absolute', left: 0, top: '20%', bottom: '20%', width: 2, borderRadius: '0 2px 2px 0', background: '#f97316' }} />
                  )}
                </button>
                {navExpanded && adminOpen && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2, margin: '3px 0 4px', paddingLeft: 12 }}>
                    {ADMIN_SUB.map(s => {
                      const SIcon = s.icon
                      const sActive = loc.pathname === '/admin' && curS === s.s
                      return (
                        <Link key={s.s} to={`/admin?s=${s.s}`} title={s.label}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 9, padding: '7px 11px', borderRadius: 8,
                            fontSize: 12.5, fontWeight: 500, textDecoration: 'none', transition: 'all .15s',
                            background: sActive ? 'rgba(249,115,22,0.14)' : 'transparent',
                            color: sActive ? '#fb923c' : '#80705c',
                          }}
                          onMouseEnter={e => { if (!sActive) { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.05)'; (e.currentTarget as HTMLElement).style.color = '#e0c0a0' } }}
                          onMouseLeave={e => { if (!sActive) { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = '#80705c' } }}>
                          <SIcon size={14} strokeWidth={2} style={{ flexShrink: 0 }} /> {s.label}
                        </Link>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          }
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
            <div title={`Số Gem còn lại: ${credits}`} style={{
              minWidth: 34, height: 34, borderRadius: 8, padding: '0 9px',
              background: 'rgba(249,115,22,0.1)', border: '1px solid rgba(249,115,22,0.2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
            }}>
              <Gem size={14} color="#fb923c" />
              <span style={{ fontSize: 13, fontWeight: 700, color: '#fb923c', whiteSpace: 'nowrap' }}>{credits}</span>
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
              {extConnected ? (
                <span style={{ color: 'var(--green)' }}>Ultra kết nối</span>
              ) : (
                <Link to="/settings" title="Bấm để kết nối trong Cài đặt"
                  style={{ color: 'rgba(248,113,113,0.85)', textDecoration: 'underline', cursor: 'pointer' }}>
                  Chưa kết nối — bấm để xử lý
                </Link>
              )}
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
            <Route path="/" element={<div style={{ padding: 40, textAlign: 'center', color: 'var(--text2)' }}>Đang tải...</div>} />
            <Route path="/projects" element={<Projects user={user} onCreated={loadProjects} />} />
            <Route path="/projects/:id" element={<ProjectDetail user={user} onUpdate={loadProjects} />} />
            <Route path="/videos" element={<MyVideos />} />
            <Route path="/tools" element={<Tools user={user} />} />
            <Route path="/billing" element={<Billing />} />
            <Route path="/affiliate" element={<Affiliate />} />
            <Route path="/guide" element={<Guide />} />
            <Route path="/support" element={<Support />} />
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
