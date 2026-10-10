import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import { useAuth } from '../hooks/useAuth'
import { useToast } from '../components/ui/toast'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Textarea } from '../components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { MessageCircle, Plus, Trash2 } from 'lucide-react'

export function ForumPage() {
  const [topics, setTopics] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showNew, setShowNew] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newContent, setNewContent] = useState('')
  const { user } = useAuth()
  const { toast } = useToast()
  const navigate = useNavigate()

  const fetchTopics = async () => {
    setLoading(true)
    try {
      const data = await api.forum.topics()
      setTopics(data)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchTopics()
  }, [])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newTitle.trim()) return
    try {
      const topic = await api.forum.createTopic({ title: newTitle, content: newContent })
      toast({ title: 'Konu oluşturuldu' })
      setShowNew(false)
      setNewTitle('')
      setNewContent('')
      navigate(`/forum/${topic.id}`)
    } catch (err: any) {
      toast({ title: 'Hata', description: err.message, variant: 'destructive' })
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Bu konuyu silmek istediğinize emin misiniz?')) return
    try {
      await api.forum.deleteTopic(id)
      toast({ title: 'Konu silindi' })
      fetchTopics()
    } catch (err: any) {
      toast({ title: 'Hata', description: err.message, variant: 'destructive' })
    }
  }

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Forum</h1>
          <p className="text-muted-foreground mt-1">Kitap önerileri ve tartışmalar</p>
        </div>
        <Button onClick={() => setShowNew(!showNew)}>
          <Plus className="h-4 w-4 mr-2" />
          Yeni Konu
        </Button>
      </div>

      {showNew && (
        <Card>
          <CardHeader>
            <CardTitle>Yeni Konu</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreate} className="space-y-4">
              <Input
                placeholder="Konu başlığı"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                required
              />
              <Textarea
                placeholder="İçerik (isteğe bağlı)"
                value={newContent}
                onChange={(e) => setNewContent(e.target.value)}
                rows={3}
              />
              <div className="flex gap-2 justify-end">
                <Button type="button" variant="outline" onClick={() => setShowNew(false)}>İptal</Button>
                <Button type="submit">Oluştur</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
        </div>
      ) : topics.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <MessageCircle className="h-12 w-12 mb-4 opacity-50" />
            <p>Henüz forum konusu yok</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {topics.map((topic) => (
            <Link key={topic.id} to={`/forum/${topic.id}`}>
              <Card className="transition-colors hover:bg-accent/50">
                <CardContent className="flex items-center gap-4 p-4">
                  <div className="rounded-lg bg-primary/10 p-2">
                    <MessageCircle className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium truncate">{topic.title}</h3>
                    <p className="text-sm text-muted-foreground">
                      {topic.reply_count || 0} yanıt
                    </p>
                  </div>
                  {user?.is_admin && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => {
                        e.preventDefault()
                        handleDelete(topic.id)
                      }}
                    >
                      <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                    </Button>
                  )}
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
