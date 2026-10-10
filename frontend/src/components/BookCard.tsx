import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Card, CardContent } from './ui/card'
import { Badge } from './ui/badge'
import { BookOpen, Monitor, Bot, Pencil } from 'lucide-react'

interface BookCardProps {
  book: any
  user: any
  onMouseEnter?: (book: any) => void
  onMouseMove?: (e: React.MouseEvent) => void
  onMouseLeave?: () => void
}

export function BookCard({ book, user, onMouseEnter, onMouseMove, onMouseLeave }: BookCardProps) {
  const location = useLocation()
  const navigate = useNavigate()
  const shelfColor = book.shelf_color || null

  return (
    <Link
      to={`/books/${book.id}`}
      state={{ from: `/books${location.search}` }}
      className="group block"
      onMouseEnter={() => onMouseEnter?.(book)}
      onMouseMove={onMouseMove}
      onMouseLeave={onMouseLeave}
    >
      <Card
        className="h-full overflow-hidden transition-all duration-200 hover:-translate-y-1 hover:shadow-xl bg-card border-border relative"
        style={shelfColor ? { borderTop: `3px solid ${shelfColor}` } : undefined}
      >
        {user && (
          <button
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              navigate(`/books/${book.id}`, { state: { from: `/books${location.search}`, editing: true } })
            }}
            className="absolute top-2 right-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-md bg-accent text-foreground hover:bg-primary hover:text-primary-foreground cursor-pointer"
            title="Düzenle"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
        )}
        <CardContent className="p-3 text-center">
          <div className="mb-2 flex justify-center">
            {book.cover_url ? (
              <div className="relative">
                <img
                  src={book.cover_url}
                  alt={book.title}
                  className="w-[94px] aspect-[3/4] rounded-md object-cover shadow-md"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement
                    target.style.display = 'none'
                    if (target.parentElement) {
                      target.parentElement.innerHTML = `
                        <div class="w-[94px] aspect-[3/4] rounded-md bg-muted flex items-center justify-center shadow-md">
                          ${book.is_ebook
                            ? '<svg class="h-7 w-7 text-primary/60" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="14" x="2" y="3" rx="2"/><line x1="8" x2="16" y1="21" y2="21"/><line x1="12" x2="12" y1="17" y2="21"/></svg>'
                            : '<svg class="h-7 w-7 text-muted-foreground/50" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/></svg>'
                          }
                        </div>
                        ${book.is_ebook
                          ? '<div class="absolute -top-1 -right-1 bg-primary text-primary-foreground rounded-full p-1 shadow-sm"><svg class="h-3 w-3" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="14" x="2" y="3" rx="2"/><line x1="8" x2="16" y1="21" y2="21"/><line x1="12" x2="12" y1="17" y2="21"/></svg></div>'
                          : ''
                        }
                      `
                    }
                  }}
                />
                {book.is_ebook && (
                  <div className="absolute -top-1 -right-1 bg-primary text-primary-foreground rounded-full p-1 shadow-sm">
                    <Monitor className="h-3 w-3" />
                  </div>
                )}
              </div>
            ) : (
              <div className="relative">
                <div className="w-[94px] aspect-[3/4] rounded-md bg-muted flex items-center justify-center shadow-md">
                  {book.is_ebook ? (
                    <Monitor className="h-7 w-7 text-primary/60" />
                  ) : (
                    <BookOpen className="h-7 w-7 text-muted-foreground/50" />
                  )}
                </div>
                {book.is_ebook && (
                  <div className="absolute -top-1 -right-1 bg-primary text-primary-foreground rounded-full p-1 shadow-sm">
                    <Monitor className="h-3 w-3" />
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="space-y-1">
            <h3 className="font-medium leading-tight line-clamp-2 text-sm">{book.title}</h3>
            {book.author && <p className="text-xs text-muted-foreground truncate">{book.author}</p>}
            <div className="flex flex-wrap justify-center gap-1 pt-1">
              {book.is_read && <Badge variant="success" className="text-[10px] px-1.5 py-0">Okundu</Badge>}
              {book.has_rag && (
                <Badge className="bg-primary/20 text-primary border-primary/30 text-[10px] px-1.5 py-0">
                  <Bot className="h-2.5 w-2.5 mr-0.5" />RAG
                </Badge>
              )}
              {(book.shelves || []).map((s: any) => (
                <Badge key={`bc-s-${s.id}`} variant="outline" className="text-[10px] px-1.5 py-0 flex items-center gap-1 border" style={{ borderColor: s.color || '#e2e8f0' }}>
                  <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: s.color || '#94a3b8' }} />
                  {s.name}
                </Badge>
              ))}
              {book.shelf && (!book.shelves || book.shelves.length === 0) && (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0">{book.shelf}</Badge>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}
