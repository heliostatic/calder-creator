import type { ArmNode, MobileDoc, MobileNode, ShapeKind, ShapeNode, WoodKey } from './types'
import { newId } from './types'
import { balanceAll } from './balance'

function shape(kind: ShapeKind, width: number, height: number, color: string, wood: WoodKey = 'balticBirch', thickness = 0.125): ShapeNode {
  return { kind: 'shape', id: newId(), shape: kind, width, height, wood, thickness, color }
}

function arm(
  length: number,
  left: MobileNode,
  right: MobileNode,
  opts: Partial<Pick<ArmNode, 'dropLeft' | 'dropRight' | 'wire' | 'pivotHeight'>> = {},
): ArmNode {
  return {
    kind: 'arm',
    id: newId(),
    length,
    pivot: length / 2, // placeholder; balanceAll sets the real value
    pivotHeight: opts.pivotHeight ?? 0.75,
    wire: opts.wire ?? 'steel16',
    dropLeft: opts.dropLeft ?? 2,
    dropRight: opts.dropRight ?? 2,
    left,
    right,
  }
}

function doc(name: string, root: MobileNode, hangerDrop = 6): MobileDoc {
  return balanceAll({ version: 1, name, hangerDrop, autoBalance: true, root })
}

// Calder's palette
const RED = '#c8202f'
const BLACK = '#1a1a1a'
const BLUE = '#0057b8'
const YELLOW = '#ffc907'
const WHITE = '#f4efe6'
const ORANGE = '#e87722'
const WOODTONE = '#7a5230'

export type FamilyKey = 'starter' | 'cascade' | 'counterweight' | 'tree' | 'constellation'

export interface FamilyInfo {
  key: FamilyKey
  title: string
  blurb: string
  /** browse real Calders in this spirit */
  archiveUrl: string
}

export const FAMILIES: FamilyInfo[] = [
  {
    key: 'starter',
    title: 'First builds',
    blurb: 'Two or three shapes — a full mobile, start to finish, in one shop session.',
    archiveUrl: 'https://calder.org/archive/all/works/hanging-mobile/',
  },
  {
    key: 'cascade',
    title: 'Cascades',
    blurb: 'The iconic Calder form: arms stepping down and spiraling out, one below the next.',
    archiveUrl: 'https://calder.org/archive/all/works/hanging-mobile/',
  },
  {
    key: 'counterweight',
    title: 'Counterweights',
    blurb: 'One bold heavy shape balancing a long, delicate chain — high drama when it turns.',
    archiveUrl: 'https://calder.org/archive/all/works/hanging-mobile/',
  },
  {
    key: 'tree',
    title: 'Trees',
    blurb: 'Branches on both sides of every arm — full, canopy-like mobiles.',
    archiveUrl: 'https://calder.org/archive/all/works/hanging-mobile/',
  },
  {
    key: 'constellation',
    title: 'Constellations',
    blurb: 'Many small shapes on long thin wires — airy, star-field mobiles that never stop drifting.',
    archiveUrl: 'https://calder.org/archive/all/works/hanging-mobile/',
  },
]

export interface TemplateEntry {
  key: string
  title: string
  family: FamilyKey
  blurb: string
  make: () => MobileDoc
}

