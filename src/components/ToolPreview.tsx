import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import type { DrillParams, EndmillParams, ToolType } from '../lib/types'

interface Props {
  toolType: ToolType
  params: EndmillParams | DrillParams
}

const STEEL = 0x8a9ba8
const CARBIDE = 0xc5ccd3
const FLUTE = 0x6b7a86
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

    const scale = 0.12
    const dia = Math.max(params.diameter, 0.5) * scale
    const shankDia = Math.max(params.shankDiameter, 0.5) * scale
    const oal = Math.max(params.overallLength, 1) * scale
    const fluteLen = Math.min(params.fluteLength, params.overallLength - 0.5) * scale
    const shankLen = Math.min(params.shankLength, params.overallLength) * scale

    // Align tool along +Z (tip at +Z, shank toward -Z), then rotate for view
    let z = 0

    // Tip / cutting end
    if (toolType === 'drill') {
      const drill = params as DrillParams
      const pointAngle = ((drill.pointAngle || 118) * Math.PI) / 180
      const half = pointAngle / 2
      const coneH = Math.max(dia * 0.35, (dia / 2) / Math.tan(half))
      const tip = new THREE.Mesh(
        new THREE.ConeGeometry(dia / 2, coneH, 24),
        matTip,
      )
      tip.rotation.x = Math.PI / 2
      tip.position.z = z + coneH / 2
      group.add(tip)
      z += coneH
    } else {
      const em = params as EndmillParams
      if (em.cornerRadius > 0) {
        const r = Math.min(em.cornerRadius, params.diameter / 2) * scale
        const torus = new THREE.Mesh(
          new THREE.TorusGeometry(dia / 2 - r, r, 12, 32, Math.PI),
          matCutting,
        )
        torus.rotation.y = Math.PI / 2
        torus.position.z = z + r * 0.15
        // simpler: rounded end disc
        const end = new THREE.Mesh(
          new THREE.CylinderGeometry(dia / 2, dia / 2, r * 1.2, 32),
          matCutting,
        )
        end.rotation.x = Math.PI / 2
        end.position.z = z + r * 0.6
        group.add(end)
        z += r * 1.2
      } else {
        const end = new THREE.Mesh(
          new THREE.CylinderGeometry(dia / 2, dia / 2, 0.15 * scale * 10, 32),
          matCutting,
        )
        end.rotation.x = Math.PI / 2
        end.position.z = z + 0.08
        group.add(end)
        z += 0.15
      }
    }

    // Fluted section — cylinder with helical groove approximations (thin cylinders offset)
    const fluteBody = new THREE.Mesh(
      new THREE.CylinderGeometry(dia / 2, dia / 2, Math.max(fluteLen, 0.5), 48),
      matCutting,
    )
    fluteBody.rotation.x = Math.PI / 2
    fluteBody.position.z = z + fluteLen / 2
    group.add(fluteBody)

    const fluteCount = Math.max(2, Math.min(8, params.fluteCount | 0))
    for (let i = 0; i < fluteCount; i++) {
      const angle = (i / fluteCount) * Math.PI * 2
      const groove = new THREE.Mesh(
        new THREE.CylinderGeometry(dia * 0.12, dia * 0.12, Math.max(fluteLen * 0.95, 0.4), 8),
        matFlute,
      )
      groove.rotation.x = Math.PI / 2
      const helix = toolType === 'endmill' ? ((params as EndmillParams).helixAngle || 30) : 30
      const twist = (helix / 45) * 0.35
      groove.position.set(
        Math.cos(angle) * dia * 0.38,
        Math.sin(angle) * dia * 0.38,
        z + fluteLen / 2,
      )
      groove.rotation.z = angle + twist
      group.add(groove)
    }
    z += fluteLen

    // Optional neck (endmill)
    if (toolType === 'endmill') {
      const em = params as EndmillParams
      if (em.neckDiameter != null && em.neckLength != null && em.neckLength > 0) {
        const nd = Math.max(em.neckDiameter, 0.3) * scale
        const nl = em.neckLength * scale
        const neck = new THREE.Mesh(
          new THREE.CylinderGeometry(nd / 2, nd / 2, nl, 24),
          matShank,
        )
        neck.rotation.x = Math.PI / 2
        neck.position.z = z + nl / 2
        group.add(neck)
        z += nl
      }
    }

    // Shank
    const remaining = Math.max(oal * 0.15, shankLen * 0.5, oal - z)
    const shankH = Math.max(remaining, shankLen * 0.6)
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

    // Grid helper (subtle)
    const grid = new THREE.GridHelper(size * 1.5, 10, 0x1e2a32, 0x162028)
    grid.position.y = -size * 0.35
    scene.add(grid)

    let frame = 0
    let raf = 0
    const animate = () => {
      raf = requestAnimationFrame(animate)
      group.rotation.y += 0.008
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
      renderer.dispose()
      matShank.dispose()
      matCutting.dispose()
      matFlute.dispose()
      matTip.dispose()
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
        <span className="preview-title">Live 3D preview</span>
        <span className="preview-badge">Simplified geometry — not grind sim</span>
      </div>
      <div ref={mountRef} className="preview-canvas" />
    </div>
  )
}
