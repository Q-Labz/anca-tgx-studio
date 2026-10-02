import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'
import { drillCaption, normalizeDrill } from '../lib/drillTypes'
import { previewPartLabel, type PreviewPart } from '../lib/drillGuide'
import { buildDrillMesh, buildEndmillMesh } from '../preview/realisticDrill'
import type { DrillParams, EndmillParams, ToolType } from '../lib/types'

interface Props {
  toolType: ToolType
  params: EndmillParams | DrillParams
  highlight?: PreviewPart | null
}

function meshParts(obj: THREE.Object3D): PreviewPart[] {
  const list = obj.userData.parts
  if (Array.isArray(list)) return list as PreviewPart[]
  const one = obj.userData.part
  return typeof one === 'string' ? [one as PreviewPart] : []
}

function applyPreviewHighlight(group: THREE.Group, part: PreviewPart | null) {
  group.traverse((obj) => {
    if (!(obj instanceof THREE.Mesh)) return
    const base = obj.userData.baseMaterial as THREE.Material | undefined
    if (!base) return
    const parts = meshParts(obj)
    if (part && parts.includes(part)) {
      let highlightMat = obj.userData.highlightMaterial as THREE.MeshStandardMaterial | undefined
      if (!highlightMat && base instanceof THREE.MeshStandardMaterial) {
        highlightMat = base.clone()
        highlightMat.color = new THREE.Color(0x14786f)
        highlightMat.emissive = new THREE.Color(0x7dffe8)
        highlightMat.emissiveIntensity = 1.4
        highlightMat.metalness = 0.15
        highlightMat.roughness = 0.35
        obj.userData.highlightMaterial = highlightMat
      }
      if (highlightMat) obj.material = highlightMat
    } else {
      obj.material = base
    }
  })
}

const PREVIEW_SCALE = 0.12

export function ToolPreview({ toolType, params, highlight = null }: Props) {
  const mountRef = useRef<HTMLDivElement>(null)
  const groupRef = useRef<THREE.Group | null>(null)
  const highlightRef = useRef(highlight)

  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return

    const width = mount.clientWidth || 400
    const height = mount.clientHeight || 360
    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x070b0e)

    const camera = new THREE.PerspectiveCamera(32, width / height, 0.1, 1000)
    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setSize(width, height)
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.12
    renderer.outputColorSpace = THREE.SRGBColorSpace
    mount.appendChild(renderer.domElement)

    const pmrem = new THREE.PMREMGenerator(renderer)
    const envTex = pmrem.fromScene(new RoomEnvironment(), 0.035).texture
    scene.environment = envTex
    scene.environmentIntensity = 0.78
    scene.add(new THREE.AmbientLight(0xdfe8f0, 0.14))
    const key = new THREE.DirectionalLight(0xfff4e4, 1.45)
    key.position.set(28, 62, 22)
    scene.add(key)
    const fill = new THREE.DirectionalLight(0x9ec0d8, 0.28)
    fill.position.set(-48, 18, -10)
    scene.add(fill)
    const rim = new THREE.DirectionalLight(0xf3f7ff, 0.62)
    rim.position.set(-6, 18, -56)
    scene.add(rim)

    const group = new THREE.Group()
    groupRef.current = group
    scene.add(group)

    if (toolType === 'drill') {
      buildDrillMesh(group, normalizeDrill(params), PREVIEW_SCALE)
    } else if (toolType === 'endmill') {
      buildEndmillMesh(group, params as EndmillParams, PREVIEW_SCALE)
    } else {
      const neverType: never = toolType
      void neverType
    }

    // Side catalog view: the point stays one tip, and the user orbits instead of a forced spin.
    group.rotation.x = -Math.PI / 2.35
    group.rotation.z = Math.PI / 8
    group.updateMatrixWorld(true)
    const rawBox = new THREE.Box3().setFromObject(group)
    group.position.sub(rawBox.getCenter(new THREE.Vector3()))
    group.updateMatrixWorld(true)

    const box = new THREE.Box3().setFromObject(group)
    const size = box.getSize(new THREE.Vector3())
    const maxDim = Math.max(size.x, size.y, size.z, 0.01)
    const tipWorld = new THREE.Vector3(0, 0, 0).applyMatrix4(group.matrixWorld)
    const look = new THREE.Vector3(0, 0, 0).lerp(tipWorld, toolType === 'endmill' ? 0.2 : 0.08)
    const fov = (camera.fov * Math.PI) / 180
    const dist = (maxDim / 2 / Math.tan(fov / 2)) * 1.14
    camera.position.set(dist * 0.86, dist * 0.22, dist * 0.5)
    camera.lookAt(look)
    camera.near = Math.max(dist / 140, 0.01)
    camera.far = dist * 24
    camera.updateProjectionMatrix()

    const controls = new OrbitControls(camera, renderer.domElement)
    controls.target.copy(look)
    controls.enableDamping = true
    controls.dampingFactor = 0.08
    controls.enablePan = false
    controls.minDistance = dist * 0.28
    controls.maxDistance = dist * 3
    controls.update()

    const grid = new THREE.GridHelper(maxDim * 1.35, 12, 0x1a262e, 0x121a20)
    grid.position.y = box.min.y - maxDim * 0.028
    scene.add(grid)
    const ground = new THREE.Mesh(
      new THREE.CircleGeometry(maxDim * 0.62, 72),
      new THREE.MeshPhysicalMaterial({ color: 0x10161b, metalness: 0.45, roughness: 0.62 }),
    )
    ground.rotation.x = -Math.PI / 2
    ground.position.y = box.min.y - maxDim * 0.027
    scene.add(ground)

    let raf = 0
    const animate = () => {
      raf = requestAnimationFrame(animate)
      controls.update()
      renderer.render(scene, camera)
    }
    animate()

    const onResize = () => {
      const nextW = mount.clientWidth
      const nextH = mount.clientHeight
      camera.aspect = nextW / Math.max(nextH, 1)
      camera.updateProjectionMatrix()
      renderer.setSize(nextW, nextH)
    }
    const observer = new ResizeObserver(onResize)
    observer.observe(mount)
    applyPreviewHighlight(group, highlightRef.current)

    return () => {
      cancelAnimationFrame(raf)
      observer.disconnect()
      controls.dispose()
      envTex.dispose()
      pmrem.dispose()
      renderer.dispose()
      groupRef.current = null
      const seen = new Set<THREE.Material>()
      scene.traverse((obj) => {
        if (!(obj instanceof THREE.Mesh)) return
        obj.geometry.dispose()
        const materials = [obj.userData.baseMaterial, obj.userData.highlightMaterial, obj.material, ground.material]
        for (const material of materials) {
          if (material instanceof THREE.Material && !seen.has(material)) {
            seen.add(material)
            material.dispose()
          }
        }
      })
      if (mount.contains(renderer.domElement)) mount.removeChild(renderer.domElement)
    }
  }, [toolType, params])

  useEffect(() => {
    highlightRef.current = highlight
    if (groupRef.current) applyPreviewHighlight(groupRef.current, highlight)
  }, [highlight])

  const title = toolType === 'drill' ? `${drillCaption(normalizeDrill(params))} · drag to rotate` : 'Live 3D preview · drag to rotate'
  const badge = highlight
    ? `Highlighting the ${previewPartLabel(highlight)}`
    : 'Drag to rotate · approximate geometry'

  return (
    <div className="preview-panel">
      <div className="preview-header">
        <span className="preview-title">{title}</span>
        <span className="preview-badge">{badge}</span>
      </div>
      <div ref={mountRef} className="preview-canvas" />
    </div>
  )
}
