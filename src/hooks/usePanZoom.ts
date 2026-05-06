import { useCallback, useEffect, useRef, useState } from 'react'

export interface PanZoomState {
  scale: number
  tx: number
  ty: number
}

interface PointerInfo {
  id: number
  x: number
  y: number
}

const MIN_SCALE = 1
const MAX_SCALE = 4
const TAP_MOVE_THRESHOLD = 8 // px
const TAP_TIME_THRESHOLD = 350 // ms

export interface TapEvent {
  // viewport coordinates
  clientX: number
  clientY: number
  // image-space coordinates (0–1) within the rendered image rect
  imageX: number
  imageY: number
}

export function usePanZoom(opts: {
  onTap?: (e: TapEvent) => void
}) {
  const { onTap } = opts
  const containerRef = useRef<HTMLDivElement | null>(null)
  const imageRef = useRef<HTMLDivElement | null>(null)
  const [state, setState] = useState<PanZoomState>({ scale: 1, tx: 0, ty: 0 })
  const stateRef = useRef(state)
  stateRef.current = state

  const pointersRef = useRef<Map<number, PointerInfo>>(new Map())
  const dragRef = useRef<{
    startX: number
    startY: number
    startTx: number
    startTy: number
    moved: boolean
    startedAt: number
  } | null>(null)
  const pinchRef = useRef<{ startDist: number; startScale: number } | null>(null)

  const clampPan = useCallback((scale: number, tx: number, ty: number) => {
    const container = containerRef.current
    const image = imageRef.current
    if (!container || !image) return { tx, ty }
    const cw = container.clientWidth
    const ch = container.clientHeight
    const iw = image.clientWidth * scale
    const ih = image.clientHeight * scale
    const maxX = Math.max(0, (iw - cw) / 2)
    const maxY = Math.max(0, (ih - ch) / 2)
    return {
      tx: Math.max(-maxX, Math.min(maxX, tx)),
      ty: Math.max(-maxY, Math.min(maxY, ty)),
    }
  }, [])

  const setClamped = useCallback(
    (next: PanZoomState) => {
      const { tx, ty } = clampPan(next.scale, next.tx, next.ty)
      setState({ scale: next.scale, tx, ty })
    },
    [clampPan],
  )

  const screenToImage = useCallback((clientX: number, clientY: number) => {
    const image = imageRef.current
    if (!image) return null
    const rect = image.getBoundingClientRect()
    if (rect.width === 0 || rect.height === 0) return null
    const ix = (clientX - rect.left) / rect.width
    const iy = (clientY - rect.top) / rect.height
    if (ix < 0 || ix > 1 || iy < 0 || iy > 1) return null
    return { imageX: ix, imageY: iy }
  }, [])

  const onPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    ;(e.target as Element).setPointerCapture?.(e.pointerId)
    pointersRef.current.set(e.pointerId, { id: e.pointerId, x: e.clientX, y: e.clientY })

    if (pointersRef.current.size === 1) {
      dragRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        startTx: stateRef.current.tx,
        startTy: stateRef.current.ty,
        moved: false,
        startedAt: performance.now(),
      }
    } else if (pointersRef.current.size === 2) {
      const pts = Array.from(pointersRef.current.values())
      if (pts[0] && pts[1]) {
        const dx = pts[0].x - pts[1].x
        const dy = pts[0].y - pts[1].y
        pinchRef.current = {
          startDist: Math.hypot(dx, dy),
          startScale: stateRef.current.scale,
        }
      }
      dragRef.current = null
    }
  }, [])

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const ptr = pointersRef.current.get(e.pointerId)
      if (!ptr) return
      ptr.x = e.clientX
      ptr.y = e.clientY

      if (pointersRef.current.size === 2 && pinchRef.current) {
        const pts = Array.from(pointersRef.current.values())
        if (pts[0] && pts[1]) {
          const dx = pts[0].x - pts[1].x
          const dy = pts[0].y - pts[1].y
          const dist = Math.hypot(dx, dy)
          const ratio = dist / pinchRef.current.startDist
          const nextScale = Math.max(
            MIN_SCALE,
            Math.min(MAX_SCALE, pinchRef.current.startScale * ratio),
          )
          setClamped({ scale: nextScale, tx: stateRef.current.tx, ty: stateRef.current.ty })
        }
        return
      }

      if (pointersRef.current.size === 1 && dragRef.current) {
        const drag = dragRef.current
        const dx = e.clientX - drag.startX
        const dy = e.clientY - drag.startY
        if (Math.hypot(dx, dy) > TAP_MOVE_THRESHOLD) drag.moved = true
        setClamped({
          scale: stateRef.current.scale,
          tx: drag.startTx + dx,
          ty: drag.startTy + dy,
        })
      }
    },
    [setClamped],
  )

  const onPointerUp = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const drag = dragRef.current
      const wasSinglePointer = pointersRef.current.size === 1
      pointersRef.current.delete(e.pointerId)
      if (pointersRef.current.size < 2) pinchRef.current = null

      if (
        wasSinglePointer &&
        drag &&
        !drag.moved &&
        performance.now() - drag.startedAt < TAP_TIME_THRESHOLD &&
        onTap
      ) {
        const img = screenToImage(e.clientX, e.clientY)
        if (img) {
          onTap({
            clientX: e.clientX,
            clientY: e.clientY,
            imageX: img.imageX,
            imageY: img.imageY,
          })
        }
      }
      dragRef.current = null
    },
    [onTap, screenToImage],
  )

  // Wheel zoom (desktop)
  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    function onWheel(ev: WheelEvent) {
      ev.preventDefault()
      const factor = Math.exp(-ev.deltaY * 0.002)
      const nextScale = Math.max(
        MIN_SCALE,
        Math.min(MAX_SCALE, stateRef.current.scale * factor),
      )
      setClamped({ scale: nextScale, tx: stateRef.current.tx, ty: stateRef.current.ty })
    }
    container.addEventListener('wheel', onWheel, { passive: false })
    return () => container.removeEventListener('wheel', onWheel)
  }, [setClamped])

  return {
    containerRef,
    imageRef,
    state,
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel: onPointerUp,
    },
    screenToImage,
  }
}
