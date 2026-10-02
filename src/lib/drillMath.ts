/** Round a millimetre value for display and stored defaults. */
export function roundMm(n: number, places = 2): number {
  const f = 10 ** places
  return Math.round(n * f) / f
}

export function formatMm(n: number): string {
  if (!Number.isFinite(n)) return String(n)
  return String(roundMm(n))
}

/**
 * Axial length of a conical point.
 * An included angle of 180° is a flat face and returns 0.
 */
export function pointConeHeight(diameter: number, includedAngleDeg: number): number {
  if (!(diameter > 0) || !(includedAngleDeg > 0) || includedAngleDeg >= 179.5) return 0
  const half = (includedAngleDeg * Math.PI) / 360
  const t = Math.tan(half)
  if (t < 1e-6) return 0
  return diameter / 2 / t
}

/**
 * Axial length of the cone between two diameters at an included angle
 * (countersink, chamfer, or subland shoulder).
 */
export function frustumHeight(
  minorDiameter: number,
  majorDiameter: number,
  includedAngleDeg: number,
): number {
  const delta = Math.abs(majorDiameter - minorDiameter) / 2
  if (delta < 1e-6) return 0
  if (!(includedAngleDeg > 0) || includedAngleDeg >= 179.5) return 0
  const half = (includedAngleDeg * Math.PI) / 360
  const t = Math.tan(half)
  if (t < 1e-6) return 0
  return delta / t
}
