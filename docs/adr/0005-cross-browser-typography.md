# Cross-browser typography constraints (Firefox/Zen ↔ Chrome parity)

**Status: Accepted, extended by issue #85.** Origin: issue #74 (a regression of
the #52 whole-device squash/clip parity fix), which re-introduced Gecko-vs-Blink
divergence at the glyph/typography level rather than the container-sizing level
#52 addressed. Issue #85 then showed the #74 model was **incomplete**: the same
two symptoms returned with a different root cause (Constraint 3), and only a
real-engine render caught it (see Consequences).

The card renders inside whatever engine the Home Assistant frontend runs in —
commonly Blink (Chrome) but also Gecko (Firefox / Zen). Three typography hazards
render **differently between Gecko and Blink** and must be authored defensively,
or the Home Screen number and the Temperature Adjust chips silently mis-render in
Firefox while looking correct in Chrome.

## Constraint 1 — gradient (`background-clip: text`) text must be block-level

The Home Screen's large current temperature is gradient-filled text
(`--ecosee-temp-grad` clipped to the glyphs via `background-clip: text` +
`-webkit-text-fill-color: transparent`). Firefox does **not** reliably clip that
gradient to text when the element is a **flex/inline-flex container**. Because the
number is a `<button>` and the shared `button` rule makes buttons `inline-flex`,
Firefox rendered the number mangled — an oversized, slanted "7" split away from a
normal "4", reading almost like "/4" — while Blink rendered "74" cleanly.

Rules:

- Gradient-clipped text is laid out **`display: inline-block`** (block-level text),
  never a flex/grid container. `.temp` explicitly overrides the base button's
  `inline-flex`.
- Keep **both** the unprefixed `background-clip: text` (Firefox honors only this)
  **and** the `-webkit-background-clip: text` form (Blink/WebKit), guarded by
  `@supports` over a **solid-color fallback** (`--ecosee-accent`). Dropping either
  property re-breaks one engine.

## Constraint 2 — inline glyph SVGs must render `display: block`

Inline SVG glyphs (`<span class="glyph"><svg …></span>`) carry a **baseline strut**
— phantom descender leading below the baseline. Firefox reserves that leading;
Blink effectively swallows it. So a glyph stacked above a numeral in a flex column
(the Temperature Adjust setpoint chips: ❄ over `75`, ♨ over `70`) came out taller
than its sized box in Firefox and **overlapped the number**, while Blink stacked it
cleanly.

Rule: glyph SVGs are `display: block` (they still fill their sized `.glyph` box via
`width/height: 100%`), so no baseline strut exists in either engine. Chip glyphs are
additionally `flex: none` so the flex column never shrinks them out of their box.

## Constraint 3 — broken-metric webfonts move the baseline; tolerate AND quarantine

Issue #85, verified in a real Gecko render against the reporter's environment: a
dashboard can provide the stack's requested face ('Gotham') as a **webfont with
degenerate vertical metrics** — the reporter's CDN Gotham has `hhea` ascent /
descent / lineGap all **zero**. The engines then disagree about where text sits:

- **Blink** falls back to the font's sane OS/2 typo metrics (ascent 0.73em) —
  renders correctly, so the breakage never shows up in Chrome-only development.
- **Gecko** synthesizes **symmetric metrics (ascent = descent = ½em)**, which puts
  the baseline at the **middle of every line box**. Digit ink (~0.7em cap height)
  then extends `0.7em − line-height/2` above its line box: with `.temp`'s tight
  `line-height: 0.84` the top ~0.28em of every digit fell outside the border box,
  where `background-clip: text` paints nothing → digits erased into "/Ɔ"; in the
  chips (`line-height: 1`) the numeral ink rose ~0.2em into the glyph box above it.

No CSS can repair a foreign font's metrics (`ascent-override` only applies to
`@font-face` rules we would own, and the card cannot re-declare a document-scope
webfont). Two complementary rules:

- **Tolerate small drift in CSS.** The `.temp` paint box carries symmetric
  `padding: 0.16em 0.08em` cancelled by equal negative margins (paint coverage
  without layout change; the `--ecosee-temp-grad` default stops are recomputed to
  14%/66% so the fade lands on the same ink as the old 0%/72% did). The chips
  keep `gap: 1.2cqw` (~0.17em of the numeral) between glyph and numeral. Note the
  Blink margin is razor thin by nature: with the typo-metric fallback the digit
  ink fits the 0.84 line box by *fractions of a pixel*, so the padding protects
  Chrome against compact-metric fonts too.
- **Quarantine what the engine itself reports as unusable.** `<ecosee-card>` runs
  `src/styles/font-probe.ts` on connect, on `document.fonts` "loadingdone", and
  once fonts are ready: canvas `TextMetrics` reveal the metrics *this engine* will
  lay text out with (`fontBoundingBoxAscent`), and any stack family whose usable
  ascent cannot contain bare digit ink is dropped from an inline `--ecosee-font`
  override (generic families are never dropped). The probe is engine-relative by
  design: the same broken Gotham is quarantined in Gecko (falls back to the next
  face, e.g. Avenir Next) but kept in Blink, where it renders correctly — each
  engine keeps the best face it can *render correctly*, which is the ADR-0001
  graceful-degradation posture applied to fonts.

## Consequences

- These are **cross-engine parity** constraints, not cosmetic preferences. A future
  typography change that reintroduces gradient-text-on-flex, an inline (non-block)
  glyph SVG, or trusts a dashboard-provided font's metrics will regress Firefox/Zen
  only, which is easy to miss when developing in Chrome.
- **A real Gecko render is the primary guard.** Issue #85 shipped precisely because
  the string-matching guard stayed green while Firefox was broken.
  `test/browser/gecko-parity.test.ts` runs in headless **Firefox** (vitest browser
  mode + Playwright, `npm run test:browser`, wired into CI): it mounts the real
  card against a page-scope 'Gotham' `@font-face` whose `ascent-override` /
  `descent-override: 50%` reproduce the broken-metric class deterministically, and
  asserts on pixels (gradient ink coverage vs a solid-fill control) and boxes
  (digit ink vs the humidity line, chip numeral ink vs glyph box) that the engine
  actually computed.
- `test/cross-browser-typography.test.ts` remains the cheap jsdom contract check
  (inline-block gradient text, both background-clip forms with a fallback,
  block-level glyph SVGs, non-shrinking chip glyphs), companion to
  `test/container-sizing.test.ts` (the #35/#52 container-sizing guard). The
  Typeface section of `docs/visual-spec.md` cross-references here.
  `test/font-probe.test.ts` pins the quarantine filter's pure seam.
- The font stack itself stays **unbundled** (Gotham → Montserrat → system, no
  `@font-face`; ADR-0001 / visual-spec). These constraints make the *layout* of the
  numerals and glyphs engine-independent; they do not force a specific face — but
  per Constraint 3 an engine may now *drop* a provided face it cannot render
  correctly, so the resolved face can differ per engine on broken-font dashboards.
