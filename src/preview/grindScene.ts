import * as THREE from 'three'
import type { GrindDuty, GrindStage, GrindVisual } from '../lib/grindOps'
import type { Abrasive } from '../lib/wheelPacks'

export type CameraPreset = 'overview' | 'tip' | 'flute' | 'wheel'

export interface SceneOp {
  duty: GrindDuty
  show: GrindStage[]
  abrasive: Abrasive | null
}

interface ToolMetrics {
  tipZ: number
  tipRadius: number
  fluteStart: number
  fluteEnd: number
  shoulderZ: number
  shankEnd: number
}

const STOCK = 0xd7c4a8
const GROUND = 0xd5dde3
const FLUTE = 0x4e5c68
const WEAR = 0x8a5a3a
const SHANK = 0x8a9ba8
const GASH = 0x2a333c
const HOLE = 0x10161c
const SECONDARY = 0x9aadc0
const FACE = 0xe7eef3

function has(show: readonly GrindStage[], stage: GrindStage): boolean {
  return show.includes(stage)
}

function diameterScaleFor(visual: GrindVisual, lengthScale: number): number {
  const nominal = Math.max(visual.diameter, ...visual.steps.map((step) => step.diameter), 0.2)
  const rawRadius = (nominal / 2) * lengthScale
  if (rawRadius < 2.2) return lengthScale * (2.2 / rawRadius)
  return lengthScale
}

function coneHeight(radius: number, pointAngle: number): number {
  const half = (Math.min(160, Math.max(70, pointAngle)) * Math.PI) / 360
  return radius / Math.tan(half)
}

function metal(color: number): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color,
    metalness: 0.72,
    roughness: 0.38,
  })
}

function addCylinder(
  group: THREE.Group,
  radiusTip: number,
  radiusBack: number,
  length: number,
  zStart: number,
  material: THREE.Material,
) {
  if (length <= 0.08 || radiusTip <= 0 || radiusBack <= 0) return
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radiusTip, radiusBack, length, 16), material)
  mesh.rotation.x = -Math.PI / 2
  mesh.position.z = zStart + length / 2
  group.add(mesh)
}

function addFlutes(
  group: THREE.Group,
  visual: GrindVisual,
  radius: number,
  zStart: number,
  zEnd: number,
  material: THREE.Material,
) {
  const count = Math.min(4, Math.max(1, Math.round(visual.fluteCount) || 1))
  const balls = 6
  const span = Math.max(0.5, zEnd - zStart)
  for (let flute = 0; flute < count; flute += 1) {
    for (let step = 0; step < balls; step += 1) {
      const t = step / (balls - 1)
      const angle =
        (flute / count) * Math.PI * 2 +
        (Math.max(visual.helixAngle, 0) * Math.PI) / 180 * t * 2.4
      const mesh = new THREE.Mesh(new THREE.SphereGeometry(Math.max(0.28, radius * 0.28), 8, 6), material)
      mesh.position.set(Math.cos(angle) * radius * 0.62, Math.sin(angle) * radius * 0.62, zStart + span * t)
      mesh.scale.z = 1.8
      group.add(mesh)
    }
  }
}

