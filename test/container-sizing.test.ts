// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest';
import type { CSSResult, CSSResultArray } from 'lit';

import { EcoseeHomeScreen } from '../src/screens/home-screen';
import { EcoseeOverlay } from '../src/overlays/overlay-shell';
import { EcoseeComfortSettingOverlay } from '../src/overlays/comfort-setting-overlay';
import { EcoseeFanOverlay } from '../src/overlays/fan-overlay';
import { EcoseeMainMenuOverlay } from '../src/overlays/main-menu-overlay';
import { EcoseeSensorsOverlay } from '../src/overlays/sensors-overlay';
import { EcoseeSystemModeOverlay } from '../src/overlays/system-mode-overlay';
import { EcoseeSystemOverlay } from '../src/overlays/system-overlay';
import { EcoseeTemperatureOverlay } from '../src/overlays/temperature-overlay';
import { EcoseeWeatherOverlay } from '../src/overlays/weather-overlay';

// Issue #35: the Card and overlays render squashed / overlapping / clipped on
// wide windows (it looked Firefox/Zen-only only because those windows were wider
// than the Chrome ones — both engines misbehave identically). Real root cause: a
// `container-type` element resolves its OWN container-query lengths (e.g. its
// padding) against the *viewport*, because nothing above it establishes a query
// container — so on a wide window that padding ballooned, collapsed the content
// box, and shrank every cqw child with it. The device is a FIXED canvas
// (--ecosee-base-size) scaled as one unit by <ecosee-card>, so container queries
// buy nothing: every self-sizing length is the fixed unit calc(N * --ecosee-u)
// (base-size / 100), which has no viewport coupling. Where container queries do
// survive (overlay bodies, so children still scale off their definite content
// box), the container's OWN properties must stay on the fixed unit. These guard
// that: (a) no block-axis / alias container unit may appear anywhere; (b) the
// fixed-canvas surfaces carry no container query at all; (c) no element sizes
// *itself* with cqw in the same rule that declares container-type.

type StyleHost = { styles: CSSResult | CSSResultArray };

// Bodies that keep an inline-size query container so their children scale off a
// definite content box (the authored proportions) — the Home Screen and every
// slotted overlay. The container's OWN properties must stay on the fixed unit.
const CONTAINER_BODIES: ReadonlyArray<readonly [string, StyleHost]> = [
  ['ecosee-home-screen', EcoseeHomeScreen],
  ['ecosee-comfort-setting-overlay', EcoseeComfortSettingOverlay],
  ['ecosee-fan-overlay', EcoseeFanOverlay],
  ['ecosee-main-menu-overlay', EcoseeMainMenuOverlay],
  ['ecosee-sensors-overlay', EcoseeSensorsOverlay],
  ['ecosee-system-mode-overlay', EcoseeSystemModeOverlay],
  ['ecosee-system-overlay', EcoseeSystemOverlay],
  ['ecosee-temperature-overlay', EcoseeTemperatureOverlay],
  ['ecosee-weather-overlay', EcoseeWeatherOverlay],
];

// The overlay shell is a pure fixed canvas: it has no cqw-sized children of its
// own (just the ✕), so it needs no container query at all — every length is the
// fixed unit calc(N * --ecosee-u).
const FIXED_CANVAS: ReadonlyArray<readonly [string, StyleHost]> = [
  ['ecosee-overlay', EcoseeOverlay],
];

const ALL_SCREENS = [...FIXED_CANVAS, ...CONTAINER_BODIES];

function cssTextOf(styles: CSSResult | CSSResultArray): string {
  const list = Array.isArray(styles) ? styles : [styles];
  const raw = list.map((s) => (s as CSSResult).cssText).join('\n');
  // Strip CSS block comments so prose that names a fragile pattern (e.g. a comment
  // reading "not cqw" or "container-type") can't trip the declaration guards — we
  // assert on declarations, not documentation.
  return raw.replace(/\/\*[\s\S]*?\*\//g, '');
}

// The rule block (declarations between the braces) that declares `needle`. Lit's
// generated CSS is flat, so the nearest `{` before and `}` after the declaration
// bound its own block — no nested braces to confuse the scan.
function ruleBlockDeclaring(css: string, needle: string): string | null {
  const at = css.indexOf(needle);
  if (at === -1) return null;
  const open = css.lastIndexOf('{', at);
  const close = css.indexOf('}', at);
  if (open === -1 || close === -1) return null;
  return css.slice(open + 1, close);
}

describe('sizing is viewport-robust (issue #35)', () => {
  for (const [tag, ctor] of ALL_SCREENS) {
    const css = cssTextOf(ctor.styles);

    it(`${tag} uses no block-axis / alias container unit (cqh / cqb / cqi / cqmin / cqmax)`, () => {
      // Only cqw (inline width) is ever valid here; the others resolve against a
      // size container's block axis or alias the inline axis, and would silently
      // fall back to the viewport. (No leading \b — the unit is glued to its
      // number, e.g. "60cqh", so there is no word boundary before "cq".)
      expect(css).not.toMatch(/cq(?:h|b|i|min|max)\b/);
    });
  }

  for (const [tag, ctor] of FIXED_CANVAS) {
    const css = cssTextOf(ctor.styles);

    it(`${tag} carries no container query (pure fixed canvas)`, () => {
      // These surfaces size everything off the fixed unit; a stray container-type
      // or cqw here would reintroduce the viewport coupling this fix removed.
      expect(css).not.toMatch(/container-type/);
      expect(css).not.toMatch(/cqw/);
      // ...and they must actually use the fixed unit.
      expect(css).toMatch(/var\(\s*--ecosee-u/);
    });
  }

  for (const [tag, ctor] of CONTAINER_BODIES) {
    const css = cssTextOf(ctor.styles);
    const rootBlock = ruleBlockDeclaring(css, 'container-type');

    it(`${tag} is an inline-size container that never sizes ITSELF with cqw`, () => {
      // These bodies keep container queries so children scale off their definite
      // content box — but the container's own properties (padding / gap) must be
      // the fixed unit, or they resolve against the viewport (the actual bug).
      expect(css).toMatch(/container-type:\s*inline-size/);
      expect(css).not.toMatch(/container-type:\s*size\b/);
      expect(rootBlock).not.toBeNull();
      expect(rootBlock).not.toMatch(/cqw/);
      expect(rootBlock).toMatch(/var\(\s*--ecosee-u/);
      // Children still resolve cqw off the now-definite box.
      expect(css).toMatch(/cqw/);
    });
  }
});
