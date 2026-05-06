import { useEffect, useState, type ReactNode } from 'react'
import { usePanZoom, type TapEvent } from '../hooks/usePanZoom'

interface Props {
  imageUrl: string
  onTap?: (e: TapEvent) => void
  overlay?: (state: { scale: number; tx: number; ty: number }) => ReactNode
}

export function BoardFrame({ imageUrl, onTap, overlay }: Props) {
  const { containerRef, imageRef, state, handlers } = usePanZoom({ onTap })
  const [naturalRatio, setNaturalRatio] = useState<number | null>(null)
  const [viewport, setViewport] = useState({ w: 0, h: 0 })

  useEffect(() => {
    const img = new Image()
    img.onload = () => {
      if (img.naturalHeight > 0) setNaturalRatio(img.naturalWidth / img.naturalHeight)
    }
    img.src = imageUrl
  }, [imageUrl])

  useEffect(() => {
    function update() {
      const c = containerRef.current
      if (c) setViewport({ w: c.clientWidth, h: c.clientHeight })
    }
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [containerRef])

  // Compute fit-to-viewport size preserving the image's natural aspect ratio.
  // Leave a small "margin" of breathing room around the image so it feels
  // matted, not edge-to-edge.
  const MARGIN = 0.92 // image fills 92% of its limiting dimension
  let frameW = 0
  let frameH = 0
  if (naturalRatio && viewport.w > 0 && viewport.h > 0) {
    const viewportRatio = viewport.w / viewport.h
    if (viewportRatio > naturalRatio) {
      frameH = viewport.h * MARGIN
      frameW = frameH * naturalRatio
    } else {
      frameW = viewport.w * MARGIN
      frameH = frameW / naturalRatio
    }
  }

  return (
    <div
      ref={containerRef}
      {...handlers}
      className="absolute inset-0 overflow-hidden flex items-center justify-center select-none"
      style={{
        touchAction: 'none',
        // Subtle radial gradient: faint lift around the image, deepening to
        // pure black at the corners. Reads as a gallery spotlight without
        // feeling theatrical.
        background:
          'radial-gradient(ellipse at center, #1c1c1f 0%, #0a0a0b 55%, #000 100%)',
      }}
    >
      {frameW > 0 && (
        <div
          ref={imageRef}
          className="relative ring-1 ring-white/[0.07]"
          style={{
            width: frameW,
            height: frameH,
            // `transform` is set imperatively by usePanZoom on each frame.
            transformOrigin: 'center center',
            willChange: 'transform',
            // Deep, soft drop shadow lifts the image off the surround.
            boxShadow:
              '0 40px 100px -20px rgba(0,0,0,0.95), 0 0 0 1px rgba(255,255,255,0.04)',
          }}
        >
          <img
            src={imageUrl}
            alt=""
            draggable={false}
            className="block w-full h-full object-cover pointer-events-none"
          />
          {overlay?.(state)}
        </div>
      )}
    </div>
  )
}