function buildTool(visual: GrindVisual, show: readonly GrindStage[]): THREE.Group {
  const group = new THREE.Group()
  const lengthScale = 62 / Math.max(visual.overallLength, 1)
  const diameterScale = diameterScaleFor(visual, lengthScale)
  const ground = has(show, 'od')
  const bodyMat = metal(ground ? GROUND : STOCK)
  const shankMat = metal(SHANK)
  const fluteMat = metal(FLUTE)
  const shorten = has(show, 'length')
    ? Math.min(visual.stockMm * lengthScale * 8, Math.max(visual.fluteLength, 1) * lengthScale * 0.12, 5)
    : 0
  const tipZ = shorten
  const d = (millimetres: number) => (millimetres / 2) * diameterScale * (ground ? 1 : 1.18)

  let tipRadius = d(visual.diameter)
  let fluteStart = tipZ
  let fluteEnd = tipZ + Math.max(6, visual.fluteLength * lengthScale)
  let shoulderZ = fluteStart + (fluteEnd - fluteStart) * 0.45
  const shankRadius = Math.max(0.6, (visual.shankDiameter / 2) * diameterScale)
  let shankEnd = Math.max(fluteEnd + 6, visual.overallLength * lengthScale)

  const pointRadius = () => {
    if (visual.family === 'step' && has(show, 'step') && visual.steps[0]) return d(visual.steps[0].diameter)
    return d(visual.diameter)
  }

  if (has(show, 'point') && !has(show, 'face')) {
    tipRadius = pointRadius()
    const height = coneHeight(tipRadius, visual.pointAngle)
    const cone = new THREE.Mesh(new THREE.ConeGeometry(tipRadius, height, 16), metal(GROUND))
    cone.rotation.x = -Math.PI / 2
    cone.position.z = tipZ + height / 2
    group.add(cone)
    if (has(show, 'secondary')) {
      const relief = new THREE.Mesh(
        new THREE.ConeGeometry(tipRadius * 1.05, height * 0.62, 16),
        metal(SECONDARY),
      )
      relief.rotation.x = -Math.PI / 2
      relief.position.z = tipZ + height * 0.72
      group.add(relief)
    }
    fluteStart = tipZ + height * 0.92
  } else if (has(show, 'face')) {
    tipRadius = d(visual.diameter)
    const cap = new THREE.Mesh(new THREE.CircleGeometry(tipRadius * 0.98, 16), metal(FACE))
    cap.rotation.y = Math.PI
    cap.position.z = tipZ + 0.04
    group.add(cap)
    fluteStart = tipZ
  }

  const bodyLen = Math.max(2.5, fluteEnd - fluteStart)
  const cleared = has(show, 'clearance')

  if (visual.family === 'step' && visual.steps.length > 0) {
    if (!has(show, 'step')) {
      const big = d(Math.max(...visual.steps.map((step) => step.diameter)))
      tipRadius = has(show, 'point') ? pointRadius() : big
      addCylinder(group, big, big, bodyLen, fluteStart, bodyMat)
      shoulderZ = fluteStart + bodyLen * 0.35
    } else {
      let z = fluteStart
      visual.steps.forEach((step, index) => {
        const length = Math.max(1.2, step.length * lengthScale)
        const radius = d(step.diameter)
        addCylinder(group, radius, radius, length, z, bodyMat)
        if (index === 0) {
          tipRadius = has(show, 'point') ? pointRadius() : radius
          shoulderZ = z + length
        }
        z += length
      })
      fluteEnd = z
      shankEnd = Math.max(fluteEnd + 6, shankEnd)
    }
  } else if (visual.family === 'subland') {
    const front = d(visual.diameter)
    const rear = d(visual.sublandDiameter)
    if (!has(show, 'step')) {
      addCylinder(group, rear, rear, bodyLen, fluteStart, bodyMat)
      shoulderZ = fluteStart + bodyLen * 0.4
      tipRadius = has(show, 'point') ? front : rear
    } else {
      const frontLen = Math.max(2, Math.min(bodyLen * 0.45, visual.fluteLength * lengthScale))
      addCylinder(group, front, front, frontLen, fluteStart, bodyMat)
      addCylinder(group, rear, rear, Math.max(2, bodyLen - frontLen), fluteStart + frontLen, bodyMat)
      shoulderZ = fluteStart + frontLen
      tipRadius = has(show, 'point') ? front : front
    }
  } else if (visual.family === 'center') {
    const pilot = d(visual.diameter)
    const mouth = d(Math.max(visual.countersinkDiameter, visual.diameter))
    const pilotLen = Math.max(1.5, visual.pilotLength * lengthScale)
    addCylinder(group, pilot, pilot, pilotLen, fluteStart, bodyMat)
    if (has(show, 'chamfer')) {
      const chamferLen = Math.max(2, mouth)
      addCylinder(group, pilot, mouth, chamferLen, fluteStart + pilotLen, bodyMat)
      shoulderZ = fluteStart + pilotLen
      fluteEnd = fluteStart + pilotLen + chamferLen
    } else {
      addCylinder(group, mouth, mouth, bodyLen, fluteStart + pilotLen, bodyMat)
      shoulderZ = fluteStart + pilotLen
    }
    tipRadius = pilot
  } else if (visual.family === 'countersink') {
    const radius = d(visual.diameter)
    const mouth = d(Math.max(visual.chamferDiameter, visual.diameter))
    const front = bodyLen * 0.62
    addCylinder(group, radius, radius, front, fluteStart, bodyMat)
    if (has(show, 'chamfer')) {
      addCylinder(group, radius, mouth, Math.max(1.6, bodyLen - front), fluteStart + front, bodyMat)
      shoulderZ = fluteStart + front
    } else {
      addCylinder(group, radius, radius, Math.max(1.6, bodyLen - front), fluteStart + front, bodyMat)
    }
    tipRadius = has(show, 'point') ? radius : radius
  } else {
    const radius = d(visual.diameter)
    tipRadius = has(show, 'point') || has(show, 'face') ? radius : radius
    if (cleared) {
      const land = Math.min(bodyLen * 0.22, Math.max(1.2, radius * 1.3))
      addCylinder(group, radius, radius, land, fluteStart, bodyMat)
      addCylinder(group, radius * 0.9, radius * 0.9, Math.max(1, bodyLen - land), fluteStart + land, bodyMat)
    } else {
      addCylinder(group, radius, radius, bodyLen, fluteStart, bodyMat)
    }
    shoulderZ = fluteStart + bodyLen * 0.45
  }

  addCylinder(group, shankRadius, shankRadius, Math.max(4, shankEnd - fluteEnd), fluteEnd, shankMat)

  if (has(show, 'flute')) addFlutes(group, visual, tipRadius, fluteStart, fluteEnd, fluteMat)

  if (has(show, 'gash')) {
    const slot = new THREE.Mesh(
      new THREE.BoxGeometry(tipRadius * 0.28, tipRadius * 1.35, Math.max(0.4, tipRadius * 0.45)),
      metal(GASH),
    )
    slot.position.set(0, 0, tipZ + tipRadius * 0.22)
    slot.rotation.z = 0.5
    group.add(slot)
  }

  if (has(show, 'wear')) {
    const blob = new THREE.Mesh(new THREE.SphereGeometry(tipRadius * 0.72, 12, 10), metal(WEAR))
    blob.scale.z = 0.55
    blob.position.z = tipZ + tipRadius * 0.12
    group.add(blob)
  }

  if (has(show, 'coolant') && visual.coolantHoles > 0) {
    const holes = Math.min(2, visual.coolantHoles)
    for (let index = 0; index < holes; index += 1) {
      const angle = (index / holes) * Math.PI
      const hole = new THREE.Mesh(
        new THREE.CylinderGeometry(Math.max(0.12, tipRadius * 0.1), Math.max(0.12, tipRadius * 0.1), fluteEnd - tipZ, 8),
        metal(HOLE),
      )
      hole.rotation.x = -Math.PI / 2
      hole.position.set(
        Math.cos(angle) * tipRadius * 0.32,
        Math.sin(angle) * tipRadius * 0.32,
        (tipZ + fluteEnd) / 2,
      )
      group.add(hole)
    }
  }

  if (has(show, 'driver')) {
    const flat = new THREE.Mesh(new THREE.BoxGeometry(shankRadius * 0.45, shankRadius * 1.7, 7), metal(0x6d7c88))
    flat.position.set(shankRadius * 0.8, 0, shankEnd - 6)
    group.add(flat)
  }

  const metrics: ToolMetrics = { tipZ, tipRadius, fluteStart, fluteEnd, shoulderZ, shankEnd }
  group.userData.metrics = metrics
  return group
}

