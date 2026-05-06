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

// Velocity damping: e^(-dt / TIME_CONSTANT) per ms. Higher = longer coast.
// ~450ms gives a "Google Maps flick" feel — the image keeps gliding noticeably
// after release.
const MOMENTUM_TIME_CONSTANT_MS = 450
const MOMENTUM_STOP_SPEED = 0.02 // px/ms; below this, kill momentum
// Smoothing for the velocity estimator during drag.
const VELOCITY_SMOOTHING = 0.25
// Wheel: smaller = less sensitive. 0.0015 ≈ Google Maps trackpad feel.
const WHEEL_ZOOM_SENSITIVITY = 0.0015
// Debounce React-state commit after wheel events stop.
const WHEEL_COMMIT_DEBOUNCE_MS = 120

// Elastic overscroll: allow drag past the hard clamp by up to this many
// pixels with rubber-band resistance, then spring back on release.
const OVERSCROLL_MAX_PX = 28
// Rubber-band stiffness — iOS uses ~0.55. Lower = looser overshoot.
const RUBBER_BAND_C = 0.55
// Spring-back to clamp: exp-decay time constant. ~120ms is snappy.
const SPRING_BACK_TIME_CONSTANT_MS = 120
// Spring-back stops when within this many px of target.
const SPRING_BACK_EPSILON_PX = 0.3

/**
 * iOS-style rubber-band: as overshoot grows, returned offset asymptotically
 * approaches OVERSCROLL_MAX_PX. Linear-ish near zero so first few px feel real.
 */
