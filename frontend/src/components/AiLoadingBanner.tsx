/**
 * AiLoadingBanner.tsx
 * -------------------
 * Model bellekte değilken AI isteği gönderildiğinde gösterilen banner.
 * Kullanıcı başka işlemler yapabilir — sayfa kilitlenmez.
 * 
 * Kullanım:
 *   const { showBanner, triggerAiCall } = useAiBanner()
 *   // AI çağrısından önce:
 *   await triggerAiCall(() => api.chat.sendMessage(...))
 */

import { useState, useCallback, useEffect, useRef } from 'react'
import { api } from '../api/client'

interface BannerState {
  visible: boolean
  phase: 'loading' | 'ready'
  eta: number          // saniye cinsinden tahmini süre
  elapsed: number      // geçen süre
}

// ── Banner bileşeni ─────────────────────────────────────────────────────────
export function AiLoadingBanner({ state }: { state: BannerState }) {
  if (!state.visible) return null

  const remaining = Math.max(0, state.eta - state.elapsed)

  return (
    <div
      className={`
        fixed top-4 left-1/2 -translate-x-1/2 z-50
        flex items-center gap-3 px-5 py-3 rounded-xl shadow-xl
        border backdrop-blur-md text-sm font-medium
        transition-all duration-500 ease-out
        ${state.phase === 'loading'
          ? 'bg-amber-950/90 border-amber-700/60 text-amber-100'
          : 'bg-emerald-950/90 border-emerald-700/60 text-emerald-100'}
      `}
      style={{ animation: 'slideDown 0.3s ease-out' }}
    >
      {state.phase === 'loading' ? (
        <>
          {/* Dönen halka */}
          <span className="relative flex h-4 w-4 shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-4 w-4 bg-amber-500" />
          </span>
          <span>
            🤖 AI modeli arka planda yükleniyor
            {remaining > 0 && (
              <span className="ml-1 text-amber-300">
                — tahmini ~{remaining} sn
              </span>
            )}
          </span>
          {/* İlerleme çubuğu */}
          <div className="absolute bottom-0 left-0 h-0.5 bg-amber-400/60 rounded-b-xl transition-all duration-1000"
            style={{ width: `${Math.min(100, (state.elapsed / state.eta) * 100)}%` }}
          />
        </>
      ) : (
        <>
          <span>✅</span>
          <span>AI modeli hazır — yanıtınız geliyor</span>
        </>
      )}
    </div>
  )
}

// ── Hook: AI çağrısını yönet ─────────────────────────────────────────────────
export function useAiBanner() {
  const [banner, setBanner] = useState<BannerState>({
    visible: false,
    phase: 'loading',
    eta: 10,
    elapsed: 0,
  })
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const elapsedRef = useRef(0)

  const clearTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
  }

  const hideBanner = useCallback(() => {
    clearTimer()
    setBanner(prev => ({ ...prev, visible: false }))
    elapsedRef.current = 0
  }, [])

  /**
   * AI çağrısını banner ile sarar.
   * 1. Status kontrol et.
   * 2. Model yüklenmiyorsa direkt çağır.
   * 3. Model yükleniyorsa banner göster, sonuç gelince gizle.
   */
  const triggerAiCall = useCallback(async <T,>(fn: () => Promise<T>): Promise<T> => {
    // Önce durumu kontrol et
    let needsBanner = false
    try {
      const status = await api.ai.status()
      // Claude (harici API) kullanılıyorsa yerel model yüklemesi beklenmez.
      needsBanner = !status.llm_loaded && status.provider !== 'claude'
    } catch {
      // Status endpoint yoksa banner gösterme
    }

    if (needsBanner) {
      elapsedRef.current = 0
      setBanner({ visible: true, phase: 'loading', eta: 10, elapsed: 0 })
      timerRef.current = setInterval(() => {
        elapsedRef.current += 1
        setBanner(prev => ({ ...prev, elapsed: elapsedRef.current }))
      }, 1000)
    }

    try {
      const result = await fn()
      if (needsBanner) {
        clearTimer()
        setBanner(prev => ({ ...prev, phase: 'ready' }))
        setTimeout(hideBanner, 2000)
      }
      return result
    } catch (e) {
      hideBanner()
      throw e
    }
  }, [hideBanner])

  // Cleanup
  useEffect(() => () => clearTimer(), [])

  return { banner, triggerAiCall }
}
