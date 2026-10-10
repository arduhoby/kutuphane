import { useState } from 'react'
import { api } from '../api/client'
import { Dialog } from './ui/dialog'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { TabButton } from './ui/tabs'
import { Search, BookOpen, Loader2, Check, Hash, Type, ExternalLink, Link } from 'lucide-react'

interface BookResult {
  isbn?: string
  title?: string
  author?: string
  publisher?: string
  page_count?: number
  language?: string
  publication_year?: string
  cover_url?: string
  source?: string
  preview_url?: string
  epub_url?: string
  pdf_url?: string
}

interface BookSearchDialogProps {
  open: boolean
  onClose: () => void
  onSelect: (data: Partial<BookResult>) => void
  initialIsbn?: string
  initialTitle?: string
}

export function BookSearchDialog({ open, onClose, onSelect, initialIsbn, initialTitle }: BookSearchDialogProps) {
  const [mode, setMode] = useState<'isbn' | 'title'>('isbn')
  const [isbn, setIsbn] = useState(initialIsbn || '')
  const [query, setQuery] = useState(initialTitle || '')
  const [result, setResult] = useState<BookResult | null>(null)
  const [results, setResults] = useState<BookResult[]>([])
  const [selectedResult, setSelectedResult] = useState<BookResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [manualUrl, setManualUrl] = useState('')
  const [showManualUrl, setShowManualUrl] = useState(false)

  const searchByIsbn = async () => {
    if (!isbn.trim()) return
    setLoading(true)
    setError('')
    setResult(null)
    setSelectedResult(null)
    try {
      const data = await api.books.searchExternal(isbn.trim(), 'isbn')
      if (data && data.length > 0) {
        setResults(data)
        setSelectedResult(data[0])
        setResult(data[0])
      } else {
        setError('ISBN ile kitap bulunamadı')
      }
    } catch (err: any) {
      const msg = err?.response?.data?.detail || err.message || 'ISBN sorgulanamadı'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  const searchByTitle = async () => {
    if (!query.trim()) return
    setLoading(true)
    setError('')
    setResults([])
    setSelectedResult(null)
    try {
      const data = await api.books.searchExternal(query, 'title')
      if (data && data.length > 0) {
        setResults(data)
        setSelectedResult(data[0])
      } else {
        setError('Otomatik aramada sonuç bulunamadı. Google Görseller\'de manuel aramayı deneyin.')
      }
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Arama yapılamadı')
    } finally {
      setLoading(false)
    }
  }

  const openGoogleImages = () => {
    const q = mode === 'isbn' ? isbn.trim() : query.trim()
    if (!q) return
    window.open(`https://www.google.com/search?tbm=isch&q=${encodeURIComponent(q)}`, '_blank')
  }

  const handleSelect = () => {
    const data = selectedResult || result
    if (data) {
      const payload: Partial<BookResult> = {}
      if (data.isbn) payload.isbn = data.isbn
      if (data.title) payload.title = data.title
      if (data.author) payload.author = data.author
      if (data.publisher) payload.publisher = data.publisher
      if (data.page_count) payload.page_count = data.page_count
      if (data.language) payload.language = data.language
      if (data.publication_year) payload.publication_year = data.publication_year
      if (data.cover_url) payload.cover_url = data.cover_url
      if (data.source) payload.source = data.source
      if (data.preview_url) payload.preview_url = data.preview_url
      if (data.epub_url) payload.epub_url = data.epub_url
      if (data.pdf_url) payload.pdf_url = data.pdf_url
      onSelect(payload)
      onClose()
    }
  }

  const handleAddManualUrl = () => {
    if (!manualUrl.trim()) return
    onSelect({ cover_url: manualUrl.trim() })
    onClose()
  }

  const handleUseCoverUrl = (url: string) => {
    onSelect({ cover_url: url })
    onClose()
  }

  const activeResult = selectedResult || result

  return (
    <Dialog open={open} onClose={onClose} title="Kitap Ara">
      <div className="space-y-4">
        <div className="flex gap-1 rounded-lg bg-muted p-1">
          <TabButton
            active={mode === 'isbn'}
            onClick={() => { setMode('isbn'); setResult(null); setResults([]); setError('') }}
            className="flex-1"
          >
            <Hash className="h-4 w-4 mr-1" />
            ISBN ile
          </TabButton>
          <TabButton
            active={mode === 'title'}
            onClick={() => { setMode('title'); setResult(null); setResults([]); setError('') }}
            className="flex-1"
          >
            <Type className="h-4 w-4 mr-1" />
            İsim / Yazar ile
          </TabButton>
        </div>

        {mode === 'isbn' ? (
          <div className="space-y-4">
            <div className="flex gap-2">
              <Input
                placeholder="ISBN numarası girin"
                value={isbn}
                onChange={(e) => setIsbn(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && searchByIsbn()}
                autoFocus
              />
              <Button onClick={searchByIsbn} disabled={loading || !isbn.trim()}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              </Button>
            </div>
            {results.length > 0 && !loading && (
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {results.map((book, i) => (
                  <div
                    key={i}
                    className={`flex gap-3 p-2 rounded-lg cursor-pointer border transition-colors ${
                      selectedResult === book ? 'border-primary bg-primary/5' : 'border-transparent hover:bg-accent'
                    }`}
                    onClick={() => setSelectedResult(book)}
                  >
                    {book.cover_url ? (
                      <img src={book.cover_url} alt="" className="w-10 h-14 rounded object-cover flex-shrink-0"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />
                    ) : (
                      <div className="w-10 h-14 rounded bg-muted flex items-center justify-center flex-shrink-0">
                        <BookOpen className="h-4 w-4 text-muted-foreground" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{book.title}</p>
                      <p className="text-xs text-muted-foreground truncate">{book.author}</p>
                      <p className="text-xs text-muted-foreground">
                        {book.publisher && <span>{book.publisher} • </span>}
                        {book.source && <span className="font-semibold text-primary">{book.source}</span>}
                      </p>
                    </div>
                    {selectedResult === book && (
                      <div className="flex items-center">
                        <Check className="h-4 w-4 text-primary" />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex gap-2">
              <Input
                placeholder="Kitap adı veya yazar girin"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && searchByTitle()}
                autoFocus
              />
              <Button onClick={searchByTitle} disabled={loading || !query.trim()}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              </Button>
            </div>
            <button
              type="button"
              onClick={openGoogleImages}
              className="text-xs text-blue-600 hover:underline flex items-center gap-1"
            >
              <ExternalLink className="h-3 w-3" />
              Google Görseller'de ara (yeni sekme)
            </button>
          </div>
        )}

        {loading && (
          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
            <Loader2 className="h-8 w-8 animate-spin mb-2" />
            <p className="text-sm">Aranıyor...</p>
          </div>
        )}

        {error && (
          <div className="space-y-3">
            <div className="rounded-md bg-destructive/10 p-4 text-sm text-destructive text-center">
              {error}
            </div>
            <div className="flex gap-2 justify-center">
              <Button variant="outline" size="sm" onClick={openGoogleImages}>
                <ExternalLink className="h-4 w-4 mr-1" />
                Google Görseller'de Ara
              </Button>
            </div>
          </div>
        )}

        {mode === 'title' && results.length > 0 && !loading && (
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {results.map((book, i) => (
              <div
                key={i}
                className={`flex gap-3 p-2 rounded-lg cursor-pointer border transition-colors ${
                  selectedResult === book ? 'border-primary bg-primary/5' : 'border-transparent hover:bg-accent'
                }`}
                onClick={() => setSelectedResult(book)}
              >
                {book.cover_url ? (
                  <img src={book.cover_url} alt="" className="w-10 h-14 rounded object-cover flex-shrink-0"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />
                ) : (
                  <div className="w-10 h-14 rounded bg-muted flex items-center justify-center flex-shrink-0">
                    <BookOpen className="h-4 w-4 text-muted-foreground" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{book.title}</p>
                  <p className="text-xs text-muted-foreground truncate">{book.author}</p>
                  <p className="text-xs text-muted-foreground">
                    {book.publisher && <span>{book.publisher} • </span>}
                    {book.source && <span className="font-semibold text-primary">{book.source}</span>}
                  </p>
                </div>
                {selectedResult === book && (
                  <div className="flex items-center">
                    <Check className="h-4 w-4 text-primary" />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {activeResult && !loading && (
          <div className="rounded-lg border p-4 space-y-4">
            <div className="flex gap-4">
              {activeResult.cover_url ? (
                <div className="w-24 flex-shrink-0">
                  <img
                    src={activeResult.cover_url}
                    alt={activeResult.title || ''}
                    className="w-full rounded-md shadow-sm object-cover"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                  />
                </div>
              ) : (
                <div className="w-24 h-36 flex-shrink-0 rounded-md bg-muted flex items-center justify-center">
                  <BookOpen className="h-8 w-8 text-muted-foreground" />
                </div>
              )}
              <div className="flex-1 min-w-0 space-y-1">
                <h3 className="font-semibold text-base leading-tight flex items-center gap-2">
                  {activeResult.title || '?'}
                  {activeResult.source && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded font-medium bg-primary/10 text-primary border border-primary/20">
                      {activeResult.source}
                    </span>
                  )}
                </h3>
                {activeResult.author && <p className="text-sm text-muted-foreground">{activeResult.author}</p>}
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  {activeResult.publisher && <span>{activeResult.publisher}</span>}
                  {activeResult.publication_year && <span>{activeResult.publication_year}</span>}
                  {activeResult.page_count && <span>{activeResult.page_count} sayfa</span>}
                  {activeResult.language && <span>{activeResult.language}</span>}
                  {activeResult.isbn && <span className="font-mono">ISBN: {activeResult.isbn}</span>}
                </div>
                {(activeResult.epub_url || activeResult.pdf_url || activeResult.preview_url) && (
                  <div className="flex flex-wrap gap-2 pt-1">
                    {activeResult.epub_url && (
                      <a href={activeResult.epub_url} target="_blank" rel="noopener noreferrer"
                        className="text-xs inline-flex items-center gap-1 text-green-600 hover:underline">
                        EPUB
                      </a>
                    )}
                    {activeResult.pdf_url && (
                      <a href={activeResult.pdf_url} target="_blank" rel="noopener noreferrer"
                        className="text-xs inline-flex items-center gap-1 text-red-600 hover:underline">
                        PDF
                      </a>
                    )}
                    {activeResult.preview_url && (
                      <a href={activeResult.preview_url} target="_blank" rel="noopener noreferrer"
                        className="text-xs inline-flex items-center gap-1 text-blue-600 hover:underline">
                        Önizle
                      </a>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="flex gap-2 justify-end pt-2 border-t">
              <Button variant="outline" onClick={onClose}>Vazgeç</Button>
              <Button onClick={handleSelect}>
                <Check className="h-4 w-4 mr-1" />
                Bu Bilgileri Kullan
              </Button>
            </div>
          </div>
        )}

        {!loading && !error && !activeResult && results.length === 0 && (
          <div className="text-center py-4 space-y-3">
            <p className="text-sm text-muted-foreground">
              {mode === 'isbn'
                ? 'ISBN girip ara butonuna tıklayın'
                : 'Kitap adı veya yazar girip arayın'}
            </p>
          </div>
        )}

        <div className="border-t pt-3 text-center">
          <button
            type="button"
            onClick={() => setShowManualUrl(!showManualUrl)}
            className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 mx-auto"
          >
            <Link className="h-3 w-3" />
            Doğrudan kapak görseli URL'si yapıştır
          </button>
          {showManualUrl && (
            <div className="flex gap-2 mt-2">
              <Input
                placeholder="https://...jpg (görsel URL'si)"
                value={manualUrl}
                onChange={(e) => setManualUrl(e.target.value)}
                className="flex-1"
              />
              <Button variant="outline" size="sm" onClick={handleAddManualUrl} disabled={!manualUrl.trim()}>
                Ekle
              </Button>
            </div>
          )}
        </div>
      </div>
    </Dialog>
  )
}
