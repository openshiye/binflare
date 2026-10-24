import { useEffect, useState } from 'react'
import { useI18n } from '../lib/i18n'

function useTheme() {
  const [theme, setTheme] = useState<'light' | 'dark'>('light')

  useEffect(() => {
    const current = document.documentElement.dataset.theme
    setTheme(current === 'dark' ? 'dark' : 'light')
  }, [])

  function toggle() {
    const next = theme === 'dark' ? 'light' : 'dark'
    document.documentElement.dataset.theme = next
    setTheme(next)
    try {
      window.localStorage.setItem('binflare.theme', next)
    } catch {
      // ignore
    }
  }

  return { theme, toggle }
}

export function ThemeToggle() {
  const { t } = useI18n()
  const { theme, toggle } = useTheme()
  return (
    <button
      type="button"
      className="button ghost small site-control"
      onClick={toggle}
      aria-label={theme === 'dark' ? t('Light mode') : t('Dark mode')}
    >
      {theme === 'dark' ? t('Light mode') : t('Dark mode')}
    </button>
  )
}

export function LanguageToggle() {
  const { lang, setLang, t } = useI18n()
  return (
    <select
      className="language-select"
      value={lang}
      onChange={(event) => setLang(event.target.value === 'zh' ? 'zh' : 'en')}
      aria-label={t('Language')}
    >
      <option value="en">EN</option>
      <option value="zh">中文</option>
    </select>
  )
}

export function SiteHeader({
  onHome,
  current = 'home',
}: {
  onHome?: () => void
  current?: 'home' | 'about'
}) {
  const { t } = useI18n()
  const brand = (
    <>
      <span className="wordmark-mark">B</span>
      <span>BINFLARE</span>
    </>
  )

  return (
    <header className="site-header">
      {onHome ? (
        <button type="button" className="wordmark" onClick={onHome} aria-label="Binflare home">
          {brand}
        </button>
      ) : (
        <a className="wordmark" href="/" aria-label="Binflare home">
          {brand}
        </a>
      )}
      <div className="site-header-right">
        <nav className="site-nav" aria-label="Main">
          <a href={current === 'about' ? '/' : '/about'}>
            {current === 'about' ? t('New document') : t('About')}
          </a>
        </nav>
        <div className="site-controls">
          <ThemeToggle />
          <LanguageToggle />
        </div>
      </div>
    </header>
  )
}
