import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  BookOpen, Puzzle, Plug, Clapperboard, Wrench, Ratio, LifeBuoy, Download,
  Film, Layers, Image, Volume2, Scissors, Users, Sparkles, Check, AlertCircle,
} from 'lucide-react'
import { useT } from '../i18n'

function Sec({ id, icon: Icon, title, children }: { id: string; icon: any; title: string; children: any }) {
  return (
    <section id={id} style={{ scrollMarginTop: 24, marginBottom: 30 }}>
      <h2 style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 19, fontWeight: 800, margin: '0 0 14px' }}>
        <span style={{ width: 34, height: 34, borderRadius: 9, background: 'var(--accent-dim)', display: 'grid', placeItems: 'center', flex: 'none' }}>
          <Icon size={18} color="var(--accent2)" />
        </span>
        {title}
      </h2>
      <div className="card" style={{ margin: 0 }}>{children}</div>
    </section>
  )
}

// Bước đánh số
function Step({ n, children }: { n: number; children: any }) {
  return (
    <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
      <span style={{ flex: 'none', width: 24, height: 24, borderRadius: '50%', background: 'var(--grad)', color: '#fff', fontSize: 12, fontWeight: 800, display: 'grid', placeItems: 'center' }}>{n}</span>
      <div style={{ fontSize: 13.5, lineHeight: 1.65, color: 'var(--text)', paddingTop: 1 }}>{children}</div>
    </div>
  )
}

function Note({ kind = 'info', children }: { kind?: 'info' | 'warn'; children: any }) {
  const warn = kind === 'warn'
  return (
    <div style={{
      display: 'flex', gap: 9, alignItems: 'flex-start', fontSize: 12.5, lineHeight: 1.6, marginTop: 12,
      padding: '10px 13px', borderRadius: 10,
      background: warn ? 'rgba(251,191,36,0.08)' : 'var(--accent-dim)',
      border: `1px solid ${warn ? 'rgba(251,191,36,0.3)' : 'var(--border2)'}`,
      color: 'var(--text2)',
    }}>
      <AlertCircle size={15} style={{ flex: 'none', marginTop: 1, color: warn ? 'var(--yellow)' : 'var(--accent2)' }} />
      <div>{children}</div>
    </div>
  )
}

