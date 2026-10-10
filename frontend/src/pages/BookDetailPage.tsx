import { useEffect, useState } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { api } from '../api/client'
import { useAuth } from '../hooks/useAuth'
import { useToast } from '../components/ui/toast'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Textarea } from '../components/ui/textarea'
import { Label } from '../components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Badge } from '../components/ui/badge'
import { Select } from '../components/ui/select'
import { BookSearchDialog } from '../components/BookSearchDialog'
import { ChatPanel } from '../components/ChatPanel'
import { Dialog } from '../components/ui/dialog'
import { ArrowLeft, Edit3, Trash2, Search, BookOpen, Upload, Bot, Loader2, ExternalLink, ImageIcon, Monitor, Library, FileText, Download, Globe, Eye, EyeOff, ScanLine, Link as LinkIcon, Youtube, X } from 'lucide-react'

const LANGUAGE_OPTIONS = [
  { value: '1', label: 'Türkçe' }, { value: '2', label: 'İngilizce' },
  { value: '3', label: 'Almanca' }, { value: '4', label: 'Fransızca' },
  { value: '5', label: 'Diğer' },
]

const CATEGORY_OPTIONS = [
  { value: 'Tarih', label: 'Tarih' },
  { value: 'Güncel', label: 'Güncel' },
  { value: 'Roman', label: 'Roman' },
  { value: 'Bilişim', label: 'Bilişim' },
  { value: 'Yemek', label: 'Yemek' },
  { value: 'Kişisel Gelişim', label: 'Kişisel Gelişim' },
  { value: 'Tıp', label: 'Tıp' },
  { value: 'Spor', label: 'Spor' },
  { value: 'Felsefe / Psikoloji', label: 'Felsefe / Psikoloji' },
  { value: 'Bilim / Araştırma', label: 'Bilim / Araştırma' },
  { value: 'Sanat / Tasarım', label: 'Sanat / Tasarım' },
  { value: 'Ekonomi / Finans', label: 'Ekonomi / Finans' },
  { value: 'Çocuk / Gençlik', label: 'Çocuk / Gençlik' },
  { value: 'Edebiyat / Şiir', label: 'Edebiyat / Şiir' },
  { value: 'Diğer', label: 'Diğer' }
]

