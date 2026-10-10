import { useState, useRef, useCallback } from 'react'

interface Position {
  top: number
  left: number
}

type Anchor = 'bottom-left' | 'bottom-right' | 'top-left' | 'top-right'

interface UsePopupPositionOptions {
  /** Default anchor: mouse point corresponds to which popup corner */
  anchor?: Anchor
  /** Minimum distance from viewport edges */
  viewportPadding?: number
}

const ANCHORS: Anchor[] = ['bottom-left', 'bottom-right', 'top-left', 'top-right']

function computePosition(anchor: Anchor, mouseX: number, mouseY: number, width: number, height: number): Position {
  let top = mouseY
  let left = mouseX
  if (anchor.includes('bottom')) top = mouseY - height
  if (anchor.includes('right')) left = mouseX - width
  return { top, left }
}

function isInsideViewport(pos: Position, width: number, height: number, padding: number): boolean {
  return (
    pos.top >= padding &&
    pos.left >= padding &&
    pos.top + height <= window.innerHeight - padding &&
    pos.left + width <= window.innerWidth - padding
  )
}

export function usePopupPosition(options: UsePopupPositionOptions = {}) {
  const { anchor: preferredAnchor = 'bottom-left', viewportPadding = 12 } = options
  const ref = useRef<HTMLDivElement>(null)
  const [position, setPosition] = useState<Position>({ top: 0, left: 0 })

  const updatePosition = useCallback(
    (mouseX: number, mouseY: number) => {
      const el = ref.current
      if (!el) return

      const rect = el.getBoundingClientRect()
      const width = rect.width
      const height = rect.height

      // Try preferred anchor first, then fallback anchors
      const order = [preferredAnchor, ...ANCHORS.filter((a) => a !== preferredAnchor)]
      let bestPos = computePosition(preferredAnchor, mouseX, mouseY, width, height)

      for (const anchor of order) {
        const pos = computePosition(anchor, mouseX, mouseY, width, height)
        if (isInsideViewport(pos, width, height, viewportPadding)) {
          bestPos = pos
          break
        }
      }

      // Final clamp just in case
      bestPos.top = Math.max(viewportPadding, Math.min(bestPos.top, window.innerHeight - height - viewportPadding))
      bestPos.left = Math.max(viewportPadding, Math.min(bestPos.left, window.innerWidth - width - viewportPadding))

      setPosition(bestPos)
    },
    [preferredAnchor, viewportPadding]
  )

  return { ref, position, updatePosition }
}
