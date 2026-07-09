import { describe, expect, it } from 'vitest'
import type { ArmNode, MobileDoc, MobileNode, ShapeNode } from './types'
import { walk } from './types'
import { TEMPLATES, blankDoc } from './templates'
import type { FamilyKey } from './templates'
import { generateMobile } from './generate'
import type { GenSize } from './generate'
import { armPointLoads, balanceAll, balancedPivot, shapeWeightOz, subtreeWeightOz } from './balance'
import { WIRES, flatGrooveLen } from './materials'
import { centroid, holePos, materialClearance, outline } from './shapes'
import { errorsOf, validateBuildable } from './validate'

// ---------------------------------------------------------------------------
// Acceptance gate: everything the app offers a user must be buildable.
// ---------------------------------------------------------------------------

describe('templates are buildable', () => {
  for (const t of TEMPLATES) {
    it(`${t.title}`, () => {
      const issues = validateBuildable(t.make())
      expect(errorsOf(issues)).toEqual([])
    })
  }

  it('blank starter is buildable', () => {
    expect(errorsOf(validateBuildable(blankDoc()))).toEqual([])
  })

  it('templates carry no warnings either — they are the showcase', () => {
    for (const t of TEMPLATES) {
      const issues = validateBuildable(t.make())
      expect(issues, t.title).toEqual([])
    }
  })
})

describe('generated mobiles are buildable', () => {
  const families: (FamilyKey | 'any')[] = ['any', 'cascade', 'tree', 'counterweight', 'constellation', 'floating']
  const sizes: GenSize[] = ['small', 'medium', 'large']
  for (const family of families) {
    for (const size of sizes) {
      it(`${family} / ${size} across seeds`, () => {
        for (let seed = 1; seed <= 8; seed++) {
          const doc = generateMobile(family, size, seed * 7919)
          const errors = errorsOf(validateBuildable(doc))
          expect(errors, `${family}/${size} seed ${seed * 7919}: ${JSON.stringify(errors)}`).toEqual([])
        }
      })
    }
  }

  it('same seed yields the same design (ignoring ids)', () => {
    const strip = (n: MobileNode): unknown =>
      n.kind === 'arm' ? { ...n, id: '', left: strip(n.left), right: strip(n.right) } : { ...n, id: '' }
    const a = generateMobile('any', 'medium', 12345)
    const b = generateMobile('any', 'medium', 12345)
    expect(strip(a.root)).toEqual(strip(b.root))
    expect(a.name).toEqual(b.name)
  })
})

// ---------------------------------------------------------------------------
// Balance math against hand calculations
// ---------------------------------------------------------------------------

function mkShape(over: Partial<ShapeNode> = {}): ShapeNode {
  return {
    kind: 'shape',
    id: `s${Math.random()}`,
    shape: 'circle',
    width: 4,
    height: 4,
    wood: 'balticBirch',
    thickness: 0.125,
    color: '#c8202f',
    ...over,
  }
}

function mkArm(left: MobileNode, right: MobileNode, over: Partial<ArmNode> = {}): ArmNode {
  return {
    kind: 'arm',
    id: `a${Math.random()}`,
    length: 10,
    pivot: 5,
    pivotHeight: 0.75,
    wire: 'steel16',
    dropLeft: 2,
    dropRight: 2,
    left,
    right,
    ...over,
  }
}