export function BookDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const { user } = useAuth()
  const { toast } = useToast()
  const goBack = () => {
    const from = (location.state as any)?.from
    navigate(from || '/books')
  }
  const isNew = id === 'new'
  const [book, setBook] = useState<any>({})
  const [loading, setLoading] = useState(!isNew)
  const [saving, setSaving] = useState(false)
  const [editing, setEditing] = useState(isNew || (location.state as any)?.editing === true)
  const [isbnDialogOpen, setIsbnDialogOpen] = useState(false)
  const [autoFilling, setAutoFilling] = useState(false)
  const [autoFillResult, setAutoFillResult] = useState<any>(null)
  const [shelves, setShelves] = useState<any[]>([])
  const [copies, setCopies] = useState<any[]>([])
  const [copiesLoading, setCopiesLoading] = useState(true)
  const [uploadProgress, setUploadProgress] = useState<number | null>(null)
  const [summary, setSummary] = useState<string | null>(null)
  const [summarizing, setSummarizing] = useState(false)
  const [ocrLoading, setOcrLoading] = useState<number | null>(null)
  const [ocrProgress, setOcrProgress] = useState<string>('')
  
  // Add Document Dialog States
  const [isAddDocOpen, setIsAddDocOpen] = useState(false)
  const [addDocType, setAddDocType] = useState<'file' | 'url' | 'youtube'>('file')
  const [docDescription, setDocDescription] = useState('')
  const [docUrl, setDocUrl] = useState('')
  const [docFile, setDocFile] = useState<File | null>(null)

  const refreshCopies = () => {
    if (!isNew && id) {
      setCopiesLoading(true)
      api.copies.list(Number(id)).then(setCopies).catch(() => {}).finally(() => setCopiesLoading(false))
    }
  }

  const handleUploadSubmit = async () => {
    if (!id || isNew) return;
    setUploadProgress(0);
    try {
      let c;
      if (addDocType === 'file' && docFile) {
        c = await api.copies.uploadWithProgress(
          Number(id),
          docFile,
          (pct) => setUploadProgress(pct),
          false,
          docDescription
        )
      } else if (addDocType === 'url' && docUrl) {
        c = await api.copies.addUrl(Number(id), docUrl, docDescription)
      } else if (addDocType === 'youtube' && docUrl) {
        c = await api.copies.addYoutube(Number(id), docUrl, docDescription)
      } else {
        return; // nothing to submit
      }
      
      if (c) {
        setCopies((prev) => [c, ...prev])
        setBook((prev: any) => ({ ...prev, has_digital_copy: true, is_ebook: true }))
        try { const b = await api.books.get(Number(id)); setBook(b) } catch {}
        
        let ragMsg = ''
        if (c.rag_status === 'ok') {
          ragMsg = ' RAG kullanıma hazır.'
        } else if (c.rag_status === 'running' || c.rag_status === 'queued') {
          if (c.type === 'pdf') {
            ragMsg = ' Arka planda işleniyor. Eğer bu bir görüntü/tarama PDF ise yapay zeka düzeltmeli OCR uygulanacağı için işlem 3-5 dakika sürebilir.'
          } else {
            ragMsg = ' Arka planda işleniyor...'
          }
        } else if (c.rag_status && c.rag_status !== 'skipped') {
          ragMsg = ` RAG Durumu: ${c.rag_status}`
        }
        
        toast({ title: 'Eklendi', description: `Belge başarıyla eklendi.${ragMsg}` })
      }
      
      setIsAddDocOpen(false);
      setDocFile(null);
      setDocUrl('');
      setDocDescription('');
    } catch (err: any) {
      toast({ title: 'Hata', description: err.message, variant: 'destructive' })
    } finally {
      setUploadProgress(null)
    }
  }

  // On mount: check if any copy has OCR running in background
  useEffect(() => {
    if (!isNew && id) {
      refreshCopies()
      api.copies.list(Number(id)).then(async (copiesList) => {
        for (const c of copiesList) {
          if (c.type === 'pdf') {
            try {
              const st = await api.copies.ocrStatus(c.id)
              if (st.status === 'running') {
                setOcrLoading(c.id)
                setOcrProgress(st.progress || st.phase)
                // Resume polling
                const poll = setInterval(async () => {
                  try {
                    const s = await api.copies.ocrStatus(c.id)
                    if (s.status === 'running') {
                      setOcrProgress(s.progress || s.phase)
                    } else if (s.status === 'done') {
                      clearInterval(poll)
                      setOcrLoading(null)
                      setOcrProgress('')
                      setBook((prev: any) => ({ ...prev, has_rag: true }))
                      refreshCopies()
                      toast({ title: 'OCR tamamlandı', description: s.message })
                    } else if (s.status === 'failed') {
                      clearInterval(poll)
                      setOcrLoading(null)
                      setOcrProgress('')
                      toast({ title: 'OCR başarısız', description: s.message, variant: 'destructive' })
                    }
                  } catch {
                    clearInterval(poll)
                    setOcrLoading(null)
                    setOcrProgress('')
                  }
                }, 3000)
                break
              }
            } catch {}
          }
        }
      }).catch(() => {})
      // Remove automatic summary generation
    }
  }, [id, isNew])
  useEffect(() => {
    if (!isNew && id) {
      api.books.get(Number(id)).then(data => {
        setBook({ ...data, shelf_ids: data.shelves?.map((s: any) => s.id) || [] })
        if (data.ai_summary) setSummary(data.ai_summary)
      }).finally(() => setLoading(false))
    }
  }, [id, isNew])

  useEffect(() => {
    api.shelves.list().then(setShelves).catch(() => {})
  }, [])

  const handleChange = (field: string, value: any) => {
    setBook((prev: any) => ({ ...prev, [field]: value }))
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      if (isNew) {
        await api.books.create(book)
        toast({ title: 'Kitap eklendi' })
      } else {
        await api.books.update(Number(id), book)
        toast({ title: 'Kitap güncellendi' })
        setEditing(false)
      }
      if (isNew) goBack()
    } catch (err: any) {
      toast({ title: 'Hata', description: err.message, variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm('Bu kitabı silmek istediğinize emin misiniz?')) return
    try {
      await api.books.delete(Number(id))
      toast({ title: 'Kitap silindi' })
      goBack()
    } catch (err: any) {
      toast({ title: 'Hata', description: err.message, variant: 'destructive' })
    }
  }

  if (loading) return <div className="flex justify-center py-12"><div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" /></div>

  // View Mode
  if (!editing && !isNew) {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={goBack}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-2xl font-bold flex-1">{book.title}</h1>
          {user && (
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
                <Edit3 className="h-4 w-4 mr-1" /> Düzenle
              </Button>
              <Button variant="destructive" size="sm" onClick={handleDelete}>
                <Trash2 className="h-4 w-4 mr-1" /> Sil
              </Button>
            </div>
          )}
        </div>

        <div className="flex gap-6">
          {book.cover_url ? (
            <div className="w-[150px] aspect-[3/4] flex-shrink-0 overflow-hidden rounded-lg bg-muted shadow-md relative">
              <img src={book.cover_url} alt={book.title} className="h-full w-full object-cover"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />
              {book.is_ebook && (
                <div className="absolute top-0 left-0 bg-primary text-primary-foreground rounded-tl-lg rounded-br-md px-2 py-1">
                  <Monitor className="h-4 w-4" />
                </div>
              )}
            </div>
          ) : (
            <div className="w-[150px] aspect-[3/4] flex-shrink-0 rounded-lg bg-muted flex items-center justify-center relative">
              {book.is_ebook ? (
                <Monitor className="h-10 w-10 text-primary/60" />
              ) : (
                <BookOpen className="h-10 w-10 text-muted-foreground" />
              )}
              {book.is_ebook && (
                <div className="absolute top-0 left-0 bg-primary text-primary-foreground rounded-tl-lg rounded-br-md px-2 py-1">
                  <Monitor className="h-4 w-4" />
                </div>
              )}
            </div>
          )}
          <div className="space-y-3 flex-1">
            <div className="flex flex-wrap gap-2">
              {book.is_read && <Badge variant="success">Okundu</Badge>}
              {book.category && <Badge variant="secondary">{book.category}</Badge>}
              {book.has_rag && <Badge className="bg-primary/20 text-primary border-primary/30"><Bot className="h-3 w-3 mr-1" />RAG</Badge>}
              {(book.shelf_ids || []).map((sid: number) => {
                const s = shelves.find((x) => x.id === sid)
                return s ? <Badge key={`s-${sid}`} variant="outline" className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ backgroundColor: s.color || '#64748b' }} />{s.name}</Badge> : null
              })}
              {book.shelf && (!book.shelf_ids || book.shelf_ids.length === 0) && <Badge variant="outline">{book.shelf}</Badge>}
            </div>
            {book.category && (
              <div>
                <span className="text-xs text-muted-foreground">Kategori</span>
                <p className="text-sm font-medium">{book.category}</p>
              </div>
            )}
            {book.author && (
              <div>
                <span className="text-xs text-muted-foreground">Yazar</span>
                <p className="text-sm font-medium">{book.author}</p>
              </div>
            )}
            {book.publisher && (
              <div>
                <span className="text-xs text-muted-foreground">Yayınevi</span>
                <p className="text-sm">{book.publisher}</p>
              </div>
            )}
            {book.isbn && (
              <div>
                <span className="text-xs text-muted-foreground">ISBN</span>
                <p className="text-sm">{book.isbn}</p>
              </div>
            )}
            {(book.page_count || book.publication_year) && (
              <div>
                <span className="text-xs text-muted-foreground">Detay</span>
                <p className="text-sm">{book.page_count ? `${book.page_count} sayfa` : ''}{book.page_count && book.publication_year ? ' · ' : ''}{book.publication_year || ''}</p>
              </div>
            )}
          </div>
        </div>

        {book.tags && (
          <div>
            <span className="text-xs text-muted-foreground">Etiketler</span>
            <div className="flex flex-wrap gap-1 mt-1">
              {book.tags.split(',').map((t: string) => (
                <span key={t} className="text-xs bg-muted px-2 py-0.5 rounded">{t.trim()}</span>
              ))}
            </div>
          </div>
        )}

          {book.notes && (
            <div className="rounded-lg border border-border bg-card p-4">
              <span className="text-xs text-muted-foreground">Notlar</span>
              <p className="text-sm mt-1 whitespace-pre-wrap">{book.notes}</p>
            </div>
          )}

          <div className="flex flex-wrap gap-2 justify-center">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const q = encodeURIComponent(`${book.title || ''} ${book.author || ''} kitap kapağı`)
                window.open(`https://www.google.com/search?tbm=isch&q=${q}`, '_blank')
              }}
            >
              <ImageIcon className="h-3 w-3 mr-1" /> Google'da Ara
            </Button>
            {book.cover_url && book.cover_url.startsWith('/covers/') && (
              <span className="text-xs text-green-500">Yerel kapak</span>
            )}
          </div>

        {/* Digital Copies — unified (RAG + okuma + depo) */}
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <FileText className="h-4 w-4 text-primary" />
              Dijital Kopyalar
              {book.has_digital_copy && <span className="text-xs text-green-500">({copies.length} dosya)</span>}
            </h3>
            <div className="flex gap-1">
              {/* Read button */}
              {book.has_digital_copy && (
                <Button variant="default" size="sm" onClick={async () => {
                  try {
                    const c = await api.copies.read(Number(id))
                    window.open(api.copies.download(c.id), '_blank')
                  } catch {
                    toast({ title: 'Uyarı', description: 'Okunabilir kopya bulunamadı', variant: 'destructive' })
                  }
                }}>
                  <BookOpen className="h-3 w-3 mr-1" /> Oku
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={async () => {
                setSummarizing(true)
                try {
                  const r = await api.copies.summary(Number(id), true)
                  setSummary(r.summary)
                  toast({ title: 'Özet hazır', description: `${r.source_count} kaynak kullanıldı` })
                } catch { setSummary('Özet alınamadı.') }
                setSummarizing(false)
              }} disabled={summarizing}>
                {summarizing ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Bot className="h-3 w-3 mr-1" />}
                {summary ? 'Yeniden Özetle' : 'Yapay Zeka Özeti'}
              </Button>
              {/* Auto-fill (tüm kullanıcılar) — web'de kaynak ara */}
              {!book.has_digital_copy && (
                <Button variant="outline" size="sm" onClick={async () => {
                  setAutoFilling(true)
                  setAutoFillResult(null)
                  try {
                    const token = localStorage.getItem('token')
                    const res = await fetch(`/api/books/${id}/rag/auto-fill`, {
                      method: 'POST',
                      headers: token ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } : {},
                    })
                    const data = await res.json()
                    setAutoFillResult(data)
                    if (data.success) {
                      setBook((prev: any) => ({ ...prev, has_rag: true, has_digital_copy: true }))
                      refreshCopies()
                      toast({ title: 'Başarılı', description: data.message })
                    }
                  } catch (err: any) {
                    toast({ title: 'Hata', description: err.message, variant: 'destructive' })
                  } finally {
                    setAutoFilling(false)
                  }
                }} disabled={autoFilling}>
                  {autoFilling ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Bot className="h-3 w-3 mr-1" />}
                  Kaynak Ara
                </Button>
              )}
              {/* Upload */}
              {uploadProgress !== null ? (
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium border border-primary/30 bg-primary/5">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  <span>Yükleniyor %{uploadProgress}</span>
                  <div className="w-16 h-1.5 rounded-full bg-muted overflow-hidden">
                    <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${uploadProgress}%` }} />
                  </div>
                </div>
              ) : (
                <>
                  <Button variant="outline" size="sm" className="h-7 text-xs px-2 gap-1" onClick={() => setIsAddDocOpen(true)}>
                    <Upload className="h-3 w-3" /> Ekle
                  </Button>
                  <Dialog open={isAddDocOpen} onClose={() => setIsAddDocOpen(false)} title="Belge Ekle">
                    <div className="space-y-4 py-4">
                      <div className="flex rounded-md shadow-sm">
                        <button
                          type="button"
                          className={`flex-1 flex justify-center items-center gap-2 py-2 text-sm font-medium border border-r-0 rounded-l-md ${addDocType === 'file' ? 'bg-primary text-primary-foreground border-primary' : 'bg-background hover:bg-accent text-muted-foreground border-input'}`}
                          onClick={() => { setAddDocType('file'); setDocUrl(''); setDocFile(null); }}
                        >
                          <FileText className="h-4 w-4" /> Dosya
                        </button>
                        <button
                          type="button"
                          className={`flex-1 flex justify-center items-center gap-2 py-2 text-sm font-medium border border-r-0 ${addDocType === 'url' ? 'bg-primary text-primary-foreground border-primary' : 'bg-background hover:bg-accent text-muted-foreground border-input'}`}
                          onClick={() => { setAddDocType('url'); setDocFile(null); }}
                        >
                          <LinkIcon className="h-4 w-4" /> Link
                        </button>
                        <button
                          type="button"
                          className={`flex-1 flex justify-center items-center gap-2 py-2 text-sm font-medium border rounded-r-md ${addDocType === 'youtube' ? 'bg-primary text-primary-foreground border-primary' : 'bg-background hover:bg-accent text-muted-foreground border-input'}`}
                          onClick={() => { setAddDocType('youtube'); setDocFile(null); }}
                        >
                          <Youtube className="h-4 w-4" /> YouTube
                        </button>
                      </div>

                      <div className="space-y-3">
                        {addDocType === 'file' && (
                          <div className="space-y-1">
                            <Label className="text-xs">Dosya Seç (PDF, EPUB, DOCX vs)</Label>
                            <Input type="file" onChange={(e) => setDocFile(e.target.files?.[0] || null)} className="h-9" />
                          </div>
                        )}
                        {addDocType === 'url' && (
                          <div className="space-y-1">
                            <Label className="text-xs">Web Linki</Label>
                            <Input value={docUrl} onChange={(e) => setDocUrl(e.target.value)} placeholder="https://..." className="h-9" />
                          </div>
                        )}
                        {addDocType === 'youtube' && (
                          <div className="space-y-1">
                            <Label className="text-xs">YouTube Video Linki</Label>
                            <Input value={docUrl} onChange={(e) => setDocUrl(e.target.value)} placeholder="https://youtube.com/watch?v=..." className="h-9" />
                          </div>
                        )}
                        
                        <div className="space-y-1">
                          <Label className="text-xs">Açıklama (Opsiyonel)</Label>
                          <Input 
                            value={docDescription} 
                            onChange={(e) => setDocDescription(e.target.value)} 
                            placeholder="RAG için kısa bilgi..." 
                            maxLength={30} 
                            className="h-9"
                          />
                          <p className="text-[10px] text-muted-foreground text-right">{docDescription.length}/30</p>
                        </div>
                      </div>

                      <div className="flex justify-end gap-2 pt-2">
                        <Button variant="ghost" size="sm" onClick={() => setIsAddDocOpen(false)}>İptal</Button>
                        <Button 
                          size="sm" 
                          onClick={handleUploadSubmit}
                          disabled={
                            (addDocType === 'file' && !docFile) || 
                            (addDocType !== 'file' && !docUrl) ||
                            uploadProgress !== null
                          }
                        >
                          {uploadProgress !== null ? <Loader2 className="h-3 w-3 animate-spin mr-2" /> : null}
                          Ekle
                        </Button>
                      </div>
                    </div>
                  </Dialog>
                </>
              )}
            </div>
          </div>

          {summary && (
            <div className="mb-3 rounded-lg bg-muted/30 p-3 border border-border">
              <p className="text-xs text-muted-foreground mb-1">Kitap Özeti</p>
              <p className="text-sm whitespace-pre-wrap">{summary}</p>
            </div>
          )}

          {autoFillResult && !autoFillResult.success && autoFillResult.sources?.length > 0 && (
            <div className="mb-3 space-y-1">
              <p className="text-xs text-muted-foreground mb-1">Bulunan kaynaklar:</p>
              {autoFillResult.sources.map((s: any, i: number) => (
                <a key={i} href={s.url} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-2 text-xs text-primary hover:underline">
                  <ExternalLink className="h-3 w-3" />
                  {s.source} — {s.type} {s.free ? '(Ücretsiz)' : ''}
                </a>
              ))}
            </div>
          )}

          {ocrLoading !== null && (
            <div className="mb-3 rounded-lg bg-amber-500/10 border border-amber-500/30 p-3 flex items-center gap-3">
              <Loader2 className="h-4 w-4 animate-spin text-amber-500 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium text-amber-600 dark:text-amber-400">OCR çalışıyor</p>
                <p className="text-xs text-muted-foreground">{ocrProgress || 'Başlatılıyor...'}</p>
              </div>
              <span className="text-xs text-muted-foreground">Arka planda</span>
            </div>
          )}

          {copiesLoading ? (
            <div className="flex items-center justify-center py-6 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : copies.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-6 text-muted-foreground">
              <FileText className="h-8 w-8 opacity-40" />
              <p className="text-sm">Henüz dijital kopya yüklenmemiş</p>
              <p className="text-xs">PDF, EPUB, TXT, DOC/DOCX veya makale dosyası yükleyebilirsiniz.</p>
              <p className="text-xs text-primary">İlk dosyayı yükleyince varsayılan okuma dosyası olur.</p>
            </div>
          ) : (
            <div className="space-y-1">
              {copies.map((c) => (
                <div key={c.id} className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-accent/50 transition-colors group">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                      {c.type === 'pdf' ? <FileText className="h-4 w-4 text-primary" /> :
                       c.type === 'epub' ? <BookOpen className="h-4 w-4 text-primary" /> :
                       <FileText className="h-4 w-4 text-muted-foreground" />}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{c.original_filename || `Kopya #${c.id}`}</p>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-xs text-muted-foreground">{c.type?.toUpperCase()}{c.file_size ? ` · ${(c.file_size / 1024 / 1024).toFixed(1)} MB` : ''}</span>
                        {c.is_default && <Badge variant="success" className="text-[10px] px-1 py-0">Varsayılan Okuma</Badge>}
                        {c.is_primary && <Badge variant="outline" className="text-[10px] px-1 py-0">RAG</Badge>}
                        {c.user_id === user?.id && (
                          <button onClick={async () => {
                            try {
                              const upd = await api.copies.update(c.id, { is_public: !c.is_public })
                              setCopies((prev) => prev.map((x) => x.id === c.id ? upd : x))
                              toast({ title: upd.is_public ? 'Herkese açıldı' : 'Gizlendi' })
                            } catch (err: any) {
                              toast({ title: 'Hata', description: err.message, variant: 'destructive' })
                            }
                          }}
                            className={`inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded transition-colors ${c.is_public ? 'bg-green-500/10 text-green-500 hover:bg-green-500/20' : 'bg-muted text-muted-foreground hover:text-foreground'}`}>
                            {c.is_public ? <><Eye className="h-3 w-3" /> Herkese Açık</> : <><EyeOff className="h-3 w-3" /> Özel</>}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    {/* Set as default for reading */}
                    {c.user_id === user?.id && !c.is_default && (
                      <button onClick={async () => {
                        try {
                          await api.copies.setDefault(c.id)
                          setCopies((prev) => prev.map((x) => ({ ...x, is_default: x.id === c.id })))
                          toast({ title: 'Varsayılan okuma dosyası yapıldı' })
                        } catch (err: any) {
                          toast({ title: 'Hata', description: err.message, variant: 'destructive' })
                        }
                      }} className="p-1 text-muted-foreground hover:text-primary" title="Varsayılan okuma">
                        <BookOpen className="h-3.5 w-3.5" />
                      </button>
                    )}
                    {/* Set as primary RAG source */}
                    {c.user_id === user?.id && !c.is_primary && (
                      <button onClick={async () => {
                        try {
                          await api.copies.setPrimary(c.id)
                          setCopies((prev) => prev.map((x) => ({ ...x, is_primary: x.id === c.id })))
                          toast({ title: 'RAG kaynağı olarak işaretlendi' })
                        } catch (err: any) {
                          toast({ title: 'Hata', description: err.message, variant: 'destructive' })
                        }
                      }} className="p-1 text-muted-foreground hover:text-indigo-400" title="RAG için kullan">
                        <Bot className="h-3.5 w-3.5" />
                      </button>
                    )}
                    {/* OCR: PDF but no RAG → scanned PDF, offer OCR */}
                    {c.user_id === user?.id && c.type === 'pdf' && !book.has_rag && (
                      <button
                        onClick={async () => {
                          setOcrLoading(c.id)
                          setOcrProgress('')
                          try {
                            const res = await api.copies.ocr(c.id)
                            if (!res.success) {
                              toast({ title: 'OCR', description: res.message, variant: 'destructive' })
                              setOcrLoading(null)
                              return
                            }
                            toast({ title: 'OCR başladı', description: 'Arka planda çalışıyor.' })
                            const poll = setInterval(async () => {
                              try {
                                const st = await api.copies.ocrStatus(c.id)
                                if (st.status === 'running') {
                                  setOcrProgress(st.progress || st.phase)
                                } else if (st.status === 'done') {
                                  clearInterval(poll)
                                  setOcrLoading(null)
                                  setOcrProgress('')
                                  setBook((prev: any) => ({ ...prev, has_rag: true }))
                                  refreshCopies()
                                  toast({ title: 'OCR tamamlandı', description: st.message })
                                } else if (st.status === 'failed') {
                                  clearInterval(poll)
                                  setOcrLoading(null)
                                  setOcrProgress('')
                                  toast({ title: 'OCR başarısız', description: st.message, variant: 'destructive' })
                                }
                              } catch {
                                clearInterval(poll)
                                setOcrLoading(null)
                                setOcrProgress('')
                              }
                            }, 3000)
                          } catch (err: any) {
                            toast({ title: 'Hata', description: err.message, variant: 'destructive' })
                            setOcrLoading(null)
                          }
                        }}
                        disabled={ocrLoading === c.id}
                        className="p-1 text-muted-foreground hover:text-amber-500 disabled:opacity-50"
                        title={ocrLoading === c.id ? `OCR çalışıyor: ${ocrProgress}` : 'OCR ile metne çevir (görüntü PDF)'}
                      >
                        {ocrLoading === c.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ScanLine className="h-3.5 w-3.5" />}
                      </button>
                    )}
                    <a href={api.copies.download(c.id)} target="_blank" rel="noopener noreferrer"
                      className="p-1 text-muted-foreground hover:text-foreground" title="İndir">
                      <Download className="h-3.5 w-3.5" />
                    </a>
                    {c.user_id === user?.id && (
                      <button onClick={async () => {
                        if (!confirm('Bu dosyayı silmek istediğinize emin misiniz?')) return
                        try {
                          await api.copies.delete(c.id)
                          setCopies((prev) => prev.filter((x) => x.id !== c.id))
                          toast({ title: 'Dosya silindi' })
                        } catch (err: any) {
                          toast({ title: 'Hata', description: err.message, variant: 'destructive' })
                        }
                      }} className="p-1 text-muted-foreground hover:text-destructive" title="Sil">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* AI Chat (tüm kitaplarda gösterilir) */}
        <div className="pt-2">
          <ChatPanel bookId={Number(id)} />
        </div>
      </div>
    )
  }

  // Edit Mode
  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => isNew ? goBack() : setEditing(false)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{isNew ? 'Yeni Kitap' : 'Kitap Düzenle'}</h1>
        </div>
          {!isNew && (
            <Button variant="destructive" size="sm" onClick={handleDelete}>
            <Trash2 className="h-4 w-4 mr-2" />
            Sil
          </Button>
        )}
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Kitap Bilgileri</CardTitle>
            <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded">Düzenleme Modu</span>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-[1fr_auto] gap-2">
            <div className="space-y-2">
              <Label>ISBN</Label>
              <Input value={book.isbn || ''} onChange={(e) => handleChange('isbn', e.target.value)} placeholder="ISBN numarası" />
            </div>
            <div className="flex items-end">
              <Button variant="outline" size="icon" onClick={() => setIsbnDialogOpen(true)} title="ISBN ile kitap bilgilerini getir">
                <Search className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Kitap Adı *</Label>
            <Input value={book.title || ''} onChange={(e) => handleChange('title', e.target.value)} required />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Yazar</Label>
              <Input value={book.author || ''} onChange={(e) => handleChange('author', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Yayınevi</Label>
              <Input value={book.publisher || ''} onChange={(e) => handleChange('publisher', e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Sayfa Sayısı</Label>
              <Input type="number" value={book.page_count || ''} onChange={(e) => handleChange('page_count', parseInt(e.target.value) || null)} />
            </div>
            <div className="space-y-2">
              <Label>Basım Yılı</Label>
              <Input value={book.publication_year || ''} onChange={(e) => handleChange('publication_year', e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Dil</Label>
              <Select value={book.language || ''} onChange={(e) => handleChange('language', e.target.value)} options={[{ value: '', label: 'Seçiniz...' }, ...LANGUAGE_OPTIONS]} />
            </div>
            <div className="space-y-2">
              <Label>Kategori</Label>
              <Select value={book.category || ''} onChange={(e) => handleChange('category', e.target.value || null)} options={[{ value: '', label: 'Seçiniz...' }, ...CATEGORY_OPTIONS]} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Raflar</Label>
            <div className="flex flex-col gap-2">
              <select 
                value="" 
                onChange={(e) => {
                  const val = Number(e.target.value)
                  if (val && !(book.shelf_ids || []).includes(val)) {
                    handleChange('shelf_ids', [...(book.shelf_ids || []), val])
                  }
                }} 
                className="flex h-9 w-full rounded-lg border border-border bg-background px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-50"
              >
                <option value="">Raf Ekle...</option>
                {shelves.filter(s => !(book.shelf_ids || []).includes(s.id)).map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
              {(book.shelf_ids || []).length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {(book.shelf_ids || []).map((sid: number) => {
                    const shelf = shelves.find(s => s.id === sid)
                    if (!shelf) return null
                    return (
                      <div key={sid} className="flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium border" style={{ borderColor: shelf.color || '#64748b', color: shelf.color || '#64748b' }}>
                        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: shelf.color || '#64748b' }} />
                        {shelf.name}
                        <button type="button" onClick={() => handleChange('shelf_ids', (book.shelf_ids || []).filter((id: number) => id !== sid))} className="ml-1 hover:text-red-500">
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
          <div className="space-y-2">
            <Label>Etiketler</Label>
            <Input value={book.tags || ''} onChange={(e) => handleChange('tags', e.target.value)} placeholder="virgülle ayırın" />
          </div>
          <div className="space-y-2">
            <Label>Notlar</Label>
            <Textarea value={book.notes || ''} onChange={(e) => handleChange('notes', e.target.value)} rows={3} />
          </div>
          <div className="flex gap-4">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={book.is_read || false} onChange={(e) => handleChange('is_read', e.target.checked)} />
              Okundu
            </label>
            <label className="flex items-center gap-2 text-sm opacity-70 cursor-not-allowed">
              <input type="checkbox" checked={book.is_ebook || false} readOnly disabled />
              E-Kitap <span className="text-[10px] text-muted-foreground ml-1">(Otomatik)</span>
            </label>
            <label className="flex items-center gap-2 text-sm opacity-70 cursor-not-allowed">
              <input type="checkbox" checked={!!book.shelf_id} readOnly disabled />
              Basılı Kitap <span className="text-[10px] text-muted-foreground ml-1">(Rafa göre otomatik)</span>
            </label>
          </div>
          <div className="space-y-2">
            <Label>Kapak Görseli</Label>
            <div className="flex items-start gap-3">
              {book.cover_url ? (
                <div className="w-[80px] aspect-[3/4] flex-shrink-0 overflow-hidden rounded-md bg-muted shadow-sm">
                  <img src={book.cover_url} alt="" className="h-full w-full object-cover"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />
                </div>
              ) : (
                <div className="w-[80px] aspect-[3/4] flex-shrink-0 rounded-md bg-muted flex items-center justify-center">
                  <BookOpen className="h-6 w-6 text-muted-foreground" />
                </div>
              )}
              <div className="flex-1 space-y-1">
                <Input value={book.cover_url || ''} onChange={(e) => handleChange('cover_url', e.target.value)} placeholder="Görsel URL'si" />
                <div className="flex flex-wrap gap-1">
                  <Button variant="outline" size="sm" onClick={() => setIsbnDialogOpen(true)} title="Kitap adıyla kapak ara">
                    <Search className="h-3 w-3 mr-1" /> Kapak Ara
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const q = encodeURIComponent(`${book.title || ''} ${book.author || ''} kitap kapağı`)
                      window.open(`https://www.google.com/search?tbm=isch&q=${q}`, '_blank')
                    }}
                  >
                    <ImageIcon className="h-3 w-3 mr-1" /> Google Görsel
                  </Button>
                  {book.cover_url && book.cover_url.startsWith('/covers/') && (
                    <span className="text-xs text-green-500 self-center">Yerel</span>
                  )}
                  {isNew ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium border border-border text-muted-foreground cursor-not-allowed" title="Önce kitabı kaydedin">
                      <Upload className="h-3 w-3" /> Kapak Yükle
                    </span>
                  ) : (
                    <label className="cursor-pointer inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium border border-border hover:bg-accent transition-colors">
                      <Upload className="h-3 w-3" /> Yükle
                      <input type="file" accept="image/*" className="hidden" onChange={async (e) => {
                        const file = e.target.files?.[0]
                        if (!file) return
                        try {
                          const res = await api.covers.upload(book.id || Number(id), file)
                          const cacheBuster = `?t=${Date.now()}`
                          setBook((prev: any) => ({ ...prev, cover_url: res.cover_url.split('?')[0] + cacheBuster }))
                          toast({ title: 'Kapak yüklendi' })
                        } catch (err: any) {
                          toast({ title: 'Hata', description: err.message, variant: 'destructive' })
                        }
                        e.target.value = ''
                      }} />
                    </label>
                  )}
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={() => isNew ? goBack() : setEditing(false)}>İptal</Button>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? 'Kaydediliyor...' : 'Kaydet'}
        </Button>
      </div>

      <BookSearchDialog
        open={isbnDialogOpen}
        onClose={() => setIsbnDialogOpen(false)}
        initialIsbn={book.isbn}
        initialTitle={book.title}
        onSelect={(data) => {
          setBook((prev: any) => ({ ...prev, ...data }))
        }}
      />
    </div>
  )
}
