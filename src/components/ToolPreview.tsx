import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'
import {
  coatingHex,
  createFlutedToolGeometry,
  substrateHex,
  type TipShape,
} from '../lib/toolMesh'
import { layoutTool } from '../lib/toolGeometry'
import type { DrillParams, EndmillParams, ToolType } from '../lib/types'

interface Props {
  toolType: ToolType
  params: EndmillParams | DrillParams
}

const STEEL = 0x8d97a0

export function ToolPreview({ toolType, params }: Props) {
  const mountRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return

    const w = mount.clientWidth || 400
    const h = mount.clientHeight || 360

    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x0c1216)

    const camera = new THREE.PerspectiveCamera(38, w / h, 0.1, 1000)
    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setSize(w, h)
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.08
    renderer.outputColorSpace = THREE.SRGBColorSpace
    mount.appendChild(renderer.domElement)

    const pmrem = new THREE.PMREMGenerator(renderer)
    const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
    scene.environment = envTex
    scene.environmentIntensity = 0.9

    scene.add(new THREE.AmbientLight(0xffffff, 0.22))
    const key = new THREE.DirectionalLight(0xfff6ea, 1.15)
    key.position.set(36, 54, 28)
    scene.add(key)
    const fill = new THREE.DirectionalLight(0xb9d4e8, 0.32)
    fill.position.set(-40, 16, -18)
    scene.add(fill)
    const rim = new THREE.DirectionalLight(0xe8f2ff, 0.4)
    rim.position.set(8, 12, -50)
    scene.add(rim)

    const group = new THREE.Group()
    scene.add(group)

    const coat = coatingHex(params.coating, params.material)
    const steel = substrateHex(params.material)
    const matCutting = new THREE.MeshStandardMaterial({
      color: coat,
      metalness: 0.92,
      roughness: 0.22,
      envMapIntensity: 1.05,
    })
    const matShank = new THREE.MeshStandardMaterial({
      color: STEEL,
      metalness: 0.88,
      roughness: 0.3,
      envMapIntensity: 0.85,
    })
    const matShankCap = new THREE.MeshStandardMaterial({
      color: STEEL,
      metalness: 0.88,
      roughness: 0.3,
      side: THREE.DoubleSide,
      envMapIntensity: 0.85,
    })
    const matBlend = new THREE.MeshStandardMaterial({
      color: steel,
      metalness: 0.9,
      roughness: 0.26,
      envMapIntensity: 0.95,
    })

    const layout = layoutTool(toolType, params)
    const dia = layout.diameter
    const shankDia = layout.shankDiameter
    const fluteLen = Math.max(layout.fluteLength, 0.05)

    let tipShape: TipShape
    let tipLength: number
    let cornerRadius = 0
    let webOuter = 0.42
    let webTip = 0.28
    let marginFrac = 0.12
    if (toolType === 'drill') {
      tipShape = 'cone'
      tipLength = layout.coneHeight
      webOuter = 0.22
      const note = (params as DrillParams).webThinningNote.toLowerCase()
      webTip = note.includes('split') || note.includes('thin') ? 0.08 : 0.12
      marginFrac = 0.1
    } else if (layout.cornerRadius > 0.001) {
      tipShape = 'bull'
      tipLength = layout.cornerRadius
      cornerRadius = layout.cornerRadius
      webOuter = layout.fluteCount >= 6 ? 0.55 : 0.4
      webTip = webOuter
      marginFrac = 0.14
    } else {
      tipShape = 'square'
      tipLength = 0
      webOuter = layout.fluteCount >= 6 ? 0.55 : 0.4
      webTip = webOuter
      marginFrac = 0.14
    }

    const fluted = new THREE.Mesh(
      createFlutedToolGeometry({
        radius: dia / 2,
        length: fluteLen + (tipShape === 'square' ? 0 : tipLength),
        fluteCount: layout.fluteCount,
        twist: layout.helixTwist,
        tipLength,
        tipShape,
        cornerRadius,
        webOuterFrac: webOuter,
        webTipFrac: webTip,
        marginFrac,
      }),
      matCutting,
    )
    group.add(fluted)
    let z = fluteLen + (tipShape === 'square' ? 0 : tipLength)

    if (tipShape === 'square') {
      const face = new THREE.Mesh(
        new THREE.CircleGeometry(dia / 2, 64),
        matCutting,
      )
      face.rotation.x = Math.PI
      group.add(face)
    }

    if (layout.neckDiameter != null && layout.neckLength != null) {
      const nd = layout.neckDiameter
      const nl = layout.neckLength
      const neck = new THREE.Mesh(
        new THREE.CylinderGeometry(nd / 2, nd / 2, nl, 48),
        matBlend,
      )
      neck.rotation.x = Math.PI / 2
      neck.position.z = z + nl / 2
      group.add(neck)
      z += nl
    }

    if (layout.extraBodyLength > 0.001) {
      const gap = layout.extraBodyLength
      const body = new THREE.Mesh(
        new THREE.CylinderGeometry(dia / 2, dia / 2, gap, 48),
        matCutting,
      )
      body.rotation.x = Math.PI / 2
      body.position.z = z + gap / 2
      group.add(body)
      z += gap
    }

    const shankH = layout.effectiveShankHeight
    const chamfer = Math.min(shankDia * 0.18, shankH * 0.12)
    const mainH = Math.max(shankH - chamfer, shankH * 0.75)
    const shank = new THREE.Mesh(
      new THREE.CylinderGeometry(shankDia / 2, shankDia / 2, mainH, 48),
      matShank,
    )
    shank.rotation.x = Math.PI / 2
    shank.position.z = z + mainH / 2
    group.add(shank)
    z += mainH
    if (chamfer > 0.002) {
      const bevel = new THREE.Mesh(
        new THREE.CylinderGeometry(shankDia / 2 * 0.86, shankDia / 2, chamfer, 48),
        matShank,
      )
      bevel.rotation.x = Math.PI / 2
      bevel.position.z = z + chamfer / 2
      group.add(bevel)
      z += chamfer
    }
    const shankCap = new THREE.Mesh(
      new THREE.CircleGeometry(shankDia / 2 * 0.86, 48),
      matShankCap,
    )
    shankCap.position.z = z
    group.add(shankCap)

    group.rotation.x = -Math.PI / 2.4
    group.rotation.z = Math.PI / 8
    group.updateMatrixWorld(true)

    const rawBox = new THREE.Box3().setFromObject(group)
    group.position.sub(rawBox.getCenter(new THREE.Vector3()))
    group.updateMatrixWorld(true)

    const box = new THREE.Box3().setFromObject(group)
    const size = box.getSize(new THREE.Vector3())
    const maxDim = Math.max(size.x, size.y, size.z, 0.01)
    const fov = (camera.fov * Math.PI) / 180
    const dist = (maxDim / 2 / Math.tan(fov / 2)) * 1.55
    camera.position.set(dist * 0.7, dist * 0.24, dist * 0.86)
    camera.lookAt(0, 0, 0)
    camera.near = Math.max(dist / 120, 0.01)
    camera.far = dist * 24
    camera.updateProjectionMatrix()

    const controls = new OrbitControls(camera, renderer.domElement)
    controls.target.set(0, 0, 0)
    controls.enableDamping = true
    controls.dampingFactor = 0.08
    controls.enablePan = false
    controls.minDistance = dist * 0.35
    controls.maxDistance = dist * 3
    controls.update()

    const grid = new THREE.GridHelper(maxDim * 2.2, 12, 0x1e2a32, 0x162028)
    grid.position.y = box.min.y - maxDim * 0.04
    scene.add(grid)

    let frame = 0
    let raf = 0
    const animate = () => {
      raf = requestAnimationFrame(animate)
      controls.update()
      renderer.render(scene, camera)
      frame++
    }
    animate()

    const onResize = () => {
      if (!mount) return
      const nw = mount.clientWidth
      const nh = mount.clientHeight
      camera.aspect = nw / nh
      camera.updateProjectionMatrix()
      renderer.setSize(nw, nh)
    }
    const ro = new ResizeObserver(onResize)
    ro.observe(mount)

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      controls.dispose()
      envTex.dispose()
      pmrem.dispose()
      renderer.dispose()
      matCutting.dispose()
      matShank.dispose()
      matShankCap.dispose()
      matBlend.dispose()
      scene.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          obj.geometry.dispose()
        }
      })
      if (mount.contains(renderer.domElement)) {
        mount.removeChild(renderer.domElement)
      }
      void frame
    }
  }, [toolType, params])

  return (
    <div className="preview-panel">
      <div className="preview-header">
        <span className="preview-title">Live 3D preview · drag to rotate</span>
        <span className="preview-badge">Approximate geometry — not grind sim</span>
      </div>
      <div ref={mountRef} className="preview-canvas" />
    </div>
  )
}
