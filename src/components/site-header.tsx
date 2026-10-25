import { useEffect, useState } from 'react'
import { Code2, Moon, Sun } from 'lucide-react'
import { useI18n } from '../lib/i18n'
import { PROJECT } from '../lib/project'
import { Button, buttonVariants } from './ui/button'

function useTheme() {
  const [theme, setTheme] = useState<'light' | 'dark'>('light')

  useEffect(() => {
    setTheme(document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light')
  }, [])

  function toggle() {
    const next = theme === 'dark' ? 'light' : 'dark'
    document.documentElement.dataset.theme = next
    setTheme(next)
    try {
      window.localStorage.setItem('binflare.theme', next)
    } catch {
      // localStorage may be unavailable.
    }
  }

  return { theme, toggle }
}

export function ThemeToggle() {
  const { t } = useI18n()
  const { theme, toggle } = useTheme()
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      onClick={toggle}
      aria-label={theme === 'dark' ? t('Light mode') : t('Dark mode')}
      className="text-muted-foreground hover:text-foreground"
    >
      {theme === 'dark' ? <Sun /> : <Moon />}
    </Button>
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
      <span className="grid size-7 place-items-center rounded-md bg-foreground font-mono text-sm font-bold text-background">
        B
      </span>
      <span className="font-semibold tracking-tight">Binflare</span>
    </>
  )

  return (
    <header className="sticky top-0 z-30 border-b bg-background/85 backdrop-blur">
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between gap-2 px-4 sm:px-6">
        {onHome ? (
          <button
            type="button"
            onClick={onHome}
            aria-label="Binflare home"
            className="flex items-center gap-2 rounded-md text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {brand}
          </button>
        ) : (
          <a
            href="/"
            aria-label="Binflare home"
            className="flex items-center gap-2 rounded-md text-sm text-foreground no-underline outline-none hover:no-underline focus-visible:ring-2 focus-visible:ring-ring"
          >
            {brand}
          </a>
        )}

        <nav className="flex items-center gap-1 sm:gap-2" aria-label="Main">
          <a
            href={current === 'about' ? '/' : '/about'}
            className={buttonVariants({ variant: 'ghost', size: 'sm', className: 'text-muted-foreground hover:text-foreground' })}
          >
            {current === 'about' ? t('New document') : t('About')}
          </a>
          <a
            href={PROJECT.repositoryUrl}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={t('View on GitHub')}
            className={buttonVariants({ variant: 'ghost', size: 'icon', className: 'text-muted-foreground hover:text-foreground' })}
          >
            <Code2 />
          </a>
          <ThemeToggle />
          <LanguageToggle />
        </nav>
      </div>
    </header>
  )
}
