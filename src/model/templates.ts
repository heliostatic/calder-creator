import type { ArmNode, MobileDoc, MobileNode, ShapeKind, ShapeNode, WoodKey } from './types'
import { newId } from './types'
import { balanceAll } from './balance'

function shape(kind: ShapeKind, width: number, height: number, color: string, wood: WoodKey = 'balticBirch', thickness = 0.125): ShapeNode {
  return { kind: 'shape', id: newId(), shape: kind, width, height, wood, thickness, color }
}

function arm(length: number, left: MobileNode, right: MobileNode, opts: Partial<Pick<ArmNode, 'dropLeft' | 'dropRight' | 'wire' | 'pivotHeight'>> = {}): ArmNode {
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

function doc(name: string, root: MobileNode): MobileDoc {
  return balanceAll({ version: 1, name, hangerDrop: 6, autoBalance: true, root })
}

export interface TemplateEntry {
  key: string
  title: string
  blurb: string
  make: () => MobileDoc
}

export const TEMPLATES: TemplateEntry[] = [
  {
    key: 'first',
    title: 'First Mobile',
    blurb: 'Three shapes on two arms. A great first build — one afternoon in the shop.',
    make: () =>
      doc(
        'First Mobile',
        arm(
          14,
          arm(9, shape('circle', 3.5, 3.5, '#0057b8'), shape('petal', 2.75, 4.5, '#ffc907'), { dropLeft: 2.5, dropRight: 1.5 }),
          shape('circle', 5, 5, '#c8202f'),
          { dropLeft: 3, dropRight: 4 },
        ),
      ),
  },
  {
    key: 'cascade',
    title: 'Classic Cascade',
    blurb: 'The iconic Calder form: arms stepping down in a spiral, five shapes.',
    make: () =>
      doc(
        'Classic Cascade',
        arm(
          18,
          shape('blob', 6, 4.5, '#c8202f'),
          arm(
            14,
            shape('circle', 4, 4, '#1a1a1a'),
            arm(
              11,
              shape('petal', 3, 5, '#0057b8'),
              arm(8, shape('crescent', 3.5, 3.5, '#ffc907'), shape('circle', 2.5, 2.5, '#f4efe6'), { dropLeft: 1.5, dropRight: 2.5 }),
              { dropLeft: 2, dropRight: 3 },
            ),
            { dropLeft: 2.5, dropRight: 3.5 },
          ),
          { dropLeft: 4, dropRight: 3 },
        ),
      ),
  },
  {
    key: 'spinner',
    title: 'Big Spinner',
    blurb: 'A fuller tree — six shapes on five arms, branches on both sides.',
    make: () =>
      doc(
        'Big Spinner',
        arm(
          20,
          arm(
            12,
            shape('triangle', 4, 4, '#1a1a1a'),
            arm(8, shape('circle', 3, 3, '#ffc907'), shape('blob', 3.5, 2.75, '#0057b8'), { dropLeft: 2, dropRight: 1.5 }),
            { dropLeft: 2.5, dropRight: 3 },
          ),
          arm(
            10,
            shape('petal', 3, 5, '#c8202f'),
            shape('crescent', 4, 4, '#e87722'),
            { dropLeft: 3, dropRight: 2 },
          ),
          { dropLeft: 4, dropRight: 5, wire: 'steel332' },
        ),
      ),
  },
]

export function blankDoc(): MobileDoc {
  return doc('My Mobile', arm(12, shape('circle', 4, 4, '#c8202f'), shape('petal', 3, 4.5, '#0057b8')))
}
