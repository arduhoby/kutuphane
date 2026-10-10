import { useEffect, useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import { useToast } from '../components/ui/toast'
import { api } from '../api/client'
import { SORT_OPTIONS, getDefaultSort, setDefaultSort, getHoverCardEnabled, setHoverCardEnabled } from '../hooks/useBookSearch'
import { useTheme } from '../hooks/useTheme'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Shield, Plus, X, Loader2, Download, Library, Palette, Trash2, Check, Pencil, ArrowUpDown, Sun, Moon, Monitor, MousePointer2, Bot, KeyRound, Sparkles } from 'lucide-react'

const COLORS = ['#22c55e', '#14b8a6', '#3b82f6', '#8b5cf6', '#ec4899', '#f97316', '#eab308', '#64748b']

export function SettingsPage() {
  const { user } = useAuth()
  const { toast } = useToast()
  const { theme, setTheme } = useTheme()
  const [users, setUsers] = useState<any[]>([])
  const [loadingUsers, setLoadingUsers] = useState(false)
  const [showAdd, setShowAdd] = useState(false)
  const [saving, setSaving] = useState(false)
  const [isBackingUp, setIsBackingUp] = useState(false)
  const [form, setForm] = useState({ username: '', email: '', password: '', full_name: '', is_admin: false })

  // Shelves
  const [shelves, setShelves] = useState<any[]>([])
  const [loadingShelves, setLoadingShelves] = useState(false)
  const [showAddShelf, setShowAddShelf] = useState(false)
  const [shelfForm, setShelfForm] = useState({ name: '', color: '#22c55e' })
  const [savingShelf, setSavingShelf] = useState(false)
  const [editingShelf, setEditingShelf] = useState<number | null>(null)
  const [editShelfForm, setEditShelfForm] = useState({ name: '', color: '' })
  const [hoverCardEnabled, setHoverCardEnabledState] = useState(getHoverCardEnabled())

  // AI (Yapay Zeka) ayarları
  const [aiProvider, setAiProvider] = useState('local')
  const [aiModel, setAiModel] = useState('')
  const [aiKey, setAiKey] = useState('')
  const [aiHasKey, setAiHasKey] = useState(false)
  const [aiKeyMasked, setAiKeyMasked] = useState('')
  const [aiSaving, setAiSaving] = useState(false)
  const [aiTesting, setAiTesting] = useState(false)

  useEffect(() => {
    api.settings.getAI().then((s) => {
      setAiProvider(s.provider)
      setAiModel(s.model)
      setAiHasKey(s.has_key)
      setAiKeyMasked(s.key_masked)
    }).catch(() => {})
  }, [])

  const saveAI = async (override?: { provider?: string; api_key?: string }) => {
    setAiSaving(true)
    try {
      const payload: { provider?: string; model?: string; api_key?: string } = {
        provider: override?.provider ?? aiProvider,
        model: aiModel,
      }
      if (override?.api_key !== undefined) payload.api_key = override.api_key
      else if (aiKey.trim()) payload.api_key = aiKey.trim()

      const updated = await api.settings.updateAI(payload)
      setAiProvider(updated.provider)
      setAiModel(updated.model)
      setAiHasKey(updated.has_key)
      setAiKeyMasked(updated.key_masked)
      setAiKey('')
      toast({ title: 'AI ayarları kaydedildi', description: updated.provider === 'claude' ? 'Claude API kullanılacak.' : 'Yerel model kullanılacak.' })
    } catch (err: any) {
      toast({ title: 'Hata', description: err.message, variant: 'destructive' })
    } finally {
      setAiSaving(false)
    }
  }

  const clearAIKey = async () => {
    setAiSaving(true)
    try {
      const updated = await api.settings.updateAI({ provider: 'local', api_key: '' })
      setAiProvider(updated.provider)
      setAiModel(updated.model)
      setAiHasKey(updated.has_key)
      setAiKeyMasked(updated.key_masked)
      setAiKey('')
      toast({ title: 'API anahtarı silindi', description: 'Yerel model kullanılacak.' })
    } catch (err: any) {
      toast({ title: 'Hata', description: err.message, variant: 'destructive' })
    } finally {
      setAiSaving(false)
    }
  }

  const testAI = async () => {
    if (!aiKey.trim() && !aiHasKey) {
      toast({ title: 'API anahtarı gerekli', description: 'Önce bir Claude API anahtarı girin.', variant: 'destructive' })
      return
    }
    setAiTesting(true)
    try {
      const res = await api.settings.testAI({ api_key: aiKey.trim() || undefined, model: aiModel || undefined })
      toast({ title: 'Bağlantı başarılı', description: `Model: ${res.model} — "${res.reply}"` })
    } catch (err: any) {
      toast({ title: 'Bağlantı başarısız', description: err.message, variant: 'destructive' })
    } finally {
      setAiTesting(false)
    }
  }

  useEffect(() => {
    if (user?.is_admin) {
      setLoadingUsers(true)
      api.users.list().then(setUsers).catch(() => {}).finally(() => setLoadingUsers(false))
    }
  }, [user])

  useEffect(() => {
    setLoadingShelves(true)
    api.shelves.list().then(setShelves).catch(() => {}).finally(() => setLoadingShelves(false))
  }, [])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.username || !form.email || !form.password) return
    setSaving(true)
    try {
      const newUser = await api.users.create(form)
      setUsers((prev) => [newUser, ...prev])
      setShowAdd(false)
      setForm({ username: '', email: '', password: '', full_name: '', is_admin: false })
      toast({ title: 'Kullanıcı oluşturuldu', description: `${newUser.username} başarıyla eklendi.` })
    } catch (err: any) {
      toast({ title: 'Hata', description: err.message, variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  const toggleAdmin = async (u: any) => {
    try {
      const updated = await api.users.update(u.id, { is_admin: !u.is_admin })
      setUsers((prev) => prev.map((x) => (x.id === u.id ? updated : x)))
      toast({ title: updated.is_admin ? 'Admin yapıldı' : 'Admin yetkisi alındı' })
    } catch (err: any) {
      toast({ title: 'Hata', description: err.message, variant: 'destructive' })
    }
  }

  const toggleActive = async (u: any) => {
    try {
      const updated = await api.users.update(u.id, { is_active: !u.is_active })
      setUsers((prev) => prev.map((x) => (x.id === u.id ? updated : x)))
      toast({ title: updated.is_active ? 'Hesap aktifleştirildi' : 'Hesap devre dışı bırakıldı' })
    } catch (err: any) {
      toast({ title: 'Hata', description: err.message, variant: 'destructive' })
    }
  }

  const createShelf = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!shelfForm.name.trim()) return
    setSavingShelf(true)
    try {
      const s = await api.shelves.create(shelfForm)
      setShelves((prev) => [...prev, s])
      setShowAddShelf(false)
      setShelfForm({ name: '', color: '#22c55e' })
      toast({ title: 'Raf oluşturuldu', description: `"${s.name}" rafı eklendi.` })
    } catch (err: any) {
      toast({ title: 'Hata', description: err.message, variant: 'destructive' })
    } finally {
      setSavingShelf(false)
    }
  }

  const updateShelf = async (id: number) => {
    if (!editShelfForm.name.trim()) return
    try {
      const s = await api.shelves.update(id, editShelfForm)
      setShelves((prev) => prev.map((x) => (x.id === id ? s : x)))
      setEditingShelf(null)
      toast({ title: 'Raf güncellendi' })
    } catch (err: any) {
      toast({ title: 'Hata', description: err.message, variant: 'destructive' })
    }
  }

  const deleteShelf = async (id: number, name: string) => {
    if (!confirm(`"${name}" rafını silmek istediğinize emin misiniz?`)) return
    try {
      await api.shelves.delete(id)
      setShelves((prev) => prev.filter((x) => x.id !== id))
      toast({ title: 'Raf silindi' })
    } catch (err: any) {
      toast({ title: 'Hata', description: err.message, variant: 'destructive' })
    }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-2xl font-bold">Ayarlar</h1>

      {/* Profile */}
      <div className="rounded-lg border border-border bg-card p-6 space-y-4">
        <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Profil Bilgileri</h2>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-muted-foreground">Kullanıcı Adı</label>
            <p className="text-sm font-medium">{user?.username}</p>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Ad Soyad</label>
            <p className="text-sm font-medium">{user?.full_name || '—'}</p>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Rol</label>
            <p className="text-sm font-medium">{user?.is_admin ? 'Admin' : 'Kullanıcı'}</p>
          </div>
        </div>
      </div>

      {/* AI / Yapay Zeka */}
      <div className="rounded-lg border border-border bg-card p-6 space-y-4">
        <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-2">
          <Bot className="h-4 w-4 text-primary" />
          Yapay Zeka
        </h2>
        <p className="text-xs text-muted-foreground">
          Çeviri, OCR, özetleme, sohbet ve münazara görevleri için kullanılacak model.
          Varsayılan olarak <span className="font-medium text-foreground">yerel model</span> kullanılır.
          Kendi Claude API anahtarınızı girerseniz işlemler Claude (Haiku) ile daha hızlı ve doğru yapılır.
        </p>

        <div className="flex gap-2">
          {[
            { value: 'local', label: 'Yerel Model', icon: Library, desc: 'Ücretsiz, çevrimdışı' },
            { value: 'claude', label: 'Claude API', icon: Sparkles, desc: 'Kendi anahtarınız' },
          ].map((p) => (
            <button
              key={p.value}
              onClick={() => setAiProvider(p.value as any)}
              className={`flex-1 flex flex-col items-center justify-center gap-1 rounded-lg border px-3 py-3 text-sm transition-colors ${
                aiProvider === p.value
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border bg-background text-foreground hover:bg-accent'
              }`}
            >
              <p.icon className="h-4 w-4" />
              <span className="font-medium">{p.label}</span>
              <span className="text-[10px] text-muted-foreground">{p.desc}</span>
            </button>
          ))}
        </div>

        {aiProvider === 'claude' && (
          <div className="space-y-3 rounded-lg border border-border bg-muted/30 p-4">
            <div className="space-y-1">
              <Label className="text-xs flex items-center gap-1.5">
                <KeyRound className="h-3.5 w-3.5" />
                Claude API Anahtarı
              </Label>
              <Input
                type="password"
                value={aiKey}
                onChange={(e) => setAiKey(e.target.value)}
                placeholder={aiHasKey ? `Kayıtlı: ${aiKeyMasked} (değiştirmek için yeni anahtar girin)` : 'sk-ant-...'}
                autoComplete="off"
              />
              <p className="text-[11px] text-muted-foreground">
                Anahtar sunucuda şifrelenerek saklanır.{' '}
                <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noreferrer" className="text-primary underline">
                  API anahtarı al
                </a>
              </p>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Model</Label>
              <Input
                value={aiModel}
                onChange={(e) => setAiModel(e.target.value)}
                placeholder="claude-3-5-haiku-latest"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={testAI} disabled={aiTesting || (!aiKey.trim() && !aiHasKey)}>
                {aiTesting ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Sparkles className="h-4 w-4 mr-1" />}
                Bağlantıyı Test Et
              </Button>
              {aiHasKey && (
                <Button size="sm" variant="outline" onClick={clearAIKey} disabled={aiSaving} className="text-destructive border-destructive/40 hover:bg-destructive/10">
                  <Trash2 className="h-4 w-4 mr-1" />
                  Anahtarı Sil
                </Button>
              )}
            </div>
          </div>
        )}

        <div className="flex justify-end">
          <Button size="sm" onClick={() => saveAI()} disabled={aiSaving}>
            {aiSaving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Check className="h-4 w-4 mr-1" />}
            Kaydet
          </Button>
        </div>
      </div>

      {/* Theme */}
      <div className="rounded-lg border border-border bg-card p-6 space-y-3">
        <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-2">
          <Sun className="h-4 w-4 text-primary" />
          Tema
        </h2>
        <p className="text-xs text-muted-foreground">Uygulama görünümü. Sistem seçeneği işletim sistemi ayarını takip eder.</p>
        <div className="flex gap-2">
          {[
            { value: 'light', label: 'Açık', icon: Sun },
            { value: 'dark', label: 'Koyu', icon: Moon },
            { value: 'system', label: 'Sistem', icon: Monitor },
          ].map((t) => (
            <button
              key={t.value}
              onClick={() => setTheme(t.value as any)}
              className={`flex-1 flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors ${
                theme === t.value
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border bg-background text-foreground hover:bg-accent'
              }`}
            >
              <t.icon className="h-4 w-4" />
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Default Sort */}
      <div className="rounded-lg border border-border bg-card p-6 space-y-3">
        <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-2">
          <ArrowUpDown className="h-4 w-4 text-primary" />
          Varsayılan Sıralama
        </h2>
        <p className="text-xs text-muted-foreground">Kitap listesinde varsayılan sıralama düzeni.</p>
        <select
          value={getDefaultSort()}
          onChange={(e) => setDefaultSort(e.target.value)}
          className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
        >
          {SORT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      {/* Hover Card */}
      <div className="rounded-lg border border-border bg-card p-6 space-y-3">
        <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-2">
          <MousePointer2 className="h-4 w-4 text-primary" />
          Hover Detay Kartı
        </h2>
        <p className="text-xs text-muted-foreground">Kitap kartı üzerinde 2 saniye bekleyince detay bilgilerini gösterir.</p>
        <label className="inline-flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={hoverCardEnabled}
            onChange={(e) => {
              const enabled = e.target.checked
              setHoverCardEnabled(enabled)
              setHoverCardEnabledState(enabled)
            }}
            className="rounded"
          />
          <span className="text-sm">Aktif</span>
        </label>
      </div>

      {/* Shelves */}
      <div className="rounded-lg border border-border bg-card">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Library className="h-4 w-4 text-primary" />
            Raflarım
          </CardTitle>
          <Button size="sm" onClick={() => setShowAddShelf(true)}>
            <Plus className="h-4 w-4 mr-1" />
            Yeni Raf
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {showAddShelf && (
            <form onSubmit={createShelf} className="rounded-lg border border-border bg-muted/30 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Yeni Raf</span>
                <button type="button" onClick={() => setShowAddShelf(false)} className="text-muted-foreground hover:text-foreground">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Raf Adı</Label>
                <Input value={shelfForm.name} onChange={(e) => setShelfForm({ ...shelfForm, name: e.target.value })} placeholder="Örn: Roman, Tarih, Bilim" autoFocus />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Renk</Label>
                <div className="flex gap-2 flex-wrap">
                  {COLORS.map((c) => (
                    <button key={c} type="button" onClick={() => setShelfForm({ ...shelfForm, color: c })}
                      className={`h-7 w-7 rounded-full border-2 transition-all ${shelfForm.color === c ? 'border-white scale-110 ring-2 ring-primary' : 'border-transparent'}`}
                      style={{ backgroundColor: c }} />
                  ))}
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setShowAddShelf(false)}>İptal</Button>
                <Button type="submit" size="sm" disabled={savingShelf || !shelfForm.name.trim()}>
                  {savingShelf ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Oluştur
                </Button>
              </div>
            </form>
          )}

          {loadingShelves ? (
            <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : shelves.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Henüz raf oluşturmadınız.</p>
          ) : (
            <div className="space-y-1">
              {shelves.map((s) => (
                <div key={s.id} className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-accent/50 transition-colors group">
                  {editingShelf === s.id ? (
                    <div className="flex-1 flex items-center gap-2">
                      <div className="flex gap-1 flex-wrap">
                        {COLORS.map((c) => (
                          <button key={c} type="button" onClick={() => setEditShelfForm({ ...editShelfForm, color: c })}
                            className={`h-5 w-5 rounded-full border-2 ${editShelfForm.color === c ? 'border-white ring-2 ring-primary' : 'border-transparent'}`}
                            style={{ backgroundColor: c }} />
                        ))}
                      </div>
                      <Input value={editShelfForm.name} onChange={(e) => setEditShelfForm({ ...editShelfForm, name: e.target.value })}
                        className="h-8 text-sm flex-1" autoFocus />
                      <Button size="sm" variant="ghost" onClick={() => updateShelf(s.id)}><Check className="h-4 w-4" /></Button>
                      <Button size="sm" variant="ghost" onClick={() => setEditingShelf(null)}><X className="h-4 w-4" /></Button>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="h-7 w-7 rounded-lg flex-shrink-0" style={{ backgroundColor: s.color || '#64748b' }} />
                        <div className="min-w-0">
                          <p className="text-sm font-medium">{s.name}</p>
                          <p className="text-xs text-muted-foreground">{s.book_count} kitap</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => { setEditingShelf(s.id); setEditShelfForm({ name: s.name, color: s.color || '#64748b' }) }}
                          className="p-1 text-muted-foreground hover:text-foreground" title="Düzenle">
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button onClick={() => deleteShelf(s.id, s.name)}
                          className="p-1 text-muted-foreground hover:text-destructive" title="Sil">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </div>

      {/* Admin Panel */}
      {user?.is_admin && (
        <div className="rounded-lg border border-border bg-card">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <Shield className="h-4 w-4 text-primary" />
              Admin Paneli
            </CardTitle>
            <Button size="sm" onClick={() => setShowAdd(!showAdd)}>
              <Plus className="h-4 w-4 mr-1" />
              Yeni Kullanıcı
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Cover Migration */}
            <div className="rounded-lg border border-border bg-muted/30 p-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Kapak Görsellerini Sunucuya Taşı</p>
                <p className="text-xs text-muted-foreground">Dış kaynaklardaki tüm kitap kapaklarını yerel sunucuya indirir</p>
              </div>
              <Button size="sm" variant="outline" onClick={async () => {
                try {
                  const res = await api.covers.migrate()
                  toast({ title: 'Taşıma tamamlandı', description: `${res.migrated} kapak taşındı, ${res.total} kapak işlendi` })
                } catch (err: any) {
                  toast({ title: 'Hata', description: err.message, variant: 'destructive' })
                }
              }}>
                <Download className="h-4 w-4 mr-1" /> Taşı
              </Button>
            </div>

            {/* Database Backup */}
            <div className="rounded-lg border border-border bg-muted/30 p-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Veritabanı Yedeği Al</p>
                <p className="text-xs text-muted-foreground">Tüm veritabanını (.sql formatında) bilgisayarınıza indirir</p>
              </div>
              <Button size="sm" variant="outline" disabled={isBackingUp} onClick={async () => {
                setIsBackingUp(true)
                toast({ title: 'Yedekleme Hazırlanıyor', description: 'Veritabanı boyutuna göre bu işlem biraz sürebilir, lütfen bekleyin...' })
                try {
                  const blob = await api.system.downloadBackup()
                  const url = window.URL.createObjectURL(blob)
                  const a = document.createElement('a')
                  a.href = url
                  
                  const date = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19)
                  a.download = `kutuphane_backup_${date}.sql`
                  
                  document.body.appendChild(a)
                  a.click()
                  document.body.removeChild(a)
                  window.URL.revokeObjectURL(url)
                  
                  toast({ title: 'Yedekleme Başarılı', description: 'Yedek dosyası indirilmeye başlandı.' })
                } catch (err: any) {
                  toast({ title: 'Hata', description: err.message, variant: 'destructive' })
                } finally {
                  setIsBackingUp(false)
                }
              }}>
                {isBackingUp ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Download className="h-4 w-4 mr-1" />}
                {isBackingUp ? 'Hazırlanıyor...' : 'Yedek İndir'}
              </Button>
            </div>
            
            {showAdd && (
              <form onSubmit={handleCreate} className="rounded-lg border border-border bg-muted/30 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Yeni Kullanıcı Oluştur</span>
                  <button type="button" onClick={() => setShowAdd(false)} className="text-muted-foreground hover:text-foreground">
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Kullanıcı Adı *</Label>
                    <Input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} required />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Ad Soyad</Label>
                    <Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">E-posta *</Label>
                    <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Şifre *</Label>
                    <Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />
                  </div>
                </div>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="checkbox" checked={form.is_admin} onChange={(e) => setForm({ ...form, is_admin: e.target.checked })} />
                  Admin yetkisi ver
                </label>
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => setShowAdd(false)}>İptal</Button>
                  <Button type="submit" size="sm" disabled={saving}>
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    Oluştur
                  </Button>
                </div>
              </form>
            )}

            {loadingUsers ? (
              <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
            ) : (
              <div className="space-y-1">
                {users.map((u) => (
                  <div key={u.id} className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-accent/50 transition-colors">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="h-7 w-7 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary flex-shrink-0">
                        {u.username.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{u.full_name || u.username}</p>
                        <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {u.is_admin ? (
                        <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded">Admin</span>
                      ) : (
                        <span className="text-xs text-muted-foreground">Kullanıcı</span>
                      )}
                      {u.id !== user?.id && (
                        <div className="flex gap-1">
                          <button
                            onClick={() => toggleAdmin(u)}
                            className="text-xs text-muted-foreground hover:text-foreground underline"
                            title={u.is_admin ? 'Admin yetkisini al' : 'Admin yap'}
                          >
                            {u.is_admin ? 'Yetki Al' : 'Admin Yap'}
                          </button>
                          <button
                            onClick={() => toggleActive(u)}
                            className={`text-xs underline ${u.is_active ? 'text-muted-foreground hover:text-destructive' : 'text-green-500'}`}
                            title={u.is_active ? 'Devre dışı bırak' : 'Aktifleştir'}
                          >
                            {u.is_active ? 'Devre Dışı' : 'Aktifleştir'}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </div>
      )}
    </div>
  )
}
