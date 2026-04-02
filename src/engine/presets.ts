import type { Body } from './physics'

const COLORS = ['#ffffff', '#888888', '#555555']

function makeBody(mass: number, px: number, py: number, vx: number, vy: number, colorIndex: number): Body {
  return {
    mass,
    position: { x: px, y: py },
    velocity: { x: vx, y: vy },
    trail: [],
    color: COLORS[colorIndex % COLORS.length],
  }
}

export type StabilityTag = 'stable' | 'kinda-stable' | 'unstable'

export interface PresetConfig {
  key: string
  name: string
  description: string
  stability: StabilityTag
  G: number
  timeScale: number
  maxTrail?: number
  create: () => Body[]
}

const G = 9800

export const PRESETS: PresetConfig[] = [
  {
    key: 'figure8',
    name: 'Figure-8',
    description: 'The holy grail. Three equal masses chase each other in a perfect figure-8. Will it last? (Spoiler: probably not in your browser)',
    stability: 'stable',
    G,
    timeScale: 3,
    maxTrail: 3200,
    create: () => {
      const mass = 15
      const sep = 150
      const v = Math.sqrt(G * mass / sep)
      const p1 = 0.347113, p2 = 0.532727
      return [
        makeBody(mass * 0.9999, -sep, 0, p1 * v, p2 * v, 0),
        makeBody(mass, 0, 0, -2 * p1 * v, -2 * p2 * v, 1),
        makeBody(mass, sep, 0, p1 * v, p2 * v, 2),
      ]
    },
  },
  {
    key: 'moth',
    name: 'Moth',
    description: 'Named after the moth-like trajectory. A beautiful choreography of gravitational ballet. Or gravitational chaos. Same thing.',
    stability: 'stable',
    G,
    timeScale: 3,
    create: () => {
      const mass = 15
      const sep = 150
      const v = Math.sqrt(G * mass / sep)
      const p1 = 0.464445, p2 = 0.396060
      return [
        makeBody(mass, -sep, 0, p1 * v, p2 * v, 0),
        makeBody(mass, 0, 0, -2 * p1 * v, -2 * p2 * v, 1),
        makeBody(mass, sep, 0, p1 * v, p2 * v, 2),
      ]
    },
  },
  {
    key: 'binaryShepherd',
    name: 'Binary Shepherd',
    description: 'Two bodies orbit tightly while a lonely third watches from afar. A metaphor for your social life.',
    stability: 'stable',
    G,
    timeScale: 3,
    maxTrail: 3200,
    create: () => {
      const innerMassA = 15, innerMassB = 15, outerMass = 6
      const innerDist = 60, outerDist = 360
      const innerTotal = innerMassA + innerMassB
      const total = innerTotal + outerMass
      const innerComX = -(outerMass / total) * outerDist
      const outerX = (innerTotal / total) * outerDist
      const innerOffset = innerDist * 0.5
      const relInner = Math.sqrt(G * innerTotal / innerDist)
      const innerSpd = relInner * 0.5
      const relOuter = Math.sqrt(G * total / outerDist)
      const innerComSpd = relOuter * (outerMass / total)
      const outerSpd = relOuter * (innerTotal / total)
      return [
        makeBody(innerMassA, innerComX - innerOffset, 0, 0, innerComSpd + innerSpd, 0),
        makeBody(innerMassB, innerComX + innerOffset, 0, 0, innerComSpd - innerSpd, 1),
        makeBody(outerMass, outerX, 0, 0, -outerSpd, 2),
      ]
    },
  },
  {
    key: 'lagrange',
    name: 'Lagrange',
    description: 'Three bodies in an equilateral triangle, spinning around their center of mass. The only stable formation. How boring.',
    stability: 'kinda-stable',
    G,
    timeScale: 3,
    create: () => {
      const mass = 15
      const radius = 150
      const orbitalSpeed = Math.sqrt(G * mass / (radius * Math.sqrt(3)))
      return [0, 1, 2].map((i) => {
        const angle = (i * 2 * Math.PI) / 3
        const va = angle + Math.PI / 2
        return makeBody(
          mass,
          radius * Math.cos(angle), radius * Math.sin(angle),
          orbitalSpeed * Math.cos(va), orbitalSpeed * Math.sin(va),
          i,
        )
      })
    },
  },
  {
    key: 'moth2',
    name: 'Moth IVa.4',
    description: 'A more exotic moth variant. Like the regular moth, but with fancier wings. And more existential dread.',
    stability: 'kinda-stable',
    G,
    timeScale: 3,
    create: () => {
      const mass = 15
      const sep = 150
      const v = Math.sqrt(G * mass / sep)
      const p1 = 0.439166, p2 = 0.452968
      return [
        makeBody(mass, -sep, 0, p1 * v, p2 * v, 0),
        makeBody(mass, 0, 0, -2 * p1 * v, -2 * p2 * v, 1),
        makeBody(mass, sep, 0, p1 * v, p2 * v, 2),
      ]
    },
  },
  {
    key: 'chaos',
    name: 'Pure Chaos',
    description: 'Random masses, random positions, random velocities. This IS your loading state — we have no idea when it will finish.',
    stability: 'unstable',
    G,
    timeScale: 3,
    maxTrail: 12000,
    create: () => {
      const r = () => (Math.random() - 0.5) * 300
      const rv = () => (Math.random() - 0.5) * 40
      const rm = () => 8 + Math.random() * 20
      return [
        makeBody(rm(), r(), r(), rv(), rv(), 0),
        makeBody(rm(), r(), r(), rv(), rv(), 1),
        makeBody(rm(), r(), r(), rv(), rv(), 2),
      ]
    },
  },
]
