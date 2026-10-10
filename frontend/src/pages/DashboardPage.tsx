import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api/client'
import { BookOpen, BookCheck, BookMarked, Users, MessageCircle, Bot } from 'lucide-react'

export function DashboardPage() {
  const [stats, setStats] = useState<any>(null)
  const [recentBooks, setRecentBooks] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      api.stats.get(),
      api.books.list({ limit: 5 }),
    ]).then(([s, b]) => {
      setStats(s)
      setRecentBooks(b.items || [])
    }).finally(() => setLoading(false))
  }, [])

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
    </div>
  )

  const statCards = [
    { label: 'Toplam Kitap', value: stats?.total_books ?? 0, icon: BookOpen },
    { label: 'Okunan', value: stats?.total_read ?? 0, icon: BookCheck },
    { label: 'E-Kitaplar', value: stats?.total_ebooks ?? 0, icon: BookMarked },
    { label: 'Aktif Ödünç', value: stats?.active_loans ?? 0, icon: BookMarked },
  ]

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Kütüphanem</h1>

        <div className="grid grid-cols-2 gap-3">
          {statCards.map((c) => (
            <div key={c.label} className="rounded-lg bg-card border border-border p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-muted-foreground uppercase tracking-wider">{c.label}</span>
                <c.icon className="h-4 w-4 text-primary" />
              </div>
              <p className="text-2xl font-bold">{c.value}</p>
            </div>
          ))}
        </div>

        <div className="rounded-lg border border-border bg-card">
          <div className="px-5 py-4 border-b border-border flex items-center justify-between">
            <h2 className="text-sm font-semibold">Son Eklenen Kitaplar</h2>
            <Link to="/books" className="text-xs text-primary hover:underline">Tümünü Gör</Link>
          </div>
          <div className="divide-y divide-border">
            {recentBooks.map((b) => (
              <Link key={b.id} to={`/books/${b.id}`} className="flex items-center gap-3 px-5 py-3 hover:bg-accent/50 transition-colors">
                {b.cover_url ? (
                  <img src={b.cover_url} alt="" className="w-[20px] h-[30px] rounded-sm object-cover border border-primary/30 flex-shrink-0" />
                ) : (
                  <div className="w-[20px] h-[30px] rounded-sm bg-muted flex items-center justify-center flex-shrink-0">
                    <BookOpen className="h-3 w-3 text-muted-foreground" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{b.title}</p>
                  <p className="text-xs text-muted-foreground truncate">{b.author}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Hızlı Erişim</h2>

        <Link to="/ai-companion" className="block rounded-lg border border-border bg-card p-4 hover:bg-accent/50 transition-colors">
          <div className="flex items-center gap-3 mb-2">
            <div className="h-8 w-8 rounded-lg bg-primary/20 flex items-center justify-center">
              <Bot className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="text-sm font-medium">AI Okuma Arkadaşım</p>
              <p className="text-xs text-muted-foreground">Kitaplar hakkında sohbet et</p>
            </div>
          </div>
        </Link>

        <Link to="/forum" className="block rounded-lg border border-border bg-card p-4 hover:bg-accent/50 transition-colors">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-primary/20 flex items-center justify-center">
              <MessageCircle className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="text-sm font-medium">Forum Grubu</p>
              <p className="text-xs text-muted-foreground">{stats?.total_topics ?? 0} konu</p>
            </div>
          </div>
        </Link>

        <div className="rounded-lg border border-border bg-card p-4">
          <h3 className="text-sm font-semibold mb-3">Koleksiyon Özeti</h3>
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Okunan / Toplam</span>
              <span className="font-medium">{stats?.total_read ?? 0} / {stats?.total_books ?? 0}</span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all"
                style={{ width: `${stats?.total_books ? ((stats?.total_read ?? 0) / stats.total_books) * 100 : 0}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Toplam Kullanıcı</span>
              <span className="font-medium">{stats?.total_users ?? 0}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Gecikmiş Ödünç</span>
              <span className="font-medium text-destructive">{stats?.overdue_loans ?? 0}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