function readMetrics(group: THREE.Group): ToolMetrics {
  return group.userData.metrics as ToolMetrics
}

function setGroupOpacity(group: THREE.Group, opacity: number) {
  const visible = opacity > 0.03
  group.visible = visible
  group.traverse((obj) => {
    if (!(obj instanceof THREE.Mesh)) return
    const material = obj.material
    if (!(material instanceof THREE.MeshStandardMaterial)) return
    material.opacity = opacity
    material.transparent = opacity < 0.98
    material.depthWrite = opacity > 0.9
  })
}

function disposeGroup(group: THREE.Group) {
  group.traverse((obj) => {
    if (!(obj instanceof THREE.Mesh)) return
    obj.geometry.dispose()
    const material = obj.material
    if (Array.isArray(material)) material.forEach((item) => item.dispose())
    else material.dispose()
  })
}

export class GrindScene {
  private readonly mount: HTMLElement
  private readonly scene = new THREE.Scene()
  private readonly camera: THREE.PerspectiveCamera
  private readonly renderer: THREE.WebGLRenderer
  private readonly root = new THREE.Group()
  private readonly wheelPivot = new THREE.Group()
  private readonly wheelSpin = new THREE.Group()
  private readonly wheelMat = metal(0x2f6f62)
  private groups: THREE.Group[] = []
  private operations: SceneOp[] = []
  private visual: GrindVisual | null = null
  private initialShow: GrindStage[] = []
  private progress = 0
  private opCount = 1
  private playing = false
  private speed = 1
  private preset: CameraPreset = 'overview'
  private last = 0
  private uiWait = 0
  private lastOp = -1
  private raf = 0
  private observer: ResizeObserver | null = null
  private readonly camPos = new THREE.Vector3(46, 24, 30)
  private readonly look = new THREE.Vector3(0, 0, 24)
  private readonly desiredPos = new THREE.Vector3(46, 24, 30)
  private readonly desiredLook = new THREE.Vector3(0, 0, 24)

