# Drop Gotham from the font stack; render Montserrat outright

**Status: Accepted.** Origin: issue #85 follow-up. Refines
[ADR-0007](./0007-bundled-montserrat-fallback.md) (the bundled face stays exactly
as it is) and amends the stack described there and in ADR-0005 / the visual-spec
Typeface section.

## Context

The Skin's typeface is Gotham (Hoefler&Co), which is proprietary and cannot ship
with the card. ADR-0007 bundled **Montserrat** — the freely-licensed Gotham-alike
— as the guaranteed fallback, but the token stack still *requested Gotham first*:

```
Gotham → Gotham SSm → Montserrat → ecosee Montserrat → system faces
```

Requesting Gotham by name only pays off on the rare dashboard that actually
provides a healthy Gotham webfont. Everywhere else it is dead weight, and it is
strictly a liability: it was a **provided Gotham** with zeroed `hhea` metrics that
broke the card in Gecko (#85). Keeping Gotham at the head of the stack keeps the
card exposed to that exact class of breakage for a face it can never bundle and
that almost no install has.

## Decision

Remove `'Gotham'` and `'Gotham SSm'` from `--ecosee-font`. The stack becomes:

```
Montserrat → ecosee Montserrat → system faces
```

- **The card renders Montserrat as its typeface** — the bundled `'ecosee
  Montserrat'` (ADR-0007) guarantees it on every install, offline and zero-config.
- A dashboard-provided `'Montserrat'` is still honored first (a theme that themes
  Montserrat wins), so this is not a lock to the bundled copy — only a removal of
  the Gotham request.
- **The #85 quarantine probe stays.** It is family-agnostic: it now guards a
  broken provided `'Montserrat'` exactly as it used to guard a broken Gotham, so
  the protection is retained where it still applies. `font-probe.ts` is unchanged
  in behavior.

## Consequences

- One fewer external face at the head of the stack → more consistent typography
  by default, and the #85 breakage can no longer arrive via Gotham at all.
- No bundle-size or release-pipeline change (ADR-0007 is untouched).
- Guards: `test/browser/gecko-parity.test.ts` now injects the degenerate-metric
  webfont under the name `'Montserrat'` (the stack's new first choice) so it keeps
  exercising the real quarantine path rather than passing vacuously. The pure
  filtering seam (`test/font-probe.test.ts`) and the registration/stack-order
  contract (`test/bundled-font.test.ts`, keyed on Montserrat) are unaffected.
- A user who genuinely wants Gotham can still supply it via their HA frontend and
  reintroduce it ahead of the stack in their own theme; the card no longer does so
  on their behalf.
