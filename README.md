# 🎈 Mobile Maker

Design Calder-style hanging mobiles on screen, test how they'll move in a breeze,
and print everything you need to build them in a home woodshop.

## What it does

- **Workbench** — build a mobile out of wire arms and plywood shapes. Pick shapes
  (circle, oval, petal, moon, triangle, amoeba), sizes, wood species, thickness and
  color. Every piece's real weight is computed from the wood's density.
- **Auto-balance** — the app does the mobile-maker's hardest math for you: it
  computes exactly where each arm's hanging loop must go so everything floats level.
  Turn it off to place pivots by hand and see the resulting tilt.
- **Wind test** — a full physics simulation. Grab any piece with the mouse and give
  it a push, or turn up the breeze and watch it drift, swing and rotate.
- **Build plans** — one click prints:
  - a shopping list (wood, wire, hardware),
  - a cut list of every shape with sizes and weights,
  - a wire table with cut lengths, loop allowances and computed **balance points**,
  - step-by-step assembly instructions in the correct bottom-up order,
  - **full-size paper templates** for every shape, with drill marks and a 1-inch
    calibration square — print at 100%, glue to the stock, and cut on the scroll saw.

Designs save automatically in the browser, and can be saved to / opened from files
to share.

## Running it

```bash
npm install
npm run dev      # local development
npm run build    # production build in dist/
```

The app is a fully static site — the `dist/` folder can be hosted anywhere.
A GitHub Actions workflow deploys it to GitHub Pages on every push to `main`
(enable Pages → "GitHub Actions" in the repo settings).

## How the balance math works

Each arm is a wire with a load hanging from each end and a hanging loop that sits a
little *above* the line between the ends (that offset is what makes a mobile arm
stable). At rest the arm settles at the tilt angle θ where torques cancel:

```
tan θ = Σ Wᵢ (p − xᵢ) / (h · Σ Wᵢ)
```

where `p` is the pivot position, `xᵢ` the load positions, and `h` the pivot height.
Setting the numerator to zero gives the perfect-balance pivot position that the
auto-balance feature (and the printed balance marks) use. Weights include the wire
itself, computed from real material densities.

The wind-test mode builds the same mobile as rigid bodies connected by
point-to-point constraints in [cannon-es](https://github.com/pmndrs/cannon-es),
running directly in inch/ounce units.
