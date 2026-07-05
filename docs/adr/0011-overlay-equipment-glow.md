# Show the Equipment Status edge glow on the Overlay shell too

**Status: Accepted.** Origin: owner report ("the glowing ring disappears on the
temperature adjuster — it should be shown on any page while the system is running").

**Extends [ADR-0009](./0009-standby-equipment-glow.md)** (Standby glow) and
**supersedes the "Overlay shell still has none" clause** of ADR-0009 /
[ADR-0006](./0006-shared-superellipse-silhouette.md).

## Context

The equipment edge glow (blue while cooling, amber while heating, nothing idle) started
Home-Screen-only (ADR-0006), then extended to the Standby Screen (ADR-0009). Both ADRs
left the Overlay shell glow-less on the reasoning that the shell "carries no equipment
state."

But the shell's canvas is opaque: `renderShape()` fills the squircle with `--ecosee-bg`
to cover the Home Screen exactly. So the moment any Overlay opens — most visibly the
Temperature Adjust overlay, where the user is actively changing the setpoint while the
system runs — the shell hides the Home Screen's glow underneath, and the "system is
running" cue vanishes. From the owner's seat that reads as the glow *disappearing*, not
as a deliberate absence.

The equipment status is already derived once (`toHomeView().equipment`) and is in hand
where the card renders the overlay, so no second derivation is needed — the same
no-drift argument ADR-0009 made for Standby.

## Decision

The Overlay shell (`overlay-shell.ts`) renders the **same** equipment edge glow the Home
Screen does, keyed to the **same** equipment status:

- The shell draws `renderShape({ glow: true })` and reveals the glow via the shared class
  chain — `.shell.cooling` / `.shell.heating` toggle `display: block` and set `color`
  from `--ecosee-cool` / `--ecosee-heat`, which flows to the strokes via `currentColor`.
  Idle has no reveal rule, so it stays glow-less — the same invariant as Home / Standby.
- The equipment string is **mirrored, not re-derived**: the shell gains an `equipment`
  property that `<ecosee-card>` fills straight from the already-derived
  `toHomeView().equipment` when it renders the overlay. Because every Overlay rides this
  one shell, the glow shows on **all** of them (Temperature, the pickers, the Main Menu
  sections, Weather), satisfying "any page while the system is running."
- **Full strength, not dimmed.** Unlike the Standby Screen (a low-brightness idle
  display, dimmed via `--ecosee-standby-glow-opacity`), an Overlay is a bright active
  surface, so it uses the Home Screen's full-strength glow (no opacity reduction).
- The glow conveys equipment state by color alone, so the shell also announces it to
  assistive tech via an `sr-only` label ("Cooling" / "Heating" / "Idle"), mirroring the
  Home and Standby screens.

## Consequences

- The shared-shape contract in ADR-0006/0009 changes from "glow on Home *and* Standby
  screens; Overlay shell none" to "**glow on Home, Standby, *and* the Overlay shell**."
  `test/shared-shape.test.ts` is updated to assert the new placement (the shell now
  renders the `.glow` group).
- `test/overlay-shell.test.ts` gains reveal-chain assertions (cooling / heating apply the
  reveal class + label; idle / absent do not light the glow), and
  `test/browser/overlay-glow.test.ts` (real headless Firefox) proves the glow has real
  geometry and reveals blue / cooling, amber / heating at full strength, hidden while
  idle — the Gecko-parity guard any rendering/CSS change requires (ADR-0005).
- Silhouette + canvas fill remain shared and asserted in one place; only the glow's
  *placement* rule moved. Each surface still owns its own reveal CSS (the established
  opt-in), so the shell copies the Home Screen's block rather than sharing a fourth
  abstraction — keeping the fill (shared) and glow reveal (per-surface) from drifting.
