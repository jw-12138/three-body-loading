export interface Vec2 {
  x: number
  y: number
}

export interface Body {
  mass: number
  position: Vec2
  velocity: Vec2
  trail: Vec2[]
  color: string
}

const SOFTENING = 0.01
const DEFAULT_MAX_TRAIL = 7200

// Escape detection constants (from external three-body project)
const ESCAPE_PREFILTER_DISTANCE_RATIO = 1.5
const ESCAPE_PREFILTER_SPEED_RATIO = 1.02
const ESCAPE_DISTANCE_MULTIPLIER = 8
const ESCAPE_CONFIRM_SECONDS = 2
const ESCAPE_RETURN_DISTANCE_RATIO = 3
const ESCAPE_PREDICTION_LOOKAHEAD_SECONDS = 16
const ESCAPE_PREDICTION_STEP_SIZE = 0.004

// System-level unbound detection
const UNBOUND_CONFIRM_SECONDS = 1.5

export class ThreeBodySimulation {
  bodies: Body[]
  G: number
  timeScale: number
  escaped: boolean
  private _pos: Float64Array
  private _vel: Float64Array
  private _masses: Float64Array
  private _k1v: Float64Array
  private _k2v: Float64Array
  private _k3v: Float64Array
  private _k4v: Float64Array
  private _tmpPos: Float64Array
  private _size: number
  private _trailCounter: number
  private _escapeTimers: Map<number, number>
  private _unboundTimer: number
  private _initBodies: () => Body[]
  private _maxTrail: number

  constructor(bodies: Body[], G = 2000, initFn?: () => Body[], maxTrail?: number) {
    this.bodies = bodies
    this.G = G
    this.timeScale = 1
    this.escaped = false
    this._maxTrail = maxTrail ?? DEFAULT_MAX_TRAIL
    this._size = 0
    this._pos = new Float64Array(0)
    this._vel = new Float64Array(0)
    this._masses = new Float64Array(0)
    this._k1v = new Float64Array(0)
    this._k2v = new Float64Array(0)
    this._k3v = new Float64Array(0)
    this._k4v = new Float64Array(0)
    this._tmpPos = new Float64Array(0)
    this._trailCounter = 0
    this._escapeTimers = new Map()
    this._unboundTimer = 0
    this._initBodies = initFn ?? (() => bodies.map(b => ({
      ...b,
      position: { ...b.position },
      velocity: { ...b.velocity },
      trail: [],
    })))
    this.ensureBuffers(bodies.length)
  }

  reset() {
    this.bodies = this._initBodies()
    this._trailCounter = 0
    this._escapeTimers.clear()
    this._unboundTimer = 0
    this.escaped = false
    this.ensureBuffers(this.bodies.length)
  }

  private ensureBuffers(n: number) {
    const size = n * 2
    if (this._size !== size) {
      this._size = size
      this._pos = new Float64Array(size)
      this._vel = new Float64Array(size)
      this._masses = new Float64Array(n)
      this._k1v = new Float64Array(size)
      this._k2v = new Float64Array(size)
      this._k3v = new Float64Array(size)
      this._k4v = new Float64Array(size)
      this._tmpPos = new Float64Array(size)
    }
  }

