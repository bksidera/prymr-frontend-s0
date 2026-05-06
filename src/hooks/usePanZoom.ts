import { useCallback, useEffect, useRef, useState } from 'react'

export interface PanZoomState {
  scale: number
  tx: number
  ty: number
}

export interface TapEvent {
  clientX: number
  clientY: number
  imageX: number // 0–1 within the rendered image
  imageY: number
}

const MIN_SCALE = 1
const MAX_SCALE = 5
const TAP_MOVE_THRESHOLD = 8 // px
const TAP_TIME_THRESHOLD = 300 // ms

// Velocity damping: e^(-dt / TIME_CONSTANT) per ms.
// ~250ms feels like Google Maps / iOS scroll inertia.
const MOMENTUM_TIME_CONSTANT_MS = 250
const MOMENTUM_STOP_SPEED = 0.02 // px/ms; below this, kill momentum
// Smoothing for the velocity estimator during drag.
const VELOCITY_SMOOTHING = 0.25
// Wheel: smaller = less sensitive. 0.0015 ≈ Google Maps trackpad feel.
const WHEEL_ZOOM_SENSITIVITY = 0.0015
// Debounce React-state commit after wheel events stop.
const WHEEL_COMMIT_DEBOUNCE_MS = 120

interface PointerPos {
  x: number
  y: number
}

interface DragState {
  startTx: number
  startTy: number
  startX: number
  startY: number
  lastX: number
  lastY: number
  lastT: number
  vx: number // px/ms
  vy: number
  startedAt: number
  moved: boolean
}

interface PinchState {
  startDist: number
  startScale: number
}

/**
 * Imperative pan/zoom hook. The transform on `imageRef` is updated via direct
 * DOM mutation in a ref-driven loop — React state is committed only at gesture
 * settle so the 60fps gesture path doesn't trigger re-renders. Children that
 * need scale (e.g. counter-scaled pins) read from the committed state and lag
 * by one gesture, which is acceptable: pins move with the image during a
 * gesture and snap to correct counter-scale on release.
 *
 * Math: transform-origin is `center center` on the image element. With the
 * image centered in the container at `tx=ty=0, scale=1`, a point at screen
 * (sx, sy) maps to image-local (relative to image center):
 *
 *   (dx, dy) = ((sx - cx - tx)/scale, (sy - cy - ty)/scale)
 *
 * where (cx, cy) = container center. Zooming toward a screen anchor (ax, ay)
 * means choosing newTx, newTy so the same image-local point under the anchor
 * stays under the anchor:
 *
 *   newTx = (ax - cx) * (1 - f) + tx * f      where f = newScale / scale
 *   newTy = (ay - cy) * (1 - f) + ty * f
 */
