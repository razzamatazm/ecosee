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

// Issue #35: the Card and overlays render squashed / overlapping / clipped in
// Firefox and Zen while Chrome is fine. Single root cause: every screen was a
// `container-type: size` query container that derived its own block size from
// `aspect-ratio`, and Gecko resolves that contained size late/collapsed — so
// `cqw`-driven text starts tiny and the layout overlaps, then a reflow (e.g.
// hover) overshoots. Switching every query container to `container-type:
// inline-size` keys sizing off the definite slot *width* only (no dependence on
// resolving a contained block size), which Gecko resolves promptly. These guard
// that fix: no screen may reintroduce `container-type: size`, and no block-axis
// container unit (`cqh` / `cqb`) may survive, since those don't resolve against
// an inline-size container.

type StyleHost = { styles: CSSResult | CSSResultArray };

const SCREENS: ReadonlyArray<readonly [string, StyleHost]> = [
  ['ecosee-home-screen', EcoseeHomeScreen],
  ['ecosee-overlay', EcoseeOverlay],
  ['ecosee-comfort-setting-overlay', EcoseeComfortSettingOverlay],
  ['ecosee-fan-overlay', EcoseeFanOverlay],
  ['ecosee-main-menu-overlay', EcoseeMainMenuOverlay],
  ['ecosee-sensors-overlay', EcoseeSensorsOverlay],
  ['ecosee-system-mode-overlay', EcoseeSystemModeOverlay],
  ['ecosee-system-overlay', EcoseeSystemOverlay],
  ['ecosee-temperature-overlay', EcoseeTemperatureOverlay],
  ['ecosee-weather-overlay', EcoseeWeatherOverlay],
];

function cssTextOf(styles: CSSResult | CSSResultArray): string {
  const list = Array.isArray(styles) ? styles : [styles];
  const raw = list.map((s) => (s as CSSResult).cssText).join('\n');
  // Strip CSS block comments so prose that names the fragile pattern (e.g. a
  // comment reading "not container-type: size") can't trip the declaration
  // guards below — we're asserting on declarations, not documentation.
  return raw.replace(/\/\*[\s\S]*?\*\//g, '');
}

describe('container sizing is Firefox-robust (issue #35)', () => {
  for (const [tag, ctor] of SCREENS) {
    const css = cssTextOf(ctor.styles);

    it(`${tag} uses container-type: inline-size, not size`, () => {
      // A bare `container-type: size` is the Gecko-fragile form; `inline-size`
      // (which contains the substring "size" only after "inline-") is allowed.
      expect(css).not.toMatch(/container-type:\s*size/);
      expect(css).toMatch(/container-type:\s*inline-size/);
    });

    it(`${tag} avoids block-axis container units (cqh / cqb)`, () => {
      // cqh/cqb resolve against a *size* container's block axis; under
      // inline-size containment they'd silently fall back to the viewport.
      expect(css).not.toMatch(/\bcq[hb]\b/);
    });
  }
});