export default function Guide() {
  const nav = useNavigate()
  const [searchParams] = useSearchParams()
  const sParam = searchParams.get('s')
  const [go] = useState(() => (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
  const t = useT()

  const SECTIONS = [
    { id: 'overview', icon: BookOpen, label: t('guide.nav.overview') },
    { id: 'extension', icon: Puzzle, label: t('guide.nav.extension') },
    { id: 'connect', icon: Plug, label: t('guide.nav.connect') },
    { id: 'project', icon: Clapperboard, label: t('guide.nav.project') },
    { id: 'tools', icon: Wrench, label: t('guide.nav.tools') },
    { id: 'specs', icon: Ratio, label: t('guide.nav.specs') },
    { id: 'trouble', icon: LifeBuoy, label: t('guide.nav.trouble') },
  ]

  const TOOLS = [
    { icon: Film, name: t('guide.tools.i2v_name'), desc: t('guide.tools.i2v_desc') },
    { icon: Layers, name: t('guide.tools.r2v_name'), desc: t('guide.tools.r2v_desc') },
    { icon: Image, name: t('guide.tools.image_name'), desc: t('guide.tools.image_desc') },
    { icon: Volume2, name: t('guide.tools.tts_name'), desc: t('guide.tools.tts_desc') },
    { icon: Scissors, name: t('guide.tools.cut_name'), desc: t('guide.tools.cut_desc') },
    { icon: Download, name: t('guide.tools.download_name'), desc: t('guide.tools.download_desc') },
    { icon: Users, name: t('guide.tools.chars_name'), desc: t('guide.tools.chars_desc') },
  ]

  // Sidebar sub-item click → scroll to section
  useEffect(() => {
    if (!sParam) return
    const el = document.getElementById(sParam)
    if (el) setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80)
  }, [sParam])

  return (
    <div style={{ maxWidth: 900, margin: '0 auto' }}>
      <div className="page-header">
        <div>
          <div className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <BookOpen size={22} color="var(--accent2)" /> {t('guide.title')}
          </div>
          <div className="page-subtitle">{t('guide.subtitle')}</div>
        </div>
      </div>

      {/* Mục lục */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 26 }}>
        {SECTIONS.map(s => (
          <button key={s.id} onClick={() => go(s.id)} className="btn btn-ghost btn-sm">
            <s.icon size={13} /> {s.label}
          </button>
        ))}
      </div>

      <Sec id="overview" icon={BookOpen} title={t('guide.nav.overview')}>
        <div style={{ fontSize: 13.5, lineHeight: 1.7, color: 'var(--text2)' }}>
          {t('guide.overview.intro')}
        </div>
        <div style={{ marginTop: 14 }}>
          <Step n={1}>{t('guide.overview.step1')}</Step>
          <Step n={2}>{t('guide.overview.step2')}</Step>
          <Step n={3}>{t('guide.overview.step3')}</Step>
        </div>
        <Note kind="warn">{t('guide.overview.note')}</Note>
      </Sec>

      <Sec id="extension" icon={Puzzle} title={t('guide.nav.extension')}>
        <a href="/api/v1/extension/download" className="btn btn-primary" style={{ marginBottom: 16 }}>
          <Download size={15} /> {t('guide.extension.download_btn')}
        </a>
        <Step n={1}>{t('guide.extension.step1')}</Step>
        <Step n={2}>{t('guide.extension.step2')}</Step>
        <Step n={3}>{t('guide.extension.step3')}</Step>
        <Step n={4}>{t('guide.extension.step4')}</Step>
        <Step n={5}>{t('guide.extension.step5')}</Step>
        <Note>{t('guide.extension.note')}</Note>
      </Sec>

      <Sec id="connect" icon={Plug} title={t('guide.nav.connect')}>
        <Step n={1}>{t('guide.connect.step1')}</Step>
        <Step n={2}>{t('guide.connect.step2')}</Step>
        <Step n={3}>{t('guide.connect.step3')}</Step>
        <Step n={4}>{t('guide.connect.step4')}</Step>
        <Note kind="warn">{t('guide.connect.note')}</Note>
      </Sec>

      <Sec id="project" icon={Clapperboard} title={t('guide.project.title')}>
        <div style={{ fontSize: 13.5, lineHeight: 1.7, color: 'var(--text2)', marginBottom: 12 }}>
          {t('guide.project.intro')}
        </div>
        <Step n={1}>{t('guide.project.step1')}</Step>
        <Step n={2}>{t('guide.project.step2')}</Step>
        <Step n={3}>{t('guide.project.step3')}</Step>
        <div style={{ borderTop: '1px solid var(--border)', margin: '14px 0', paddingTop: 14, fontSize: 13.5, lineHeight: 1.7, color: 'var(--text2)' }}>
          <strong style={{ color: 'var(--text)' }}>{t('guide.project.options_title')}</strong>
          <ul style={{ margin: '8px 0 0', paddingLeft: 18 }}>
            <li>{t('guide.project.option_face')}</li>
            <li>{t('guide.project.option_audio')}</li>
            <li>{t('guide.project.option_merge')}</li>
            <li>{t('guide.project.option_continue')}</li>
          </ul>
        </div>
      </Sec>

      <Sec id="tools" icon={Wrench} title={t('guide.nav.tools')}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {TOOLS.map((tl, i) => (
            <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: '11px 0', borderBottom: i < TOOLS.length - 1 ? '1px solid var(--border)' : 'none' }}>
              <span style={{ flex: 'none', width: 30, height: 30, borderRadius: 8, background: 'var(--inset)', display: 'grid', placeItems: 'center' }}><tl.icon size={15} color="var(--accent2)" /></span>
              <div>
                <div style={{ fontSize: 13.5, fontWeight: 700 }}>{tl.name}</div>
                <div style={{ fontSize: 12.5, color: 'var(--text3)', marginTop: 2, lineHeight: 1.5 }}>{tl.desc}</div>
              </div>
            </div>
          ))}
        </div>
        <Note>{t('guide.tools.note')}</Note>
      </Sec>

      <Sec id="specs" icon={Ratio} title={t('guide.nav.specs')}>
        <div style={{ fontSize: 13.5, lineHeight: 1.75, color: 'var(--text2)' }}>
          <p style={{ margin: '0 0 10px' }}>{t('guide.specs.aspect_ratio')}</p>
          <p style={{ margin: '0 0 10px' }}>{t('guide.specs.quality_label')}</p>
          <ul style={{ margin: '0 0 10px', paddingLeft: 18 }}>
            <li>{t('guide.specs.quality_free')}</li>
            <li>{t('guide.specs.quality_paid')}</li>
          </ul>
          <p style={{ margin: 0 }}>{t('guide.specs.gem_info')}</p>
        </div>
      </Sec>

      <Sec id="trouble" icon={LifeBuoy} title={t('guide.nav.trouble')}>
        <Tr q={t('guide.trouble.q1')}>
          {t('guide.trouble.a1')}
        </Tr>
        <Tr q={t('guide.trouble.q2')}>
          {t('guide.trouble.a2')}
        </Tr>
        <Tr q={t('guide.trouble.q3')}>
          {t('guide.trouble.a3')}
        </Tr>
        <Tr q={t('guide.trouble.q4')}>
          {t('guide.trouble.a4')}
        </Tr>
        <Tr q={t('guide.trouble.q5')}>
          {t('guide.trouble.a5')}
        </Tr>
      </Sec>

      <div style={{ textAlign: 'center', color: 'var(--text3)', fontSize: 12.5, padding: '10px 0 30px' }}>
        <Sparkles size={14} style={{ verticalAlign: -2 }} /> {t('guide.footer')}
      </div>
    </div>
  )
}

const lnk: React.CSSProperties = { background: 'none', border: 'none', color: 'var(--accent2)', fontWeight: 600, cursor: 'pointer', padding: 0, font: 'inherit', textDecoration: 'underline' }

function Tr({ q, children }: { q: string; children: any }) {
  return (
    <details style={{ borderBottom: '1px solid var(--border)', padding: '10px 0' }}>
      <summary style={{ cursor: 'pointer', fontSize: 13.5, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8, listStyle: 'none' }}>
        <Check size={14} style={{ color: 'var(--accent2)', flex: 'none' }} /> {q}
      </summary>
      <div style={{ fontSize: 13, lineHeight: 1.65, color: 'var(--text2)', marginTop: 9, paddingLeft: 22 }}>{children}</div>
    </details>
  )
}
