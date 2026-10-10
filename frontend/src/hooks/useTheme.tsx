import { useEffect, useState, createContext, useContext, useCallback } from 'react'

type Theme = 'dark' | 'light' | 'system'

interface ThemeContextValue {
  theme: Theme
  resolvedTheme: 'dark' | 'light'
  setTheme: (theme: Theme) => void
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined)

const STORAGE_KEY = 'theme'

function safeGetItem(key: string): string | null {
  try {
    if (typeof window === 'undefined') return null
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function safeSetItem(key: string, value: string): void {
  try {
    if (typeof window === 'undefined') return
    localStorage.setItem(key, value)
  } catch {
    // ignore
  }
}

function getSystemTheme(): 'dark' | 'light' {
  if (typeof window === 'undefined') return 'dark'
  try {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  } catch {
    return 'dark'
  }
}

function getStoredTheme(): Theme {
  const stored = safeGetItem(STORAGE_KEY)
  if (stored === 'dark' || stored === 'light' || stored === 'system') return stored
  return 'system'
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => getStoredTheme())
  const [resolvedTheme, setResolvedTheme] = useState<'dark' | 'light'>(() =>
    theme === 'system' ? getSystemTheme() : theme
  )

  const applyTheme = useCallback((next: Theme) => {
    const resolved = next === 'system' ? getSystemTheme() : next
    setResolvedTheme(resolved)
    if (typeof document === 'undefined') return
    const root = document.documentElement
    root.classList.remove('light', 'dark')
    root.classList.add(resolved)
  }, [])

  useEffect(() => {
    applyTheme(theme)
  }, [theme, applyTheme])

  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const media = window.matchMedia('(prefers-color-scheme: dark)')
      const handler = () => {
        if (theme === 'system') applyTheme('system')
      }
      media.addEventListener('change', handler)
      return () => media.removeEventListener('change', handler)
    } catch {
      return undefined
    }
  }, [theme, applyTheme])

  const setTheme = useCallback((next: Theme) => {
    safeSetItem(STORAGE_KEY, next)
    setThemeState(next)
  }, [])

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider')
  return ctx
}
