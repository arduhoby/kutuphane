import { useState, useEffect, useRef, useCallback } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import { useAuth } from '../hooks/useAuth'
import { useBookSearch, SORT_OPTIONS, getHoverCardEnabled } from '../hooks/useBookSearch'
import { useToast } from '../components/ui/toast'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Card, CardContent } from '../components/ui/card'
import { Badge } from '../components/ui/badge'
import { Pagination } from '../components/Pagination'
import { BookSkeletonGrid } from '../components/BookSkeleton'
import { BookHoverCard } from '../components/BookHoverCard'
import { BookCard } from '../components/BookCard'
import { BookOpen, Plus, Search, X, Bot, Globe, ExternalLink, ShoppingCart, Loader2, Monitor, Pencil, LayoutGrid, List } from 'lucide-react'

export function BooksPage() {
  const { user } = useAuth()
  const { toast } = useToast()
  const location = useLocation()
  const navigate = useNavigate()
  const search = useBookSearch(50)
  const [searchInput, setSearchInput] = useState(search.query)
  const [viewMode, setViewMode] = useState<'grid' | 'list'>(
    () => (localStorage.getItem('booksViewMode') as 'grid' | 'list') || 'grid'
  )

  const handleViewModeChange = (mode: 'grid' | 'list') => {
    setViewMode(mode)
    localStorage.setItem('booksViewMode', mode)
  }

  useEffect(() => { setSearchInput(search.query) }, [search.query])

  useEffect(() => {
    search.fetchBooks()
  }, [location.pathname, location.search])

  // Web search fallback when library returns 0 results
  const [webResults, setWebResults] = useState<any[]>([])
  const [webSearching, setWebSearching] = useState(false)
  const [webSearched, setWebSearched] = useState(false)

  useEffect(() => {
    setWebResults([])
    setWebSearched(false)
  }, [search.query])

  useEffect(() => {
    if (!search.loading && search.data.length === 0 && search.query && !webSearched) {
      setWebSearching(true)
      setWebSearched(true)
      api.books.searchWeb(search.query)
        .then(setWebResults)
        .catch(() => setWebResults([]))
        .finally(() => setWebSearching(false))
    }
  }, [search.loading, search.data.length, search.query, webSearched])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    search.setQuery(searchInput)
  }

  const addToWishlist = async (item: any) => {
    try {
      await api.wishlist.add({
        title: item.title || item.snippet?.slice(0, 100) || 'Bilinmeyen Kitap',
        author: item.author || '',
        source: item.source || extractSiteName(item.url || ''),
        source_url: item.url || '',
        price: extractPrice(item.snippet || ''),
      })
      toast({ title: 'Satın alma planına eklendi' })
    } catch (err: any) {
      toast({ title: 'Hata', description: err.message, variant: 'destructive' })
    }
  }

  // Hover card state
  const hoverEnabled = useRef(getHoverCardEnabled()).current
  const [hoveredBook, setHoveredBook] = useState<any | null>(null)
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 })
  const hoverTimer = useRef<number | null>(null)

  const handleMouseEnter = useCallback((book: any) => {
    if (!hoverEnabled) return
    if (hoverTimer.current) window.clearTimeout(hoverTimer.current)
    hoverTimer.current = window.setTimeout(() => {
      setHoveredBook(book)
    }, 2000)
  }, [hoverEnabled])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    setMousePos({ x: e.clientX, y: e.clientY })
  }, [])

  const handleMouseLeave = useCallback(() => {
    if (hoverTimer.current) window.clearTimeout(hoverTimer.current)
    setHoveredBook(null)
  }, [])

  useEffect(() => {
    return () => {
      if (hoverTimer.current) window.clearTimeout(hoverTimer.current)
    }
  }, [])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Kitaplar</h1>
          <p className="text-muted-foreground mt-1">Toplam {search.total} kitap</p>
        </div>
        {user && (
          <Link to="/books/new">
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Kitap Ekle
            </Button>
          </Link>
        )}
      </div>

      <form onSubmit={handleSearch} className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Kitap adı, yazar veya ISBN ile ara..."
            className="pl-9 pr-9"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
          {searchInput && (
            <button
              type="button"
              onClick={() => { setSearchInput(''); search.clearSearch() }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <Button type="submit" variant="secondary">Ara</Button>
      </form>

      <div className="flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input type="checkbox" checked={search.isRead === true} onChange={() => search.setIsRead(search.toggleFilter(search.isRead))} className="rounded" />
          Okundu
        </label>
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input type="checkbox" checked={search.isEbook === true} onChange={() => search.setIsEbook(search.toggleFilter(search.isEbook))} className="rounded" />
          E-Kitap
        </label>
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input type="checkbox" checked={search.isPrinted === true} onChange={() => search.setIsPrinted(search.toggleFilter(search.isPrinted))} className="rounded" />
          Basılı Kitap
        </label>
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input type="checkbox" checked={search.isLoaned === true} onChange={() => search.setIsLoaned(search.toggleFilter(search.isLoaned))} className="rounded" />
          Ödünçte
        </label>
        <div className="ml-auto flex items-center gap-3">
          <div className="flex items-center gap-2">
            <label className="text-xs text-muted-foreground">Sırala:</label>
            <select
              value={search.sort}
              onChange={(e) => search.setSort(e.target.value)}
              className="text-xs bg-background border border-border rounded-md px-2 py-1 text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
            >
              {SORT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <div className="h-4 w-px bg-border" />
          <div className="flex items-center gap-1 border border-border rounded-md p-0.5 bg-muted/40">
            <button
              type="button"
              className={`h-6 w-6 p-0 flex items-center justify-center rounded-sm transition-colors ${viewMode === 'grid' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
              onClick={() => handleViewModeChange('grid')}
              title="Kart Görünümü"
            >
              <LayoutGrid className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              className={`h-6 w-6 p-0 flex items-center justify-center rounded-sm transition-colors ${viewMode === 'list' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
              onClick={() => handleViewModeChange('list')}
              title="Liste Görünümü"
            >
              <List className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
        {search.hasFilters && (
          <button onClick={() => { setSearchInput(''); search.clearFilters(); search.clearSearch() }} className="text-xs text-muted-foreground hover:text-foreground underline">
            Filtreleri Temizle
          </button>
        )}
      </div>

      {search.loading ? (
        <BookSkeletonGrid count={8} />
      ) : search.data.length === 0 && !webResults.length && !webSearching ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <BookOpen className="h-12 w-12 mb-4 opacity-50" />
            <p>{search.query ? 'Aramanızla eşleşen kitap bulunamadı' : 'Henüz kitap eklenmemiş'}</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {viewMode === 'grid' ? (
            <div className="grid gap-3 grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
              {search.data.map((book: any) => (
                <BookCard
                  key={book.id}
                  book={book}
                  user={user}
                  onMouseEnter={handleMouseEnter}
                  onMouseMove={handleMouseMove}
                  onMouseLeave={handleMouseLeave}
                />
              ))}
            </div>
          ) : (
            <div className="border border-border rounded-lg divide-y divide-border bg-card overflow-hidden">
              {search.data.map((book: any) => {
                const shelfColor = book.shelf_color || null
                return (
                  <div
                    key={book.id}
                    className="flex items-center justify-between p-3 hover:bg-muted/50 transition-colors group relative"
                    style={shelfColor ? { borderLeft: `3px solid ${shelfColor}` } : undefined}
                  >
                    <Link
                      to={`/books/${book.id}`}
                      state={{ from: `/books${location.search}` }}
                      className="flex-1 min-w-0 flex items-baseline gap-2"
                    >
                      <span className="font-semibold text-sm hover:text-primary transition-colors truncate">
                        {book.title}
                      </span>
                      {book.author && (
                        <span className="text-xs text-muted-foreground truncate">
                          {book.author}
                        </span>
                      )}
                    </Link>
                    
                    <div className="flex items-center gap-1.5 ml-4 flex-shrink-0">
                      {book.is_ebook && (
                        <Badge
                          variant="outline"
                          className="h-5 w-5 p-0 flex items-center justify-center bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20 font-bold text-xs"
                          title="E-Kitap"
                        >
                          E
                        </Badge>
                      )}
                      {book.is_read && (
                        <Badge
                          variant="outline"
                          className="h-5 w-5 p-0 flex items-center justify-center bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 font-bold text-xs"
                          title="Okundu"
                        >
                          R
                        </Badge>
                      )}
                      {book.has_digital_copy && (
                        <Badge
                          variant="outline"
                          className="h-5 w-5 p-0 flex items-center justify-center bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/20 font-bold text-xs"
                          title="Dijital Doküman"
                        >
                          D
                        </Badge>
                      )}
                      
                      {user && (
                        <button
                          onClick={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            navigate(`/books/${book.id}`, { state: { from: `/books${location.search}`, editing: true } })
                          }}
                          className="p-1 rounded-md bg-accent text-foreground hover:bg-primary hover:text-primary-foreground opacity-0 group-hover:opacity-100 transition-opacity ml-2 cursor-pointer"
                          title="Düzenle"
                        >
                          <Pencil className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {hoveredBook && (
            <BookHoverCard
              book={hoveredBook}
              mouseX={mousePos.x}
              mouseY={mousePos.y}
            />
          )}

          {search.data.length > 0 && <Pagination page={search.page} totalPages={search.totalPages} onPageChange={search.setPage} />}

          {search.query && search.data.length === 0 && (
            <div className="mt-8 space-y-4">
              <div className="flex items-center gap-2 border-b border-border pb-2">
                <Globe className="h-5 w-5 text-primary" />
                <h2 className="text-lg font-semibold">Kütüphane Dışı Arama</h2>
                <span className="text-xs text-muted-foreground">(Kütüphanede bulunamadı)</span>
              </div>

              {webSearching ? (
                <div className="flex items-center gap-2 text-muted-foreground py-4">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-sm">Web'de aranıyor...</span>
                </div>
              ) : webResults.length === 0 ? (
                <p className="text-sm text-muted-foreground">Web'de de sonuç bulunamadı.</p>
              ) : (
                <div className="space-y-2">
                  {webResults.map((r, i) => {
                    const siteName = extractSiteName(r.url || '')
                    const price = extractPrice(r.snippet || '')
                    return (
                      <div key={i} className="rounded-lg border border-border bg-card p-4 hover:bg-accent/50 transition-colors">
                        <div className="flex items-start justify-between gap-4">
                          <div className="min-w-0 flex-1">
                            <a href={r.url} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-primary hover:underline block truncate">
                              {r.title || siteName}
                              <ExternalLink className="h-3 w-3 inline ml-1 opacity-70" />
                            </a>
                            {r.snippet && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{r.snippet}</p>}
                            <div className="flex items-center gap-3 mt-1.5">
                              <span className="text-xs text-muted-foreground">{siteName}</span>
                              {price && <span className="text-xs font-medium text-green-500">{price}</span>}
                            </div>
                          </div>
                          <Button size="sm" variant="outline" onClick={() => addToWishlist(r)}>
                            <ShoppingCart className="h-3.5 w-3.5 mr-1" />
                            Planla
                          </Button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}

function extractSiteName(url: string): string {
  try {
    const host = new URL(url).hostname.replace('www.', '')
    return host.split('.')[0].charAt(0).toUpperCase() + host.split('.')[0].slice(1)
  } catch { return '' }
}

function extractPrice(text: string): string {
  const match = text.match(/(\d{1,3}(?:\.\d{3})*(?:,\d{2})?\s?(?:TL|₺|\$|€))/)
  return match ? match[1] : ''
}
