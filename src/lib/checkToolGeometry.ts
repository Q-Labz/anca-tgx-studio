import { DEFAULT_DRILL, DEFAULT_ENDMILL } from './types'
import { layoutTool, PREVIEW_SCALE } from './toolGeometry'
import { envelopeRadius, profileRadius } from './toolMesh'

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg)
}

function nearly(a: number, b: number, eps = 1e-6) {
  return Math.abs(a - b) <= eps
}

const square = layoutTool('endmill', { ...DEFAULT_ENDMILL, cornerRadius: 0 })
assert(square.cornerRadius === 0, 'square end should have zero corner radius')
assert(square.squareCapHeight > 0, 'square end should have a flat cap')

const bull = layoutTool('endmill', { ...DEFAULT_ENDMILL, cornerRadius: 2 })
assert(nearly(bull.cornerRadius, 2 * PREVIEW_SCALE), `corner R=2 should scale, got ${bull.cornerRadius}`)
assert(bull.squareCapHeight === 0, 'rounded end should not use a square cap')
assert(bull.cornerRadius > square.squareCapHeight, 'bull-nose corner should be taller than the square cap')

const ball = layoutTool('endmill', { ...DEFAULT_ENDMILL, cornerRadius: 5 })
assert(nearly(ball.cornerRadius, 5 * PREVIEW_SCALE), 'ball-nose R=5 (half of ⌀10) should use full radius')

const dia16 = layoutTool('endmill', { ...DEFAULT_ENDMILL, diameter: 16 })
assert(dia16.diameter > square.diameter, 'larger diameter should increase body radius')

const flutes7 = layoutTool('endmill', { ...DEFAULT_ENDMILL, fluteCount: 7 })
assert(flutes7.fluteCount === 7, 'flute count 7 should be honored')

const helix0 = layoutTool('endmill', { ...DEFAULT_ENDMILL, helixAngle: 0 })
assert(helix0.helixDeg === 0, `helix 0 must not fall back to 30, got ${helix0.helixDeg}`)
assert(nearly(helix0.helixTwist, 0), `helix 0 must produce zero twist, got ${helix0.helixTwist}`)

const helix45 = layoutTool('endmill', { ...DEFAULT_ENDMILL, helixAngle: 45 })
assert(helix45.helixTwist > helix0.helixTwist, 'steeper helix should twist more')
assert(helix45.helixTwist > square.helixTwist, '45° helix should twist more than default 30°')

const fluteLong = layoutTool('endmill', { ...DEFAULT_ENDMILL, fluteLength: 45 })
assert(fluteLong.fluteLength > square.fluteLength, 'longer flute length should lengthen the fluted section')

const shankShort = layoutTool('endmill', { ...DEFAULT_ENDMILL, shankLength: 15 })
const shankLong = layoutTool('endmill', { ...DEFAULT_ENDMILL, shankLength: 60 })
assert(
  shankLong.effectiveShankHeight > shankShort.effectiveShankHeight,
  `shank length must change shank height (${shankShort.effectiveShankHeight} vs ${shankLong.effectiveShankHeight})`,
)

const oalLong = layoutTool('endmill', { ...DEFAULT_ENDMILL, overallLength: 150 })
assert(oalLong.totalLength > square.totalLength, 'longer OAL should lengthen the tool')
assert(
  oalLong.extraBodyLength > square.extraBodyLength,
  'longer OAL with unchanged flute/shank should grow the leftover body',
)

const thinShank = layoutTool('endmill', { ...DEFAULT_ENDMILL, shankDiameter: 6 })
assert(thinShank.shankDiameter < square.shankDiameter, 'smaller shank diameter should step down')

const necked = layoutTool('endmill', {
  ...DEFAULT_ENDMILL,
  neckDiameter: 6,
  neckLength: 10,
})
assert(necked.neckDiameter != null && necked.neckLength != null, 'neck params should appear')
assert(nearly(necked.neckLength as number, 10 * PREVIEW_SCALE), 'neck length should scale')
assert(nearly(necked.neckDiameter as number, 6 * PREVIEW_SCALE), 'neck diameter should scale')

const drill118 = layoutTool('drill', { ...DEFAULT_DRILL, pointAngle: 118 })
const drill135 = layoutTool('drill', { ...DEFAULT_DRILL, pointAngle: 135 })
const drill90 = layoutTool('drill', { ...DEFAULT_DRILL, pointAngle: 90 })
assert(drill135.coneHeight < drill118.coneHeight, 'blunter 135° point must be shorter than 118°')
assert(drill90.coneHeight > drill118.coneHeight, 'sharper 90° point must be taller than 118°')
assert(drill118.fluteCount === 2, 'default drill flute count')

const drill3 = layoutTool('drill', { ...DEFAULT_DRILL, fluteCount: 3 })
assert(drill3.fluteCount === 3, 'drill flute count 3 should be honored')

const drillFat = layoutTool('drill', { ...DEFAULT_DRILL, diameter: 16 })
assert(drillFat.diameter > drill118.diameter, 'drill diameter should scale')

const R = 1
const web = 0.22
const margin = profileRadius(0, 2, R, web, 0.1)
const gullet = profileRadius(Math.PI / 2, 2, R, web, 0.1)
assert(margin > 0.95 * R, `margin should sit near OD, got ${margin}`)
assert(gullet < 0.55 * R, `flute gullet should dip toward the web, got ${gullet}`)
assert(gullet < margin, 'gullet must be deeper than the margin')

const envTip = envelopeRadius(0, R, 0.5, 'cone', 0)
const envMid = envelopeRadius(0.25, R, 0.5, 'cone', 0)
const envFull = envelopeRadius(0.5, R, 0.5, 'cone', 0)
assert(envTip < envMid && envMid < envFull, 'cone envelope must grow from the tip')
assert(nearly(envFull, R), 'cone envelope reaches OD at the point length')

const ball0 = envelopeRadius(0, R, R, 'bull', R)
const ballHalf = envelopeRadius(R * 0.5, R, R, 'bull', R)
assert(ball0 < ballHalf && ballHalf < R, 'ball-nose envelope should be a hemisphere')

console.log(
  JSON.stringify(
    {
      squareCap: square.squareCapHeight,
      bullCorner: bull.cornerRadius,
      ballCorner: ball.cornerRadius,
      helix0: helix0.helixTwist,
      helix30: square.helixTwist,
      helix45: helix45.helixTwist,
      shank15: shankShort.effectiveShankHeight,
      shank60: shankLong.effectiveShankHeight,
      oal75: square.totalLength,
      oal150: oalLong.totalLength,
      cone90: drill90.coneHeight,
      cone118: drill118.coneHeight,
      cone135: drill135.coneHeight,
    },
    null,
    2,
  ),
)
console.log('OK: all parameter layout checks passed')