describe('balance math', () => {
  it('matches a hand-computed pivot for two hanging shapes', () => {
    const big = mkShape({ width: 5, height: 5 })
    const small = mkShape({ width: 3, height: 3 })
    const arm = mkArm(big, small)
    const w = WIRES.steel16.ozPerIn
    const WL = shapeWeightOz(big) + w * 2
    const WR = shapeWeightOz(small) + w * 2
    const Warm = w * 10
    const expected = (WR * 10 + Warm * 5) / (WL + WR + Warm)
    expect(balancedPivot(arm)).toBeCloseTo(expected, 8)
  })

  it('a flat piece levers past the end of the arm', () => {
    const hangingVersion = mkArm(mkShape({ width: 5, height: 5 }), mkShape({ width: 4, height: 4 }))
    const flatVersion = mkArm(mkShape({ width: 5, height: 5 }), mkShape({ width: 4, height: 4, mount: 'flat', thickness: 0.25 }))
    // the flat piece's weight acts beyond the end loop, so the balance point
    // must shift toward it compared against any load AT the end
    const pHanging = balancedPivot(hangingVersion)
    const pFlat = balancedPivot(flatVersion)
    expect(pFlat).toBeGreaterThan(pHanging)

    // and the load position must be exactly end + half width + centroid offset
    const flat = flatVersion.right as ShapeNode
    const c = centroid(flat.shape, flat.width, flat.height)
    const loads = armPointLoads(flatVersion)
    const flatLoad = loads.find((l) => Math.abs(l.W - shapeWeightOz(flat)) < 1e-9)
    expect(flatLoad?.x).toBeCloseTo(10 + flat.width / 2 + c.x, 8)
  })

  it('moments cancel exactly at the computed balance point', () => {
    for (let seed = 1; seed <= 12; seed++) {
      const doc = balanceAll(generateMobile('any', 'large', seed * 31337))
      walk(doc.root, (n) => {
        if (n.kind !== 'arm') return
        const p = balancedPivot(n)
        const residual = armPointLoads(n).reduce((s, l) => s + l.W * (p - l.x), 0)
        expect(Math.abs(residual)).toBeLessThan(1e-9)
      })
    }
  })

  it('subtree weight equals the sum of its parts', () => {
    const doc = TEMPLATES.find((t) => t.key === 'waterGarden')!.make()
    let sum = 0
    walk(doc.root, (n) => {
      if (n.kind === 'shape') {
        sum += shapeWeightOz(n)
      } else {
        const w = WIRES[n.wire].ozPerIn
        sum += w * n.length
        // drop wires only exist on hanging sides; flat sides add groove wire
        for (const side of ['left', 'right'] as const) {
          const child = side === 'left' ? n.left : n.right
          const drop = side === 'left' ? n.dropLeft : n.dropRight
          if (child.kind === 'shape' && child.mount === 'flat') sum += w * flatGrooveLen(child.width)
          else sum += w * drop
        }
      }
    })
    expect(subtreeWeightOz(doc.root)).toBeCloseTo(sum, 8)
  })
})

// ---------------------------------------------------------------------------
// Shapes: holes, grooves, and the circle/oval distinction
// ---------------------------------------------------------------------------

describe('shape geometry', () => {
  const kinds = ['circle', 'oval', 'petal', 'crescent', 'triangle', 'blob'] as const

  it('every hanging hole sits in solid material, above the centroid', () => {
    for (const kind of kinds) {
      for (const [w, h] of [
        [1.5, 1.5],
        [3, 3],
        [4, 2.6],
        [6, 6],
        [3, 5],
      ]) {
        const hole = holePos(kind, w, h)
        const clear = materialClearance(kind, w, h, hole.x, hole.y)
        expect(clear, `${kind} ${w}x${h}`).toBeGreaterThan(0.08)
        const c = centroid(kind, w, h)
        expect(hole.y, `${kind} ${w}x${h} hole above centroid`).toBeGreaterThan(c.y)
        expect(Math.abs(hole.x - c.x), `${kind} ${w}x${h} hangs true`).toBeLessThan(w / 5)
      }
    }
  })

  it('an oval is not a circle', () => {
    // same nominal size: outlines must differ (the bug dad found: they printed identically)
    const oval = outline('oval', 4, 2.6)
    const maxY = Math.max(...oval.map((p) => p.y))
    const maxX = Math.max(...oval.map((p) => p.x))
    expect(maxY).toBeCloseTo(1.3, 2)
    expect(maxX).toBeCloseTo(2, 2)
  })

  it('generated ovals always get a real aspect ratio', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const doc = generateMobile('any', 'large', seed * 104729)
      walk(doc.root, (n) => {
        if (n.kind === 'shape' && n.shape === 'oval') {
          expect(n.height, `seed ${seed}`).toBeLessThan(n.width * 0.8)
        }
      })
    }
  })

  it('validator flags a circle-shaped oval', () => {
    const doc: MobileDoc = {
      version: 1,
      name: 'x',
      hangerDrop: 6,
      autoBalance: true,
      root: balanceAll({
        version: 1,
        name: 'x',
        hangerDrop: 6,
        autoBalance: true,
        root: mkArm(mkShape({ shape: 'oval', width: 4, height: 4 }), mkShape()),
      }).root,
    }
    const issues = validateBuildable(doc)
    expect(issues.some((i) => i.message.includes('identical to a circle'))).toBe(true)
  })

  it('validator catches a balance point too close to the end', () => {
    // a heavy counterweight against a feather: pivot lands inside the loop zone
    const doc: MobileDoc = balanceAll({
      version: 1,
      name: 'x',
      hangerDrop: 6,
      autoBalance: true,
      root: mkArm(mkShape({ width: 9, height: 9, thickness: 0.5, wood: 'maple' }), mkShape({ width: 1, height: 1 }), {
        length: 8,
      }),
    })
    const errors = errorsOf(validateBuildable(doc))
    expect(errors.some((e) => e.message.includes('balance point'))).toBe(true)
  })
})
