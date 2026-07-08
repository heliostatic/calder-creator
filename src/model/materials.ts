import type { WoodKey, WireKey } from './types'

// Densities: typical seasoned weights. oz/in³ = (lb/ft³ × 16) / 1728
export const WOODS: Record<WoodKey, { label: string; densityOzIn3: number; note: string }> = {
  balticBirch: { label: 'Baltic birch plywood', densityOzIn3: 0.389, note: 'strong, flat, cuts clean' },
  basswood:    { label: 'Basswood',             densityOzIn3: 0.231, note: 'very light, easy to cut' },
  walnut:      { label: 'Walnut',               densityOzIn3: 0.352, note: 'dark, looks great unpainted' },
  maple:       { label: 'Maple',                densityOzIn3: 0.407, note: 'hard, heavy, pale' },
  cherry:      { label: 'Cherry',               densityOzIn3: 0.324, note: 'warm tone, ages nicely' },
}

export const THICKNESSES: { value: number; label: string }[] = [
  { value: 0.125, label: '1/8"' },
  { value: 0.1875, label: '3/16"' },
  { value: 0.25, label: '1/4"' },
  { value: 0.375, label: '3/8"' },
  { value: 0.5, label: '1/2"' },
]

// Wire weight per inch = π (d/2)² × density (steel 4.53 oz/in³, brass 4.92 oz/in³)
export const WIRES: Record<WireKey, { label: string; diameterIn: number; ozPerIn: number; note: string }> = {
  steel16:  { label: '1/16" steel wire',  diameterIn: 0.0625,  ozPerIn: 0.0139, note: 'good up to ~12 oz loads' },
  steel332: { label: '3/32" steel wire',  diameterIn: 0.09375, ozPerIn: 0.0313, note: 'stiffer, for bigger arms' },
  steel18:  { label: '1/8" steel rod',    diameterIn: 0.125,   ozPerIn: 0.0556, note: 'for large heavy mobiles' },
  brass16:  { label: '1/16" brass rod',   diameterIn: 0.0625,  ozPerIn: 0.0151, note: 'warm gold look' },
  brass332: { label: '3/32" brass rod',   diameterIn: 0.09375, ozPerIn: 0.0340, note: 'gold look, stiffer' },
}

/** Extra wire consumed forming one hanging/connection loop with round-nose pliers. */
export const LOOP_ALLOWANCE_IN = 1.25

/** Hole is drilled this far below the topmost point of a shape. */
export const HOLE_INSET_IN = 0.35

// Calder's palette
export const COLORS: { value: string; label: string }[] = [
  { value: '#c8202f', label: 'Calder red' },
  { value: '#1a1a1a', label: 'Black' },
  { value: '#0057b8', label: 'Blue' },
  { value: '#ffc907', label: 'Yellow' },
  { value: '#f4efe6', label: 'White' },
  { value: '#e87722', label: 'Orange' },
  { value: '#7a5230', label: 'Bare wood' },
]

/** 3.25 → `3 1/4"` (nearest 1/16") */
export function fmtIn(x: number): string {
  const sixteenths = Math.round(x * 16)
  const whole = Math.floor(sixteenths / 16)
  let num = sixteenths - whole * 16
  if (num === 0) return `${whole}"`
  let den = 16
  while (num % 2 === 0) {
    num /= 2
    den /= 2
  }
  return whole > 0 ? `${whole} ${num}/${den}"` : `${num}/${den}"`
}

export function fmtOz(oz: number): string {
  if (oz >= 16) return `${(oz / 16).toFixed(1)} lb`
  if (oz >= 1) return `${oz.toFixed(1)} oz`
  return `${oz.toFixed(2)} oz`
}