  onProgress: ((progress: number, playing: boolean) => void) | null = null

  constructor(mount: HTMLElement) {
    this.mount = mount
    const width = mount.clientWidth || 640
    const height = mount.clientHeight || 420
    this.camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 1000)
    this.renderer = new THREE.WebGLRenderer({ antialias: true })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
    this.renderer.setSize(width, height)
    mount.appendChild(this.renderer.domElement)

    this.scene.background = new THREE.Color(0x0e1418)
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.5))
    const key = new THREE.DirectionalLight(0xffffff, 0.95)
    key.position.set(30, 50, 20)
    this.scene.add(key)
    const fill = new THREE.DirectionalLight(0x4ecdc4, 0.28)
    fill.position.set(-24, 12, -10)
    this.scene.add(fill)

    const grid = new THREE.GridHelper(140, 14, 0x243340, 0x1a2630)
    grid.position.y = -10
    this.scene.add(grid)
    this.scene.add(this.root)

    const disc = new THREE.Mesh(new THREE.CylinderGeometry(8, 8, 1.15, 24), this.wheelMat)
    const rim = new THREE.Mesh(
      new THREE.CylinderGeometry(8.35, 8.35, 0.28, 24),
      metal(0x141c22),
    )
    this.wheelSpin.add(disc, rim)
    this.wheelSpin.rotation.z = Math.PI / 2
    this.wheelPivot.add(this.wheelSpin)
    this.wheelPivot.visible = false
    this.scene.add(this.wheelPivot)

    this.observer = new ResizeObserver(() => this.resize())
    this.observer.observe(mount)
    this.last = performance.now()
    this.raf = requestAnimationFrame(this.frame)
  }

  setPlan(visual: GrindVisual, initialShow: GrindStage[], operations: SceneOp[]) {
    this.visual = visual
    this.initialShow = initialShow
    this.operations = operations
    this.opCount = Math.max(1, operations.length)
    this.playing = false
    this.progress = 0
    this.lastOp = -1
    this.rebuild()
    this.apply(0)
  }

  setWheels(operations: SceneOp[]) {
    this.operations = operations
  }

  getProgress(): number {
    return this.progress
  }

  setProgress(progress: number) {
    this.progress = Math.min(this.opCount, Math.max(0, progress))
    this.apply(this.progress)
  }

  play() {
    if (this.progress >= this.opCount - 0.01) this.progress = 0
    this.playing = true
  }

  pause() {
    this.playing = false
  }

  setSpeed(speed: number) {
    this.speed = speed > 0 ? speed : 1
  }

  setCamera(preset: CameraPreset) {
    this.preset = preset
  }

  resize() {
    const width = this.mount.clientWidth || 640
    const height = this.mount.clientHeight || 420
    this.camera.aspect = width / height
    this.camera.updateProjectionMatrix()
    this.renderer.setSize(width, height)
  }

  dispose() {
    cancelAnimationFrame(this.raf)
    this.observer?.disconnect()
    this.clearGroups()
    this.wheelMat.dispose()
    this.renderer.dispose()
    this.renderer.domElement.remove()
  }

  private rebuild() {
    if (!this.visual) return
    this.clearGroups()
    const shows = [this.initialShow, ...this.operations.map((op) => op.show)]
    this.groups = shows.map((show) => {
      const group = buildTool(this.visual as GrindVisual, show)
      group.visible = false
      this.root.add(group)
      return group
    })
  }

  private clearGroups() {
    for (const group of this.groups) {
      this.root.remove(group)
      disposeGroup(group)
    }
    this.groups = []
  }

  private frame = (now: number) => {
    const dt = Math.min(0.05, (now - this.last) / 1000)
    this.last = now
    if (this.playing) {
      this.progress = Math.min(this.opCount, this.progress + (dt * this.speed) / 2.5)
      if (this.progress >= this.opCount) {
        this.playing = false
        this.progress = this.opCount
      }
    }
    this.apply(this.progress)
    this.wheelSpin.rotation.x += dt * 5
    this.uiWait += dt
    const op = Math.floor(this.progress)
    if (this.playing && (this.uiWait > 0.1 || op !== this.lastOp)) {
      this.uiWait = 0
      this.lastOp = op
      this.onProgress?.(this.progress, true)
    } else if (!this.playing && this.lastOp !== -2 && op !== this.lastOp) {
      this.lastOp = op
      this.onProgress?.(this.progress, false)
    }
    this.camPos.lerp(this.desiredPos, 0.08)
    this.look.lerp(this.desiredLook, 0.08)
    this.camera.position.copy(this.camPos)
    this.camera.lookAt(this.look)
    this.renderer.render(this.scene, this.camera)
    this.raf = requestAnimationFrame(this.frame)
  }

  private apply(progress: number) {
    const count = this.groups.length
    if (count === 0) return
    const done = progress >= this.opCount
    const index = done ? this.opCount - 1 : Math.min(this.opCount - 1, Math.floor(progress))
    const intra = done ? 1 : progress - index
    for (let groupIndex = 0; groupIndex < count; groupIndex += 1) {
      const group = this.groups[groupIndex]
      if (!group) continue
      if (done) setGroupOpacity(group, groupIndex === count - 1 ? 1 : 0)
      else if (groupIndex === index) setGroupOpacity(group, 1 - intra)
      else if (groupIndex === index + 1) setGroupOpacity(group, intra)
      else setGroupOpacity(group, 0)
    }

    const current = this.groups[Math.min(count - 1, index + (intra > 0.5 || done ? 1 : 0))]
    const metrics = current ? readMetrics(current) : null
    const op = this.operations[index]
    if (metrics && op && !done) {
      const visible = placeWheel(op.duty, intra, metrics, this.wheelPivot)
      this.wheelPivot.visible = visible
      this.wheelMat.color.setHex(op.abrasive === 'cbn' ? 0xb0893e : 0x2f6f62)
    } else {
      this.wheelPivot.visible = false
    }
    if (metrics) this.aim(metrics)
  }

  private aim(metrics: ToolMetrics) {
    const mid = (metrics.fluteStart + metrics.fluteEnd) / 2
    switch (this.preset) {
      case 'overview':
        this.desiredPos.set(metrics.tipRadius * 6 + 26, 18, metrics.shankEnd * 0.25)
        this.desiredLook.set(0, 0, metrics.shankEnd * 0.42)
        break
      case 'tip':
        this.desiredPos.set(16, 9, metrics.tipZ - 12)
        this.desiredLook.set(0, 0, metrics.tipZ + 3)
        break
      case 'flute':
        this.desiredPos.set(20, 11, mid + 6)
        this.desiredLook.set(0, 0, mid)
        break
      case 'wheel':
        this.desiredPos.set(this.wheelPivot.position.x + 14, this.wheelPivot.position.y + 10, this.wheelPivot.position.z + 10)
        this.desiredLook.copy(this.wheelPivot.position)
        break
      default: {
        const neverPreset: never = this.preset
        this.desiredLook.set(0, 0, neverPreset)
      }
    }
  }
}

