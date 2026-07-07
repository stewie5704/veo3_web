import { useState, useEffect } from 'react'
import { useToast } from '../components/Toast'
import { useT, LangSwitch } from '../i18n'
import api, { authApi, billingApi } from '../api/client'
import {
  User, KeyRound, Wifi, Shield, Save, Loader2, Crown, HardDrive, Sparkles,
  Gem, Check, AtSign, Mail, Gift, Bot, ExternalLink, Search,
} from 'lucide-react'

const fmtBytes = (b: number) =>
  b >= 1024 ** 3 ? (b / 1024 ** 3).toFixed(2) + ' GB'
    : b >= 1024 ** 2 ? (b / 1024 ** 2).toFixed(0) + ' MB'
    : (b / 1024).toFixed(0) + ' KB'

export default function Settings({ user, onUpdate }: { user: any; onUpdate: (u: any) => void }) {
  const toast = useToast()
  const t = useT()
  const [tab, setTab] = useState<'profile' | 'assistants' | 'security' | 'api'>('profile')
  const [sub, setSub] = useState<any>(null)

  const [displayName, setDisplayName] = useState('')
  const [username, setUsername] = useState('')
  const [saving, setSaving] = useState(false)

  const [curPwd, setCurPwd] = useState('')
  const [newPwd, setNewPwd] = useState('')
  const [confirmPwd, setConfirmPwd] = useState('')
  const [pwdSaving, setPwdSaving] = useState(false)

  const [geminiKey, setGeminiKey] = useState('')
  const [keySaving, setKeySaving] = useState(false)

  const [refCode, setRefCode] = useState('')
  const [refSaving, setRefSaving] = useState(false)

  // Trợ lý AI được tặng kèm gói (quà) — link ChatGPT ẩn dưới tên
  const [gift, setGift] = useState<any>(null)
  const [asstQ, setAsstQ] = useState('')

  const PLAN_LABEL: Record<string, string> = { m1: t('settings.plan_1m'), m6: t('settings.plan_6m'), m12: t('settings.plan_12m') }

  useEffect(() => {
    if (user) { setDisplayName(user.display_name || ''); setUsername(user.username || '') }
  }, [user])
  useEffect(() => { billingApi.me().then(setSub).catch(() => {}) }, [])
  useEffect(() => { billingApi.myAssistants().then(setGift).catch(() => {}) }, [])

  async function saveProfile() {
    setSaving(true)
    try {
      await api.patch('/profile/me', { display_name: displayName, username })
      onUpdate(await authApi.me())
      toast(t('settings.profile_updated'), 'success')
    } catch (e: any) { toast(e.response?.data?.detail || t('common.error'), 'error') }
    finally { setSaving(false) }
  }
  async function changePassword() {
    if (newPwd !== confirmPwd) { toast(t('settings.password_mismatch'), 'error'); return }
    if (newPwd.length < 6) { toast(t('settings.password_min_length'), 'error'); return }
    setPwdSaving(true)
    try {
      await api.post('/profile/change-password', { current_password: curPwd, new_password: newPwd })
      setCurPwd(''); setNewPwd(''); setConfirmPwd('')
      toast(t('settings.password_changed'), 'success')
    } catch (e: any) { toast(e.response?.data?.detail || t('common.error'), 'error') }
    finally { setPwdSaving(false) }
  }
  async function saveGeminiKey() {
    if (!geminiKey.trim()) return
    const keys = geminiKey.split(/[\r\n,]+/).map(k => k.trim()).filter(Boolean)
    if (keys.length > 5) {
      toast('Chỉ hỗ trợ tối đa 5 API Keys cá nhân', 'error')
      return
    }
    setKeySaving(true)
    try {
      await authApi.saveGeminiKey(keys.join(','))
      onUpdate(await authApi.me())
      toast(t('settings.gemini_key_saved'), 'success'); setGeminiKey('')
    } catch (e: any) { toast(e.response?.data?.detail || t('common.error'), 'error') }
    finally { setKeySaving(false) }
  }
  async function applyRefCode() {
    if (!refCode.trim()) return
    setRefSaving(true)
    try {
      await authApi.applyRef(refCode.trim())
      onUpdate(await authApi.me())
      toast(t('settings.ref_applied'), 'success'); setRefCode('')
    } catch (e: any) { toast(e.response?.data?.detail || t('common.error'), 'error') }
    finally { setRefSaving(false) }
  }

  // Tab "Trợ lý AI" chỉ hiện khi user thực sự được tặng (quà kèm gói)
  const hasGift = !!(gift?.gifted && (gift?.assistants?.length || 0) > 0)
  const TABS: { k: 'profile' | 'assistants' | 'security' | 'api'; l: string; i: any }[] = [
    { k: 'profile', l: t('settings.tab_profile'), i: User },
    ...(hasGift ? [{ k: 'assistants' as const, l: t('settings.tab_assistants'), i: Bot }] : []),
    { k: 'security', l: t('settings.tab_security'), i: Shield },
    { k: 'api', l: t('settings.tab_api'), i: Wifi },
  ]

  // Plan / trial state
  const active = sub?.active
  const inTrial = sub?.in_trial && !active
  const trialHrs = sub?.trial_ends_at ? Math.max(0, Math.round((new Date(sub.trial_ends_at).getTime() - Date.now()) / 3600000)) : 0
  const stUsed = sub?.storage_used || 0
  const stLimit = sub?.storage_limit || 150 * 1024 * 1024
  const stPct = Math.min(100, Math.round((stUsed / stLimit) * 100))
  const stNear = stPct >= 85

  // Trợ lý tặng: lọc theo ô tìm + gom nhóm theo danh mục (giữ thứ tự)
  const allAssts: any[] = gift?.assistants || []
  const asstQuery = asstQ.trim().toLowerCase()
  const asstFiltered = asstQuery
    ? allAssts.filter(a => `${a.name || ''} ${a.category || ''}`.toLowerCase().includes(asstQuery))
    : allAssts
  const asstGroups: [string, any[]][] = []
  const asstIdx: Record<string, any[]> = {}
  for (const a of asstFiltered) {
    const cat = a.category || t('settings.category_other')
    if (!asstIdx[cat]) { asstIdx[cat] = []; asstGroups.push([cat, asstIdx[cat]]) }
    asstIdx[cat].push(a)
  }

  return (
    <div style={{ maxWidth: 600, margin: '0 auto' }}>
      <div className="page-header">
        <div>
          <div className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Gem size={22} color="#fb923c" /> {t('settings.title')}
          </div>
          <div className="page-subtitle">{t('settings.subtitle')}</div>
        </div>
      </div>

      {/* ── VIP account card ── */}
      <div style={{
        position: 'relative', borderRadius: 20, padding: '22px 24px', marginBottom: 18, overflow: 'hidden',
        background: 'linear-gradient(140deg, rgba(249,115,22,0.10), rgba(236,72,153,0.06) 45%, rgba(168,85,247,0.05))',
        border: '1px solid rgba(249,115,22,0.22)',
        boxShadow: '0 24px 60px -28px rgba(236,72,153,0.4)',
      }}>
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: 'var(--grad)' }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          {/* avatar with gradient ring */}
          <div style={{ padding: 2.5, borderRadius: '50%', background: 'var(--grad)', flexShrink: 0, boxShadow: '0 6px 20px -6px rgba(236,72,153,0.6)' }}>
            <div style={{
              width: 64, height: 64, borderRadius: '50%', background: '#15110f',
              display: 'grid', placeItems: 'center', fontSize: 26, fontWeight: 800,
            }}>
              <span style={{ background: 'var(--grad)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
                {(user?.display_name || user?.username || '?')[0]?.toUpperCase()}
              </span>
            </div>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 19, fontWeight: 800, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              {user?.display_name || user?.username}
              {user?.is_admin && <Crown size={16} color="#fbbf24" fill="#fbbf24" />}
            </div>
            <div style={{ fontSize: 12.5, color: 'var(--text3)', marginBottom: 8 }}>{user?.email}</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {active ? (
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 11px', borderRadius: 99,
                  fontSize: 11.5, fontWeight: 700, color: '#fff', background: 'var(--grad)',
                  boxShadow: '0 4px 12px -4px rgba(236,72,153,0.6)',
                }}>
                  <Crown size={12} /> {t('settings.plan_badge', { plan: PLAN_LABEL[sub.plan] || sub.plan, days: sub.days_left != null ? String(Math.round(sub.days_left)) : '' })}
                </span>
              ) : inTrial ? (
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 11px', borderRadius: 99,
                  fontSize: 11.5, fontWeight: 700, color: '#fbbf24',
                  background: 'rgba(251,191,36,0.12)', border: '1px solid rgba(251,191,36,0.3)',
                }}>
                  <Sparkles size={12} /> {t('settings.trial_badge', { hours: String(trialHrs) })}
                </span>
              ) : (
                <span className="badge" style={{ background: 'rgba(255,255,255,0.06)', color: 'var(--text3)' }}>{t('settings.free_badge')}</span>
              )}
              {user?.is_admin && <span className="badge badge-processing">Admin</span>}
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 10px', borderRadius: 99,
                fontSize: 11.5, fontWeight: 600, color: 'var(--text2)', background: 'rgba(255,255,255,0.05)',
              }}>
                🎬 {t('settings.videos_count', { count: String(user?.videos_generated || 0) })}
              </span>
            </div>
          </div>
        </div>

        {/* storage bar */}
        <div style={{ marginTop: 18, borderTop: '1px solid rgba(255,255,255,0.07)', paddingTop: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12.5, marginBottom: 7 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 7, color: 'var(--text2)' }}>
              <HardDrive size={14} color={stNear ? '#f87171' : '#fb923c'} /> {t('settings.storage_label')}
            </span>
            <span style={{ color: stNear ? '#f87171' : 'var(--text3)', fontVariantNumeric: 'tabular-nums' }}>
              {fmtBytes(stUsed)} / {fmtBytes(stLimit)}{active ? '' : ' (free)'}
            </span>
          </div>
          <div style={{ height: 8, borderRadius: 99, background: 'rgba(255,255,255,0.07)', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${stPct}%`, borderRadius: 99, transition: 'width .4s', background: stNear ? 'linear-gradient(90deg,#f87171,#ef4444)' : 'var(--grad)' }} />
          </div>
          <div style={{ fontSize: 11.5, color: 'var(--text3)', marginTop: 7 }}>
            {stNear
              ? <span style={{ color: '#f87171' }}>{active ? t('settings.storage_near_full_paid') : t('settings.storage_near_full_free')}</span>
              : active ? t('settings.storage_paid_info') : t('settings.storage_free_info')}
          </div>
        </div>
      </div>

      {/* ── Tabs ── */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 18 }}>
        {TABS.map(tb => {
          const Icon = tb.i; const on = tab === tb.k
          return (
            <button key={tb.k} onClick={() => setTab(tb.k)} style={{
              display: 'flex', alignItems: 'center', gap: 7, padding: '8px 16px', borderRadius: 10,
              border: `1px solid ${on ? 'rgba(249,115,22,0.35)' : 'transparent'}`, cursor: 'pointer',
              fontSize: 13, fontWeight: 600, transition: 'all .15s', fontFamily: 'inherit',
              background: on ? 'rgba(249,115,22,0.13)' : 'rgba(255,255,255,0.04)',
              color: on ? '#fb923c' : 'var(--text3)',
            }}>
              <Icon size={14} /> {tb.l}
            </button>
          )
        })}
      </div>

      {/* Profile */}
      {tab === 'profile' && (
        <div className="card">
          <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span><User size={15} /> {t('settings.profile_header')}</span>
            <LangSwitch />
          </div>
          <div className="form-group">
            <label className="form-label">{t('settings.display_name')}</label>
            <input className="form-input" placeholder={t('settings.display_name_placeholder')}
              value={displayName} onChange={e => setDisplayName(e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}><AtSign size={12} /> {t('settings.username')}</label>
            <input className="form-input" placeholder={t('settings.username_placeholder')}
              value={username} onChange={e => setUsername(e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Mail size={12} /> Email</label>
            <input className="form-input" value={user?.email || ''} disabled style={{ opacity: 0.5, cursor: 'not-allowed' }} />
          </div>
          <div className="form-group">
            <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Gift size={12} /> {t('settings.referral_code')}</label>
            {user?.referred_by ? (
              <div className="alert alert-success" style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 6, marginBottom: 0 }}>
                <Check size={13} /> {t('settings.already_referred')}
              </div>
            ) : (
              <div style={{ display: 'flex', gap: 8 }}>
                <input className="form-input" placeholder={t('settings.referral_placeholder')}
                  value={refCode} onChange={e => setRefCode(e.target.value)} style={{ flex: 1 }} />
                <button type="button" className="btn btn-ghost" onClick={applyRefCode} disabled={refSaving || !refCode.trim()}>
                  {refSaving ? <Loader2 size={13} className="spin" /> : t('settings.apply_ref')}
                </button>
              </div>
            )}
          </div>
          <button className="btn btn-primary" onClick={saveProfile} disabled={saving}>
            {saving ? <><Loader2 size={13} className="spin" /> {t('settings.saving')}</> : <><Save size={13} /> {t('settings.save_changes')}</>}
          </button>
        </div>
      )}

      {/* Trợ lý AI được tặng (quà kèm gói) — bấm tên để mở ChatGPT (link ẩn dưới tên) */}
      {tab === 'assistants' && hasGift && (
        <div className="card">
          <div className="card-header" style={{ justifyContent: 'space-between' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Bot size={15} color="#fb923c" /> {t('settings.gifted_assistants')}</span>
            <span className="badge" style={{ background: 'var(--grad)', color: '#fff', border: 'none' }}>{t('settings.assistant_count', { count: String(gift.count) })}</span>
          </div>
          <div className="alert alert-info" style={{ fontSize: 12, marginBottom: 14 }}>
            {t('settings.gift_info')}
          </div>
          {allAssts.length > 8 && (
            <div style={{ position: 'relative', marginBottom: 14 }}>
              <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)', pointerEvents: 'none' }} />
              <input className="form-input" style={{ paddingLeft: 34 }} placeholder={t('settings.search_assistants')}
                value={asstQ} onChange={e => setAsstQ(e.target.value)} />
            </div>
          )}
          <div className="gift-asst-list">
            {asstGroups.length === 0 ? (
              <div style={{ fontSize: 13, color: 'var(--text3)', padding: '18px 4px', textAlign: 'center' }}>{t('settings.no_assistants_found')}</div>
            ) : asstGroups.map(([cat, items]) => (
              <div key={cat}>
                <div className="gift-asst-cat">{cat}</div>
                {items.map((a: any, i: number) => (
                  <a key={a.id ?? `${cat}-${i}`} className="gift-asst" href={a.url} target="_blank" rel="noreferrer" title={a.name}>
                    <span className="ai-ico"><Bot size={15} /></span>
                    <span className="ai-name">{a.name}</span>
                    <ExternalLink size={13} className="ai-ext" />
                  </a>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Security */}
      {tab === 'security' && (
        <div className="card">
          <div className="card-header"><Shield size={15} /> {t('settings.change_password')}</div>
          <div className="form-group">
            <label className="form-label">{t('settings.current_password')}</label>
            <input className="form-input" type="password" placeholder="••••••••"
              value={curPwd} onChange={e => setCurPwd(e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">{t('settings.new_password')}</label>
            <input className="form-input" type="password" placeholder={t('settings.password_min_length')}
              value={newPwd} onChange={e => setNewPwd(e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">{t('settings.confirm_password')}</label>
            <input className="form-input" type="password" placeholder="••••••••"
              value={confirmPwd} onChange={e => setConfirmPwd(e.target.value)} />
          </div>
          {newPwd && confirmPwd && newPwd !== confirmPwd && (
            <div className="alert alert-error" style={{ marginBottom: 12 }}>{t('settings.password_mismatch')}</div>
          )}
          <button className="btn btn-primary" onClick={changePassword}
            disabled={pwdSaving || !curPwd || !newPwd || newPwd !== confirmPwd}>
            {pwdSaving ? <><Loader2 size={13} className="spin" /> {t('settings.changing_password')}</> : <><KeyRound size={13} /> {t('settings.change_password')}</>}
          </button>
        </div>
      )}

      {/* API & Connections */}
      {tab === 'api' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="card">
            <div className="card-header"><Wifi size={15} /> {t('settings.google_ultra_connection')}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <div className={`connection-badge ${user?.google_connected ? 'connected' : 'disconnected'}`}>
                <span className="connection-dot" />
                {user?.google_connected ? t('settings.connected') : t('settings.not_connected')}
              </div>
            </div>
            <div className="alert alert-info" style={{ fontSize: 12 }}>
              {t('settings.chrome_extension_info')}
            </div>
          </div>

          <div className="card">
            <div className="card-header"><KeyRound size={15} /> Gemini API Key</div>
            {user?.has_gemini_key && (
              <div className="alert alert-success" style={{ marginBottom: 12, fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Check size={13} /> Đã có API Key cá nhân trong hệ thống
              </div>
            )}
            <div className="form-group">
              <label className="form-label">Cấu hình Pool Cá Nhân (Tối đa 5 Keys)</label>
              <textarea className="form-input" placeholder="AIzaSy...\nAIzaSy...\n(Mỗi key 1 dòng, tối đa 5 keys)"
                value={geminiKey} onChange={e => setGeminiKey(e.target.value)} rows={3} style={{ resize: 'vertical' }} />
            </div>
            <div className="alert alert-info" style={{ fontSize: 12, marginBottom: 12 }}>
              Hệ thống sẽ tự động xoay vòng (round-robin) các key của bạn để tránh lỗi Rate Limit. Nếu tất cả key của bạn đều cạn Quota, hệ thống mới tự động fallback sang máy chủ chung. Lấy key tại: <a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer" style={{ color: 'var(--accent2)' }}>aistudio.google.com</a>
            </div>
            <button className="btn btn-primary" onClick={saveGeminiKey} disabled={keySaving || !geminiKey.trim()}>
              {keySaving ? <><Loader2 size={13} className="spin" /> {t('settings.saving')}</> : <><Save size={13} /> Lưu Pool Keys</>}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
