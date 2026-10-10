import { useState, useRef, useEffect } from 'react'
import { api } from '../api/client'
import { useBookSearch } from '../hooks/useBookSearch'
import { BookSearchDialog } from '../components/BookSearchDialog'
import { Input } from '../components/ui/input'
import { Button } from '../components/ui/button'
import { Search, Bot, User, Send, Loader2, BookOpen, Plus, Trash2, FolderOpen, Mic, MicOff, Volume2, VolumeX, FileText, Youtube, Image as ImageIcon, File, Link as LinkIcon, Library } from 'lucide-react'
import { Dialog } from '../components/ui/dialog'
import { AiLoadingBanner, useAiBanner } from '../components/AiLoadingBanner'
import { useVoice } from '../hooks/useVoice'

interface Session {
  id: number
  name: string
  is_public?: boolean
  created_at: string
}

interface Source {
  id: number
  source_type: string
  original_name: string
  status: string
  book_id?: number
}

interface Message {
  id: number
  role: 'user' | 'assistant'
  content: string
  sources?: any[]
}

export function KnowledgeHubPage() {
  const [step, setStep] = useState<'sessions' | 'hub'>('sessions')
  const [sessions, setSessions] = useState<Session[]>([])
  const [activeSession, setActiveSession] = useState<Session | null>(null)
  const [sources, setSources] = useState<Source[]>([])
  
  const [newSessionName, setNewSessionName] = useState('')
  const [loading, setLoading] = useState(true)
  const [isAddSourceOpen, setIsAddSourceOpen] = useState(false)
  const [addDocType, setAddDocType] = useState<'file' | 'url' | 'youtube' | 'library'>('library')
  const [youtubeUrl, setYoutubeUrl] = useState('')
  const [fileUrl, setFileUrl] = useState('')
  
  const search = useBookSearch(20)
  const [searchingBook, setSearchingBook] = useState(false)
  const [selectedBookForCopies, setSelectedBookForCopies] = useState<any>(null)
  const [digitalCopies, setDigitalCopies] = useState<any[]>([])
  const [selectedCopyIds, setSelectedCopyIds] = useState<number[]>([])
  const [loadingCopies, setLoadingCopies] = useState(false)
  
  const [messages, setMessages] = useState<Message[]>([])
  const [reports, setReports] = useState<any[]>([])
  const [viewTab, setViewTab] = useState<'chat' | 'reports'>('chat')
  const [input, setInput] = useState('')
  const [reportTopic, setReportTopic] = useState('')
  const [generatingReport, setGeneratingReport] = useState(false)
  const [sending, setSending] = useState(false)
  const [isPublic, setIsPublic] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  
  const { banner, triggerAiCall } = useAiBanner()
  const voice = useVoice()

  useEffect(() => {
    loadSessions()
  }, [])

  useEffect(() => {
    if (activeSession) {
      loadSources(activeSession.id)
      loadMessages(activeSession.id)
      loadReports(activeSession.id)
    }
  }, [activeSession])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const loadSessions = async () => {
    setLoading(true)
    try {
      const data = await api.knowledge.getSessions()
      setSessions(data)
    } catch (e) {
      console.error(e)
    }
    setLoading(false)
  }

  const loadMessages = async (id: number) => {
    try {
      const data = await api.knowledge.getMessages(id)
      setMessages(data)
    } catch (e) {
      console.error(e)
    }
  }

  const loadReports = async (id: number) => {
    try {
      const data = await api.knowledge.getReports(id)
      setReports(data)
    } catch (e) {
      console.error(e)
    }
  }

  const loadSources = async (sessionId: number) => {
    try {
      const data = await api.knowledge.getSources(sessionId)
      setSources(data)
    } catch (e) {
      console.error(e)
    }
  }

  const [isCreating, setIsCreating] = useState(false)

  const createSession = async () => {
    if (!newSessionName.trim()) return
    setIsCreating(true)
    try {
      const s = await api.knowledge.createSession(newSessionName, isPublic)
      setSessions([...sessions, s])
      setNewSessionName('')
      setIsPublic(false)
      setActiveSession(s)
      setStep('hub')
    } catch (e: any) {
      console.error(e)
      alert("Oluşturma hatası: " + (e.message || "Bilinmeyen hata"))
    } finally {
      setIsCreating(false)
    }
  }

  const generateReport = async () => {
    if (!reportTopic.trim() || !activeSession) return
    setGeneratingReport(true)
    try {
      await triggerAiCall(() => api.knowledge.generateReport(activeSession.id, reportTopic))
      setReportTopic('')
      await loadReports(activeSession.id)
    } catch (e) {
      console.error(e)
    } finally {
      setGeneratingReport(false)
    }
  }

  const deleteSession = async (id: number) => {
    try {
      await api.knowledge.deleteSession(id)
      setSessions(sessions.filter(s => s.id !== id))
    } catch (e) {
      console.error(e)
    }
  }

  const handleBookClick = async (book: any) => {
    setSelectedBookForCopies(book)
    setLoadingCopies(true)
    try {
      const copies = await api.copies.list(book.id)
      setDigitalCopies(copies)
      setSelectedCopyIds([])
    } catch (e) {
      console.error(e)
    } finally {
      setLoadingCopies(false)
    }
  }

  const addDocumentSources = async () => {
    if (!activeSession || selectedCopyIds.length === 0) return
    try {
      setLoading(true)
      const newSources = await api.knowledge.addDocumentSources(activeSession.id, selectedCopyIds)
      setSources([...sources, ...newSources])
      setIsAddSourceOpen(false)
      setSelectedBookForCopies(null)
      setSelectedCopyIds([])
      search.setQuery('')
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const sendMessage = async () => {
    if (!input.trim() || sending || !activeSession) return
    const text = input.trim()
    setInput('')
    setSending(true)
    
    if (voice.isListening) {
      voice.stopListening()
    }

    const tempId = -Date.now()
    setMessages((prev) => [...prev, { id: tempId, role: 'user', content: text }])

    let reply = ''
    let respSources = []
    try {
      const resp = await triggerAiCall(() => api.knowledge.askSession(activeSession.id, text))
      reply = resp.answer
      respSources = resp.sources
    } catch {
      reply = 'Üzgünüm, şu anda yanıt veremiyorum.'
    }

    setMessages((prev) => [
      ...prev.filter((m) => m.id !== tempId),
      { id: tempId, role: 'user', content: text },
      { id: Date.now(), role: 'assistant', content: reply, sources: respSources },
    ])
    setSending(false)
    
    // Opsiyonel olarak cevabı otomatik okutabiliriz, ama şimdilik manuel butonla yapalım.
  }

  const toggleListening = () => {
    if (voice.isListening) {
      voice.stopListening()
    } else {
      voice.startListening((text, isFinal) => {
        // Doğrudan input'a yaz (kullanıcı isterse düzeltsin)
        setInput(text)
      })
    }
  }

  if (loading) {
    return <div className="flex justify-center p-12"><Loader2 className="animate-spin h-8 w-8 text-primary" /></div>
  }

  if (step === 'sessions') {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <Bot className="h-8 w-8 text-primary" />
          <h1 className="text-3xl font-bold">Akademik Bilgi Merkezi ( RAG tabanlı )</h1>
        </div>
        <p className="text-muted-foreground">
          Kitaplar, belgeler ve medyalarınız üzerinden yapay zeka ile çalışın.
        </p>

        <div className="grid md:grid-cols-2 gap-8 mt-8">
          <div className="space-y-4">
            <h2 className="text-xl font-semibold">Yeni Oturum Başlat</h2>
            <div className="flex flex-col gap-2">
              <div className="flex gap-2">
                <Input
                  placeholder="Oturum Adı (örn: Felsefe Çalışması)"
                  value={newSessionName}
                  onChange={(e) => setNewSessionName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && createSession()}
                />
                <Button onClick={createSession} disabled={!newSessionName.trim() || isCreating}>
                  {isCreating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Oluştur
                </Button>
              </div>
              <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
                <input type="checkbox" checked={isPublic} onChange={e => setIsPublic(e.target.checked)} className="rounded" />
                Herkese Açık (Public)
              </label>
            </div>
          </div>

          <div className="space-y-4">
            <h2 className="text-xl font-semibold">Mevcut Oturumlar</h2>
            {sessions.length === 0 ? (
              <p className="text-sm text-muted-foreground border border-dashed rounded-lg p-6 text-center">
                Henüz hiç oturumunuz yok.
              </p>
            ) : (
              <div className="space-y-2">
                {sessions.map(s => (
                  <div key={s.id} className="flex items-center justify-between p-3 rounded-lg border bg-card hover:border-primary transition-colors">
                    <button 
                      onClick={() => { setActiveSession(s); setStep('hub') }}
                      className="flex items-center gap-2 flex-1 text-left"
                    >
                      <FolderOpen className="h-4 w-4 text-primary" />
                      <span className="font-medium">{s.name}</span>
                    </button>
                    <button onClick={() => deleteSession(s.id)} className="p-2 text-muted-foreground hover:text-red-500">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <>
      <AiLoadingBanner state={banner} />
      <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-6 h-[calc(100vh-8rem)]">
        
        {/* Sol Panel: Kaynaklar */}
        <div className="md:col-span-1 border rounded-xl bg-card flex flex-col overflow-hidden">
          <div className="p-4 border-b flex justify-between items-center bg-muted/30">
            <h2 className="font-semibold text-sm">Kaynaklar</h2>
            <button onClick={() => setStep('sessions')} className="text-xs text-primary hover:underline">Oturumlar</button>
          </div>
          <div className="p-4 flex-1 overflow-y-auto space-y-4">
            
            {/* Kaynak Ekleme */}
            <div className="space-y-4">
              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Kaynak Yönetimi</p>
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="w-full text-xs h-8 bg-primary/10 hover:bg-primary/20 text-primary border-primary/20"
                    onClick={() => setIsAddSourceOpen(true)}
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    Yeni Kaynak Ekle
                  </Button>
                </div>
              </div>
            </div>

            {/* Mevcut Kaynaklar */}
            <div className="space-y-2 pt-4 border-t">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Bu Oturumdaki Kaynaklar ({sources.length})</p>
              {sources.length === 0 ? (
                <p className="text-xs text-muted-foreground italic">Henüz kaynak eklenmedi.</p>
              ) : (
                <div className="space-y-2">
                  {sources.map(s => {
                    let Icon = FileText;
                    let iconColor = "text-primary";
                    if (s.source_type === 'youtube') {
                      Icon = Youtube;
                      iconColor = "text-red-500";
                    } else if (s.source_type === 'image') {
                      Icon = ImageIcon;
                      iconColor = "text-blue-500";
                    } else if (s.source_type === 'book') {
                      Icon = BookOpen;
                      iconColor = "text-orange-500";
                    } else if (s.source_type === 'file' && s.original_name.toLowerCase().endsWith('.pdf')) {
                      Icon = File;
                      iconColor = "text-red-400";
                    }

                    return (
                      <div key={s.id} className="text-[11px] p-2 rounded-md bg-muted/50 border truncate flex items-center gap-2">
                        <Icon className={`h-3 w-3 shrink-0 ${iconColor}`} />
                        <span className="truncate" title={s.original_name}>{s.original_name}</span>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Sağ Panel: Chat */}
        <div className="md:col-span-3 border rounded-xl bg-card flex flex-col overflow-hidden">
          <div className="p-4 border-b bg-muted/30 flex justify-between items-center">
            <div>
              <h2 className="font-semibold flex items-center gap-2">
                {activeSession?.name}
                {activeSession?.is_public && <span className="text-[10px] bg-primary/20 text-primary px-2 py-0.5 rounded-full">Public</span>}
              </h2>
              <p className="text-xs text-muted-foreground">Tüm ekli kaynaklar üzerinden arama yapar ve yanıtlar.</p>
            </div>
            <div className="flex gap-1 bg-background p-1 rounded-lg border">
              <button onClick={() => setViewTab('chat')} className={`px-4 py-1.5 text-sm rounded-md font-medium transition-colors ${viewTab === 'chat' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:bg-muted'}`}>Sohbet</button>
              <button onClick={() => setViewTab('reports')} className={`px-4 py-1.5 text-sm rounded-md font-medium transition-colors ${viewTab === 'reports' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:bg-muted'}`}>Raporlar</button>
            </div>
          </div>
          
          {viewTab === 'chat' ? (
            <>
            <div className="flex-1 overflow-y-auto p-4 space-y-6">
            {messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-muted-foreground space-y-4">
                <Bot className="h-12 w-12 text-muted-foreground/30" />
                <p>Sorularınızı sormaya başlayın.</p>
              </div>
            ) : (
              messages.map((m) => (
                <div key={m.id} className={`flex gap-3 max-w-[85%] ${m.role === 'user' ? 'ml-auto flex-row-reverse' : ''}`}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${m.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                    {m.role === 'user' ? <User className="w-5 h-5" /> : <Bot className="w-5 h-5" />}
                  </div>
                  <div className={`rounded-2xl px-5 py-3 ${m.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted/50 border'} group relative`}>
                    
                    {/* TTS (Seslendir) Butonu - Sadece Asistan mesajlarında ve hover durumunda görünür */}
                    {m.role === 'assistant' && (
                      <button 
                        onClick={() => voice.isPlaying ? voice.stopSpeaking() : voice.speak(m.content)}
                        className="absolute -right-10 top-2 p-1.5 rounded-full text-muted-foreground hover:bg-muted hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity"
                        title={voice.isPlaying ? "Sesi Durdur" : "Seslendir"}
                      >
                        {voice.isPlaying ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                      </button>
                    )}

                    <div className="whitespace-pre-wrap leading-relaxed text-[15px]">{m.content}</div>
                    {m.sources && m.sources.length > 0 && (
                      <div className="mt-4 pt-3 border-t border-border/50">
                        <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
                          <BookOpen className="w-3 h-3" /> Faydalanılan Kaynaklar:
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {m.sources.map((s, idx) => (
                            s.url ? (
                              <a 
                                key={idx} 
                                href={s.url} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="text-xs bg-background border px-2 py-1 rounded-md text-primary hover:underline flex items-center gap-1"
                              >
                                {s.title}
                              </a>
                            ) : (
                              <span key={idx} className="text-xs bg-background border px-2 py-1 rounded-md text-foreground">
                                {s.title}
                              </span>
                            )
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
            <div ref={bottomRef} />
          </div>
          
          <div className="p-4 bg-background/50 border-t backdrop-blur-sm">
            <form onSubmit={(e) => { e.preventDefault(); sendMessage() }} className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder={sources.length === 0 ? "Önce kaynak eklemelisiniz..." : voice.isListening ? "Dinliyorum..." : "Tüm kaynaklarda ara veya mikrofonla sor..."}
                  disabled={sending || sources.length === 0}
                  className={`w-full rounded-full bg-muted/50 pr-12 transition-all ${voice.isListening ? 'border-red-500 shadow-[0_0_10px_rgba(239,68,68,0.3)]' : ''}`}
                />
                {voice.hasSupport && (
                  <button
                    type="button"
                    onClick={toggleListening}
                    disabled={sending || sources.length === 0}
                    className={`absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full transition-colors ${
                      voice.isListening ? 'bg-red-500 text-white animate-pulse' : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                    }`}
                  >
                    {voice.isListening ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
                  </button>
                )}
              </div>
              <Button type="submit" disabled={sending || !input.trim() || sources.length === 0} size="icon" className="rounded-full shrink-0 h-10 w-10">
                {sending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
              </Button>
            </form>
          </div>
          </>
          ) : (
            <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6 bg-muted/10">
              <div className="bg-card border rounded-xl p-5 shadow-sm space-y-4">
                <h3 className="font-semibold">Akademik Rapor Oluştur</h3>
                <p className="text-sm text-muted-foreground">Oturumdaki tüm kaynaklardan yararlanarak atıflı bir araştırma raporu üretin.</p>
                <div className="flex gap-2">
                  <Input 
                    placeholder="Rapor Konusu (Örn: Aristoteles'in varlık anlayışı)..." 
                    value={reportTopic}
                    onChange={(e) => setReportTopic(e.target.value)}
                    disabled={generatingReport || sources.length === 0}
                  />
                  <Button onClick={generateReport} disabled={!reportTopic.trim() || generatingReport || sources.length === 0}>
                    {generatingReport ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <BookOpen className="w-4 h-4 mr-2" />}
                    Oluştur
                  </Button>
                </div>
              </div>
              
              <div className="space-y-4">
                <h3 className="font-semibold text-lg">Oluşturulan Raporlar</h3>
                {reports.length === 0 ? (
                  <div className="text-center p-8 border border-dashed rounded-xl text-muted-foreground bg-card">
                    Henüz rapor oluşturulmamış.
                  </div>
                ) : (
                  reports.map((r, i) => (
                    <div key={i} className="border bg-card rounded-xl overflow-hidden shadow-sm">
                      <div className="p-4 border-b bg-muted/30 flex justify-between items-center">
                        <h4 className="font-semibold text-primary">{r.topic}</h4>
                        <div className="text-xs text-muted-foreground font-mono bg-background px-2 py-1 rounded border">
                          SHA256: {r.content_hash?.substring(0, 8)}...
                        </div>
                      </div>
                      <div className="p-5 prose prose-sm dark:prose-invert max-w-none text-sm text-foreground/90 whitespace-pre-wrap leading-relaxed">
                        {r.content}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
        
      </div>

      <Dialog open={isAddSourceOpen} onClose={() => setIsAddSourceOpen(false)} title="Yeni Kaynak Ekle">
        <div className="space-y-4 py-4">
          <div className="flex rounded-md shadow-sm">
            <button
              type="button"
              className={`flex-1 flex justify-center items-center gap-2 py-2 text-sm font-medium border border-r-0 rounded-l-md ${addDocType === 'library' ? 'bg-primary text-primary-foreground border-primary' : 'bg-background hover:bg-accent text-muted-foreground border-input'}`}
              onClick={() => { setAddDocType('library'); setFileUrl(''); setYoutubeUrl(''); }}
            >
              <Library className="h-4 w-4" /> Kütüphane
            </button>
            <button
              type="button"
              className={`flex-1 flex justify-center items-center gap-2 py-2 text-sm font-medium border border-r-0 ${addDocType === 'file' ? 'bg-primary text-primary-foreground border-primary' : 'bg-background hover:bg-accent text-muted-foreground border-input'}`}
              onClick={() => { setAddDocType('file'); setFileUrl(''); setYoutubeUrl(''); }}
            >
              <FileText className="h-4 w-4" /> Dosya
            </button>
            <button
              type="button"
              className={`flex-1 flex justify-center items-center gap-2 py-2 text-sm font-medium border border-r-0 ${addDocType === 'url' ? 'bg-primary text-primary-foreground border-primary' : 'bg-background hover:bg-accent text-muted-foreground border-input'}`}
              onClick={() => { setAddDocType('url'); setFileUrl(''); setYoutubeUrl(''); }}
            >
              <LinkIcon className="h-4 w-4" /> Web Linki
            </button>
            <button
              type="button"
              className={`flex-1 flex justify-center items-center gap-2 py-2 text-sm font-medium border rounded-r-md ${addDocType === 'youtube' ? 'bg-primary text-primary-foreground border-primary' : 'bg-background hover:bg-accent text-muted-foreground border-input'}`}
              onClick={() => { setAddDocType('youtube'); setFileUrl(''); setYoutubeUrl(''); }}
            >
              <Youtube className="h-4 w-4" /> YouTube
            </button>
          </div>

          <div className="space-y-3 min-h-[200px]">
            {addDocType === 'library' && (
              <div className="space-y-3">
                {!selectedBookForCopies ? (
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground">Kütüphanenizdeki kitapların dijital kopyalarını veya RAG özetlerini seçebilirsiniz.</p>
                    <div className="flex gap-2">
                      <Input 
                        placeholder="Kitap ara..." 
                        value={search.query}
                        onChange={e => search.setQuery(e.target.value)}
                      />
                    </div>
                    {(() => {
                      const filteredBooks = search.data.filter((b: any) => b.is_ebook || (!b.is_ebook && b.has_digital_copy));
                      
                      if (search.query && filteredBooks.length === 0) {
                        return <div className="text-center p-4 text-xs text-muted-foreground">Sonuç bulunamadı.</div>;
                      }
                      
                      if (filteredBooks.length === 0) {
                        return null;
                      }

                      return (
                        <div className="space-y-2">
                          <div className="border rounded-md max-h-40 overflow-y-auto bg-background p-1 space-y-1">
                            {filteredBooks.map((b: any) => {
                              const isDisabled = b.is_ebook && !b.has_digital_copy;
                              
                              return (
                                <button
                                  key={b.id}
                                  disabled={isDisabled}
                                  onClick={() => handleBookClick(b)}
                                  className={`w-full text-left text-xs p-2 rounded truncate flex justify-between group ${!isDisabled ? 'hover:bg-muted' : 'opacity-50 cursor-not-allowed'}`}
                                >
                                  <span className="flex items-center gap-2 truncate pr-4">
                                    <BookOpen className={`h-3 w-3 shrink-0 ${!isDisabled ? 'text-orange-500' : 'text-muted-foreground'}`} />
                                    <span className="truncate">{b.title}</span>
                                    <span className="text-muted-foreground text-[10px] shrink-0 font-medium">
                                      {isDisabled ? "(boş)" : "(dijital ekleri var)"}
                                    </span>
                                  </span>
                                  {!isDisabled && <Plus className="h-3 w-3 opacity-0 group-hover:opacity-100 shrink-0" />}
                                </button>
                              )
                            })}
                          </div>
                          
                          {search.totalPages > 1 && (
                            <div className="flex items-center justify-between text-xs text-muted-foreground pt-1">
                              <button 
                                disabled={search.page <= 1} 
                                onClick={() => search.setPage(search.page - 1)}
                                className="hover:text-foreground disabled:opacity-50"
                              >
                                &larr; Önceki
                              </button>
                              <span>{search.page} / {search.totalPages} ({search.total} sonuç)</span>
                              <button 
                                disabled={search.page >= search.totalPages} 
                                onClick={() => search.setPage(search.page + 1)}
                                className="hover:text-foreground disabled:opacity-50"
                              >
                                Sonraki &rarr;
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                ) : (
                  <div className="space-y-3 animate-in fade-in slide-in-from-right-4">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-semibold text-primary">{selectedBookForCopies.title}</p>
                      <button 
                        onClick={() => { setSelectedBookForCopies(null); setDigitalCopies([]); setSelectedCopyIds([]); }}
                        className="text-xs text-muted-foreground hover:underline"
                      >
                        Geri Dön
                      </button>
                    </div>
                    
                    {loadingCopies ? (
                      <div className="flex justify-center p-4"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
                    ) : digitalCopies.length === 0 ? (
                      <p className="text-xs text-muted-foreground">Bu kitabın dijital kopyası bulunamadı.</p>
                    ) : (
                      <div className="border rounded-md max-h-40 overflow-y-auto bg-background p-2 space-y-2">
                        {digitalCopies.map((copy: any) => (
                          <label key={copy.id} className="flex items-center gap-2 p-2 hover:bg-muted rounded cursor-pointer">
                            <input 
                              type="checkbox" 
                              className="rounded text-primary focus:ring-primary h-3 w-3"
                              checked={selectedCopyIds.includes(copy.id)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedCopyIds([...selectedCopyIds, copy.id]);
                                } else {
                                  setSelectedCopyIds(selectedCopyIds.filter(id => id !== copy.id));
                                }
                              }}
                            />
                            <File className="h-3 w-3 text-muted-foreground" />
                            <div className="flex-1 min-w-0 flex flex-col">
                              <span className="text-xs truncate">{copy.original_filename || `${copy.type} belgesi`}</span>
                              {copy.description && (
                                <span className="text-[10px] text-muted-foreground truncate">{copy.description}</span>
                              )}
                            </div>
                          </label>
                        ))}
                      </div>
                    )}
                    
                    <Button 
                      onClick={addDocumentSources} 
                      disabled={selectedCopyIds.length === 0 || loading}
                      className="w-full h-8 text-xs"
                      size="sm"
                    >
                      {loading ? <Loader2 className="h-3 w-3 animate-spin mr-2" /> : <Plus className="h-3 w-3 mr-2" />}
                      Seçili Belgeleri Ekle ({selectedCopyIds.length})
                    </Button>
                  </div>
                )}
              </div>
            )}

            {addDocType === 'file' && (
              <div className="space-y-4 pt-2">
                <p className="text-xs text-muted-foreground">Desteklenen formatlar: PDF, EPUB, DOC, DOCX, TXT, PNG, JPEG</p>
                <Button 
                  variant="outline" 
                  className="w-full"
                  disabled={loading}
                  onClick={() => {
                    const input = document.createElement('input')
                    input.type = 'file'
                    input.accept = '.pdf,.epub,.doc,.docx,.txt,.md,.html,.htm,.srt,.vtt,.rtf,image/png,image/jpeg,image/tiff'
                    input.onchange = async (e: any) => {
                      const file = e.target.files?.[0]
                      if (file && activeSession) {
                        setIsAddSourceOpen(false)
                        try {
                          setLoading(true)
                          let src;
                          if (file.type.startsWith('image/')) {
                            src = await api.knowledge.addImageSource(activeSession.id, file)
                          } else {
                            src = await api.knowledge.addFileSource(activeSession.id, file)
                          }
                          setSources(prev => [...prev, src])
                        } catch (err) {
                          console.error(err)
                          alert('Belge yüklenirken hata oluştu.')
                        } finally {
                          setLoading(false)
                        }
                      }
                    }
                    input.click()
                  }}
                >
                  <FolderOpen className="h-4 w-4 mr-2" />
                  Dosya Seç ve Yükle
                </Button>
              </div>
            )}

            {addDocType === 'url' && (
              <div className="space-y-3 pt-2">
                <p className="text-xs text-muted-foreground">İnternetteki bir belgenin veya sayfanın linkini ekleyin.</p>
                <div className="flex gap-2">
                  <Input 
                    placeholder="https://..." 
                    value={fileUrl}
                    onChange={e => setFileUrl(e.target.value)}
                  />
                  <Button 
                    disabled={!fileUrl.trim() || loading}
                    onClick={async () => {
                      if (!activeSession) return
                      setIsAddSourceOpen(false)
                      try {
                        setLoading(true)
                        const src = await api.knowledge.addUrlSource(activeSession.id, fileUrl)
                        setSources(prev => [...prev, src])
                        setFileUrl('')
                      } catch (err: any) {
                        console.error(err)
                        alert(err.message || 'Dosya indirilirken hata oluştu.')
                      } finally {
                        setLoading(false)
                      }
                    }}
                  >
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Ekle'}
                  </Button>
                </div>
              </div>
            )}

            {addDocType === 'youtube' && (
              <div className="space-y-3 pt-2">
                <p className="text-xs text-muted-foreground">Bir YouTube videosunun alt yazılarını RAG için ekleyin.</p>
                <div className="flex gap-2">
                  <Input 
                    placeholder="https://youtube.com/watch?v=..." 
                    value={youtubeUrl}
                    onChange={e => setYoutubeUrl(e.target.value)}
                  />
                  <Button 
                    disabled={!youtubeUrl.trim() || loading}
                    onClick={async () => {
                      if (!activeSession) return
                      setIsAddSourceOpen(false)
                      try {
                        setLoading(true)
                        const src = await api.knowledge.addYoutubeSource(activeSession.id, youtubeUrl)
                        setSources(prev => [...prev, src])
                        setYoutubeUrl('')
                      } catch (err: any) {
                        console.error(err)
                        alert(err.message || 'YouTube altyazısı alınırken hata oluştu.')
                      } finally {
                        setLoading(false)
                      }
                    }}
                  >
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Ekle'}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </Dialog>
    </>
  )
}