export const TEMPLATES: TemplateEntry[] = [
  // ------------------------------------------------------------- first builds
  {
    key: 'twoFriends',
    title: 'Two Friends',
    family: 'starter',
    blurb: 'One arm, two shapes. The whole craft in miniature — cut, drill, bend, balance.',
    make: () => doc('Two Friends', arm(14, shape('circle', 4.5, 4.5, RED), shape('petal', 3, 5, BLACK), { dropLeft: 3, dropRight: 4.5 })),
  },
  {
    key: 'first',
    title: 'First Mobile',
    family: 'starter',
    blurb: 'Three shapes on two arms. A great first build — one afternoon in the shop.',
    make: () =>
      doc(
        'First Mobile',
        arm(
          14,
          arm(9, shape('circle', 3.5, 3.5, BLUE), shape('petal', 2.75, 4.5, YELLOW), { dropLeft: 2.5, dropRight: 1.5 }),
          shape('circle', 5, 5, RED),
          { dropLeft: 3, dropRight: 4 },
        ),
      ),
  },
  {
    key: 'littleTrio',
    title: 'Little Trio',
    family: 'starter',
    blurb: 'A compact three-piece for a shelf corner or above a desk.',
    make: () =>
      doc(
        'Little Trio',
        arm(
          10,
          shape('blob', 3.5, 2.75, BLACK),
          arm(6.5, shape('circle', 2.25, 2.25, YELLOW), shape('triangle', 2.5, 2.5, BLUE), { dropLeft: 1.5, dropRight: 2 }),
          { dropLeft: 2.5, dropRight: 2 },
        ),
        4,
      ),
  },

  // ---------------------------------------------------------------- cascades
  {
    key: 'cascade',
    title: 'Classic Cascade',
    family: 'cascade',
    blurb: 'Four arms stepping down in a spiral, five shapes. The template that started this app.',
    make: () =>
      doc(
        'Classic Cascade',
        arm(
          18,
          shape('blob', 6, 4.5, RED),
          arm(
            14,
            shape('circle', 4, 4, BLACK),
            arm(
              11,
              shape('petal', 3, 5, BLUE),
              arm(8, shape('crescent', 3.5, 3.5, YELLOW), shape('circle', 2.5, 2.5, WHITE), { dropLeft: 1.5, dropRight: 2.5 }),
              { dropLeft: 2, dropRight: 3 },
            ),
            { dropLeft: 2.5, dropRight: 3.5 },
          ),
          { dropLeft: 4, dropRight: 3 },
        ),
      ),
  },
  {
    key: 'longDescent',
    title: 'Long Descent',
    family: 'cascade',
    blurb: 'Six arms, seven shapes, alternating sides on the way down. An ambitious, room-filling build.',
    make: () =>
      doc(
        'Long Descent',
        arm(
          24,
          shape('blob', 6.5, 5, BLACK),
          arm(
            19,
            arm(
              15,
              shape('circle', 4, 4, BLUE),
              arm(
                12,
                arm(
                  9,
                  shape('petal', 2.5, 4, YELLOW),
                  arm(6.5, shape('circle', 2, 2, WHITE), shape('triangle', 2.25, 2.25, RED), { dropLeft: 1.25, dropRight: 1.75 }),
                  { dropLeft: 1.5, dropRight: 2.5 },
                ),
                shape('crescent', 3, 3, ORANGE),
                { dropLeft: 2.5, dropRight: 2 },
              ),
              { dropLeft: 2, dropRight: 3 },
            ),
            shape('circle', 4.5, 4.5, RED),
            { dropLeft: 3.5, dropRight: 3 },
          ),
          { dropLeft: 5, dropRight: 4, wire: 'steel332' },
        ),
        8,
      ),
  },
  {
    key: 'fallingLeaves',
    title: 'Falling Leaves',
    family: 'cascade',
    blurb: 'All petals in autumn colors, drifting down. Lovely in walnut and bare wood too.',
    make: () =>
      doc(
        'Falling Leaves',
        arm(
          17,
          shape('petal', 4, 6, ORANGE),
          arm(
            13,
            shape('petal', 3.25, 5, RED),
            arm(
              10,
              shape('petal', 2.75, 4.25, YELLOW),
              arm(7, shape('petal', 2.25, 3.5, WOODTONE, 'walnut'), shape('petal', 2, 3, ORANGE), { dropLeft: 1.5, dropRight: 2 }),
              { dropLeft: 2, dropRight: 2.5 },
            ),
            { dropLeft: 2.5, dropRight: 3 },
          ),
          { dropLeft: 4, dropRight: 3.5 },
        ),
      ),
  },

  // ----------------------------------------------------------- counterweights
  {
    key: 'bigRed',
    title: 'Big Red',
    family: 'counterweight',
    blurb: 'One massive red blob holds up a chain of small quiet shapes. The heavyweight does all the work.',
    make: () =>
      doc(
        'Big Red',
        arm(
          22,
          shape('blob', 7, 5.5, RED, 'balticBirch', 0.25),
          arm(
            12,
            shape('circle', 2.75, 2.75, BLACK),
            arm(8.5, shape('triangle', 2.5, 2.5, WHITE), shape('circle', 2, 2, BLUE), { dropLeft: 1.5, dropRight: 2.25 }),
            { dropLeft: 2, dropRight: 3 },
          ),
          { dropLeft: 3, dropRight: 6, wire: 'steel332' },
        ),
        8,
      ),
  },
  {
    key: 'moonAndStars',
    title: 'Moon and Stars',
    family: 'counterweight',
    blurb: 'A big black moon balancing a drift of little yellow and white circles.',
    make: () =>
      doc(
        'Moon and Stars',
        arm(
          20,
          shape('crescent', 6, 6, BLACK, 'balticBirch', 0.25),
          arm(
            11,
            arm(7, shape('circle', 1.75, 1.75, YELLOW), shape('circle', 1.5, 1.5, WHITE), { dropLeft: 1.25, dropRight: 2 }),
            arm(6, shape('circle', 1.5, 1.5, WHITE), shape('circle', 1.25, 1.25, YELLOW), { dropLeft: 1.5, dropRight: 1 }),
            { dropLeft: 2.5, dropRight: 4 },
          ),
          { dropLeft: 3.5, dropRight: 6, wire: 'steel332' },
        ),
        8,
      ),
  },

  // -------------------------------------------------------------------- trees
  {
    key: 'spinner',
    title: 'Big Spinner',
    family: 'tree',
    blurb: 'A fuller tree — six shapes on five arms, branches on both sides.',
    make: () =>
      doc(
        'Big Spinner',
        arm(
          20,
          arm(
            12,
            shape('triangle', 4, 4, BLACK),
            arm(8, shape('circle', 3, 3, YELLOW), shape('blob', 3.5, 2.75, BLUE), { dropLeft: 2, dropRight: 1.5 }),
            { dropLeft: 2.5, dropRight: 3 },
          ),
          arm(10, shape('petal', 3, 5, RED), shape('crescent', 4, 4, ORANGE), { dropLeft: 3, dropRight: 2 }),
          { dropLeft: 4, dropRight: 5, wire: 'steel332' },
        ),
      ),
  },
  {
    key: 'familyTree',
    title: 'Family Tree',
    family: 'tree',
    blurb: 'Two matched branches of three, hanging from one long beam. Calm and symmetric.',
    make: () =>
      doc(
        'Family Tree',
        arm(
          22,
          arm(
            11,
            shape('circle', 3.5, 3.5, RED),
            arm(7, shape('petal', 2.25, 3.5, YELLOW), shape('circle', 2, 2, WHITE), { dropLeft: 1.5, dropRight: 2 }),
            { dropLeft: 2.5, dropRight: 3 },
          ),
          arm(
            11,
            arm(7, shape('triangle', 2.5, 2.5, BLUE), shape('circle', 2, 2, WHITE), { dropLeft: 2, dropRight: 1.5 }),
            shape('blob', 3.75, 3, BLACK),
            { dropLeft: 3, dropRight: 2.5 },
          ),
          { dropLeft: 4, dropRight: 4, wire: 'steel332' },
        ),
        8,
      ),
  },
  {
    key: 'garden',
    title: 'Garden',
    family: 'tree',
    blurb: 'Petals and pods on both sides, in wood tones and sky colors. Try it unpainted in cherry.',
    make: () =>
      doc(
        'Garden',
        arm(
          18,
          arm(
            10,
            shape('petal', 2.75, 4.5, WOODTONE, 'cherry'),
            arm(6.5, shape('circle', 2, 2, YELLOW), shape('blob', 2.5, 2, BLUE), { dropLeft: 1.25, dropRight: 1.75 }),
            { dropLeft: 2, dropRight: 2.5 },
          ),
          arm(
            9,
            shape('blob', 3, 2.5, WHITE),
            shape('petal', 2.5, 4, WOODTONE, 'walnut'),
            { dropLeft: 2.5, dropRight: 3.5 },
          ),
          { dropLeft: 3.5, dropRight: 4 },
        ),
      ),
  },

  // ----------------------------------------------------------- constellations
  {
    key: 'constellation',
    title: 'Constellation',
    family: 'constellation',
    blurb: 'Eight small circles on long thin arms. Delicate wire work, hypnotic in the slightest draft.',
    make: () =>
      doc(
        'Constellation',
        arm(
          24,
          arm(
            14,
            arm(8, shape('circle', 1.75, 1.75, WHITE), shape('circle', 1.5, 1.5, YELLOW), { dropLeft: 1.5, dropRight: 2.25 }),
            arm(7, shape('circle', 1.5, 1.5, BLACK), shape('circle', 1.75, 1.75, RED), { dropLeft: 2, dropRight: 1.25 }),
            { dropLeft: 3, dropRight: 4 },
          ),
          arm(
            13,
            shape('circle', 2.25, 2.25, BLUE),
            arm(8, shape('circle', 1.5, 1.5, YELLOW), arm(5.5, shape('circle', 1.25, 1.25, WHITE), shape('circle', 1.5, 1.5, BLACK), { dropLeft: 1, dropRight: 1.5 }), {
              dropLeft: 1.5,
              dropRight: 2.5,
            }),
            { dropLeft: 2.5, dropRight: 3.5 },
          ),
          { dropLeft: 5, dropRight: 5 },
        ),
        9,
      ),
  },
  {
    key: 'nightSky',
    title: 'Night Sky',
    family: 'constellation',
    blurb: 'Little moons and triangles in black, blue and white, scattered on long wires.',
    make: () =>
      doc(
        'Night Sky',
        arm(
          21,
          arm(
            12,
            shape('crescent', 2.5, 2.5, YELLOW),
            arm(7.5, shape('triangle', 2, 2, WHITE), shape('circle', 1.5, 1.5, BLUE), { dropLeft: 1.5, dropRight: 2 }),
            { dropLeft: 2.5, dropRight: 3.5 },
          ),
          arm(
            11,
            arm(6.5, shape('circle', 1.5, 1.5, WHITE), shape('crescent', 2, 2, BLACK), { dropLeft: 1.25, dropRight: 1.75 }),
            shape('triangle', 2.5, 2.5, BLUE),
            { dropLeft: 3, dropRight: 2 },
          ),
          { dropLeft: 4.5, dropRight: 4.5 },
        ),
        8,
      ),
  },
]

export function blankDoc(): MobileDoc {
  return doc('My Mobile', arm(12, shape('circle', 4, 4, RED), shape('petal', 3, 4.5, BLUE)))
}
