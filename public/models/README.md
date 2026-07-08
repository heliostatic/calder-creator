# Furniture models (optional)

Drop real 3D models here and the app will use them instead of the built-in
low-poly furniture — no code changes needed:

- `eames-lounge.glb` — Eames lounge chair + ottoman as one model. Scaled so its
  overall height is 31.5" and placed with its feet on the floor.
- `noguchi-table.glb` — Noguchi coffee table. Scaled to 15.75" tall.

Only **glTF binary (.glb)** is supported (that's the web-native 3D format).

Herman Miller publishes official models at
https://www.hermanmiller.com/resources/3d-models-and-planning-tools/ in
Revit/SketchUp/AutoCAD formats — none load in a browser directly, so convert
first. The SketchUp (.skp) file is the easiest source:

1. Open the .skp in SketchUp (Pro exports directly) or import it into a
   converter of your choice.
2. Export/convert to `.glb` (units don't matter — the app rescales to the real
   dimensions and re-centers automatically).
3. Name the files as above, commit, push to `main`. Done.

Note: Herman Miller provides those files for planning/specification use —
fine for a personal project like this, but they're not freely licensed assets.
