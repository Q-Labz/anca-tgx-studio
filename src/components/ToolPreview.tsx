import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'
import {
  coatingHex,
  coatingLook,
  createFlutedToolGeometry,
  createTwistDrillGeometry,
  substrateHex,
  type TipShape,
} from '../lib/toolMesh'
import { layoutTool } from '../lib/toolGeometry'
import type { DrillParams, EndmillParams, ToolType } from '../lib/types'

interface Props {
  toolType: ToolType
  params: EndmillParams | DrillParams
}

const STEEL = 0x9aa4ae

export function ToolPreview({ toolType, params }: Props) {
  const mountRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return

    const w = mount.clientWidth || 400
    const h = mount.clientHeight || 360

    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x070b0e)

    const camera = new THREE.PerspectiveCamera(32, w / h, 0.1, 1000)
    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setSize(w, h)
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
    const bounce = new THREE.DirectionalLight(0x6f7c86, 0.16)
    bounce.position.set(0, -40, 8)
    scene.add(bounce)

    const group = new THREE.Group()
    scene.add(group)

    const coat = coatingHex(params.coating, params.material)
    const finish = coatingLook(params.coating)
    const steel = substrateHex(params.material)
    const cuttingProps = {
      color: coat,
      metalness: finish.metalness,
      roughness: finish.roughness,
      clearcoat: finish.clearcoat,
      clearcoatRoughness: finish.clearcoatRoughness,
      envMapIntensity: 1.22,
    }
    const matCutting = new THREE.MeshPhysicalMaterial({
      ...cuttingProps,
      vertexColors: true,
    })
    const matCuttingSolid = new THREE.MeshPhysicalMaterial(cuttingProps)
    const matShank = new THREE.MeshPhysicalMaterial({
      color: STEEL,
      metalness: 0.94,
      roughness: 0.22,
      clearcoat: 0.18,
      clearcoatRoughness: 0.35,
      envMapIntensity: 0.95,
      anisotropy: 0.72,
      anisotropyRotation: Math.PI / 2,
    })
    const matShankCap = new THREE.MeshPhysicalMaterial({
      color: STEEL,
      metalness: 0.9,
      roughness: 0.28,
      side: THREE.DoubleSide,
      envMapIntensity: 0.85,
    })
    const matBlend = new THREE.MeshPhysicalMaterial({
      color: steel,
      metalness: 0.93,
      roughness: 0.24,
      envMapIntensity: 1,
    })
    const matGround = new THREE.MeshPhysicalMaterial({
      color: 0x0a1014,
      metalness: 0.42,
      roughness: 0.5,
      envMapIntensity: 0.35,
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
    let splitPoint = false
    if (toolType === 'drill') {
      tipShape = 'cone'
      tipLength = layout.coneHeight
      webOuter = 0.26
      const note = (params as DrillParams).webThinningNote.toLowerCase()
      splitPoint = note.includes('split') || note.includes('thin')
      webTip = splitPoint ? 0.12 : 0.16
      marginFrac = 0.09
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

    let z = 0
    if (toolType === 'drill') {
      // True 118° is ~0.3×D. A modest visual scale keeps 90/118/135 readable
      // without the crayon-cone look of a 2.6× overlay.
      const coneH = Math.max(layout.coneHeight * 1.85, dia * 0.32)
      const fluted = new THREE.Mesh(
        createTwistDrillGeometry({
          radius: dia / 2,
          fluteLength: fluteLen,
          coneHeight: coneH,
          fluteCount: layout.fluteCount,
          twist: layout.helixTwist,
          webOuterFrac: webOuter,
          webTipFrac: webTip,
          marginFrac,
          splitPoint,
        }),
        matCutting,
      )
      group.add(fluted)
      z = coneH + fluteLen
    } else {
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
      z = fluteLen + (tipShape === 'square' ? 0 : tipLength)
    }

    if (tipShape === 'square') {
      const face = new THREE.Mesh(
        new THREE.CircleGeometry(dia / 2, 64),
        matCuttingSolid,
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
        new THREE.CylinderGeometry(dia / 2, dia / 2, gap, 64),
        matCuttingSolid,
      )
      body.rotation.x = Math.PI / 2
      body.position.z = z + gap / 2
      group.add(body)
      z += gap
    }

    const shankH = layout.effectiveShankHeight
    const chamfer = Math.min(shankDia * 0.16, shankH * 0.1)
    const neckIn = Math.min(shankDia * 0.04, shankH * 0.04)
    const mainH = Math.max(shankH - chamfer - neckIn, shankH * 0.72)
    if (neckIn > 0.002) {
      const blend = new THREE.Mesh(
        new THREE.CylinderGeometry(shankDia / 2, shankDia / 2 * 0.98, neckIn, 64),
        matShank,
      )
      blend.rotation.x = Math.PI / 2
      blend.position.z = z + neckIn / 2
      group.add(blend)
      z += neckIn
    }
    const shank = new THREE.Mesh(
      new THREE.CylinderGeometry(shankDia / 2, shankDia / 2, mainH, 64),
      matShank,
    )
    shank.rotation.x = Math.PI / 2
    shank.position.z = z + mainH / 2
    group.add(shank)
    z += mainH
    if (chamfer > 0.002) {
      const bevel = new THREE.Mesh(
        new THREE.CylinderGeometry(shankDia / 2 * 0.84, shankDia / 2, chamfer, 64),
        matShank,
      )
      bevel.rotation.x = Math.PI / 2
      bevel.position.z = z + chamfer / 2
      group.add(bevel)
      z += chamfer
    }
    const shankCap = new THREE.Mesh(
      new THREE.CircleGeometry(shankDia / 2 * 0.84, 64),
      matShankCap,
    )
    shankCap.position.z = z
    group.add(shankCap)

    group.rotation.x = -Math.PI / 2.35
    group.rotation.z = Math.PI / 7
    group.updateMatrixWorld(true)

    const rawBox = new THREE.Box3().setFromObject(group)
    group.position.sub(rawBox.getCenter(new THREE.Vector3()))
    group.updateMatrixWorld(true)

    const box = new THREE.Box3().setFromObject(group)
    const size = box.getSize(new THREE.Vector3())
    const maxDim = Math.max(size.x, size.y, size.z, 0.01)
    const tipWorld = new THREE.Vector3(0, 0, 0).applyMatrix4(group.matrixWorld)
    const look = new THREE.Vector3(0, 0, 0).lerp(tipWorld, 0.08)
    const fov = (camera.fov * Math.PI) / 180
    const dist = (maxDim / 2 / Math.tan(fov / 2)) * 1.14
    camera.position.set(dist * 0.68, dist * 0.2, dist * 0.74)
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

    const ground = new THREE.Mesh(new THREE.CircleGeometry(maxDim * 0.62, 72), matGround)
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
      matCuttingSolid.dispose()
      matShank.dispose()
      matShankCap.dispose()
      matBlend.dispose()
      matGround.dispose()
      scene.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          obj.geometry.dispose()
        }
      })
      if (mount.contains(renderer.domElement)) {
        mount.removeChild(renderer.domElement)
      }
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
