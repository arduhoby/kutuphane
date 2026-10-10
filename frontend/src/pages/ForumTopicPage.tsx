import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import { useAuth } from '../hooks/useAuth'
import { useToast } from '../components/ui/toast'
import { Button } from '../components/ui/button'
import { Textarea } from '../components/ui/textarea'
import { Card, CardContent } from '../components/ui/card'
import { ArrowLeft, Trash2, Send } from 'lucide-react'

export function ForumTopicPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { toast } = useToast()
  const [topic, setTopic] = useState<any>(null)
  const [replies, setReplies] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [newReply, setNewReply] = useState('')

  useEffect(() => {
    if (!id) return
    Promise.all([
      api.forum.getTopic(Number(id)),
      api.forum.replies(Number(id)),
    ]).then(([t, r]) => {
      setTopic(t)
      setReplies(r)
    }).finally(() => setLoading(false))
  }, [id])

  const handleReply = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newReply.trim()) return
    try {
      const reply = await api.forum.createReply(Number(id), { content: newReply })
      setReplies((prev) => [...prev, reply])
      setNewReply('')
      toast({ title: 'Yanıt gönderildi' })
    } catch (err: any) {
      toast({ title: 'Hata', description: err.message, variant: 'destructive' })
    }
  }

  const handleDeleteReply = async (replyId: number) => {
    if (!confirm('Bu yanıtı silmek istediğinize emin misiniz?')) return
    try {
      await api.forum.deleteReply(replyId)
      setReplies((prev) => prev.filter((r) => r.id !== replyId))
      toast({ title: 'Yanıt silindi' })
    } catch (err: any) {
      toast({ title: 'Hata', description: err.message, variant: 'destructive' })
    }
  }

  const handleDeleteTopic = async () => {
    if (!confirm('Bu konuyu silmek istediğinize emin misiniz?')) return
    try {
      await api.forum.deleteTopic(Number(id))
      toast({ title: 'Konu silindi' })
      navigate('/forum')
    } catch (err: any) {
      toast({ title: 'Hata', description: err.message, variant: 'destructive' })
    }
  }

  if (loading) return <div className="flex justify-center py-12"><div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" /></div>

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/forum')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{topic?.title}</h1>
        </div>
        {user?.is_admin && (
          <Button variant="destructive" size="sm" onClick={handleDeleteTopic}>
            <Trash2 className="h-4 w-4 mr-2" />
            Konuyu Sil
          </Button>
        )}
      </div>

      {topic?.content && (
        <Card>
          <CardContent className="p-4 text-sm text-muted-foreground whitespace-pre-wrap">
            {topic.content}
          </CardContent>
        </Card>
      )}

      <div className="space-y-3">
        <h2 className="text-lg font-semibold">Yanıtlar ({replies.length})</h2>
        {replies.length === 0 ? (
          <p className="text-sm text-muted-foreground">Henüz yanıt yok.</p>
        ) : (
          replies.map((reply) => (
            <Card key={reply.id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <p className="text-sm text-muted-foreground mb-2">
                    Kullanıcı #{reply.user_id}
                  </p>
                  {(user?.is_admin || reply.user_id === user?.id) && (
                    <Button variant="ghost" size="icon" onClick={() => handleDeleteReply(reply.id)}>
                      <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                    </Button>
                  )}
                </div>
                <p className="text-sm whitespace-pre-wrap">{reply.content}</p>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <form onSubmit={handleReply} className="flex gap-2">
        <Textarea
          placeholder="Yanıtınızı yazın..."
          value={newReply}
          onChange={(e) => setNewReply(e.target.value)}
          className="flex-1"
          required
        />
        <Button type="submit" className="self-end">
          <Send className="h-4 w-4" />
        </Button>
      </form>
    </div>
  )
}
