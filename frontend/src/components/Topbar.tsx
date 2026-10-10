import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { Search } from 'lucide-react'

export function Topbar() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [query, setQuery] = useState('')

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (query.trim()) {
      navigate(`/books?query=${encodeURIComponent(query.trim())}`)
    } else {
      navigate('/books')
    }
  }

  return (
    <header className="h-[70px] bg-card flex items-center justify-between px-8 border-b border-border flex-shrink-0">
      <form onSubmit={handleSearch} className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          placeholder="Kitap, yazar veya tartışma ara..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-[300px] bg-background border border-border rounded-full pl-9 pr-4 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
        />
      </form>
      <div className="flex items-center gap-3">
        <span className="text-sm text-foreground/80">{user?.full_name || user?.username}</span>
        <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center text-sm font-bold text-primary-foreground">
          {user?.username?.charAt(0).toUpperCase()}
        </div>
      </div>
    </header>
  )
}
