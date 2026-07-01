# Shared superellipse silhouette across every surface

The device's outer edge is a true **superellipse** (|x|⁴ + |y|⁴ = 1) — the ecobee
squircle, softer at the corners than a constant-radius `border-radius`. That shape
originally lived only on the Home Screen: it drew an inline `.shape` SVG whose one
path fills the near-black canvas, clips the equipment glow, and strokes the glow.
The Standby Screen and the Overlay shell instead used `background` +
`border-radius: var(--ecosee-radius)`, so they rendered as plain constant-radius
rounded rectangles. The Card's silhouette therefore *changed shape* as you moved
between screens (issue #76).

The fix is extraction and reuse, not a redesign. `src/styles/shape.ts` is the one
source of the silhouette:

- `SQUIRCLE_PATH` — the sampled superellipse path (0–100 viewBox).
- `renderShape({ glow? })` — the `.shape` SVG, drawn as the first child of a
  surface. It always paints the canvas fill through the path; `glow: true` adds the
  three stacked edge-glow strokes.
- `shapeStyles` — the structural CSS (`.shape` positioning + `.fill` keyed to
  `--ecosee-bg`), included in each surface's `static styles` array.

Every surface consumes it: the Home Screen (`glow: true`), the Standby Screen, and
the Overlay shell — and because all Overlays ride that one shell, the Temperature
Adjust scrubber, Main Menu, and every other Overlay inherit it for free. Those
surfaces set no `background` and no `border-radius`; the superellipse SVG is the
only shape, and their existing `overflow: hidden` clips the corners outside the
curve (which stay transparent, exactly as the Home Screen already rendered).

## The shared contract

- **Silhouette + canvas fill are shared.** Every surface draws `renderShape()` and
  `shapeStyles`, so the outline and the near-black fill (both driven by
  `SQUIRCLE_PATH` / `--ecosee-bg`) are identical everywhere. A token override of
  `--ecosee-bg` recolors all of them at once.
- **The equipment edge glow is Home-Screen-only.** Only the Home Screen has
  equipment state, so only it opts into the glow (`renderShape({ glow: true })`)
  and owns its reveal CSS (`.screen.cooling` / `.screen.heating`). Standby and the
  Overlay shell share the silhouette but render no glow group. Keeping the glow
  asserted in exactly one place is deliberate: it stops the fill (shared) and the
  glow (not shared) from drifting back apart.
- **No cqw / `container-type` in `shapeStyles`.** The Overlay shell is a
  fixed-canvas surface with no query container (issue #35); the shared shape CSS
  carries no container-query units, so it is safe there and in the query-container
  screens alike.

## Consequences

- The outer edge is a **fixed curve, not an overridable corner radius**. The
  `--ecosee-radius` token — previously only ever the corner radius of the two
  rounded-rectangle surfaces — is retired; nothing references it, and the device
  renders the fixed superellipse. Update `styles/shape.ts` to reshape the outline.
- `test/shared-shape.test.ts` guards the contract: every surface renders the shared
  `.shape` fill path, only the Home Screen renders a glow group, and no surface uses
  `--ecosee-radius` / a corner `border-radius`. If a new surface is added, add it
  there so it can't ship a mismatched silhouette.
