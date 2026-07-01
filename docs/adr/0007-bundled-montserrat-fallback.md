# Bundle Montserrat inside the card as the guaranteed fallback face

**Status: Accepted.** Origin: issue #85 follow-up. Supersedes the "no `@font-face`,
fully unbundled stack" posture stated in ADR-0005's consequences and the
visual-spec Typeface section (both amended to point here). Later refined by
[ADR-0008](./0008-drop-gotham-from-stack.md): Gotham was dropped from the stack, so
the `Gotham → Gotham SSm → …` order below is now `Montserrat → ecosee Montserrat → …`
(the bundled face and everything else here is unchanged).

## Context

The Skin's typeface is Gotham (proprietary, cannot ship with the card). The
stack degraded through dashboard/system faces, which made typography a
lottery: most installs fell back to whatever the client OS had, and the #85
reporter's dashboard "fixed" that by loading Gotham from a webfont CDN whose
file has broken metrics — mangling the card in Gecko. Asking users to
hand-install a font (HA resources, `www/` files) contradicts the card's
zero-config posture, and HACS delivers exactly **one** asset
(`dist/ecosee.js`, see `hacs.json` and `release.yml`), so extra font files
cannot ride along as siblings without changing the release pipeline.

## Decision

Carry **Montserrat** — the freely-licensed (SIL OFL 1.1) Gotham-alike the
stack already preferred — **inside the bundle**: the six weights the Skin
uses (200–700, latin subset, ~110 KB of woff2) are inlined as `data:` URIs at
build time (vite `?inline`) and registered at runtime under the **private
family `'ecosee Montserrat'`** by `src/styles/bundled-font.ts`, injected once
into `document.head` when the first card connects (`@font-face` inside shadow
roots is ignored; document scope is required).

- The private name means the card never fights a theme's own `Montserrat`
  declaration. The token stack becomes
  `Gotham → Gotham SSm → Montserrat → ecosee Montserrat → system faces`:
  a dashboard-provided Gotham or Montserrat still wins, and the metric
  quarantine probe (ADR-0005 Constraint 3) drops broken ones so the bundled
  face takes over.
- Works offline and on fresh installs with zero configuration — every
  install now renders a Gotham-alike with **verified-healthy metrics** in
  every engine.
- License: OFL text ships in the repo (`src/assets/fonts/montserrat/OFL.txt`)
  and the bundle carries a `/*! … OFL … */` legal banner.

## Consequences

- `dist/ecosee.js` grows from ~173 KB to ~328 KB (~161 KB gzipped). Loaded
  once from the local HA instance and cached; accepted for zero-config
  typography.
- The release pipeline is untouched — still one HACS asset.
- Guards: `test/bundled-font.test.ts` (registration contract, stack order)
  and `test/browser/gecko-parity.test.ts` (the faces actually load in a real
  engine; the broken-Gotham cards render with the bundled face on CI, where
  no system Montserrat exists).
- Updating the vendored fonts means replacing the woff2 files under
  `src/assets/fonts/montserrat/` (Fontsource latin subsets) and re-running
  the suites.
