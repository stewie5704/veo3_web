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
import VerifyEmail from './VerifyEmail'
import { useT, LangSwitch } from '../i18n'

export const logStore: { msg: string; level: string; ts: string }[] = []
export let logListeners: (() => void)[] = []
export function pushLog(msg: string, level = 'info') {
  logStore.push({ msg, level, ts: new Date().toLocaleTimeString('vi-VN') })
  if (logStore.length > 500) logStore.shift()
  logListeners.forEach(l => l())
}

type NavItem = { path: string; icon: any; label: string; exact?: boolean; userOnly?: boolean; adminOnly?: boolean }

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
  const t = useT()

  // userOnly = chỉ user thường (admin không tạo video, ẩn đi). adminOnly = chỉ admin.
  const NAV: NavItem[] = [
    { path: '/projects', icon: FolderOpen, label: t('nav.create_video'), userOnly: true },
    { path: '/videos', icon: Library, label: t('nav.library'), userOnly: true },
    { path: '/tools', icon: Wrench, label: t('nav.tools'), userOnly: true },
    { path: '/billing', icon: Crown, label: t('nav.billing'), userOnly: true },
    { path: '/affiliate', icon: Share2, label: t('nav.affiliate'), userOnly: true },
    { path: '/guide', icon: BookOpen, label: t('nav.guide') },
    { path: '/support', icon: LifeBuoy, label: t('nav.support') },
    { path: '/settings', icon: Settings, label: t('nav.settings') },
    { path: '/admin', icon: Shield, label: 'Admin', adminOnly: true },
  ]

  // Mục con của "Tạo video" (dropdown) — điều hướng tới /projects?tab=<tab>
  const PROJECTS_SUB = [
    { tab: 'new', label: t('nav.sub.from_idea'), icon: Sparkles },
    { tab: 'batch', label: t('nav.sub.from_script'), icon: PenLine },
    { tab: 'copy', label: t('nav.sub.copy_idea'), icon: Copy },
    { tab: 'sell', label: t('nav.sub.sell_video'), icon: ShoppingBag },
  ]

  // Mục con của "Công cụ" (dropdown) — điều hướng tới /tools?t=<key>
  const TOOL_SUB = [
    { t: 'i2v', label: t('nav.sub.img_to_video'), icon: Film },
    { t: 'r2v', label: t('nav.sub.face_to_video'), icon: Layers },
    { t: 'image', label: t('nav.sub.create_image'), icon: Image },
    { t: 'tts', label: t('nav.sub.tts'), icon: Volume2 },
    { t: 'cut', label: t('nav.sub.cut_video'), icon: Scissors },
    { t: 'download', label: t('nav.sub.download_video'), icon: Download },
    { t: 'chars', label: t('nav.sub.characters'), icon: Users },
  ]

  // Mục con của "Admin" — điều hướng tới /admin?s=<section>
  const ADMIN_SUB = [
    { s: 'overview',  label: t('nav.sub.admin_overview'),   icon: BarChart3 },
    { s: 'users',     label: t('nav.sub.admin_users'),  icon: Users },
    { s: 'payments',  label: t('nav.sub.admin_payments'),    icon: CreditCard },
    { s: 'affiliate', label: 'Affiliate',   icon: Share2 },
  ]

  // Mục con của "Hướng dẫn" — điều hướng tới /guide?s=<section_id>
  const GUIDE_SUB = [
    { s: 'overview',   label: t('guide.nav.overview'),               icon: BookOpen },
    { s: 'extension',  label: t('guide.nav.extension'),      icon: Puzzle },
    { s: 'connect',    label: t('guide.nav.connect'),     icon: Plug },
    { s: 'project',    label: t('guide.nav.project'),    icon: Clapperboard },
    { s: 'tools',      label: t('guide.nav.tools'),               icon: Wrench },
    { s: 'specs',      label: t('guide.nav.specs'), icon: Ratio },
    { s: 'trouble',    label: t('guide.nav.trouble'),      icon: LifeBuoy },
  ]

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
    const timer = setInterval(poll, 5000)
    return () => clearInterval(timer)
  }, [])


  // Poll extension status (do NOT open a /ws/extension socket here — that would shadow the
  // real extension's connection on the server and break captcha).
  useEffect(() => {
    const poll = () => extensionApi.status().then(s => setExtConnected(!!s.connected)).catch(() => setExtConnected(false))
    poll()
    const timer = setInterval(poll, 5000)
    return () => clearInterval(timer)
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

  // Chặn vào app khi hệ thống bật xác minh email và user CHƯA xác minh.
  if (user && user.email_verify_required && !user.email_verified) {
    return <VerifyEmail email={user.email} onVerified={() => authApi.me().then(setUser)} />
  }

  return (
    <div className="app-layout">

      {/* ── Sidebar (thu gọn / xả ra) ── */}
      <nav style={{
        width: navWidth, minHeight: '100vh', position: 'fixed', top: 0, left: 0, bottom: 0, zIndex: 60,
        background: 'rgba(9, 9, 11, 0.88)', backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)',
        borderRight: '1px solid rgba(255, 255, 255, 0.07)',
        display: 'flex', flexDirection: 'column', alignItems: navExpanded ? 'stretch' : 'center',
        padding: navExpanded ? '14px 10px' : '14px 6px', gap: 4,
        transition: 'width 0.2s cubic-bezier(0.16, 1, 0.3, 1)', overflowY: 'auto',
      }}>
        {/* Logo + brand + toggle */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, width: '100%',
          flexDirection: navExpanded ? 'row' : 'column',
          justifyContent: navExpanded ? 'space-between' : 'center',
          padding: navExpanded ? '0 4px' : 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, overflow: 'hidden' }}>
            <div style={{
              width: 34, height: 34, borderRadius: 10, flexShrink: 0,
              background: 'linear-gradient(135deg, #F97316 0%, #EC4899 50%, #8B5CF6 100%)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 4px 16px -2px rgba(249, 115, 22, 0.4)',
            }}>
              <Scissors size={16} color="#fff" strokeWidth={2.4} />
            </div>
            {navExpanded && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontWeight: 800, fontSize: 14.5, color: '#fff', whiteSpace: 'nowrap', letterSpacing: '-0.02em' }}>
                  AI AutoCut
                </span>
                <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 5, background: 'rgba(249,115,22,0.15)', color: '#fb923c', border: '1px solid rgba(249,115,22,0.25)', letterSpacing: '0.04em' }}>
                  PRO
                </span>
              </div>
            )}
          </div>
          <button onClick={toggleNav} title={navExpanded ? t('dash.collapse') : t('dash.expand')} style={{
            width: 28, height: 28, borderRadius: 8, flexShrink: 0,
            background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af',
            transition: 'all 0.15s',
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.08)'; (e.currentTarget as HTMLElement).style.color = '#fff' }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.03)'; (e.currentTarget as HTMLElement).style.color = '#9ca3af' }}>
            {navExpanded ? <PanelLeftClose size={14} /> : <PanelLeftOpen size={14} />}
          </button>
        </div>

        {NAV.filter(n => (!n.adminOnly || user?.is_admin) && (!n.userOnly || !user?.is_admin)).map(n => {
          const Icon = n.icon
          const active = isActive(n.path, n.exact)
          if (n.path === '/projects') {
            const curTab = new URLSearchParams(loc.search).get('tab') || 'new'
            return (
              <div key="/projects" style={{ width: navExpanded ? '100%' : 44 }}>
                <button onClick={() => navExpanded ? setProjectsOpen(o => !o) : nav('/projects')} title={t('nav.create_video')}
                  style={{
                    width: '100%', height: 38, borderRadius: 10, boxSizing: 'border-box', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: 10,
                    justifyContent: navExpanded ? 'flex-start' : 'center', padding: navExpanded ? '0 10px' : 0,
                    background: active ? 'rgba(249, 115, 22, 0.12)' : 'transparent',
                    border: `1px solid ${active ? 'rgba(249, 115, 22, 0.3)' : 'transparent'}`,
                    color: active ? '#fb923c' : '#9ca3af',
                    boxShadow: active ? '0 0 16px -3px rgba(249, 115, 22, 0.2)' : 'none',
                    transition: 'all .16s ease', position: 'relative',
                  }}
                  onMouseEnter={e => { if (!active) { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.05)'; (e.currentTarget as HTMLElement).style.color = '#f3f4f6' } }}
                  onMouseLeave={e => { if (!active) { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = '#9ca3af' } }}>
                  <Icon size={16} strokeWidth={active ? 2.2 : 1.9} style={{ flexShrink: 0 }} />
                  {navExpanded && <span style={{ fontSize: 13, fontWeight: active ? 600 : 500, flex: 1, textAlign: 'left', letterSpacing: '-0.01em' }}>{t('nav.create_video')}</span>}
                  {navExpanded && <ChevronDown size={13} style={{ transition: 'transform .2s', transform: projectsOpen ? 'rotate(180deg)' : 'none', opacity: 0.7 }} />}
                </button>
                {navExpanded && projectsOpen && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2, margin: '4px 0 6px 14px', paddingLeft: 10, borderLeft: '1px solid rgba(255, 255, 255, 0.08)' }}>
                    {PROJECTS_SUB.map(s => {
                      const SIcon = s.icon
                      const sActive = loc.pathname === '/projects' && curTab === s.tab
                      return (
                        <Link key={s.tab} to={`/projects?tab=${s.tab}`} title={s.label}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', borderRadius: 8,
                            fontSize: 12, fontWeight: sActive ? 600 : 500, textDecoration: 'none', transition: 'all .15s',
                            background: sActive ? 'rgba(249,115,22,0.14)' : 'transparent',
                            color: sActive ? '#fb923c' : '#9ca3af',
                          }}
                          onMouseEnter={e => { if (!sActive) { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.05)'; (e.currentTarget as HTMLElement).style.color = '#f3f4f6' } }}
                          onMouseLeave={e => { if (!sActive) { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = '#9ca3af' } }}>
                          <SIcon size={13} strokeWidth={2} style={{ flexShrink: 0, opacity: sActive ? 1 : 0.8 }} /> {s.label}
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
              <div key="/tools" style={{ width: navExpanded ? '100%' : 44 }}>
                <button onClick={() => navExpanded ? setToolsOpen(o => !o) : nav('/tools')} title={t('nav.tools')}
                  style={{
                    width: '100%', height: 38, borderRadius: 10, boxSizing: 'border-box', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: 10,
                    justifyContent: navExpanded ? 'flex-start' : 'center', padding: navExpanded ? '0 10px' : 0,
                    background: active ? 'rgba(249, 115, 22, 0.12)' : 'transparent',
                    border: `1px solid ${active ? 'rgba(249, 115, 22, 0.3)' : 'transparent'}`,
                    color: active ? '#fb923c' : '#9ca3af',
                    boxShadow: active ? '0 0 16px -3px rgba(249, 115, 22, 0.2)' : 'none',
                    transition: 'all .16s ease', position: 'relative',
                  }}
                  onMouseEnter={e => { if (!active) { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.05)'; (e.currentTarget as HTMLElement).style.color = '#f3f4f6' } }}
                  onMouseLeave={e => { if (!active) { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = '#9ca3af' } }}>
                  <Icon size={16} strokeWidth={active ? 2.2 : 1.9} style={{ flexShrink: 0 }} />
                  {navExpanded && <span style={{ fontSize: 13, fontWeight: active ? 600 : 500, flex: 1, textAlign: 'left', letterSpacing: '-0.01em' }}>{t('nav.tools')}</span>}
                  {navExpanded && <ChevronDown size={13} style={{ transition: 'transform .2s', transform: toolsOpen ? 'rotate(180deg)' : 'none', opacity: 0.7 }} />}
                </button>
                {navExpanded && toolsOpen && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2, margin: '4px 0 6px 14px', paddingLeft: 10, borderLeft: '1px solid rgba(255, 255, 255, 0.08)' }}>
                    {TOOL_SUB.map(s => {
                      const SIcon = s.icon
                      const sActive = loc.pathname === '/tools' && curT === s.t
                      return (
                        <Link key={s.t} to={`/tools?t=${s.t}`} title={s.label}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', borderRadius: 8,
                            fontSize: 12, fontWeight: sActive ? 600 : 500, textDecoration: 'none', transition: 'all .15s',
                            background: sActive ? 'rgba(249,115,22,0.14)' : 'transparent',
                            color: sActive ? '#fb923c' : '#9ca3af',
                          }}
                          onMouseEnter={e => { if (!sActive) { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.05)'; (e.currentTarget as HTMLElement).style.color = '#f3f4f6' } }}
                          onMouseLeave={e => { if (!sActive) { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = '#9ca3af' } }}>
                          <SIcon size={13} strokeWidth={2} style={{ flexShrink: 0, opacity: sActive ? 1 : 0.8 }} /> {s.label}
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
              <div key="/guide" style={{ width: navExpanded ? '100%' : 44 }}>
                <button onClick={() => navExpanded ? setGuideOpen(o => !o) : nav('/guide')} title={t('nav.guide')}
                  style={{
                    width: '100%', height: 38, borderRadius: 10, boxSizing: 'border-box', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: 10,
                    justifyContent: navExpanded ? 'flex-start' : 'center', padding: navExpanded ? '0 10px' : 0,
                    background: active ? 'rgba(249, 115, 22, 0.12)' : 'transparent',
                    border: `1px solid ${active ? 'rgba(249, 115, 22, 0.3)' : 'transparent'}`,
                    color: active ? '#fb923c' : '#9ca3af',
                    boxShadow: active ? '0 0 16px -3px rgba(249, 115, 22, 0.2)' : 'none',
                    transition: 'all .16s ease', position: 'relative',
                  }}
                  onMouseEnter={e => { if (!active) { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.05)'; (e.currentTarget as HTMLElement).style.color = '#f3f4f6' } }}
                  onMouseLeave={e => { if (!active) { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = '#9ca3af' } }}>
                  <Icon size={16} strokeWidth={active ? 2.2 : 1.9} style={{ flexShrink: 0 }} />
                  {navExpanded && <span style={{ fontSize: 13, fontWeight: active ? 600 : 500, flex: 1, textAlign: 'left', letterSpacing: '-0.01em' }}>{t('nav.guide')}</span>}
                  {navExpanded && <ChevronDown size={13} style={{ transition: 'transform .2s', transform: guideOpen ? 'rotate(180deg)' : 'none', opacity: 0.7 }} />}
                </button>
                {navExpanded && guideOpen && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2, margin: '4px 0 6px 14px', paddingLeft: 10, borderLeft: '1px solid rgba(255, 255, 255, 0.08)' }}>
                    {GUIDE_SUB.map(s => {
                      const SIcon = s.icon
                      const sActive = loc.pathname === '/guide' && curS === s.s
                      return (
                        <Link key={s.s} to={`/guide?s=${s.s}`} title={s.label}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', borderRadius: 8,
                            fontSize: 12, fontWeight: sActive ? 600 : 500, textDecoration: 'none', transition: 'all .15s',
                            background: sActive ? 'rgba(249,115,22,0.14)' : 'transparent',
                            color: sActive ? '#fb923c' : '#9ca3af',
                          }}
                          onMouseEnter={e => { if (!sActive) { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.05)'; (e.currentTarget as HTMLElement).style.color = '#f3f4f6' } }}
                          onMouseLeave={e => { if (!sActive) { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = '#9ca3af' } }}>
                          <SIcon size={13} strokeWidth={2} style={{ flexShrink: 0, opacity: sActive ? 1 : 0.8 }} /> {s.label}
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
              <div key="/admin" style={{ width: navExpanded ? '100%' : 44 }}>
                <button onClick={() => navExpanded ? setAdminOpen(o => !o) : nav('/admin')} title="Admin"
                  style={{
                    width: '100%', height: 38, borderRadius: 10, boxSizing: 'border-box', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: 10,
                    justifyContent: navExpanded ? 'flex-start' : 'center', padding: navExpanded ? '0 10px' : 0,
                    background: active ? 'rgba(249, 115, 22, 0.12)' : 'transparent',
                    border: `1px solid ${active ? 'rgba(249, 115, 22, 0.3)' : 'transparent'}`,
                    color: active ? '#fb923c' : '#9ca3af',
                    boxShadow: active ? '0 0 16px -3px rgba(249, 115, 22, 0.2)' : 'none',
                    transition: 'all .16s ease', position: 'relative',
                  }}
                  onMouseEnter={e => { if (!active) { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.05)'; (e.currentTarget as HTMLElement).style.color = '#f3f4f6' } }}
                  onMouseLeave={e => { if (!active) { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = '#9ca3af' } }}>
                  <Icon size={16} strokeWidth={active ? 2.2 : 1.9} style={{ flexShrink: 0 }} />
                  {navExpanded && <span style={{ fontSize: 13, fontWeight: active ? 600 : 500, flex: 1, textAlign: 'left', letterSpacing: '-0.01em' }}>Admin</span>}
                  {navExpanded && <ChevronDown size={13} style={{ transition: 'transform .2s', transform: adminOpen ? 'rotate(180deg)' : 'none', opacity: 0.7 }} />}
                </button>
                {navExpanded && adminOpen && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2, margin: '4px 0 6px 14px', paddingLeft: 10, borderLeft: '1px solid rgba(255, 255, 255, 0.08)' }}>
                    {ADMIN_SUB.map(s => {
                      const SIcon = s.icon
                      const sActive = loc.pathname === '/admin' && curS === s.s
                      return (
                        <Link key={s.s} to={`/admin?s=${s.s}`} title={s.label}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', borderRadius: 8,
                            fontSize: 12, fontWeight: sActive ? 600 : 500, textDecoration: 'none', transition: 'all .15s',
                            background: sActive ? 'rgba(249,115,22,0.14)' : 'transparent',
                            color: sActive ? '#fb923c' : '#9ca3af',
                          }}
                          onMouseEnter={e => { if (!sActive) { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.05)'; (e.currentTarget as HTMLElement).style.color = '#f3f4f6' } }}
                          onMouseLeave={e => { if (!sActive) { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = '#9ca3af' } }}>
                          <SIcon size={13} strokeWidth={2} style={{ flexShrink: 0, opacity: sActive ? 1 : 0.8 }} /> {s.label}
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
              width: navExpanded ? '100%' : 44, height: 38, borderRadius: 10, boxSizing: 'border-box',
              display: 'flex', alignItems: 'center', gap: 10,
              justifyContent: navExpanded ? 'flex-start' : 'center',
              padding: navExpanded ? '0 10px' : 0,
              background: active ? 'rgba(249, 115, 22, 0.12)' : 'transparent',
              border: `1px solid ${active ? 'rgba(249, 115, 22, 0.3)' : 'transparent'}`,
              color: active ? '#fb923c' : '#9ca3af',
              boxShadow: active ? '0 0 16px -3px rgba(249, 115, 22, 0.2)' : 'none',
              transition: 'all 0.16s ease', textDecoration: 'none',
              position: 'relative',
            }}
              onMouseEnter={e => { if (!active) { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.05)'; (e.currentTarget as HTMLElement).style.color = '#f3f4f6' } }}
              onMouseLeave={e => { if (!active) { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = '#9ca3af' } }}
            >
              <Icon size={16} strokeWidth={active ? 2.2 : 1.9} style={{ flexShrink: 0 }} />
              {navExpanded && <span style={{ fontSize: 13, fontWeight: active ? 600 : 500, whiteSpace: 'nowrap', letterSpacing: '-0.01em' }}>{n.label}</span>}
            </Link>
          )
        })}

        {/* Bottom: LangSwitch + credits + user */}
        <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, width: '100%', paddingTop: 12, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          {/* Custom Lang Switch for Sidebar */}
          <button title={t('settings.language') || 'Language'} onClick={() => {
            const newLang = localStorage.getItem('lang') === 'vi' ? 'en' : 'vi';
            localStorage.setItem('lang', newLang);
            window.location.reload();
          }}
            style={{
              width: navExpanded ? '100%' : 36, height: 34, borderRadius: 9, background: 'rgba(255,255,255,0.02)',
              border: '1px solid rgba(255,255,255,0.06)', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af',
              transition: 'all 0.15s', fontSize: 12, fontWeight: 500, gap: 6,
              padding: navExpanded ? '0 10px' : 0,
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#fff'; (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.06)' }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = '#9ca3af'; (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.02)' }}
          >
            <span style={{ fontSize: 13 }}>🌐</span>
            {navExpanded && <span>{localStorage.getItem('lang') === 'en' ? 'English' : 'Tiếng Việt'}</span>}
          </button>

          {credits !== null && (
            <div title={t('dash.gems_remaining', { count: credits })} style={{
              width: navExpanded ? '100%' : 36, height: 34, borderRadius: 9, padding: navExpanded ? '0 10px' : 0,
              background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.12), rgba(249, 115, 22, 0.12))',
              border: '1px solid rgba(245, 158, 11, 0.25)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              boxShadow: '0 2px 10px -2px rgba(245, 158, 11, 0.15)',
            }}>
              <Gem size={14} color="#f59e0b" />
              {navExpanded && <span style={{ fontSize: 12.5, fontWeight: 700, color: '#fbbf24', whiteSpace: 'nowrap' }}>{credits} 💎</span>}
            </div>
          )}

          {/* Worker status */}
          {workerStatus && (workerStatus.processing > 0 || workerStatus.pending > 0) && (
            <div title={t('dash.worker_status', { processing: workerStatus.processing, pending: workerStatus.pending })}
              style={{
                width: navExpanded ? '100%' : 36, height: 30, borderRadius: 9,
                background: 'rgba(74,222,128,0.1)', border: '1px solid rgba(74,222,128,0.2)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                padding: navExpanded ? '0 10px' : 0,
              }}>
              <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#4ade80', boxShadow: '0 0 8px #4ade80', animation: 'pulse-dot 1.4s infinite' }} />
              {navExpanded && <span style={{ fontSize: 11, color: '#4ade80', fontWeight: 600 }}>Rendering: {workerStatus.processing}</span>}
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', justifyContent: navExpanded ? 'space-between' : 'center', marginTop: 2 }}>
            <div style={{
              width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
              background: 'linear-gradient(135deg, #f97316, #ec4899)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 13, fontWeight: 700, color: '#fff', cursor: 'pointer',
              boxShadow: '0 2px 8px rgba(0,0,0,0.3)', border: '2px solid rgba(255,255,255,0.15)',
            }} title={user?.username} onClick={() => nav('/settings')}>
              {user?.username?.[0]?.toUpperCase()}
            </div>
            {navExpanded && (
              <div style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#f3f4f6', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {user?.username || 'User'}
                </div>
                <div style={{ fontSize: 10, color: '#9ca3af', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {user?.email || ''}
                </div>
              </div>
            )}
            <button title={t('auth.logout')} onClick={() => { localStorage.removeItem('token'); nav('/login') }}
              style={{
                width: 30, height: 30, borderRadius: 8, background: 'transparent',
                border: '1px solid rgba(255,255,255,0.06)', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6b7280',
                transition: 'all 0.15s', flexShrink: 0,
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#f87171'; (e.currentTarget as HTMLElement).style.background = 'rgba(248,113,113,0.1)'; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(248,113,113,0.3)' }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = '#6b7280'; (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.06)' }}
            >
              <LogOut size={13} />
            </button>
          </div>
        </div>
      </nav>

      {/* ── Left panel: project list (chỉ khi xem chi tiết dự án) ── */}
      {isProjectDetail && (
        <div style={{
          width: 280, minHeight: '100vh', position: 'fixed', top: 0, left: navWidth, bottom: 0, zIndex: 50,
          background: 'rgba(12, 12, 16, 0.92)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
          borderRight: '1px solid rgba(255, 255, 255, 0.06)',
          transition: 'left 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
          paddingBottom: logOpen ? 240 : 36,
        }}>
          {/* Panel header */}
          <div style={{ padding: '16px 16px 12px', borderBottom: '1px solid rgba(255,255,255,0.06)', flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <div style={{ fontSize: 11.5, fontWeight: 700, color: '#e5e7eb', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                {t('dash.projects')}
              </div>
              <div style={{ display: 'flex', gap: 5 }}>
                <button onClick={loadProjects} title="Tải lại"
                  style={{ width: 26, height: 26, borderRadius: 7, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af', transition: 'all 0.15s' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#fff'; (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.08)' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = '#9ca3af'; (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.03)' }}>
                  <RefreshCw size={11} />
                </button>
                <button onClick={() => nav('/projects')} title="Dự án mới"
                  style={{ width: 26, height: 26, borderRadius: 7, background: 'rgba(249,115,22,0.15)', border: '1px solid rgba(249,115,22,0.3)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fb923c', transition: 'all 0.15s' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(249,115,22,0.25)' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(249,115,22,0.15)' }}>
                  <Plus size={13} />
                </button>
              </div>
            </div>
            {/* Connection status inline */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: extConnected ? '#4ade80' : '#f87171', boxShadow: extConnected ? '0 0 6px rgba(74,222,128,0.5)' : 'none', flexShrink: 0 }} />
              {extConnected ? (
                <span style={{ color: '#4ade80', fontWeight: 500 }}>{t('dash.ultra_connected')}</span>
              ) : (
                <Link to="/settings" title={t('dash.click_to_connect')}
                  style={{ color: '#f87171', textDecoration: 'none', cursor: 'pointer', opacity: 0.9 }}>
                  {t('dash.not_connected')}
                </Link>
              )}
            </div>
          </div>

          {/* Project list */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '8px 8px' }}>
            {projects.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '36px 16px', color: '#6b7280', fontSize: 12 }}>
                <div style={{
                  width: 44, height: 44, margin: '0 auto 12px', borderRadius: 12,
                  background: 'rgba(249,115,22,0.08)', border: '1px solid rgba(249,115,22,0.15)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <FolderOpen size={18} color="#fb923c" />
                </div>
                <div style={{ color: '#e5e7eb', fontWeight: 600, marginBottom: 4 }}>{t('dash.no_projects')}</div>
                <div style={{ marginBottom: 14, lineHeight: 1.5 }}>{t('dash.create_first_project')}</div>
                <button className="btn btn-primary btn-sm" onClick={() => nav('/projects')}>
                  <Plus size={12} /> {t('dash.create_project')}
                </button>
              </div>
            ) : projects.map(p => {
              const isSelected = activeProject === p.id
              return (
                <div key={p.id}
                  onClick={() => nav(`/projects/${p.id}`)}
                  style={{
                    padding: '9px 12px', borderRadius: 9, cursor: 'pointer', marginBottom: 3,
                    border: `1px solid ${isSelected ? 'rgba(249,115,22,0.35)' : 'rgba(255,255,255,0.04)'}`,
                    background: isSelected ? 'rgba(249,115,22,0.1)' : 'rgba(255,255,255,0.02)',
                    transition: 'all 0.15s ease', position: 'relative',
                  }}
                  onMouseEnter={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.05)' }}
                  onMouseLeave={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.02)' }}
                >
                  {isSelected && <div style={{ position: 'absolute', left: 0, top: '15%', bottom: '15%', width: 2.5, borderRadius: '0 2px 2px 0', background: '#f97316' }} />}
                  <div style={{ fontSize: 12.5, fontWeight: isSelected ? 600 : 500, marginBottom: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: isSelected ? '#fed7aa' : '#e5e7eb' }}>
                    {p.name}
                  </div>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <span style={{ fontSize: 10, color: isSelected ? 'rgba(249,115,22,0.8)' : '#9ca3af' }}>{p.scene_count} scenes</span>
                    {p.chain_mode && <span style={{ fontSize: 9, color: '#fb923c' }}>⛓</span>}
                    <span style={{ fontSize: 10, color: '#6b7280', marginLeft: 'auto' }}>
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
            <Route path="/" element={<div style={{ padding: 40, textAlign: 'center', color: 'var(--text2)' }}>{t('dash.loading')}</div>} />
            <Route path="/projects" element={<Projects user={user} onCreated={loadProjects} />} />
            <Route path="/projects/:id" element={<ProjectDetail user={user} onUpdate={loadProjects} />} />
            <Route path="/videos" element={<MyVideos onUpdate={loadProjects} />} />
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
          background: 'rgba(9, 9, 13, 0.94)', backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)',
          borderTop: '1px solid rgba(255, 255, 255, 0.07)', zIndex: 100,
          transition: 'left 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
        }}>
          <div onClick={() => { setLogOpen(o => !o); setUnread(0) }}
            style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '6px 18px', cursor: 'pointer', userSelect: 'none',
              background: 'rgba(255, 255, 255, 0.015)',
            }}>
            <Terminal size={12} color="#9ca3af" />
            <span style={{ fontSize: 11, color: '#9ca3af', fontWeight: 600, fontFamily: 'monospace', letterSpacing: '0.04em' }}>{t('dash.logs')}</span>
            {unread > 0 && (
              <span style={{ background: '#f97316', color: '#fff', borderRadius: 99, padding: '1px 6px', fontSize: 9, fontWeight: 700 }}>
                {unread}
              </span>
            )}
            <span style={{ marginLeft: 'auto', color: '#6b7280' }}>
              {logOpen ? <ChevronDown size={13} /> : <ChevronUp size={13} />}
            </span>
          </div>
          {logOpen && (
            <div style={{ height: 190, overflowY: 'auto', padding: '10px 18px', fontFamily: 'monospace', fontSize: 11, lineHeight: 1.7, background: 'rgba(0,0,0,0.5)' }}>
              {logs.length === 0 && <div style={{ color: '#6b7280' }}>{t('dash.no_logs')}</div>}
              {logs.map((l, i) => (
                <div key={i} style={{ color: l.level === 'error' ? '#f87171' : l.level === 'warn' ? '#fbbf24' : '#9ca3af', display: 'flex', alignItems: 'baseline', gap: 8 }}>
                  <span style={{ color: '#4b5563', fontSize: 10 }}>[{l.ts}]</span>
                  <span>{l.msg}</span>
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