  private computeAccel(positions: Float64Array, masses: Float64Array, accels: Float64Array) {
    const n = masses.length
    accels.fill(0)
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const dx = positions[j * 2] - positions[i * 2]
        const dy = positions[j * 2 + 1] - positions[i * 2 + 1]
        const distSq = dx * dx + dy * dy
        const dist = Math.sqrt(distSq)
        const force = this.G * masses[i] * masses[j] / (distSq + SOFTENING)
        const fx = force * dx / dist
        const fy = force * dy / dist
        accels[i * 2] += fx / masses[i]
        accels[i * 2 + 1] += fy / masses[i]
        accels[j * 2] -= fx / masses[j]
        accels[j * 2 + 1] -= fy / masses[j]
      }
    }
  }

  step(deltaTime: number) {
    const n = this.bodies.length
    if (n < 2) return
    this.ensureBuffers(n)

    const { _pos: pos, _vel: vel, _masses: masses, _k1v: k1v, _k2v: k2v, _k3v: k3v, _k4v: k4v, _tmpPos: tmpPos } = this
    const size = n * 2

    for (let i = 0; i < n; i++) {
      pos[i * 2] = this.bodies[i].position.x
      pos[i * 2 + 1] = this.bodies[i].position.y
      vel[i * 2] = this.bodies[i].velocity.x
      vel[i * 2 + 1] = this.bodies[i].velocity.y
      masses[i] = this.bodies[i].mass
    }

    const dt = deltaTime

    // RK4
    this.computeAccel(pos, masses, k1v)

    for (let i = 0; i < size; i++) tmpPos[i] = pos[i] + vel[i] * dt * 0.5 + k1v[i] * dt * dt * 0.125
    this.computeAccel(tmpPos, masses, k2v)

    for (let i = 0; i < size; i++) tmpPos[i] = pos[i] + vel[i] * dt * 0.5 + k2v[i] * dt * dt * 0.125
    this.computeAccel(tmpPos, masses, k3v)

    for (let i = 0; i < size; i++) tmpPos[i] = pos[i] + vel[i] * dt + k3v[i] * dt * dt * 0.5
    this.computeAccel(tmpPos, masses, k4v)

    for (let i = 0; i < size; i++) {
      pos[i] += vel[i] * dt + (k1v[i] + k2v[i] + k3v[i]) * dt * dt / 6
      vel[i] += (k1v[i] + 2 * k2v[i] + 2 * k3v[i] + k4v[i]) * dt / 6
    }

    for (let i = 0; i < n; i++) {
      this.bodies[i].position.x = pos[i * 2]
      this.bodies[i].position.y = pos[i * 2 + 1]
      this.bodies[i].velocity.x = vel[i * 2]
      this.bodies[i].velocity.y = vel[i * 2 + 1]
    }

    this._trailCounter++
    if (this._trailCounter >= 2) {
      this._trailCounter = 0
      for (const body of this.bodies) {
        body.trail.push({ x: body.position.x, y: body.position.y })
        if (body.trail.length > this._maxTrail) {
          body.trail.shift()
        }
      }
    }
  }

  update(frameDelta: number): boolean {
    const scaled = frameDelta * this.timeScale
    const maxStep = 0.002
    const numSteps = Math.ceil(scaled / maxStep)
    const stepSize = scaled / numSteps
    for (let i = 0; i < numSteps; i++) {
      this.step(stepSize)
    }

    if (!this.escaped && this.checkEscape(frameDelta)) {
      this.escaped = true
    }
    return this.escaped
  }

  // ── Per-body escape metrics (from external three-body project) ──

  private getEscapeMetrics(bodyIndex: number) {
    const body = this.bodies[bodyIndex]
    let restMass = 0, cx = 0, cy = 0, cvx = 0, cvy = 0

    for (let i = 0; i < this.bodies.length; i++) {
      if (i === bodyIndex) continue
      const o = this.bodies[i]
      restMass += o.mass
      cx += o.position.x * o.mass
      cy += o.position.y * o.mass
      cvx += o.velocity.x * o.mass
      cvy += o.velocity.y * o.mass
    }
    if (restMass <= 0) return null

    cx /= restMass; cy /= restMass
    cvx /= restMass; cvy /= restMass

    let coreRadius = 0
    for (let i = 0; i < this.bodies.length; i++) {
      if (i === bodyIndex) continue
      const dx = this.bodies[i].position.x - cx
      const dy = this.bodies[i].position.y - cy
      coreRadius = Math.max(coreRadius, Math.hypot(dx, dy))
    }

    let restKE = 0, restPE = 0
    for (let i = 0; i < this.bodies.length; i++) {
      if (i === bodyIndex) continue
      const dvx = this.bodies[i].velocity.x - cvx
      const dvy = this.bodies[i].velocity.y - cvy
      restKE += 0.5 * this.bodies[i].mass * (dvx * dvx + dvy * dvy)
    }
    for (let i = 0; i < this.bodies.length; i++) {
      if (i === bodyIndex) continue
      for (let j = i + 1; j < this.bodies.length; j++) {
        if (j === bodyIndex) continue
        const dx = this.bodies[j].position.x - this.bodies[i].position.x
        const dy = this.bodies[j].position.y - this.bodies[i].position.y
        restPE -= this.G * this.bodies[i].mass * this.bodies[j].mass / Math.max(Math.hypot(dx, dy), 1e-9)
      }
    }

    const relX = body.position.x - cx
    const relY = body.position.y - cy
    const distance = Math.max(Math.hypot(relX, relY), 1e-9)
    const relVx = body.velocity.x - cvx
    const relVy = body.velocity.y - cvy
    const relSpeed = Math.hypot(relVx, relVy)
    const escapeSpeed = Math.sqrt(Math.max(0, 2 * this.G * restMass / distance))
    const radialVelocity = (relX * relVx + relY * relVy) / distance
    const specificEnergy = 0.5 * (relVx * relVx + relVy * relVy) - this.G * restMass / distance

    return {
      distance,
      distanceRatio: distance / Math.max(coreRadius, 1),
      speedRatio: escapeSpeed > 0 ? relSpeed / escapeSpeed : Infinity,
      radialVelocity,
      specificEnergy,
      restSystemEnergy: restKE + restPE,
    }
  }

  // ── RK4 forward prediction (from external three-body project) ──

  private getEscapeMetricsFromState(pos: Float64Array, vel: Float64Array, masses: Float64Array, bodyIndex: number) {
    const n = masses.length
    let restMass = 0, cx = 0, cy = 0, cvx = 0, cvy = 0

    for (let i = 0; i < n; i++) {
      if (i === bodyIndex) continue
      restMass += masses[i]
      cx += pos[i * 2] * masses[i]
      cy += pos[i * 2 + 1] * masses[i]
      cvx += vel[i * 2] * masses[i]
      cvy += vel[i * 2 + 1] * masses[i]
    }
    if (restMass <= 0) return null

    cx /= restMass; cy /= restMass
    cvx /= restMass; cvy /= restMass

    let coreRadius = 0
    for (let i = 0; i < n; i++) {
      if (i === bodyIndex) continue
      coreRadius = Math.max(coreRadius, Math.hypot(pos[i * 2] - cx, pos[i * 2 + 1] - cy))
    }

    const relX = pos[bodyIndex * 2] - cx
    const relY = pos[bodyIndex * 2 + 1] - cy
    const distance = Math.max(Math.hypot(relX, relY), 1e-9)
    const relVx = vel[bodyIndex * 2] - cvx
    const relVy = vel[bodyIndex * 2 + 1] - cvy
    const radialVelocity = (relX * relVx + relY * relVy) / distance

    return {
      distance,
      distanceRatio: distance / Math.max(coreRadius, 1),
      radialVelocity,
    }
  }

  private stepRK4Prediction(pos: Float64Array, vel: Float64Array, masses: Float64Array, dt: number) {
    const size = masses.length * 2
    const k1v = new Float64Array(size)
    const k2v = new Float64Array(size)
    const k3v = new Float64Array(size)
    const k4v = new Float64Array(size)
    const tmpPos = new Float64Array(size)

    this.computeAccel(pos, masses, k1v)
    for (let i = 0; i < size; i++) tmpPos[i] = pos[i] + vel[i] * dt * 0.5 + k1v[i] * dt * dt * 0.125
    this.computeAccel(tmpPos, masses, k2v)
    for (let i = 0; i < size; i++) tmpPos[i] = pos[i] + vel[i] * dt * 0.5 + k2v[i] * dt * dt * 0.125
    this.computeAccel(tmpPos, masses, k3v)
    for (let i = 0; i < size; i++) tmpPos[i] = pos[i] + vel[i] * dt + k3v[i] * dt * dt * 0.5
    this.computeAccel(tmpPos, masses, k4v)

    for (let i = 0; i < size; i++) {
      pos[i] += vel[i] * dt + (k1v[i] + k2v[i] + k3v[i]) * dt * dt / 6
      vel[i] += (k1v[i] + 2 * k2v[i] + 2 * k3v[i] + k4v[i]) * dt / 6
    }
  }

  private predictNoReturn(bodyIndex: number): boolean {
    const n = this.bodies.length
    const pos = new Float64Array(n * 2)
    const vel = new Float64Array(n * 2)
    const masses = new Float64Array(n)

    for (let i = 0; i < n; i++) {
      pos[i * 2] = this.bodies[i].position.x
      pos[i * 2 + 1] = this.bodies[i].position.y
      vel[i * 2] = this.bodies[i].velocity.x
      vel[i * 2 + 1] = this.bodies[i].velocity.y
      masses[i] = this.bodies[i].mass
    }

    const initialMetrics = this.getEscapeMetricsFromState(pos, vel, masses, bodyIndex)
    if (!initialMetrics) return false

    const stepCount = Math.ceil(ESCAPE_PREDICTION_LOOKAHEAD_SECONDS / ESCAPE_PREDICTION_STEP_SIZE)
    const dt = ESCAPE_PREDICTION_LOOKAHEAD_SECONDS / stepCount
    const initialDistance = Math.max(initialMetrics.distance, 1e-9)

    for (let step = 0; step < stepCount; step++) {
      this.stepRK4Prediction(pos, vel, masses, dt)
      const metrics = this.getEscapeMetricsFromState(pos, vel, masses, bodyIndex)
      if (!metrics) return false

      const distanceFraction = metrics.distance / initialDistance
      const returnedNearCore = metrics.distanceRatio <= ESCAPE_RETURN_DISTANCE_RATIO
      const meaningfullyCloser = distanceFraction <= 0.75
      const turnedBack = metrics.radialVelocity < 0

      if (returnedNearCore || meaningfullyCloser || turnedBack) {
        return false
      }
    }
    return true
  }

  // ── Escape detection: per-body (external repo) + system-level (mutual escape) ──

  private checkEscape(deltaTime: number): boolean {
    if (this.bodies.length < 3) return false

    // === Strategy 1: Per-body escape (from external three-body project) ===
    for (let i = 0; i < this.bodies.length; i++) {
      const m = this.getEscapeMetrics(i)
      if (!m) continue

      // Prefilter: moving outward, rest system bound, far enough, fast enough
      const prefilter = m.radialVelocity > 0
        && m.restSystemEnergy < 0
        && m.distanceRatio >= ESCAPE_PREFILTER_DISTANCE_RATIO
        && m.speedRatio >= ESCAPE_PREFILTER_SPEED_RATIO

      // Strong immediate signal: very far + positive energy
      const strongSignal = m.distanceRatio >= ESCAPE_DISTANCE_MULTIPLIER && m.specificEnergy > 0

      if (!prefilter && !strongSignal) {
        this._escapeTimers.delete(i)
        continue
      }

      // Run RK4 forward prediction to confirm
      if (!this.predictNoReturn(i)) {
        this._escapeTimers.delete(i)
        continue
      }

      const elapsed = (this._escapeTimers.get(i) ?? 0) + deltaTime
      if (elapsed >= ESCAPE_CONFIRM_SECONDS) {
        return true
      }
      this._escapeTimers.set(i, elapsed)
    }

    // === Strategy 2: System-level mutual escape ===
    // When ALL bodies are unbound and expanding, no single body has a
    // "bound core" to escape from, so per-body detection fails.
    // Check: total energy > 0 AND all pairwise distances increasing.
    const totalE = this.totalEnergy()
    if (totalE > 0) {
      let allExpanding = true
      for (let i = 0; i < this.bodies.length && allExpanding; i++) {
        for (let j = i + 1; j < this.bodies.length && allExpanding; j++) {
          const dx = this.bodies[j].position.x - this.bodies[i].position.x
          const dy = this.bodies[j].position.y - this.bodies[i].position.y
          const dvx = this.bodies[j].velocity.x - this.bodies[i].velocity.x
          const dvy = this.bodies[j].velocity.y - this.bodies[i].velocity.y
          // Radial velocity between pair: positive = moving apart
          const radial = dx * dvx + dy * dvy
          if (radial <= 0) allExpanding = false
        }
      }

      if (allExpanding) {
        this._unboundTimer += deltaTime
        if (this._unboundTimer >= UNBOUND_CONFIRM_SECONDS) {
          return true
        }
      } else {
        this._unboundTimer = 0
      }
    } else {
      this._unboundTimer = 0
    }

    return false
  }

  totalEnergy(): number {
    let ke = 0
    let pe = 0
    for (const b of this.bodies) {
      ke += 0.5 * b.mass * (b.velocity.x ** 2 + b.velocity.y ** 2)
    }
    for (let i = 0; i < this.bodies.length; i++) {
      for (let j = i + 1; j < this.bodies.length; j++) {
        const dx = this.bodies[j].position.x - this.bodies[i].position.x
        const dy = this.bodies[j].position.y - this.bodies[i].position.y
        const dist = Math.sqrt(dx * dx + dy * dy)
        pe -= this.G * this.bodies[i].mass * this.bodies[j].mass / dist
      }
    }
    return ke + pe
  }

  getBounds() {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
    for (const body of this.bodies) {
      const start = Math.max(0, body.trail.length - 400)
      for (let i = start; i < body.trail.length; i++) {
        const p = body.trail[i]
        if (p.x < minX) minX = p.x
        if (p.y < minY) minY = p.y
        if (p.x > maxX) maxX = p.x
        if (p.y > maxY) maxY = p.y
      }
      if (body.position.x < minX) minX = body.position.x
      if (body.position.y < minY) minY = body.position.y
      if (body.position.x > maxX) maxX = body.position.x
      if (body.position.y > maxY) maxY = body.position.y
    }
    return { minX, minY, maxX, maxY }
  }
}
