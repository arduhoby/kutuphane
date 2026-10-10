import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api/client'
import { Input } from '../components/ui/input'
import { Card, CardContent } from '../components/ui/card'
import { Badge } from '../components/ui/badge'
import { Button } from '../components/ui/button'
import { Search, FileText, BookOpen, Download, Globe, X, Loader2 } from 'lucide-react'

export function PublicCopiesPage() {
  const [copies, setCopies] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [searchInput, setSearchInput] = useState('')

  const fetch = (q = '') => {
    setLoading(true)
    api.copies.public(q ? { query: q } : {})
      .then(setCopies)
      .catch(() => setCopies([]))
      .finally(() => setLoading(false))
  }

  useEffect(() => { fetch() }, [])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setQuery(searchInput)
    fetch(searchInput)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Globe className="h-5 w-5 text-primary" />
          Herkese Açık Dijital Kopyalar
        </h1>
        <p className="text-muted-foreground text-sm mt-1">Kullanıcıların paylaştığı PDF, EPUB ve makaleler</p>
      </div>

      <form onSubmit={handleSearch} className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Kitap adı veya yazar ile ara..."
            className="pl-9 pr-9"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
          {searchInput && (
            <button type="button" onClick={() => { setSearchInput(''); setQuery(''); fetch('') }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <Button type="submit" variant="secondary">Ara</Button>
      </form>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
      ) : copies.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <Globe className="h-12 w-12 mb-4 opacity-50" />
            <p>{query ? 'Aramanızla eşleşen sonuç bulunamadı' : 'Henüz herkese açık kopya paylaşılmamış'}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {copies.map((c) => (
            <div key={c.id} className="rounded-lg border border-border bg-card p-4 hover:bg-accent/50 transition-colors">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                    {c.type === 'pdf' ? <FileText className="h-5 w-5 text-primary" /> :
                     c.type === 'epub' ? <BookOpen className="h-5 w-5 text-primary" /> :
                     <FileText className="h-5 w-5 text-muted-foreground" />}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{c.original_filename || `Kopya #${c.id}`}</p>
                    <p className="text-xs text-muted-foreground">
                      {c.type?.toUpperCase()}
                      {c.file_size ? ` · ${(c.file_size / 1024 / 1024).toFixed(1)} MB` : ''}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <Link to={`/books/${c.book_id}`} className="text-xs text-primary hover:underline">
                        Kitaba Git #{c.book_id}
                      </Link>
                      {c.is_primary && <Badge variant="outline" className="text-[10px]">RAG</Badge>}
                    </div>
                  </div>
                </div>
                <a href={api.copies.download(c.id)} target="_blank" rel="noopener noreferrer">
                  <Button size="sm" variant="outline">
                    <Download className="h-3.5 w-3.5 mr-1" /> İndir
                  </Button>
                </a>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
