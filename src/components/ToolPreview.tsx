import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
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
      // Cone height derived from the point angle so 118° vs 135° differ visibly:
      // sharper angle -> taller point, blunter angle -> shorter point.
      const coneH = Math.max(dia / 2 / Math.tan(half), dia * 0.05)
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
      const cr = Math.min(Math.max(em.cornerRadius, 0), params.diameter / 2) * scale
      if (cr > 0.001) {
        // Rounded cutting end (bull-nose; a full ball-nose when corner R =
        // radius), built by revolving the actual end profile so the corner
        // radius is visible and scales with the parameter.
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
        // Square end — flat cap.
        const capH = Math.max(dia * 0.06, 0.05)
        const end = new THREE.Mesh(
          new THREE.CylinderGeometry(dia / 2, dia / 2, capH, 48),
          matCutting,
        )
        end.rotation.x = Math.PI / 2
        end.position.z = z + capH / 2
        group.add(end)
        z += capH
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

    // Helical flutes — each groove follows a helix wrapping around the body,
    // so flutes run down the tool and twist by the helix angle.
    const fluteCount = Math.max(2, Math.min(8, params.fluteCount | 0))
    const drawnFluteLen = Math.max(fluteLen, 0.5)
    const helixDeg = toolType === 'endmill' ? ((params as EndmillParams).helixAngle || 30) : 30
    const helixRad = (helixDeg * Math.PI) / 180
    const realDia = Math.max(params.diameter, 0.5)
    const realFluteLen = Math.max(
      Math.min(params.fluteLength, params.overallLength - 0.5),
      0.5,
    )
    // Total wrap angle over the flute length for a helix of this lead, capped so
    // very long/steep flutes stay legible.
    const totalTwist = Math.min(
      (2 * realFluteLen * Math.tan(helixRad)) / realDia,
      Math.PI * 4,
    )
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

    // Optional neck (endmill)
    let neckAdded = false
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
        neckAdded = true
      }
    }

    // Shank length honored directly; the leftover length up to the overall
    // length is filled with a plain body so both parameters change the model.
    let shankH = Math.max(shankLen, dia * 0.4)
    const gap = oal - z - shankH
    if (gap > 0.001) {
      if (neckAdded) {
        // A necked tool already stepped down before the shank, so just extend
        // the shank rather than adding a full-diameter body after the neck.
        shankH += gap
      } else {
        const body = new THREE.Mesh(
          new THREE.CylinderGeometry(dia / 2, dia / 2, gap, 32),
          matCutting,
        )
        body.rotation.x = Math.PI / 2
        body.position.z = z + gap / 2
        group.add(body)
        z += gap
      }
    }

    // Shank
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
