import * as THREE from 'three'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'
import type { GrindDuty, GrindStage, GrindVisual } from '../lib/grindOps'
import type { DrillParams } from '../lib/types'
import { buildDrillMesh } from './realisticDrill'
import type { DrillReveal } from './fluteProfile'
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

function has(show: readonly GrindStage[], stage: GrindStage): boolean {
  return show.includes(stage)
}

function revealFor(show: readonly GrindStage[], visual: GrindVisual): DrillReveal {
  const face = has(show, 'face')
  return {
    fluteOpen: has(show, 'flute') ? 1 : 0,
    point: has(show, 'point') && !face,
    clearance: has(show, 'clearance'),
    steps: has(show, 'step'),
    chamfer: has(show, 'chamfer'),
    coolant: has(show, 'coolant'),
    driver: has(show, 'driver'),
    stock: !has(show, 'od'),
    flatFace: face,
    wear: has(show, 'wear'),
    gash: has(show, 'gash'),
    relief: has(show, 'secondary'),
    shortenMm: has(show, 'length') ? visual.stockMm : 0,
  }
}

function metal(color: number): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color,
    metalness: 0.72,
    roughness: 0.38,
  })
}

function scaleMetrics(metrics: ToolMetrics, factor: number): ToolMetrics {
  return {
    tipZ: metrics.tipZ * factor,
    tipRadius: metrics.tipRadius * factor,
    fluteStart: metrics.fluteStart * factor,
    fluteEnd: metrics.fluteEnd * factor,
    shoulderZ: metrics.shoulderZ * factor,
    shankEnd: metrics.shankEnd * factor,
  }
}

function buildTool(drill: DrillParams, visual: GrindVisual, show: readonly GrindStage[]): THREE.Group {
  const group = new THREE.Group()
  const lengthScale = 62 / Math.max(drill.overallLength, 1)
  buildDrillMesh(group, drill, lengthScale, { quality: 'sim', reveal: revealFor(show, visual) })
  let metrics = group.userData.metrics as ToolMetrics
  if (metrics.tipRadius > 0 && metrics.tipRadius < 1.5) {
    const factor = 1.5 / metrics.tipRadius
    group.scale.setScalar(factor)
    metrics = scaleMetrics(metrics, factor)
    group.userData.metrics = metrics
  }
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
  private drill: DrillParams | null = null
  private envTex: THREE.Texture | null = null
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
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1.05
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    mount.appendChild(this.renderer.domElement)

    const pmrem = new THREE.PMREMGenerator(this.renderer)
    this.envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
    pmrem.dispose()
    this.scene.environment = this.envTex
    this.scene.environmentIntensity = 0.72
    this.scene.background = new THREE.Color(0x0e1418)
    this.scene.add(new THREE.AmbientLight(0xdfe7ee, 0.22))
    const key = new THREE.DirectionalLight(0xfff4e4, 1.25)
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

  setPlan(drill: DrillParams, visual: GrindVisual, initialShow: GrindStage[], operations: SceneOp[]) {
    this.drill = drill
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
    this.envTex?.dispose()
    this.renderer.dispose()
    this.renderer.domElement.remove()
  }

  private rebuild() {
    if (!this.visual || !this.drill) return
    this.clearGroups()
    const drill = this.drill
    const visual = this.visual
    const shows = [this.initialShow, ...this.operations.map((op) => op.show)]
    this.groups = shows.map((show) => {
      const group = buildTool(drill, visual, show)
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
