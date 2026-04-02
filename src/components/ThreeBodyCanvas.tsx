import { useRef, useEffect, useCallback } from 'react'
import { ThreeBodySimulation } from '../engine/physics'
import type { PresetConfig } from '../engine/presets'

interface Props {
  preset: PresetConfig
  size?: number
  interactive?: boolean
  paused?: boolean
  timeScale?: number
  gValue?: number
}

// ── Sticky-bounds camera ──
// Instead of smoothing position/zoom separately with special cases,
// we smooth the BOUNDS themselves. Bounds expand instantly (never clip
// content) but contract slowly (no jitter from oscillating bodies).
// Then position & zoom are derived directly from the smoothed bounds.

interface Camera {
  // Smoothed bounds in world space
  minX: number
  minY: number
  maxX: number
  maxY: number
  initialized: boolean
}

// Exponential decay alpha (time-independent)
function smoothAlpha(dt: number, duration: number): number {
  if (dt <= 0) return 0
  return 1 - Math.pow(0.01, dt / duration)
}

const PADDING = 80                  // World-space padding around content
const SHRINK_SECONDS = 4            // How slowly bounds contract
const ESCAPE_WARNING_DURATION = 1.2 // Seconds to show warning before reset

function getIsDark(): boolean {
  const attr = document.documentElement.getAttribute('data-theme')
  if (attr === 'light') return false
  if (attr === 'dark') return true
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

export function ThreeBodyCanvas({ preset, size = 200, interactive = false, paused = false, timeScale, gValue }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const simRef = useRef<ThreeBodySimulation | null>(null)
  const rafRef = useRef<number>(0)
  const lastTimeRef = useRef<number>(0)
  const presetKeyRef = useRef<string>('')
  const cameraRef = useRef<Camera>({ minX: 0, minY: 0, maxX: 0, maxY: 0, initialized: false })
  const escapeWarningRef = useRef<number>(0)
  const escapedPersistRef = useRef(false) // for interactive: stays true once escaped
  const pausedRef = useRef(paused)
  pausedRef.current = paused

  const initSim = useCallback(() => {
    const bodies = preset.create()
    const sim = new ThreeBodySimulation(bodies, gValue ?? preset.G, preset.create, preset.maxTrail)
    sim.timeScale = timeScale ?? preset.timeScale
    simRef.current = sim
    presetKeyRef.current = preset.key
    cameraRef.current = { minX: 0, minY: 0, maxX: 0, maxY: 0, initialized: false }
    escapeWarningRef.current = 0
    escapedPersistRef.current = false
  }, [preset, gValue, timeScale])

  useEffect(() => {
    if (presetKeyRef.current !== preset.key) {
      initSim()
    }
  }, [preset.key, initSim])

  useEffect(() => {
    if (simRef.current) {
      simRef.current.G = gValue ?? preset.G
    }
  }, [gValue, preset.G])

  useEffect(() => {
    if (simRef.current) {
      simRef.current.timeScale = timeScale ?? preset.timeScale
    }
  }, [timeScale, preset.timeScale])

  useEffect(() => {
    initSim()
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')!
    lastTimeRef.current = performance.now()

    const animate = (now: number) => {
      const dt = Math.min((now - lastTimeRef.current) / 1000, 0.016)
      lastTimeRef.current = now

      const sim = simRef.current
      if (!sim) return

      if (pausedRef.current) {
        // Still draw but don't advance physics
        const cam = cameraRef.current
        const camW = Math.max(cam.maxX - cam.minX, 1)
        const camH = Math.max(cam.maxY - cam.minY, 1)
        const cx = (cam.minX + cam.maxX) / 2
        const cy = (cam.minY + cam.maxY) / 2
        const zoom = Math.min(canvas.width / camW, canvas.height / camH, 2)
        draw(ctx, sim, canvas.width, canvas.height, cx, cy, zoom, getIsDark())
        rafRef.current = requestAnimationFrame(animate)
        return
      }

      const escaped = sim.update(dt)

      if (interactive) {
        if (escaped) escapedPersistRef.current = true
      } else {
        if (escapeWarningRef.current > 0) {
          escapeWarningRef.current -= dt
          if (escapeWarningRef.current <= 0) {
            sim.reset()
            cameraRef.current.initialized = false
            escapeWarningRef.current = 0
          }
        } else if (escaped) {
          escapeWarningRef.current = ESCAPE_WARNING_DURATION
        }
      }

      updateCamera(cameraRef.current, sim, dt)

      const cam = cameraRef.current
      const camW = Math.max(cam.maxX - cam.minX, 1)
      const camH = Math.max(cam.maxY - cam.minY, 1)
      const cx = (cam.minX + cam.maxX) / 2
      const cy = (cam.minY + cam.maxY) / 2
      const zoom = Math.min(canvas.width / camW, canvas.height / camH, 2)
      const isDark = getIsDark()

      draw(ctx, sim, canvas.width, canvas.height, cx, cy, zoom, isDark)

      if (escapeWarningRef.current > 0) {
        drawEscapeWarning(ctx, canvas.width, canvas.height, escapeWarningRef.current / ESCAPE_WARNING_DURATION, isDark)
      } else if (escapedPersistRef.current) {
        drawEscapeWarning(ctx, canvas.width, canvas.height, 0, isDark)
      }

      rafRef.current = requestAnimationFrame(animate)
    }

    rafRef.current = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(rafRef.current)
  }, [initSim])

  return (
    <canvas
      ref={canvasRef}
      width={size * 2}
      height={size * 2}
      style={{
        width: size,
        height: size,
        borderRadius: 14,
      }}
    />
  )
}

function updateCamera(cam: Camera, sim: ThreeBodySimulation, dt: number) {
  if (sim.bodies.length === 0) return

  // Step 1: Compute raw bounds from ALL content (bodies + trails)
  let rawMinX = Infinity, rawMinY = Infinity, rawMaxX = -Infinity, rawMaxY = -Infinity

  for (const body of sim.bodies) {
    if (body.position.x < rawMinX) rawMinX = body.position.x
    if (body.position.y < rawMinY) rawMinY = body.position.y
    if (body.position.x > rawMaxX) rawMaxX = body.position.x
    if (body.position.y > rawMaxY) rawMaxY = body.position.y

    for (const p of body.trail) {
      if (p.x < rawMinX) rawMinX = p.x
      if (p.y < rawMinY) rawMinY = p.y
      if (p.x > rawMaxX) rawMaxX = p.x
      if (p.y > rawMaxY) rawMaxY = p.y
    }
  }

  rawMinX -= PADDING
  rawMinY -= PADDING
  rawMaxX += PADDING
  rawMaxY += PADDING

  // Step 2: Snap on first frame
  if (!cam.initialized) {
    cam.minX = rawMinX
    cam.minY = rawMinY
    cam.maxX = rawMaxX
    cam.maxY = rawMaxY
    cam.initialized = true
    return
  }

  // Step 3: Sticky bounds — expand instantly, contract slowly
  // Expansion: if raw bounds are larger, snap to them immediately
  // Contraction: if raw bounds are smaller, ease toward them
  const shrinkAlpha = smoothAlpha(dt, SHRINK_SECONDS)

  if (rawMinX < cam.minX) {
    cam.minX = rawMinX
  } else {
    cam.minX += (rawMinX - cam.minX) * shrinkAlpha
  }

  if (rawMinY < cam.minY) {
    cam.minY = rawMinY
  } else {
    cam.minY += (rawMinY - cam.minY) * shrinkAlpha
  }

  if (rawMaxX > cam.maxX) {
    cam.maxX = rawMaxX
  } else {
    cam.maxX += (rawMaxX - cam.maxX) * shrinkAlpha
  }

  if (rawMaxY > cam.maxY) {
    cam.maxY = rawMaxY
  } else {
    cam.maxY += (rawMaxY - cam.maxY) * shrinkAlpha
  }
}

// Dark: white bodies on black. Light: dark bodies on white.
const DARK_COLORS = ['#ffffff', '#aaaaaa', '#777777']
const LIGHT_COLORS = ['#111111', '#555555', '#888888']

function draw(ctx: CanvasRenderingContext2D, sim: ThreeBodySimulation, w: number, h: number, cx: number, cy: number, zoom: number, isDark: boolean) {
  const bg = isDark ? '#000' : '#fff'
  const highlight = isDark ? '#fff' : '#000'
  const colors = isDark ? DARK_COLORS : LIGHT_COLORS

  ctx.fillStyle = bg
  ctx.fillRect(0, 0, w, h)

  if (sim.bodies.length === 0) return

  ctx.save()
  ctx.translate(w / 2, h / 2)
  ctx.scale(zoom, zoom)
  ctx.translate(-cx, -cy)

  const baseDotR = Math.max(5.5 / zoom, 3)
  const bodyR = Math.max(8 / zoom, 5)

  // Draw trails as particle chains
  for (let bi = 0; bi < sim.bodies.length; bi++) {
    const body = sim.bodies[bi]
    const color = colors[bi % colors.length]
    const len = body.trail.length
    if (len < 2) continue

    const step = Math.max(1, Math.floor(len / 300))
    for (let i = 0; i < len; i += step) {
      const t = i / len
      const dotRadius = baseDotR * (0.15 + t * 0.85)
      const alpha = t * t * 0.55

      ctx.globalAlpha = alpha
      ctx.beginPath()
      ctx.arc(body.trail[i].x, body.trail[i].y, dotRadius, 0, Math.PI * 2)
      ctx.fillStyle = color
      ctx.fill()
    }

    const headStart = Math.max(0, len - 60)
    for (let i = headStart; i < len; i++) {
      const t = (i - headStart) / Math.max(1, len - 1 - headStart)
      const dotRadius = baseDotR * (0.6 + t * 0.6)
      ctx.globalAlpha = 0.4 + t * 0.6

      ctx.beginPath()
      ctx.arc(body.trail[i].x, body.trail[i].y, dotRadius, 0, Math.PI * 2)
      ctx.fillStyle = color
      ctx.fill()
    }
  }

  // Draw bodies
  ctx.globalAlpha = 1
  for (let bi = 0; bi < sim.bodies.length; bi++) {
    const body = sim.bodies[bi]
    const color = colors[bi % colors.length]

    if (isDark) {
      const glowR = bodyR * 3.5
      ctx.beginPath()
      ctx.arc(body.position.x, body.position.y, glowR, 0, Math.PI * 2)
      const gradient = ctx.createRadialGradient(
        body.position.x, body.position.y, bodyR * 0.2,
        body.position.x, body.position.y, glowR,
      )
      gradient.addColorStop(0, color + '80')
      gradient.addColorStop(0.4, color + '30')
      gradient.addColorStop(1, 'transparent')
      ctx.fillStyle = gradient
      ctx.fill()
    }

    ctx.beginPath()
    ctx.arc(body.position.x, body.position.y, bodyR, 0, Math.PI * 2)
    ctx.fillStyle = color
    ctx.fill()

    ctx.beginPath()
    ctx.arc(body.position.x, body.position.y, bodyR * 0.45, 0, Math.PI * 2)
    ctx.fillStyle = highlight
    ctx.fill()
  }

  ctx.restore()
}

function drawEscapeWarning(ctx: CanvasRenderingContext2D, w: number, h: number, progress: number, isDark: boolean) {
  const pulse = 0.5 + 0.5 * Math.sin(progress * Math.PI * 6)
  const intensity = (1 - progress) * 0.6 + pulse * 0.25

  if (isDark) {
    const gradient = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.25, w / 2, h / 2, Math.min(w, h) * 0.7)
    gradient.addColorStop(0, 'transparent')
    gradient.addColorStop(0.7, 'transparent')
    gradient.addColorStop(1, `rgba(220, 38, 38, ${intensity * 0.7})`)
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, w, h)

    const edgeH = h * 0.08
    const topGrad = ctx.createLinearGradient(0, 0, 0, edgeH)
    topGrad.addColorStop(0, `rgba(220, 38, 38, ${intensity * 0.6})`)
    topGrad.addColorStop(1, 'transparent')
    ctx.fillStyle = topGrad
    ctx.fillRect(0, 0, w, edgeH)

    const botGrad = ctx.createLinearGradient(0, h - edgeH, 0, h)
    botGrad.addColorStop(0, 'transparent')
    botGrad.addColorStop(1, `rgba(220, 38, 38, ${intensity * 0.6})`)
    ctx.fillStyle = botGrad
    ctx.fillRect(0, h - edgeH, w, edgeH)
  }

  const textAlpha = Math.min(1, (1 - progress) * 3)
  ctx.globalAlpha = textAlpha * (0.7 + pulse * 0.3)
  ctx.font = `600 ${w * 0.055}px "Geist", "SF Pro Display", system-ui, sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.letterSpacing = '0.15em'

  if (isDark) {
    ctx.shadowColor = 'rgba(220, 38, 38, 0.8)'
    ctx.shadowBlur = 20
    ctx.fillStyle = 'rgba(248, 113, 113, 0.9)'
  } else {
    ctx.fillStyle = 'rgba(185, 28, 28, 0.85)'
  }
  ctx.fillText('ESCAPE DETECTED', w / 2, h * 0.85)

  ctx.shadowColor = 'transparent'
  ctx.shadowBlur = 0
  ctx.globalAlpha = 1
}
