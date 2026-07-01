# Cross-browser typography constraints (Firefox/Zen ↔ Chrome parity)

**Status: Accepted.** Origin: issue #74 (a regression of the #52 whole-device
squash/clip parity fix), which re-introduced Gecko-vs-Blink divergence at the
glyph/typography level rather than the container-sizing level #52 addressed.

The card renders inside whatever engine the Home Assistant frontend runs in —
commonly Blink (Chrome) but also Gecko (Firefox / Zen). Two typography techniques
render **differently between Gecko and Blink** and must be authored defensively, or
the Home Screen number and the Temperature Adjust chips silently mis-render in
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

## Consequences

- These are **cross-engine parity** constraints, not cosmetic preferences. A future
  typography change that reintroduces gradient-text-on-flex or an inline (non-block)
  glyph SVG will regress Firefox/Zen only, which is easy to miss when developing in
  Chrome.
- `test/cross-browser-typography.test.ts` is the durable regression guard: it asserts
  the CSS contract above (inline-block gradient text, both background-clip forms with
  a fallback, block-level glyph SVGs, non-shrinking chip glyphs). It is the
  typography companion to `test/container-sizing.test.ts` (the #35/#52 container-
  sizing guard). The Typeface section of `docs/visual-spec.md` cross-references here.
- The font stack itself stays **unbundled** (Gotham → Montserrat → system, no
  `@font-face`; ADR-0001 / visual-spec). These constraints make the *layout* of the
  numerals and glyphs engine-independent; they do not force a specific face.