export function usePanZoom(opts: { onTap?: (e: TapEvent) => void }) {
  const { onTap } = opts
  const containerRef = useRef<HTMLDivElement | null>(null)
  const imageRef = useRef<HTMLDivElement | null>(null)

  // Hot state — never triggers re-render, mutated at 60fps.
  const stateRef = useRef<PanZoomState>({ scale: 1, tx: 0, ty: 0 })
  // Cold state — flushed at gesture-settle for child re-renders.
  const [committed, setCommitted] = useState<PanZoomState>({ scale: 1, tx: 0, ty: 0 })

  const pointersRef = useRef<Map<number, PointerPos>>(new Map())
  const dragRef = useRef<DragState | null>(null)
  const pinchRef = useRef<PinchState | null>(null)
  const momentumRafRef = useRef<number | null>(null)
  const wheelCommitRef = useRef<number | null>(null)

  // ----- Geometry helpers -----

  const containerCenter = useCallback(() => {
    const c = containerRef.current
    if (!c) return { x: 0, y: 0 }
    const r = c.getBoundingClientRect()
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 }
  }, [])

  const clampPan = useCallback((scale: number, tx: number, ty: number) => {
    const container = containerRef.current
    const image = imageRef.current
    if (!container || !image) return { tx, ty, clampedX: false, clampedY: false }
    const cw = container.clientWidth
    const ch = container.clientHeight
    const iw = image.clientWidth * scale
    const ih = image.clientHeight * scale
    const maxX = Math.max(0, (iw - cw) / 2)
    const maxY = Math.max(0, (ih - ch) / 2)
    const ctx = Math.max(-maxX, Math.min(maxX, tx))
    const cty = Math.max(-maxY, Math.min(maxY, ty))
    return {
      tx: ctx,
      ty: cty,
      clampedX: ctx !== tx,
      clampedY: cty !== ty,
    }
  }, [])

  const applyTransform = useCallback(() => {
    const el = imageRef.current
    if (!el) return
    const { scale, tx, ty } = stateRef.current
    el.style.transform = `translate3d(${tx}px, ${ty}px, 0) scale(${scale})`
  }, [])

  /** Update hot state + DOM. Returns whether a clamp was hit (per axis). */
  const setLive = useCallback(
    (scale: number, tx: number, ty: number) => {
      const clamped = clampPan(scale, tx, ty)
      stateRef.current = { scale, tx: clamped.tx, ty: clamped.ty }
      applyTransform()
      return clamped
    },
    [clampPan, applyTransform],
  )

  const commit = useCallback(() => {
    setCommitted({ ...stateRef.current })
  }, [])

  /** Zoom toward a screen-space anchor point, preserving the image-local
   * point under that anchor. Used by both pinch and wheel. */
  const zoomToward = useCallback(
    (anchorX: number, anchorY: number, requestedScale: number) => {
      const newScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, requestedScale))
      const center = containerCenter()
      const kx = anchorX - center.x
      const ky = anchorY - center.y
      const { scale, tx, ty } = stateRef.current
      if (newScale === scale) {
        setLive(scale, tx, ty)
        return
      }
      const f = newScale / scale
      const newTx = kx * (1 - f) + tx * f
      const newTy = ky * (1 - f) + ty * f
      setLive(newScale, newTx, newTy)
    },
    [containerCenter, setLive],
  )

  // ----- Image-space coordinate helper -----

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

  // ----- Momentum -----

  const stopMomentum = useCallback(() => {
    if (momentumRafRef.current !== null) {
      cancelAnimationFrame(momentumRafRef.current)
      momentumRafRef.current = null
    }
  }, [])

  const startMomentum = useCallback(
    (vx0: number, vy0: number) => {
      stopMomentum()
      let vx = vx0
      let vy = vy0
      let lastT = performance.now()

      const step = (now: number) => {
        const dt = Math.min(50, now - lastT) // cap dt to avoid jumps after tab-switch
        lastT = now

        const { scale, tx, ty } = stateRef.current
        const requestedTx = tx + vx * dt
        const requestedTy = ty + vy * dt
        const result = setLive(scale, requestedTx, requestedTy)

        // If we hit a clamp on an axis, kill velocity on that axis (no bounce).
        if (result.clampedX) vx = 0
        if (result.clampedY) vy = 0

        // Exponential decay.
        const decay = Math.exp(-dt / MOMENTUM_TIME_CONSTANT_MS)
        vx *= decay
        vy *= decay

        if (Math.hypot(vx, vy) < MOMENTUM_STOP_SPEED) {
          momentumRafRef.current = null
          commit()
          return
        }
        momentumRafRef.current = requestAnimationFrame(step)
      }
      momentumRafRef.current = requestAnimationFrame(step)
    },
    [setLive, stopMomentum, commit],
  )

  // ----- Pointer handlers -----

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      ;(e.target as Element).setPointerCapture?.(e.pointerId)
      stopMomentum()
      pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY })

      if (pointersRef.current.size === 1) {
        const now = performance.now()
        dragRef.current = {
          startTx: stateRef.current.tx,
          startTy: stateRef.current.ty,
          startX: e.clientX,
          startY: e.clientY,
          lastX: e.clientX,
          lastY: e.clientY,
          lastT: now,
          vx: 0,
          vy: 0,
          startedAt: now,
          moved: false,
        }
      } else if (pointersRef.current.size === 2) {
        const pts = Array.from(pointersRef.current.values())
        const [a, b] = pts
        if (a && b) {
          pinchRef.current = {
            startDist: Math.hypot(a.x - b.x, a.y - b.y),
            startScale: stateRef.current.scale,
          }
        }
        // Pinching cancels any pending tap/drag intent.
        dragRef.current = null
      }
    },
    [stopMomentum],
  )

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const ptr = pointersRef.current.get(e.pointerId)
    if (!ptr) return
    ptr.x = e.clientX
    ptr.y = e.clientY

    // Two-finger pinch: zoom toward the live midpoint, every frame.
    if (pointersRef.current.size === 2 && pinchRef.current) {
      const pts = Array.from(pointersRef.current.values())
      const [a, b] = pts
      if (!a || !b) return
      const dist = Math.hypot(a.x - b.x, a.y - b.y)
      const midX = (a.x + b.x) / 2
      const midY = (a.y + b.y) / 2
      const newScale =
        pinchRef.current.startScale * (dist / pinchRef.current.startDist)
      zoomToward(midX, midY, newScale)
      return
    }

    // Single-finger drag.
    const drag = dragRef.current
    if (pointersRef.current.size === 1 && drag) {
      const dx = e.clientX - drag.startX
      const dy = e.clientY - drag.startY
      if (Math.hypot(dx, dy) > TAP_MOVE_THRESHOLD) drag.moved = true

      // Velocity estimator: exponential moving average of instantaneous velocity.
      const now = performance.now()
      const dt = Math.max(1, now - drag.lastT)
      const instVx = (e.clientX - drag.lastX) / dt
      const instVy = (e.clientY - drag.lastY) / dt
      drag.vx = drag.vx * (1 - VELOCITY_SMOOTHING) + instVx * VELOCITY_SMOOTHING
      drag.vy = drag.vy * (1 - VELOCITY_SMOOTHING) + instVy * VELOCITY_SMOOTHING
      drag.lastX = e.clientX
      drag.lastY = e.clientY
      drag.lastT = now

      setLive(stateRef.current.scale, drag.startTx + dx, drag.startTy + dy)
    }
  }, [zoomToward, setLive])

  const onPointerUp = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const drag = dragRef.current
      const sizeBefore = pointersRef.current.size
      pointersRef.current.delete(e.pointerId)

      // End of pinch: if one pointer remains, hand off to a fresh drag origin.
      if (pinchRef.current && sizeBefore === 2) {
        pinchRef.current = null
        const remaining = Array.from(pointersRef.current.values())[0]
        if (remaining) {
          const now = performance.now()
          dragRef.current = {
            startTx: stateRef.current.tx,
            startTy: stateRef.current.ty,
            startX: remaining.x,
            startY: remaining.y,
            lastX: remaining.x,
            lastY: remaining.y,
            lastT: now,
            vx: 0,
            vy: 0,
            startedAt: now,
            moved: true, // pinch counts as movement, no tap
          }
        } else {
          commit()
        }
        return
      }

      // Tap detection on single-pointer release.
      if (
        sizeBefore === 1 &&
        drag &&
        !drag.moved &&
        performance.now() - drag.startedAt < TAP_TIME_THRESHOLD
      ) {
        if (onTap) {
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
        commit()
        return
      }

      // End of drag: kick off momentum if velocity is meaningful.
      if (sizeBefore === 1 && drag) {
        const speed = Math.hypot(drag.vx, drag.vy)
        if (speed > MOMENTUM_STOP_SPEED * 4) {
          dragRef.current = null
          startMomentum(drag.vx, drag.vy)
          return
        }
      }

      dragRef.current = null
      commit()
    },
    [commit, onTap, screenToImage, startMomentum],
  )

  // ----- Wheel zoom (toward cursor) -----

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const scheduleWheelCommit = () => {
      if (wheelCommitRef.current !== null) clearTimeout(wheelCommitRef.current)
      wheelCommitRef.current = window.setTimeout(() => {
        wheelCommitRef.current = null
        commit()
      }, WHEEL_COMMIT_DEBOUNCE_MS)
    }

    const onWheel = (ev: WheelEvent) => {
      ev.preventDefault()
      stopMomentum()
      const factor = Math.exp(-ev.deltaY * WHEEL_ZOOM_SENSITIVITY)
      const requestedScale = stateRef.current.scale * factor
      zoomToward(ev.clientX, ev.clientY, requestedScale)
      scheduleWheelCommit()
    }

    container.addEventListener('wheel', onWheel, { passive: false })
    return () => {
      container.removeEventListener('wheel', onWheel)
      if (wheelCommitRef.current !== null) {
        clearTimeout(wheelCommitRef.current)
        wheelCommitRef.current = null
      }
    }
  }, [commit, stopMomentum, zoomToward])

  // Re-apply transform after image element mounts/resizes (otherwise initial
  // render shows scale 1 even if state was rehydrated — not relevant here, but
  // also catches the case where imageRef remounts).
  useEffect(() => {
    applyTransform()
  })

  return {
    containerRef,
    imageRef,
    state: committed,
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel: onPointerUp,
    },
    screenToImage,
  }
}
