import { useMemo } from 'react'
import { useStore } from '../state/store'
import { buildPlan } from '../model/plan'
import { WIRES, WOODS, fmtIn, fmtOz } from '../model/materials'
import { SHAPE_LABELS, centroid, holePos, svgPath } from '../model/shapes'
import { ShapeThumb } from './ShapeThumb'

export function PlansView() {
  const doc = useStore((s) => s.doc)
  const setView = useStore((s) => s.setView)
  const plan = useMemo(() => buildPlan(doc), [doc])

  return (
    <div className="plans-wrap">
      <div className="plans-toolbar no-print">
        <button className="btn" onClick={() => setView('editor')}>
          ← Back to the workshop
        </button>
        <button className="btn primary" onClick={() => window.print()}>
          🖨 Print these plans
        </button>
        <span className="hint">Print at 100% scale (no “fit to page”) so the templates come out true to size.</span>
      </div>

      <article className="plans">
        <header className="plan-header">
          <h1>{doc.name}</h1>
          <p>
            Build plans · about <strong>{fmtIn(plan.totals.widthIn)}</strong> across,{' '}
            <strong>{fmtIn(plan.totals.heightIn)}</strong> tall from the hook, weighs{' '}
            <strong>{fmtOz(plan.totals.weightOz)}</strong> · {plan.shapes.length} shapes on {plan.arms.length} arms
          </p>
        </header>

        <section>
          <h2>1 · Shopping list</h2>
          <ul className="checklist">
            {plan.totals.woodTotals.map((w) => (
              <li key={w.label}>
                <strong>{w.label}</strong> — at least {Math.ceil(w.areaIn2)} sq in (a 12″ × {Math.max(6, Math.ceil(w.areaIn2 / 12))}″
                piece is plenty)
              </li>
            ))}
            {plan.totals.wireTotalsByKind.map((w) => (
              <li key={w.label}>
                <strong>{w.label}</strong> — {fmtIn(Math.ceil(w.totalIn * 1.2))} total (includes ~20% spare for practice bends)
              </li>
            ))}
            <li>Small screw hook or eye for the ceiling</li>
            <li>Paint or finish: spray paint or acrylic in your colors, plus a sealer if you like</li>
            <li>Spray adhesive or glue stick (to stick the paper templates to the wood)</li>
          </ul>
          <p className="tools-note">
            <strong>Tools:</strong> scroll saw (or band saw with a fine blade), drill press with a 1/16″ bit, belt sander or
            sanding block, round-nose pliers, wire cutters, a fine file, and a spring clamp for balance testing.
          </p>
        </section>

        <section>
          <h2>2 · Cut the shapes</h2>
          <p>
            Print the full-size templates (last pages), rough-cut around them, stick them to the wood, then saw on the line.
            Drill the 1/16″ hanging hole at the <strong>+</strong> mark <em>before</em> cutting the shape free — small pieces
            are easier to drill while still on the big board.
          </p>
          <table>
            <thead>
              <tr>
                <th></th>
                <th>Part</th>
                <th>Shape</th>
                <th>Size (W × H)</th>
                <th>Wood</th>
                <th>Weight</th>
              </tr>
            </thead>
            <tbody>
              {plan.shapes.map((s) => (
                <tr key={s.node.id}>
                  <td>
                    <ShapeThumb kind={s.node.shape} color={s.node.color} size={26} />
                  </td>
                  <td>
                    <strong>{s.label}</strong>
                  </td>
                  <td>
                    {SHAPE_LABELS[s.node.shape]}
                    {s.flat && <em> · lies flat</em>}
                  </td>
                  <td>
                    {fmtIn(s.node.width)} × {fmtIn(s.node.height)}
                  </td>
                  <td>
                    {WOODS[s.node.wood].label}, {fmtIn(s.node.thickness)} thick
                  </td>
                  <td>{fmtOz(s.weightOz)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p>Sand the edges, then paint both sides and the edges. Let everything dry fully before weighing it down with wire.</p>
        </section>

        <section>
          <h2>3 · Cut and bend the wires</h2>
          <p>
            Each <strong>arm</strong> is one piece of wire with a small loop bent at each end (each loop uses about 1¼″ of
            wire) and a hanging loop bent <em>upward</em> at the balance point. Each <strong>drop wire</strong> is a short
            piece with a loop at each end connecting an arm to whatever hangs below it. Where a piece{' '}
            <strong>lies flat</strong>, there's no loop on that end — the wire runs straight on under the piece and is epoxied
            into a shallow groove on its underside (the cut lengths below already include that extra run).
          </p>
          <h3>Arms</h3>
          <table>
            <thead>
              <tr>
                <th>Arm</th>
                <th>Wire</th>
                <th>Cut length</th>
                <th>Finished length</th>
                <th>Hangs on left end</th>
                <th>Hangs on right end</th>
                <th>Balance point (from left loop)</th>
              </tr>
            </thead>
            <tbody>
              {plan.arms.map((a) => (
                <tr key={a.node.id}>
                  <td>
                    <strong>{a.label}</strong>
                  </td>
                  <td>{WIRES[a.node.wire].label}</td>
                  <td>
                    <strong>{fmtIn(a.cutLenIn)}</strong>
                  </td>
                  <td>{fmtIn(a.node.length)}</td>
                  <td>
                    {a.leftChildLabel}
                    {a.leftFlat && <em> (lies flat)</em>}
                  </td>
                  <td>
                    {a.rightChildLabel}
                    {a.rightFlat && <em> (lies flat)</em>}
                  </td>
                  <td>
                    <strong>{fmtIn(a.balanceFromLeftIn)}</strong>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <h3>Drop wires</h3>
          <table>
            <thead>
              <tr>
                <th>Connects</th>
                <th>Wire</th>
                <th>Finished length</th>
                <th>Cut length</th>
              </tr>
            </thead>
            <tbody>
              {plan.drops.map((d, i) => (
                <tr key={i}>
                  <td>{d.purpose}</td>
                  <td>{d.wireLabel}</td>
                  <td>{fmtIn(d.lengthIn)}</td>
                  <td>
                    <strong>{fmtIn(d.cutLenIn)}</strong>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section>
          <h2>4 · Assemble from the bottom up</h2>
          <p>
            A mobile is always built <strong>lowest arm first</strong>: each arm must carry its finished, balanced load before
            you can balance the arm above it. The balance points in the table are calculated from the wood weights — they'll
            be very close, but always confirm by test-hanging before you bend.
          </p>
          <ol className="steps">
            {plan.buildOrder.map((a) => {
              const sideText = (side: 'left' | 'right') => {
                const flat = side === 'left' ? a.leftFlat : a.rightFlat
                const label = side === 'left' ? a.leftChildLabel : a.rightChildLabel
                const drop = side === 'left' ? a.node.dropLeft : a.node.dropRight
                return flat ? (
                  <>
                    let the {side} end run straight on under <strong>{label}</strong> and epoxy it into the groove on the
                    piece's underside (no loop on this end)
                  </>
                ) : (
                  <>
                    bend a small loop on the {side} end and hang <strong>{label}</strong> from it on its {fmtIn(drop)} drop
                    wire
                  </>
                )
              }
              return (
                <li key={a.node.id}>
                  <strong>{a.label}</strong> — cut {WIRES[a.node.wire].label} to <strong>{fmtIn(a.cutLenIn)}</strong>. Then{' '}
                  {sideText('left')}; {sideText('right')}. Let any epoxy cure fully. Mark{' '}
                  <strong>{fmtIn(a.balanceFromLeftIn)}</strong> from{' '}
                  {a.leftFlat ? 'where the wire comes out from under the left piece' : 'the left loop'},
                  grip the mark with a clamp or clothespin and test-hang. Nudge the grip until the arm floats level, then bend
                  the hanging loop <em>upward</em> at that exact spot.
                </li>
              )
            })}
            <li>
              <strong>Hang it up</strong> — cut the ceiling wire to <strong>{fmtIn(plan.drops[0].cutLenIn)}</strong>, loop both
              ends, and hang the whole mobile from your ceiling hook. Give it a gentle push and enjoy. If any arm drifted from
              level after joining everything, open its hanging loop slightly, slide it a hair toward the high side, and squeeze
              it closed.
            </li>
          </ol>
        </section>

        <section className="page-break">
          <h2>5 · Full-size templates</h2>
          <p>
            Each shape prints at exact size on its own page. Check the 1-inch box on each page with a ruler — if it isn't
            exactly 1″, your printer is scaling; set it to 100%.
          </p>
        </section>

        {plan.shapes.map((s) => {
          const hole = holePos(s.node.shape, s.node.width, s.node.height)
          const c = centroid(s.node.shape, s.node.width, s.node.height)
          const pad = 0.75
          const w = s.node.width + pad * 2
          const h = s.node.height + pad * 2
          return (
            <section key={s.node.id} className="template-page page-break">
              <h3>
                {s.label} — {SHAPE_LABELS[s.node.shape]}, {fmtIn(s.node.width)} × {fmtIn(s.node.height)},{' '}
                {WOODS[s.node.wood].label} {fmtIn(s.node.thickness)}
                {s.flat && ' · lies flat'}
              </h3>
              <svg
                className="template-svg"
                style={{ width: `${w}in`, height: `${h}in` }}
                viewBox={`${-w / 2} ${-h / 2} ${w} ${h}`}
              >
                <path d={svgPath(s.node.shape, s.node.width, s.node.height)} fill="none" stroke="#000" strokeWidth={0.02} />
                {s.flat ? (
                  // groove line on the UNDERSIDE: from the near (inner) edge in,
                  // running through the centroid line so the piece sits level
                  <>
                    <line
                      x1={-s.node.width / 2}
                      y1={-c.y}
                      x2={-s.node.width / 2 + s.grooveLenIn}
                      y2={-c.y}
                      stroke="#000"
                      strokeWidth={0.03}
                      strokeDasharray="0.12 0.08"
                    />
                    <text x={-s.node.width / 2 + s.grooveLenIn + 0.1} y={-c.y + 0.05} fontSize={0.18} fill="#000">
                      groove {fmtIn(s.grooveLenIn)} (underside)
                    </text>
                  </>
                ) : (
                  <>
                    {/* drill mark */}
                    <line x1={hole.x - 0.15} y1={-hole.y} x2={hole.x + 0.15} y2={-hole.y} stroke="#000" strokeWidth={0.015} />
                    <line x1={hole.x} y1={-hole.y - 0.15} x2={hole.x} y2={-hole.y + 0.15} stroke="#000" strokeWidth={0.015} />
                    <circle cx={hole.x} cy={-hole.y} r={0.031} fill="none" stroke="#000" strokeWidth={0.01} />
                  </>
                )}
              </svg>
              <div className="calibration">
                <svg style={{ width: '1in', height: '1in' }} viewBox="0 0 1 1">
                  <rect x="0.01" y="0.01" width="0.98" height="0.98" fill="none" stroke="#000" strokeWidth={0.02} />
                </svg>
                <span>this box must measure exactly 1″ × 1″</span>
              </div>
              {s.flat ? (
                <p className="hint">
                  The dashed line is a shallow groove on the <strong>underside</strong> — saw or file it just deep enough to
                  seat the wire, then epoxy the wire in. This piece lies flat; no hole to drill.
                </p>
              ) : (
                <p className="hint">+ marks the 1/16″ hanging hole. Drill before cutting the shape free.</p>
              )}
            </section>
          )
        })}
      </article>
    </div>
  )
}
