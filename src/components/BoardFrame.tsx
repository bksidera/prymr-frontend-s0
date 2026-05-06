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
  let frameW = 0
  let frameH = 0
  if (naturalRatio && viewport.w > 0 && viewport.h > 0) {
    const viewportRatio = viewport.w / viewport.h
    if (viewportRatio > naturalRatio) {
      frameH = viewport.h
      frameW = viewport.h * naturalRatio
    } else {
      frameW = viewport.w
      frameH = viewport.w / naturalRatio
    }
  }

  return (
    <div
      ref={containerRef}
      {...handlers}
      className="absolute inset-0 overflow-hidden bg-black flex items-center justify-center select-none"
      style={{ touchAction: 'none' }}
    >
      {frameW > 0 && (
        <div
          ref={imageRef}
          className="relative"
          style={{
            width: frameW,
            height: frameH,
            // `transform` is set imperatively by usePanZoom on each frame.
            // Don't manage it via React state here or the two will fight.
            transformOrigin: 'center center',
            willChange: 'transform',
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