function rubberBand(overshoot: number): number {
  const max = OVERSCROLL_MAX_PX
  const c = RUBBER_BAND_C
  return max * (1 - 1 / ((overshoot * c) / max + 1))
}

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
  const springBackRafRef = useRef<number | null>(null)
  const wheelCommitRef = useRef<number | null>(null)

  // ----- Geometry helpers -----

  const containerCenter = useCallback(() => {
    const c = containerRef.current
    if (!c) return { x: 0, y: 0 }
    const r = c.getBoundingClientRect()
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 }
  }, [])

  /** Compute the pan bounds for a given scale. Returns the absolute max
   * |tx| and |ty| beyond which there's no real content to reveal. */
  const panBounds = useCallback((scale: number) => {
    const container = containerRef.current
    const image = imageRef.current
    if (!container || !image) return { maxX: 0, maxY: 0 }
    const cw = container.clientWidth
    const ch = container.clientHeight
    const iw = image.clientWidth * scale
    const ih = image.clientHeight * scale
    return {
      maxX: Math.max(0, (iw - cw) / 2),
      maxY: Math.max(0, (ih - ch) / 2),
    }
  }, [])

  /** Hard clamp — used by momentum, wheel, pinch. Snaps to bounds. */
  const hardClampPan = useCallback(
    (scale: number, tx: number, ty: number) => {
      const { maxX, maxY } = panBounds(scale)
      const ctx = Math.max(-maxX, Math.min(maxX, tx))
      const cty = Math.max(-maxY, Math.min(maxY, ty))
      return {
        tx: ctx,
        ty: cty,
        clampedX: ctx !== tx,
        clampedY: cty !== ty,
      }
    },
    [panBounds],
  )

  /** Rubber-band clamp — used during active drag. Allows up to
   * OVERSCROLL_MAX_PX of overshoot with diminishing returns (asymptotic). */
  const rubberClampPan = useCallback(
    (scale: number, tx: number, ty: number) => {
      const { maxX, maxY } = panBounds(scale)

      const rubber = (value: number, max: number): number => {
        if (value > max) {
          const over = value - max
          return max + rubberBand(over)
        }
        if (value < -max) {
          const over = -value - max
          return -(max + rubberBand(over))
        }
        return value
      }

      return { tx: rubber(tx, maxX), ty: rubber(ty, maxY) }
    },
    [panBounds],
  )

  const applyTransform = useCallback(() => {
    const el = imageRef.current
    if (!el) return
    const { scale, tx, ty } = stateRef.current
    el.style.transform = `translate3d(${tx}px, ${ty}px, 0) scale(${scale})`
  }, [])

  /** Update hot state + DOM with a hard clamp. Returns whether a clamp was
   * hit on each axis (used by momentum to kill velocity into walls). */
  const setLive = useCallback(
    (scale: number, tx: number, ty: number) => {
      const clamped = hardClampPan(scale, tx, ty)
      stateRef.current = { scale, tx: clamped.tx, ty: clamped.ty }
      applyTransform()
      return clamped
    },
    [hardClampPan, applyTransform],
  )

  /** Update hot state + DOM with rubber-band overshoot. Used during active
   * drag so the image gives slightly past the boundary. */
  const setLiveRubber = useCallback(
    (scale: number, tx: number, ty: number) => {
      const rubber = rubberClampPan(scale, tx, ty)
      stateRef.current = { scale, tx: rubber.tx, ty: rubber.ty }
      applyTransform()
    },
    [rubberClampPan, applyTransform],
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

  // ----- Momentum + spring-back -----

  const stopMomentum = useCallback(() => {
    if (momentumRafRef.current !== null) {
      cancelAnimationFrame(momentumRafRef.current)
      momentumRafRef.current = null
    }
  }, [])

  const stopSpringBack = useCallback(() => {
    if (springBackRafRef.current !== null) {
      cancelAnimationFrame(springBackRafRef.current)
      springBackRafRef.current = null
    }
  }, [])

  /** Animate tx, ty back to the hard-clamped target via exp decay.
   * Used when a drag ended in overscroll territory. */
  const startSpringBack = useCallback(() => {
    stopSpringBack()
    let lastT = performance.now()

    const step = (now: number) => {
      const dt = Math.min(50, now - lastT)
      lastT = now

      const { scale, tx, ty } = stateRef.current
      const target = hardClampPan(scale, tx, ty)
      const dx = target.tx - tx
      const dy = target.ty - ty

      if (Math.abs(dx) < SPRING_BACK_EPSILON_PX && Math.abs(dy) < SPRING_BACK_EPSILON_PX) {
        // Snap exactly to target, commit, done.
        setLive(scale, target.tx, target.ty)
        springBackRafRef.current = null
        commit()
        return
      }

      const k = 1 - Math.exp(-dt / SPRING_BACK_TIME_CONSTANT_MS)
      setLive(scale, tx + dx * k, ty + dy * k)
      springBackRafRef.current = requestAnimationFrame(step)
    }
    springBackRafRef.current = requestAnimationFrame(step)
  }, [hardClampPan, setLive, stopSpringBack, commit])

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
      stopSpringBack()
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
    [stopMomentum, stopSpringBack],
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

      // Rubber-band during active drag so the image yields slightly past
      // the clamp boundary instead of feeling locked.
      setLiveRubber(stateRef.current.scale, drag.startTx + dx, drag.startTy + dy)
    }
  }, [zoomToward, setLiveRubber])

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

      // End of drag.
      if (sizeBefore === 1 && drag) {
        dragRef.current = null
        const { scale, tx, ty } = stateRef.current
        const target = hardClampPan(scale, tx, ty)
        const inOverscroll = target.tx !== tx || target.ty !== ty

        if (inOverscroll) {
          // Spring back to the clamp boundary; ignore residual velocity.
          startSpringBack()
          return
        }

        const speed = Math.hypot(drag.vx, drag.vy)
        if (speed > MOMENTUM_STOP_SPEED * 4) {
          startMomentum(drag.vx, drag.vy)
          return
        }
      }

      dragRef.current = null
      commit()
    },
    [commit, onTap, screenToImage, startMomentum, startSpringBack, hardClampPan],
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
      stopSpringBack()
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
  }, [commit, stopMomentum, stopSpringBack, zoomToward])

  // Re-apply transform after image element mounts/resizes (otherwise initial
  // render shows scale 1 even if state was rehydrated — not relevant here, but
  // also catches the case where imageRef remounts).
  useEffect(() => {
    applyTransform()
  })

  // Cancel any in-flight RAF on unmount so we don't leak frames.
  useEffect(() => {
    return () => {
      stopMomentum()
      stopSpringBack()
    }
  }, [stopMomentum, stopSpringBack])

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
