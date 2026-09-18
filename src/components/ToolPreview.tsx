import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { layoutTool } from '../lib/toolGeometry'
import type { DrillParams, EndmillParams, ToolType } from '../lib/types'

interface Props {
  toolType: ToolType
  params: EndmillParams | DrillParams
}

const STEEL = 0x8a9ba8
const CARBIDE = 0xc5ccd3
const FLUTE = 0x2f3a44
const ACCENT = 0x2a9d8f

export function ToolPreview({ toolType, params }: Props) {
  const mountRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return

    const w = mount.clientWidth || 400
    const h = mount.clientHeight || 360

    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x0e1418)

    const camera = new THREE.PerspectiveCamera(40, w / h, 0.1, 1000)
    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setSize(w, h)
    mount.appendChild(renderer.domElement)

    const ambient = new THREE.AmbientLight(0xffffff, 0.45)
    scene.add(ambient)
    const key = new THREE.DirectionalLight(0xffffff, 0.9)
    key.position.set(40, 60, 40)
    scene.add(key)
    const fill = new THREE.DirectionalLight(0x4ecdc4, 0.25)
    fill.position.set(-30, 20, -20)
    scene.add(fill)

    const group = new THREE.Group()
    scene.add(group)

    const matShank = new THREE.MeshStandardMaterial({
      color: STEEL,
      metalness: 0.85,
      roughness: 0.35,
    })
    const matCutting = new THREE.MeshStandardMaterial({
      color: params.material === 'carbide' ? CARBIDE : 0xb8a070,
      metalness: 0.7,
      roughness: 0.4,
    })
    const matFlute = new THREE.MeshStandardMaterial({
      color: FLUTE,
      metalness: 0.6,
      roughness: 0.45,
    })
    const matTip = new THREE.MeshStandardMaterial({
      color: ACCENT,
      metalness: 0.5,
      roughness: 0.35,
    })
    // Double-sided variant for the revolved (Lathe) end cap so the open top of
    // the profile never culls into an invisible face.
    const matEnd = new THREE.MeshStandardMaterial({
      color: params.material === 'carbide' ? CARBIDE : 0xb8a070,
      metalness: 0.7,
      roughness: 0.4,
      side: THREE.DoubleSide,
    })

    const layout = layoutTool(toolType, params)
    const dia = layout.diameter
    const shankDia = layout.shankDiameter

    // Align tool along +Z (tip at +Z, shank toward -Z), then rotate for view
    let z = 0

    if (toolType === 'drill') {
      const coneH = layout.coneHeight
      const tip = new THREE.Mesh(
        new THREE.ConeGeometry(dia / 2, coneH, 24),
        matTip,
      )
      tip.rotation.x = Math.PI / 2
      tip.position.z = z + coneH / 2
      group.add(tip)
      z += coneH
    } else if (layout.cornerRadius > 0.001) {
      // Rounded cutting end (bull-nose; a full ball-nose when corner R =
      // radius), built by revolving the actual end profile so the corner
      // radius is visible and scales with the parameter.
      const cr = layout.cornerRadius
      const R = dia / 2
      const flat = Math.max(R - cr, 0)
      const profile: THREE.Vector2[] = [new THREE.Vector2(0, 0)]
      if (flat > 0) profile.push(new THREE.Vector2(flat, 0))
      const arcSteps = 10
      for (let s = 0; s <= arcSteps; s++) {
        const th = (s / arcSteps) * (Math.PI / 2)
        profile.push(
          new THREE.Vector2(flat + cr * Math.sin(th), cr - cr * Math.cos(th)),
        )
      }
      const end = new THREE.Mesh(new THREE.LatheGeometry(profile, 48), matEnd)
      end.rotation.x = Math.PI / 2
      end.position.z = z
      group.add(end)
      z += cr
    } else {
      const capH = layout.squareCapHeight
      const end = new THREE.Mesh(
        new THREE.CylinderGeometry(dia / 2, dia / 2, capH, 48),
        matCutting,
      )
      end.rotation.x = Math.PI / 2
      end.position.z = z + capH / 2
      group.add(end)
      z += capH
    }

    const fluteLen = layout.fluteLength
    const fluteBody = new THREE.Mesh(
      new THREE.CylinderGeometry(dia / 2, dia / 2, Math.max(fluteLen, 0.5), 48),
      matCutting,
    )
    fluteBody.rotation.x = Math.PI / 2
    fluteBody.position.z = z + fluteLen / 2
    group.add(fluteBody)

    const fluteCount = layout.fluteCount
    const drawnFluteLen = Math.max(fluteLen, 0.5)
    const totalTwist = layout.helixTwist
    const grooveRadius = dia * 0.46
    const tubeRadius = Math.max(dia * 0.1, 0.03)
    const segments = Math.max(24, Math.round((totalTwist / (Math.PI * 2)) * 40))
    for (let i = 0; i < fluteCount; i++) {
      const baseAngle = (i / fluteCount) * Math.PI * 2
      const points: THREE.Vector3[] = []
      for (let k = 0; k <= segments; k++) {
        const t = k / segments
        const a = baseAngle + t * totalTwist
        points.push(
          new THREE.Vector3(
            Math.cos(a) * grooveRadius,
            Math.sin(a) * grooveRadius,
            z + t * drawnFluteLen,
          ),
        )
      }
      const curve = new THREE.CatmullRomCurve3(points)
      const groove = new THREE.Mesh(
        new THREE.TubeGeometry(curve, segments, tubeRadius, 8, false),
        matFlute,
      )
      group.add(groove)
    }
    z += fluteLen

    if (layout.neckDiameter != null && layout.neckLength != null) {
      const nd = layout.neckDiameter
      const nl = layout.neckLength
      const neck = new THREE.Mesh(
        new THREE.CylinderGeometry(nd / 2, nd / 2, nl, 24),
        matShank,
      )
      neck.rotation.x = Math.PI / 2
      neck.position.z = z + nl / 2
      group.add(neck)
      z += nl
    }

    if (layout.extraBodyLength > 0.001) {
      const gap = layout.extraBodyLength
      const body = new THREE.Mesh(
        new THREE.CylinderGeometry(dia / 2, dia / 2, gap, 32),
        matCutting,
      )
      body.rotation.x = Math.PI / 2
      body.position.z = z + gap / 2
      group.add(body)
      z += gap
    }

    const shankH = layout.effectiveShankHeight
    const shank = new THREE.Mesh(
      new THREE.CylinderGeometry(shankDia / 2, shankDia / 2, shankH, 32),
      matShank,
    )
    shank.rotation.x = Math.PI / 2
    shank.position.z = z + shankH / 2
    group.add(shank)

    // Center group
    const box = new THREE.Box3().setFromObject(group)
    const center = box.getCenter(new THREE.Vector3())
    group.position.sub(center)

    // Orient tip up-ish for nicer view
    group.rotation.x = -Math.PI / 2.4
    group.rotation.z = Math.PI / 8

    const size = box.getSize(new THREE.Vector3()).length()
    camera.position.set(size * 0.55, size * 0.35, size * 0.7)
    camera.lookAt(0, 0, 0)

    // Drag to orbit instead of a forced spin.
    const controls = new OrbitControls(camera, renderer.domElement)
    controls.target.set(0, 0, 0)
    controls.enableDamping = true
    controls.dampingFactor = 0.08
    controls.enablePan = false
    controls.minDistance = size * 0.35
    controls.maxDistance = size * 1.8
    controls.update()

    // Grid helper (subtle)
    const grid = new THREE.GridHelper(size * 1.5, 10, 0x1e2a32, 0x162028)
    grid.position.y = -size * 0.35
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
      renderer.dispose()
      matShank.dispose()
      matCutting.dispose()
      matFlute.dispose()
      matTip.dispose()
      matEnd.dispose()
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
        <span className="preview-badge">Simplified geometry — not grind sim</span>
      </div>
      <div ref={mountRef} className="preview-canvas" />
    </div>
  )
}
