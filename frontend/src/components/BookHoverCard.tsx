import { useEffect, useRef, useState } from 'react'
import { usePopupPosition } from '../hooks/usePopupPosition'
import { CheckCircle2, BookOpen, Monitor, Bot, Library } from 'lucide-react'
import { Badge } from './ui/badge'

interface BookHoverCardProps {
  book: any
  mouseX: number
  mouseY: number
}

export function BookHoverCard({ book, mouseX, mouseY }: BookHoverCardProps) {
  const { ref, position, updatePosition } = usePopupPosition({
    anchor: 'bottom-left',
    viewportPadding: 12,
  })
  const hasPositioned = useRef(false)

  useEffect(() => {
    if (!hasPositioned.current && ref.current) {
      updatePosition(mouseX, mouseY)
      hasPositioned.current = true
    }
  }, [mouseX, mouseY, updatePosition])

  return (
    <div
      ref={ref}
      className="fixed z-50 w-72 rounded-xl border border-border bg-card/95 backdrop-blur-sm p-4 shadow-2xl animate-fade-in pointer-events-none"
      style={{ top: position.top, left: position.left }}
    >
      <h4 className="text-sm font-bold leading-snug mb-2 line-clamp-3">{book.title}</h4>

      <div className="space-y-1.5 text-xs text-muted-foreground">
        {book.author && (
          <p>
            <span className="font-medium">Yazar:</span> {book.author}
          </p>
        )}
        {book.publisher && (
          <p>
            <span className="font-medium">Yayınevi:</span> {book.publisher}
          </p>
        )}
        {(book.page_count || book.publication_year) && (
          <p>
            <span className="font-medium">Detay:</span>
            {book.page_count ? `${book.page_count} sayfa` : ''}
            {book.page_count && book.publication_year ? ' · ' : ''}
            {book.publication_year || ''}
          </p>
        )}
      </div>

      <div className="flex flex-wrap gap-1.5 mt-3">
        {book.is_read && (
          <Badge variant="success" className="text-[10px] px-1.5 py-0">
            <CheckCircle2 className="h-3 w-3 mr-0.5" /> Okundu
          </Badge>
        )}
        {book.has_rag && (
          <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-primary border-primary/30">
            <Bot className="h-3 w-3 mr-0.5" /> RAG
          </Badge>
        )}
        {book.shelf_id && book.shelf_name && (
          <Badge variant="outline" className="text-[10px] px-1.5 py-0 flex items-center gap-1">
            <Library className="h-3 w-3" />
            {book.shelf_name}
          </Badge>
        )}
        {!book.shelf_id && book.shelf && (
          <Badge variant="outline" className="text-[10px] px-1.5 py-0 flex items-center gap-1">
            <Library className="h-3 w-3" />
            {book.shelf}
          </Badge>
        )}
      </div>

      {book.notes && (
        <div className="mt-3 pt-3 border-t border-border">
          <p className="text-[10px] font-medium text-muted-foreground mb-1">Notlar</p>
          <p className="text-xs text-foreground/90 line-clamp-5 whitespace-pre-wrap">{book.notes}</p>
        </div>
      )}
    </div>
  )
}
