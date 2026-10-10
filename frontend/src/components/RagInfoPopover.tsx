import { useState } from 'react'
import { Info, X } from 'lucide-react'

export function RagInfoPopover() {
  const [open, setOpen] = useState(false)

  return (
    <div className="relative inline-block">
      <button
        onClick={() => setOpen(!open)}
        className="text-muted-foreground hover:text-foreground transition-colors"
        title="RAG - Yapay Zeka Destekli Okuma"
      >
        <Info className="h-4 w-4" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-6 z-50 w-72 rounded-lg border border-border bg-card p-4 shadow-lg">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-bold">RAG Nedir?</h3>
              <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              <strong>RAG (Retrieval-Augmented Generation)</strong>, yapay zekanın kitap içeriğini
              tarayarak sorularınıza kaynak göstererek yanıt vermesini sağlayan bir teknolojidir.
              AI Okuma Arkadaşınız, kitapların PDF/EPUB dosyalarını tarar, anlamlı bölümlere ayırır
              ve sorularınıza kitabın kendisinden alıntı yaparak yanıt verir.
            </p>
            <ul className="mt-2 space-y-1">
              <li className="text-xs text-muted-foreground flex items-start gap-1.5">
                <span className="text-primary mt-0.5">📖</span>
                Kitabın tamamını tarar
              </li>
              <li className="text-xs text-muted-foreground flex items-start gap-1.5">
                <span className="text-primary mt-0.5">🎯</span>
                Sorularınıza alakalı bölümleri bulur
              </li>
              <li className="text-xs text-muted-foreground flex items-start gap-1.5">
                <span className="text-primary mt-0.5">🔗</span>
                Kaynak göstererek yanıtlar
              </li>
            </ul>
            <p className="mt-2 text-xs text-muted-foreground">
              Henüz hiçbir kitap RAG için yüklenmedi. Yöneticiniz PDF/EPUB yüklediğinde bu özellik aktif olacaktır.
            </p>
          </div>
        </>
      )}
    </div>
  )
}
