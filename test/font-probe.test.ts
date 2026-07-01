// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest';

import {
  splitFamilies,
  isDegenerate,
  filterDegenerateFamilies,
  createCanvasMeasure,
  PROBE_WEIGHTS,
  type FontMetricsSample,
  type MeasureFamily,
} from '../src/styles/font-probe';

// Issue #85: the broken-metric font quarantine. The full behavior (a real
// engine really laying text out with degenerate metrics, and the card really
// recovering) is guarded by test/browser/gecko-parity.test.ts in headless
// Firefox; this file pins the pure filtering seam.

/** A measure fn backed by a fixture table; families absent from the table
 *  measure as the engine-default font (healthy), like the real canvas probe. */
function measureFrom(table: Record<string, FontMetricsSample>): MeasureFamily {
  return (family) => table[family] ?? { fontAscent: 95, inkAscent: 70 };
}

const BROKEN: FontMetricsSample = { fontAscent: 50, inkAscent: 70 }; // mid-box baseline class
const ZEROED: FontMetricsSample = { fontAscent: 0, inkAscent: 70 }; // hhea-zeroed Gotham in Gecko
const HEALTHY: FontMetricsSample = { fontAscent: 73, inkAscent: 70 }; // same Gotham in Blink

describe('splitFamilies', () => {
  it('splits a stack and strips quotes', () => {
    expect(splitFamilies("'Gotham', 'Gotham SSm', Montserrat, system-ui, sans-serif")).toEqual([
      'Gotham',
      'Gotham SSm',
      'Montserrat',
      'system-ui',
      'sans-serif',
    ]);
  });

  it('keeps commas inside quoted names', () => {
    expect(splitFamilies('"Weird, Name", serif')).toEqual(['Weird, Name', 'serif']);
  });
});

describe('isDegenerate', () => {
  it('flags an ascent that cannot contain digit ink', () => {
    expect(isDegenerate(BROKEN)).toBe(true);
    expect(isDegenerate(ZEROED)).toBe(true);
  });

  it('accepts compact-but-sufficient ascents (Blink typo-metric fallback)', () => {
    expect(isDegenerate(HEALTHY)).toBe(false);
  });

  it('ignores unmeasurable ink (no digits rendered)', () => {
    expect(isDegenerate({ fontAscent: 0, inkAscent: 0 })).toBe(false);
  });
});

describe('filterDegenerateFamilies', () => {
  const STACK = "'Gotham', 'Montserrat', 'Avenir Next', system-ui, sans-serif";

  it('returns null when every family is healthy (cascade left untouched)', () => {
    expect(filterDegenerateFamilies(STACK, measureFrom({}))).toBeNull();
  });

  it('drops only the degenerate family and preserves order', () => {
    const filtered = filterDegenerateFamilies(STACK, measureFrom({ Gotham: ZEROED }));
    expect(filtered).toBe("'Montserrat', 'Avenir Next', system-ui, sans-serif");
  });

  it('quarantines a family broken at ANY probed weight', () => {
    // Webfont kits register each weight as its own face; only one may be broken.
    const brokenAt700: MeasureFamily = (family, weight) =>
      family === 'Gotham' && weight === 700 ? BROKEN : { fontAscent: 95, inkAscent: 70 };
    const filtered = filterDegenerateFamilies(STACK, brokenAt700);
    expect(filtered).toBe("'Montserrat', 'Avenir Next', system-ui, sans-serif");
    expect(PROBE_WEIGHTS).toContain(700);
  });

  it('never drops generic families, even if measured broken', () => {
    const allBroken: MeasureFamily = () => BROKEN;
    const filtered = filterDegenerateFamilies(STACK, allBroken);
    expect(filtered).toBe('system-ui, sans-serif');
  });

  it('treats unmeasurable samples as healthy', () => {
    const unmeasurable: MeasureFamily = () => null;
    expect(filterDegenerateFamilies(STACK, unmeasurable)).toBeNull();
  });
});

describe('createCanvasMeasure', () => {
  it('is inert where canvas text metrics are unavailable (this DOM shim)', () => {
    // happy-dom has no real 2d context; the probe must disable itself rather
    // than throw — the card then simply never quarantines.
    expect(createCanvasMeasure()).toBeNull();
  });
});
