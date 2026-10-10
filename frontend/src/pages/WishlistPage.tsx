import { useEffect, useState } from 'react'
import { api } from '../api/client'
import { useToast } from '../components/ui/toast'
import { Button } from '../components/ui/button'
import { ShoppingCart, Trash2, ExternalLink, BookOpen, CheckCircle2, XCircle } from 'lucide-react'

export function WishlistPage() {
  const { toast } = useToast()
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.wishlist.list().then(setItems).catch(() => {}).finally(() => setLoading(false))
  }, [])

  const remove = async (id: number) => {
    try {
      await api.wishlist.remove(id)
      setItems((prev) => prev.filter((i) => i.id !== id))
      toast({ title: 'Kaldırıldı' })
    } catch (err: any) {
      toast({ title: 'Hata', description: err.message, variant: 'destructive' })
    }
  }

  const markBought = async (id: number) => {
    try {
      const updated = await api.wishlist.update(id, { status: 'bought' })
      setItems((prev) => prev.map((i) => (i.id === id ? updated : i)))
      toast({ title: 'Satın alındı olarak işaretlendi' })
    } catch (err: any) {
      toast({ title: 'Hata', description: err.message, variant: 'destructive' })
    }
  }

  const statusIcon = (status: string) => {
    switch (status) {
      case 'bought': return <CheckCircle2 className="h-4 w-4 text-green-500" />
      case 'cancelled': return <XCircle className="h-4 w-4 text-muted-foreground" />
      default: return <ShoppingCart className="h-4 w-4 text-primary" />
    }
  }

  if (loading) return <div className="flex justify-center py-12"><div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" /></div>

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-2">
        <ShoppingCart className="h-5 w-5 text-primary" />
        <h1 className="text-2xl font-bold">Satın Alma Planı</h1>
        <span className="text-sm text-muted-foreground">({items.length} kitap)</span>
      </div>

      {items.length === 0 ? (
        <div className="rounded-lg border border-border bg-card p-8 text-center">
          <ShoppingCart className="h-10 w-10 mx-auto mb-3 text-muted-foreground opacity-50" />
          <p className="text-sm text-muted-foreground">Henüz satın alma planınızda kitap yok.</p>
          <p className="text-xs text-muted-foreground mt-1">Kitaplar sayfasında arama yaparken bulamadığınız kitapları ekleyebilirsiniz.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((item) => (
            <div key={item.id} className="rounded-lg border border-border bg-card p-4 flex items-center gap-4">
              {item.cover_url ? (
                <img src={item.cover_url} alt="" className="w-[30px] h-[45px] rounded-sm object-cover border border-primary/30 flex-shrink-0" />
              ) : (
                <div className="w-[30px] h-[45px] rounded-sm bg-muted flex items-center justify-center flex-shrink-0">
                  <BookOpen className="h-4 w-4 text-muted-foreground" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate flex items-center gap-2">
                  {item.title}
                  {statusIcon(item.status)}
                </p>
                {item.author && <p className="text-xs text-muted-foreground truncate">{item.author}</p>}
                <div className="flex items-center gap-3 mt-1">
                  {item.price && <span className="text-xs font-medium text-primary">{item.price}</span>}
                  {item.source && <span className="text-xs text-muted-foreground">{item.source}</span>}
                  {item.isbn && <span className="text-xs text-muted-foreground">ISBN: {item.isbn}</span>}
                </div>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                {item.source_url && (
                  <a href={item.source_url} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground p-1" title="Siteyi aç">
                    <ExternalLink className="h-4 w-4" />
                  </a>
                )}
                {item.status === 'plan' && (
                  <button onClick={() => markBought(item.id)} className="text-muted-foreground hover:text-green-500 p-1" title="Satın alındı olarak işaretle">
                    <CheckCircle2 className="h-4 w-4" />
                  </button>
                )}
                <button onClick={() => remove(item.id)} className="text-muted-foreground hover:text-destructive p-1" title="Kaldır">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
