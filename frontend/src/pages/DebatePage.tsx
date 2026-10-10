import { useState, useRef, useEffect } from 'react'
import { api } from '../api/client'
import { useBookSearch } from '../hooks/useBookSearch'
import { useToast } from '../components/ui/toast'
import { Input } from '../components/ui/input'
import { Button } from '../components/ui/button'
import { Pagination } from '../components/Pagination'
import { Scale, User, Bot, Send, Loader2, BookOpen, Trophy, Search, Plus } from 'lucide-react'
import { AiLoadingBanner, useAiBanner } from '../components/AiLoadingBanner'

export function DebatePage() {
  const { toast } = useToast()
  const [step, setStep] = useState<'select' | 'side' | 'debate'>('select')
  const search = useBookSearch(50)
  const [selectedBook, setSelectedBook] = useState<any>(null)
  const [selectedSession, setSelectedSession] = useState<any>(null)
  const [sessions, setSessions] = useState<any[]>([])
  const [customTitle, setCustomTitle] = useState('')
  const [customAuthor, setCustomAuthor] = useState('')
  const [side, setSide] = useState<'lehte' | 'aleyhte' | null>(null)
  const [sessionId, setSessionId] = useState('')
  const [motion, setMotion] = useState('')
  const [aiSide, setAiSide] = useState('')
  const [messages, setMessages] = useState<any[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const [winner, setWinner] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const { banner, triggerAiCall } = useAiBanner()

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, winner])

  useEffect(() => {
    loadSessions()
  }, [])

  const loadSessions = async () => {
    try {
      const data = await api.knowledge.getSessions()
      setSessions(data)
    } catch (err) {
      console.error(err)
    }
  }

  const startDebate = async (chosenSide: 'lehte' | 'aleyhte') => {
    if (!selectedBook) return
    setSide(chosenSide)
    setLoading(true)
    try {
      const res: any = await triggerAiCall(() => api.debate.start(selectedBook.id, chosenSide))
      setSessionId(res.session_id)
      setMotion(res.motion)
      setAiSide(res.ai_side)
      setMessages(res.messages || [])
      setStep('debate')
    } catch (err: any) {
      toast({ title: 'Hata', description: err.message, variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  const startSessionDebate = async (chosenSide: 'lehte' | 'aleyhte') => {
    if (!selectedSession) return
    setSide(chosenSide)
    setLoading(true)
    try {
      const res: any = await triggerAiCall(() => api.debate.startSession(selectedSession.id, chosenSide))
      setSessionId(res.session_id)
      setMotion(res.motion)
      setAiSide(res.ai_side)
      setMessages(res.messages || [])
      setStep('debate')
    } catch (err: any) {
      toast({ title: 'Hata', description: err.message, variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  const startCustomDebate = async (chosenSide: 'lehte' | 'aleyhte') => {
    if (!customTitle.trim()) return
    setSide(chosenSide)
    setLoading(true)
    try {
      const res: any = await triggerAiCall(() => api.debate.startCustom(customTitle.trim(), customAuthor.trim(), chosenSide))
      setSessionId(res.session_id)
      setMotion(res.motion)
      setAiSide(res.ai_side)
      setMessages(res.messages || [])
      setStep('debate')
    } catch (err: any) {
      toast({ title: 'Hata', description: err.message, variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  const sendMessage = async () => {
    if (!input.trim() || sending || winner) return
    const text = input.trim()
    setInput('')
    setSending(true)
    setMessages((prev) => [...prev, { role: 'user', content: text, user: true }])
    try {
      const res: any = await triggerAiCall(() => api.debate.sendMessage(sessionId, text))
      setMessages(res.messages || [])
      if (res.winner) setWinner(res.winner)
    } catch (err: any) {
      toast({ title: 'Hata', description: err.message, variant: 'destructive' })
    } finally {
      setSending(false)
    }
  }

  const reset = () => {
    setStep('select')
    setSelectedBook(null)
    setSelectedSession(null)
    setCustomTitle('')
    setCustomAuthor('')
    setSide(null)
    setSessionId('')
    setMotion('')
    setMessages([])
    setWinner(null)
  }

  if (step === 'select') {
    const customBook = customTitle.trim() ? { title: customTitle, author: customAuthor } : null
    return (
      <>
        <AiLoadingBanner state={banner} />
        <div className="space-y-6 max-w-2xl mx-auto">
        <div className="flex items-center gap-2">
          <Scale className="h-5 w-5 text-primary" />
          <h1 className="text-2xl font-bold">Münazara</h1>
        </div>
        <p className="text-sm text-muted-foreground">Oxford Union metoduna göre AI ile münazara yapmak için bir kitap seçin.</p>

        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground mb-2 font-medium">
            <Plus className="h-3 w-3 inline mr-1" />
            Kütüphane Dışı Kitap
          </p>
          <div className="space-y-1">
            <Input placeholder="Kitap adı *" value={customTitle} onChange={(e) => setCustomTitle(e.target.value)} />
            <Input placeholder="Yazar (opsiyonel)" value={customAuthor} onChange={(e) => setCustomAuthor(e.target.value)} />
          </div>
        </div>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-border" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-background px-2 text-muted-foreground">veya</span>
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground mb-2 font-medium">📚 Kütüphaneden Kitap Seç</p>
          <div className="relative mb-2">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Kitaplıkta ara..."
              value={search.query}
              onChange={(e) => search.setQuery(e.target.value)}
              className="w-full bg-background border border-border rounded-md pl-8 pr-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
            />
          </div>
          <div className="grid gap-1.5 max-h-48 overflow-y-auto">
            {search.data.map((b: any) => (
              <button
                key={b.id}
                onClick={() => { setSelectedBook(b); setSelectedSession(null); setCustomTitle(''); setCustomAuthor('') }}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-left text-sm transition-colors ${
                  selectedBook?.id === b.id ? 'bg-primary/20 border border-primary/50' : 'hover:bg-accent'
                }`}
              >
                {b.cover_url ? (
                  <img src={b.cover_url} alt="" className="w-[20px] h-[30px] rounded-sm object-cover border border-primary/30 flex-shrink-0" />
                ) : (
                  <div className="w-[20px] h-[30px] rounded-sm bg-muted flex items-center justify-center flex-shrink-0">
                    <BookOpen className="h-3 w-3 text-muted-foreground" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="truncate font-medium">{b.title}</p>
                  <p className="truncate text-xs text-muted-foreground">{b.author}</p>
                </div>
              </button>
            ))}
          </div>
          {search.totalPages > 1 && (
            <div className="mt-2 pt-2 border-t border-border">
              <Pagination page={search.page} totalPages={search.totalPages} onPageChange={search.setPage} />
            </div>
          )}
        </div>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-border" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-background px-2 text-muted-foreground">veya</span>
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground mb-2 font-medium">🧠 Bilgi Merkezi Oturumu Seç</p>
          <div className="grid gap-1.5 max-h-48 overflow-y-auto">
            {sessions.length === 0 ? (
              <p className="text-xs text-muted-foreground">Henüz oturum yok.</p>
            ) : (
              sessions.map((s: any) => (
                <button
                  key={s.id}
                  onClick={() => { setSelectedSession(s); setSelectedBook(null); setCustomTitle(''); setCustomAuthor('') }}
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg text-left text-sm transition-colors ${
                    selectedSession?.id === s.id ? 'bg-primary/20 border border-primary/50' : 'hover:bg-accent'
                  }`}
                >
                  <Bot className="h-4 w-4 text-primary" />
                  <span className="truncate font-medium">{s.name}</span>
                </button>
              ))
            )}
          </div>
        </div>

        {(selectedBook || customBook || selectedSession) && (
          <div className="rounded-lg border border-border bg-card p-6 text-center space-y-4">
            <p className="text-sm text-muted-foreground">Seçilen hedef:</p>
            <p className="text-lg font-bold">{selectedBook?.title || customBook?.title || selectedSession?.name}</p>
            <p className="text-sm text-muted-foreground">{selectedBook?.author || customBook?.author || (selectedSession ? 'Bilgi Merkezi Oturumu' : '—')}</p>
            <p className="text-xs text-muted-foreground mt-2">Hangi tarafı savunmak istersiniz?</p>
            <div className="flex justify-center gap-4">
              <Button onClick={() => selectedSession ? startSessionDebate('lehte') : (selectedBook ? startDebate('lehte') : startCustomDebate('lehte'))} disabled={loading} className="w-32">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Lehte
              </Button>
              <Button onClick={() => selectedSession ? startSessionDebate('aleyhte') : (selectedBook ? startDebate('aleyhte') : startCustomDebate('aleyhte'))} disabled={loading} variant="destructive" className="w-32">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Aleyhte
              </Button>
            </div>
          </div>
        )}
      </div>
      </>
    )
  }

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={reset} className="text-sm text-muted-foreground hover:text-foreground">← Geri</button>
          <Scale className="h-5 w-5 text-primary" />
          <h1 className="text-xl font-bold">Münazara</h1>
        </div>
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <span>{selectedBook?.title || selectedSession?.name}</span>
          <span className={`px-2 py-0.5 rounded text-xs font-medium ${
            side === 'lehte' ? 'bg-green-900/30 text-green-400' : 'bg-red-900/30 text-red-400'
          }`}>
            {side === 'lehte' ? 'Lehte' : 'Aleyhte'}
          </span>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card p-4">
        <p className="text-sm font-medium text-center">{motion}</p>
      </div>

      <div className="rounded-lg border border-border bg-card flex flex-col h-[500px]">
        <div className="px-5 py-3 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Scale className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium">Oxford Union Münazara</span>
          </div>
          {winner && (
            <div className="flex items-center gap-1.5 text-sm font-medium text-yellow-500">
              <Trophy className="h-4 w-4" />
              Kazanan: {winner === side ? 'Siz' : 'AI'}
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {messages.map((msg: any, i: number) => (
            <div key={i} className={`flex gap-2 ${msg.user ? 'justify-end' : 'justify-start'}`}>
              {!msg.user && (
                <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-1">
                  {msg.role === 'system' ? <Scale className="h-4 w-4 text-primary" /> : <Bot className="h-4 w-4 text-primary" />}
                </div>
              )}
              <div className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                msg.user ? 'bg-primary text-primary-foreground' : msg.role === 'system' ? 'bg-muted/50 border border-border' : 'bg-muted'
              }`}>
                <p className="whitespace-pre-wrap">{msg.content}</p>
              </div>
              {msg.user && (
                <div className="h-7 w-7 rounded-full bg-primary flex items-center justify-center flex-shrink-0 mt-1">
                  <User className="h-4 w-4 text-primary-foreground" />
                </div>
              )}
            </div>
          ))}
          {sending && (
            <div className="flex gap-2">
              <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Bot className="h-4 w-4 text-primary" />
              </div>
              <div className="bg-muted rounded-lg px-3 py-2 flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-xs text-muted-foreground">AI yanıt hazırlıyor...</span>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {!winner && (
          <form onSubmit={(e) => { e.preventDefault(); sendMessage() }} className="flex gap-2 p-4 border-t">
            <input
              className="flex-1 bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
              placeholder="Argümanınızı yazın..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={sending}
            />
            <button
              type="submit"
              disabled={sending || !input.trim()}
              className="bg-primary text-primary-foreground px-4 rounded-lg font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Gönder
            </button>
          </form>
        )}
      </div>

      {winner && (
        <div className="text-center">
          <Button onClick={reset}>Yeni Münazara</Button>
        </div>
      )}
    </div>
  )
}
