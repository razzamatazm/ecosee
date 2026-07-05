# Show the Equipment Status edge glow on the Standby Screen too

**Update:** the "Overlay shell still has none" clause below is **superseded by
[ADR-0011](./0011-overlay-equipment-glow.md)** — the glow now renders on the Overlay
shell too (full strength), so it shows on every Overlay while the system runs. The
Standby glow decision here otherwise stands unchanged.

**Status: Accepted.** Origin: issue #90. **Supersedes the "equipment edge glow is
Home-Screen-only" clause of [ADR-0006](./0006-shared-superellipse-silhouette.md)**
(the shared-silhouette + canvas-fill contract of ADR-0006 otherwise stands
unchanged). Amends the visual-spec edge-glow and Standby Screen sections.

## Context

ADR-0006 extracted the superellipse silhouette into `styles/shape.ts` and, as part
of that, drew a deliberate line: every surface shares the silhouette + canvas fill,
but the **equipment edge glow is Home-Screen-only**. The reasoning was that only the
Home Screen had equipment state, so keeping the glow asserted in one place stopped
the shared fill and the not-shared glow from drifting apart.

That reasoning no longer holds. The Standby Screen (the dimmed idle display, issue
#63) already composes the Home Screen's view model via `toStandbyView` → `toHomeView`,
so it has the *same* already-derived `hvac_action` equipment status available for
free — there is no second derivation to drift. And the owner's intent, surfaced in
QA (issue #90), is that standby should show the same glow the Home Screen does:
blue while cooling, amber while heating. Leaving standby glow-less while the unit is
actively conditioning reads as a missing cue, not a deliberate calm.

The #89 fix (glow markup emitted via Lit's `svg` tag so `<g>`/`<path>`/`<clipPath>`
land in the SVG namespace and actually paint) is a prerequisite — until it landed,
no glow rendered anywhere, so standby glow could not even be verified.

## Decision

The Standby Screen renders the **same** equipment edge glow as the Home Screen,
keyed to the **same** equipment status:

- `standby-screen.ts` draws `renderShape({ glow: true })` and reveals the glow with
  the identical class chain the Home Screen owns — `.screen.cooling` /
  `.screen.heating` toggle `display: block` and set `color` from the
  `--ecosee-cool` / `--ecosee-heat` tokens, which flows to the strokes via
  `currentColor`. **Idle has no reveal rule**, so it stays glow-less — the same
  invariant as Home.
- The equipment string is **mirrored, not re-derived**: `StandbyView` gains an
  `equipment` field that `toStandbyView` fills straight from `toHomeView().equipment`.
  Standby and Home therefore light on exactly the same states.
- **Dimmed for standby.** Standby is the device's low-brightness idle display, so
  the glow is revealed at reduced opacity (`--ecosee-standby-glow-opacity`, default
  `0.6`) rather than at the Home Screen's full strength. This is expressed as
  `opacity` on the Standby reveal rule only — **no new shape variant**: the shared
  glow markup, the three stacked strokes, the clip path and the `currentColor` chain
  are all untouched, so `styles/shape.ts` stays the single source of the glow
  geometry (keeping the #89 SVG-namespace fix intact).
- The glow conveys equipment state by color alone, so the Standby Screen also
  announces it to assistive tech via an `sr-only` label ("Cooling" / "Heating" /
  "Idle"), mirroring the Home Screen.

## Consequences

- The shared contract in ADR-0006 changes from "glow on the Home Screen only" to
  "**glow on the Home *and* Standby screens**; the Overlay shell still has none" (it
  carries no equipment state). `test/shared-shape.test.ts` is updated to assert the
  new placement.
- `test/standby-screen.test.ts` gains reveal-chain assertions (cooling/heating light
  the glow, idle/absent do not) and `test/browser/standby-glow.test.ts` (real headless
  Firefox) proves the glow has real geometry and reveals blue/cooling, amber/heating,
  dimmed, hidden idle — the Gecko-parity guard this rendering/CSS change requires.
- Silhouette + canvas fill remain shared and asserted in one place; only the glow's
  *placement* rule moved. If a third surface ever needs the glow, it opts in the same
  way (`renderShape({ glow: true })` + its own reveal CSS) and is added to the
  shared-shape guard.
