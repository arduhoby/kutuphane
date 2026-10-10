import { useEffect, useState, useRef } from 'react'
import { api } from '../api/client'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { useAuth } from '../hooks/useAuth'
import { Send, Bot, User, MessageCircle, Loader2, Globe } from 'lucide-react'

interface Message {
  id: number
  role: string
  content: string
  created_at: string
}

interface ChatPanelProps {
  bookId: number
}

export function ChatPanel({ bookId }: ChatPanelProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const { user } = useAuth()
  const bottomRef = useRef<HTMLDivElement>(null)

  const fetchMessages = async () => {
    try {
      const data = await api.chat.getSession(bookId)
      setMessages(data.messages || [])
    } catch {
      setError('Sohbet yüklenemedi')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchMessages()
  }, [bookId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendMessage = async () => {
    if (!input.trim() || sending) return
    const text = input.trim()
    setInput('')
    setSending(true)
    setError('')

    const tempMsg: Message = {
      id: -Date.now(),
      role: 'user',
      content: text,
      created_at: new Date().toISOString(),
    }
    setMessages((prev) => [...prev, tempMsg])

    try {
      const reply = await api.chat.sendMessage(bookId, text)
      setMessages((prev) => [
        ...prev.filter((m) => m.id !== tempMsg.id || m.role !== 'user'),
        { id: tempMsg.id, role: 'user', content: text, created_at: tempMsg.created_at },
        reply,
      ])
    } catch (err: any) {
      setError(err.message || 'Mesaj gönderilemedi')
      setMessages((prev) => prev.filter((m) => m.id !== tempMsg.id))
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="flex flex-col h-[500px] border rounded-lg bg-card">
      <div className="flex items-center gap-2 px-4 py-3 border-b bg-muted/50">
        <MessageCircle className="h-4 w-4 text-primary" />
        <span className="text-sm font-medium">Kitap Hakkında Sohbet (AI)</span>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {loading ? (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground">
            <Bot className="h-8 w-8 mb-2 opacity-50" />
            <p className="text-sm">Bu kitap hakkında sohbet başlatın.</p>
            <p className="text-xs mt-1">Karakterler, temalar veya satır araları hakkında sorun.</p>
          </div>
        ) : (
          messages.map((msg) => (
            <div key={msg.id} className={`flex gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              {msg.role === 'assistant' && (
                <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-1">
                  <Bot className="h-4 w-4 text-primary" />
                </div>
              )}
              <div
                className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                  msg.role === 'user'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted'
                }`}
              >
                <p className="whitespace-pre-wrap text-sm">
                  {(() => {
                    const parts = msg.content.split(/(https?:\/\/[^\s)]+)/g)
                    return parts.map((part, i) =>
                      part.match(/^https?:\/\//)
                        ? <a key={i} href={part} target="_blank" rel="noopener noreferrer" className="underline text-blue-500 hover:text-blue-700 break-all">{part}</a>
                        : part
                    )
                  })()}
                </p>
              </div>
              {msg.role === 'user' && (
                <div className="h-7 w-7 rounded-full bg-primary flex items-center justify-center flex-shrink-0 mt-1">
                  <User className="h-4 w-4 text-primary-foreground" />
                </div>
              )}
            </div>
          ))
        )}
        {sending && (
          <div className="flex gap-2">
            <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
              <Bot className="h-4 w-4 text-primary" />
            </div>
            <div className="bg-muted rounded-lg px-3 py-2 flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              <Globe className="h-3 w-3 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Web'de aranıyor...</span>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {error && <p className="px-4 py-1 text-xs text-destructive">{error}</p>}

      <form onSubmit={(e) => { e.preventDefault(); sendMessage() }} className="flex gap-2 p-4 border-t">
        <Input
          placeholder="Kitap hakkında bir şey sor..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={sending}
        />
        <Button type="submit" size="icon" disabled={sending || !input.trim()}>
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </form>
    </div>
  )
}