function placeWheel(duty: GrindDuty, intra: number, metrics: ToolMetrics, pivot: THREE.Group): boolean {
  const gap = metrics.tipRadius + 8.4
  const along = metrics.fluteStart + (metrics.fluteEnd - metrics.fluteStart) * (0.12 + 0.76 * intra)
  switch (duty) {
    case 'inspect':
    case 'blank-feature':
      return false
    case 'od':
    case 'clearance':
      pivot.position.set(gap, 0, along)
      pivot.rotation.set(0, 0, 0)
      return true
    case 'flute':
      pivot.position.set(gap * 0.92, metrics.tipRadius * 0.35, along)
      pivot.rotation.set(0.25, 0, 0.35)
      return true
    case 'gash':
      pivot.position.set(metrics.tipRadius * 0.15, metrics.tipRadius * 0.9, metrics.tipZ + metrics.tipRadius * 0.3)
      pivot.rotation.set(0.9, 0.1, 0.2)
      return true
    case 'point':
      pivot.position.set(gap * 0.72, metrics.tipRadius * 0.35, metrics.tipZ + Math.max(1.4, metrics.tipRadius * 0.55))
      pivot.rotation.set(0.75, 0.15, 0.45)
      return true
    case 'chamfer':
      pivot.position.set(gap * 0.8, 0, metrics.shoulderZ)
      pivot.rotation.set(0.55, 0, 0.1)
      return true
    default: {
      const neverDuty: never = duty
      return neverDuty
    }
  }
}
