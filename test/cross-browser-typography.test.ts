// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest';
import type { CSSResult, CSSResultArray } from 'lit';

import { EcoseeHomeScreen } from '../src/screens/home-screen';
import { EcoseeTemperatureOverlay } from '../src/overlays/temperature-overlay';

// Issue #74 (regression of #52): Firefox/Zen mis-renders the Home Screen's large
// current temperature (digits mis-sized/overlapping — an oversized slanted "7"
// split from "4") and the Temperature Adjust setpoint chips (glyph cramped over /
// overlapping the number) while Chrome renders both correctly. Two Gecko-vs-Blink
// layout divergences were the cause, both of which this guard locks down:
//
//   1. `background-clip: text` gradient text laid out inside a FLEX container.
//      The `.temp` number is a <button>, and the base `button` rule makes buttons
//      `inline-flex`. Firefox does not reliably clip a gradient background to text
//      inside a flex/inline-flex container, so the number rendered mangled. The
//      fix pins `.temp` to `display: inline-block` (block text layout) and keeps
//      BOTH the unprefixed `background-clip: text` (Firefox) and the `-webkit-`
//      prefixed form (Blink/WebKit), guarded by @supports over a solid-color
//      fallback.
//
//   2. Inline SVG glyphs carry a baseline strut (phantom descender leading) that
//      Firefox reserves but Blink effectively swallows, so a glyph stacked above a
//      numeral in a flex column (the setpoint chips) came out taller than its box
//      and overlapped the number. The fix renders glyph SVGs as `display: block`
//      replaced elements so no baseline strut exists in either engine.
//
// See docs/adr/0005-cross-browser-typography.md and the Typeface section of
// docs/visual-spec.md. This is the typography companion to
// test/container-sizing.test.ts (which locks the container-sizing contract).

function cssTextOf(styles: CSSResult | CSSResultArray): string {
  const list = Array.isArray(styles) ? styles : [styles];
  const raw = list.map((s) => (s as CSSResult).cssText).join('\n');
  // Strip CSS block comments so prose (which may quote a property name for
  // documentation) can't satisfy or defeat a declaration guard — we assert on
  // the actual declarations, not the comments describing them.
  return raw.replace(/\/\*[\s\S]*?\*\//g, '');
}

// Return the declaration block (text between the braces) of the flat rule whose
// body contains `needle`. Lit's generated CSS is flat, so the block is bounded by
// the nearest `{` before and `}` after the needle.
function ruleBlockContaining(css: string, needle: string): string | null {
  const at = css.indexOf(needle);
  if (at === -1) return null;
  const open = css.lastIndexOf('{', at);
  const close = css.indexOf('}', at);
  if (open === -1 || close === -1) return null;
  return css.slice(open + 1, close);
}

const HOME_CSS = cssTextOf(EcoseeHomeScreen.styles);
const OVERLAY_CSS = cssTextOf(EcoseeTemperatureOverlay.styles);

describe('cross-browser typography contract (issue #74)', () => {
  describe('Home Screen large current temperature (.temp)', () => {
    // The base `button` rule makes buttons inline-flex; the `.temp` number MUST
    // override that to block-level text layout, or Firefox mis-clips the gradient.
    const tempBlock = ruleBlockContaining(HOME_CSS, 'font-size: 42cqw');

    it('lays the number out as inline-block, not a flex container', () => {
      expect(tempBlock).not.toBeNull();
      expect(tempBlock).toMatch(/display:\s*inline-block/);
      // A flex/inline-flex .temp is exactly the Firefox gradient-clip trap.
      expect(tempBlock).not.toMatch(/display:\s*(?:inline-)?flex/);
    });

    it('keeps a solid-color fallback under the gradient (progressive enhancement)', () => {
      expect(tempBlock).toMatch(/color:\s*var\(\s*--ecosee-accent/);
    });

    it('declares BOTH prefixed and unprefixed background-clip: text', () => {
      // Firefox honors only the unprefixed property; Blink/WebKit need the
      // -webkit- form. Dropping either re-breaks one engine.
      expect(HOME_CSS).toMatch(/(?<!-webkit-)background-clip:\s*text/);
      expect(HOME_CSS).toMatch(/-webkit-background-clip:\s*text/);
      expect(HOME_CSS).toMatch(/-webkit-text-fill-color:\s*transparent/);
    });

    it('guards the gradient behind @supports over the fallback', () => {
      expect(HOME_CSS).toMatch(/@supports[^{]*background-clip:\s*text/);
    });
  });

  describe('inline glyph SVGs render as block (no baseline strut)', () => {
    it('Home Screen renders glyph SVGs as block', () => {
      expect(HOME_CSS).toMatch(/\.glyph svg\s*\{[^}]*display:\s*block/);
    });

    it('Temperature Adjust renders chip glyph SVGs as block', () => {
      expect(OVERLAY_CSS).toMatch(/\.glyph svg\s*\{[^}]*display:\s*block/);
    });

    it('Temperature Adjust chips do not let the glyph shrink out of its box', () => {
      // A shrunk glyph is the other half of the cramped/overlapping chip.
      const chipGlyph = ruleBlockContaining(OVERLAY_CSS, '.chip .glyph');
      expect(chipGlyph).not.toBeNull();
      expect(OVERLAY_CSS).toMatch(/\.chip \.glyph\s*\{[^}]*flex:\s*none/);
    });
  });
});
