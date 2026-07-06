import { createContext, useContext, useState, useCallback, ReactNode } from 'react'
import vi from './locales/vi.json'
import en from './locales/en.json'

type Lang = 'vi' | 'en'
type Translations = Record<string, string>

const translations: Record<Lang, Translations> = { vi, en }

interface I18nCtx {
  lang: Lang
  setLang: (l: Lang) => void
  t: (key: string, params?: Record<string, string | number>) => string
}

const I18nContext = createContext<I18nCtx>({
  lang: 'vi',
  setLang: () => {},
  t: (k) => k,
})

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => {
    const saved = localStorage.getItem('lang')
    return (saved === 'en' ? 'en' : 'vi') as Lang
  })

  const setLang = useCallback((l: Lang) => {
    setLangState(l)
    localStorage.setItem('lang', l)
  }, [])

  const t = useCallback((key: string, params?: Record<string, string | number>): string => {
    let str = translations[lang]?.[key] || translations['vi']?.[key] || key
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        str = str.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), String(v))
      })
    }
    return str
  }, [lang])

  return (
    <I18nContext.Provider value={{ lang, setLang, t }}>
      {children}
    </I18nContext.Provider>
  )
}

/** Hook lấy hàm dịch t() */
export function useT() {
  return useContext(I18nContext).t
}

/** Hook lấy đầy đủ: lang, setLang, t */
export function useI18n() {
  return useContext(I18nContext)
}

/** Component nút chuyển ngôn ngữ */
export function LangSwitch({ compact }: { compact?: boolean }) {
  const { lang, setLang } = useI18n()
  return (
    <button
      onClick={() => setLang(lang === 'vi' ? 'en' : 'vi')}
      className="btn btn-ghost btn-sm"
      style={{ fontSize: 12, gap: 4, opacity: 0.85 }}
      title={lang === 'vi' ? 'Switch to English' : 'Chuyển sang Tiếng Việt'}
    >
      🌐 {compact ? (lang === 'vi' ? 'EN' : 'VI') : (lang === 'vi' ? 'English' : 'Tiếng Việt')}
    </button>
  )
}
