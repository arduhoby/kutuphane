import { useRef, useEffect, useCallback, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { cn } from '../lib/utils'
import {
  BookOpen, MessageCircle, Bot, Settings,
  LogOut, Users, ShoppingCart, Scale,
  ChevronLeft, ChevronRight, Menu, Globe,
} from 'lucide-react'

const navItems = [
  { path: '/', label: 'Kütüphanem', icon: BookOpen },
  { path: '/forum', label: 'Forum Grubu', icon: MessageCircle },
  { path: '/knowledge-hub', label: 'Bilgi Merkezi', icon: Bot },
  { path: '/debate', label: 'AI Münazara', icon: Scale },
  { path: '/wishlist', label: 'Satın Alma Planı', icon: ShoppingCart },
  { path: '/public-copies', label: 'Herkese Açık', icon: Globe },
  { path: '/users', label: 'Kullanıcılar', icon: Users, adminOnly: true },
  { path: '/settings', label: 'Ayarlar', icon: Settings },
]

export function Sidebar() {
  const { user, logout } = useAuth()
  const location = useLocation()
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === 'undefined') return false
    return window.innerWidth >= 1024 && localStorage.getItem('sidebar_collapsed') === 'true'
  })
  const [mobileOpen, setMobileOpen] = useState(false)
  const touchStartX = useRef(0)
  const isDesktop = useRef(window.innerWidth >= 1024)

  useEffect(() => {
    const onResize = () => {
      isDesktop.current = window.innerWidth >= 1024
      if (isDesktop.current) setMobileOpen(false)
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  useEffect(() => {
    localStorage.setItem('sidebar_collapsed', String(collapsed))
  }, [collapsed])

  // close mobile sidebar on route change
  useEffect(() => {
    setMobileOpen(false)
  }, [location.pathname])

  const toggleCollapsed = useCallback(() => setCollapsed((p) => !p), [])

  const edgeSwipe = useCallback((clientX: number) => {
    if (clientX < 30) setMobileOpen(true)
  }, [])

  return (
    <>
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-50"
          onClick={() => setMobileOpen(false)}
        >
          <div className="absolute inset-0 bg-black/50 animate-fade-in" />
          <aside
            className="absolute left-0 top-0 bottom-0 w-[280px] bg-card border-r border-border flex flex-col shadow-2xl animate-slide-in-left"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-5">
              <div className="flex items-center gap-2.5">
                <span className="text-2xl">🌿</span>
                <span className="text-xl font-bold text-primary">FirBook</span>
              </div>
              <button onClick={() => setMobileOpen(false)} className="text-muted-foreground hover:text-foreground p-1">
                <ChevronLeft className="h-5 w-5" />
              </button>
            </div>
            <nav className="flex-1 px-3 space-y-1 overflow-y-auto">
              {navItems
                .filter((item) => !item.adminOnly || user?.is_admin)
                .map((item) => (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={cn(
                      'sidebar-link',
                      location.pathname === item.path && 'active'
                    )}
                  >
                    <item.icon className="h-4 w-4" />
                    {item.label}
                  </Link>
                ))}
            </nav>
            <div className="border-t border-border p-4 space-y-3">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center text-sm font-bold text-primary-foreground">
                  {user?.username?.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{user?.full_name || user?.username}</p>
                  <p className="text-xs text-muted-foreground truncate">{user?.is_admin ? 'Admin' : 'Kullanıcı'}</p>
                </div>
              </div>
              <button onClick={logout} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-foreground transition-colors">
                <LogOut className="h-4 w-4" />
                Çıkış Yap
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* Edge swipe zone + hamburger (mobile) */}
      <div
        className={cn('lg:hidden fixed z-40', mobileOpen ? 'hidden' : 'block')}
        onTouchStart={(e) => { touchStartX.current = e.touches[0].clientX }}
        onTouchEnd={(e) => {
          const dx = e.changedTouches[0].clientX - touchStartX.current
          if (dx > 40 && touchStartX.current < 30) setMobileOpen(true)
        }}
      >
        {/* vertical strip for edge swipe */}
        <div className="fixed left-0 top-0 bottom-0 w-4 cursor-pointer" />
        {/* hamburger button */}
        <button
          onClick={() => setMobileOpen(true)}
          className="fixed top-3 left-3 z-40 h-9 w-9 rounded-lg bg-card border border-border flex items-center justify-center text-muted-foreground hover:text-foreground shadow-md"
        >
          <Menu className="h-5 w-5" />
        </button>
      </div>

      {/* Desktop sidebar */}
      <aside
          className={cn(
            'hidden lg:flex flex-col bg-card border-r border-border flex-shrink-0 transition-all duration-300 ease-in-out relative',
            collapsed ? 'w-[60px]' : 'w-[240px]'
          )}
        onClick={(e) => {
          const t = (e.target as HTMLElement).closest('a,button')
          if (!t) toggleCollapsed()
        }}
      >
        <div className={cn('flex items-center py-5 min-h-[70px]', collapsed ? 'justify-center px-2' : 'justify-between px-5')}>
          <div className={cn('flex items-center gap-2.5 overflow-hidden', collapsed && 'justify-center')}>
            <span className="text-2xl flex-shrink-0">🌿</span>
            <span className={cn('text-xl font-bold text-primary whitespace-nowrap transition-all duration-300', collapsed && 'opacity-0 w-0 overflow-hidden')}>
              FirBook
            </span>
          </div>
          {!collapsed && (
            <button
              onClick={toggleCollapsed}
              className="flex items-center justify-center h-7 w-7 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors flex-shrink-0"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
          )}
        </div>

        <nav className={cn('flex-1 space-y-1', collapsed ? 'px-1' : 'px-3')}>
          {navItems
            .filter((item) => !item.adminOnly || user?.is_admin)
            .map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  collapsed
                    ? 'group relative flex items-center justify-center h-9 w-full rounded-lg text-foreground/70 hover:text-foreground hover:bg-primary/10 hover:scale-125 transition-transform duration-150 ease-out transform-gpu'
                    : 'sidebar-link',
                  location.pathname === item.path && (collapsed ? 'bg-primary text-primary-foreground' : 'active')
                )}
              >
                <item.icon className={cn('flex-shrink-0', collapsed ? 'h-5 w-5' : 'h-4 w-4')} />
                <span className={cn('truncate transition-all duration-300', collapsed && 'hidden')}>
                  {item.label}
                </span>
                {collapsed && (
                  <span className="absolute left-full ml-2 top-1/2 -translate-y-1/2 px-2.5 py-1.5 rounded-md bg-card border border-border text-sm text-foreground whitespace-nowrap shadow-lg pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-150 z-50">
                    {item.label}
                  </span>
                )}
              </Link>
            ))}
        </nav>

        <div className={cn('border-t border-border', collapsed ? 'p-2' : 'p-4')}>
          <div className={cn('flex items-center', collapsed ? 'justify-center' : 'gap-3')}>
            <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center text-sm font-bold text-primary-foreground flex-shrink-0">
              {user?.username?.charAt(0).toUpperCase()}
            </div>
            <div className={cn('flex-1 min-w-0 transition-all duration-300', collapsed && 'hidden')}>
              <p className="text-sm font-medium truncate">{user?.full_name || user?.username}</p>
              <p className="text-xs text-muted-foreground truncate">
                {user?.is_admin ? 'Admin' : 'Kullanıcı'}
              </p>
            </div>
          </div>
          <button
            onClick={logout}
            className={cn(
              collapsed
                ? 'group relative flex items-center justify-center h-9 w-full rounded-lg mt-2 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors'
                : 'flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-foreground transition-colors mt-2'
            )}
          >
            <LogOut className={cn('flex-shrink-0', collapsed ? 'h-5 w-5' : 'h-4 w-4')} />
            <span className={cn('transition-all duration-300', collapsed && 'hidden')}>
              Çıkış Yap
            </span>
            {collapsed && (
              <span className="absolute left-full ml-2 top-1/2 -translate-y-1/2 px-2.5 py-1.5 rounded-md bg-[#1E293B] border border-border text-sm text-foreground whitespace-nowrap shadow-lg pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-150 z-50">
                Çıkış Yap
              </span>
            )}
          </button>
        </div>
      </aside>
    </>
  )
}
