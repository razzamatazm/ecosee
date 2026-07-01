// Broken-metric font quarantine (issue #85).
//
// The card's font stack requests 'Montserrat' by name (ADR-0008 / tokens.ts), so
// it uses whatever font the surrounding dashboard provides under that name. Some
// dashboards provide such a face as a webfont with DEGENERATE vertical metrics
// (the original #85 report was a CDN Gotham whose hhea ascent/descent/lineGap were
// all zero — the same class of breakage applies to any requested family). Engines then
// diverge: Blink falls back to the font's sane OS/2 typo metrics, but Gecko
// synthesizes symmetric metrics (ascent = descent = ½em), which drops the text
// baseline to the MIDDLE of every line box. Digit ink (~0.7em cap height) then
// rides ~0.2em above its line box, mangling the gradient-clipped current
// temperature and crashing the Temperature Adjust chip numerals into their
// glyphs — in Firefox/Zen only, while Chrome looks fine.
//
// No CSS can repair a foreign font's metrics (metric overrides only apply to
// @font-face rules we'd own), so the card asks the engine itself: for each
// family in the stack, canvas TextMetrics report the metrics THIS engine will
// lay text out with. A family whose reported line-layout ascent cannot even
// contain bare digits is unusable in this engine and is dropped from the
// resolved stack (the next fallback takes over — the same face-independent
// degradation the stack already expresses). The probe is engine-relative by
// design: the same broken webfont stays quarantined in Gecko but kept in Blink,
// where its typo-metric fallback renders correctly, so Chrome keeps its look.
// See docs/adr/0005-cross-browser-typography.md.

/** One engine-reported measurement of a family: the ascent the engine will use
 *  for line layout vs the actual ink ascent of bare digits. */
export interface FontMetricsSample {
  fontAscent: number;
  inkAscent: number;
}

/** Measure one family at one weight; `null` when the environment can't
 *  measure (no canvas / no TextMetrics support), which disables the probe. */
export type MeasureFamily = (family: string, weight: number) => FontMetricsSample | null;

/** The probe renders at 100px, so tolerances below are in px-per-100px-em. */
export const PROBE_FONT_SIZE = 100;

/** Weights the Skin actually renders text at (thin numerals → bold labels);
 *  webfont kits register each weight as its own face, so any of them may carry
 *  the broken metrics. */
export const PROBE_WEIGHTS = [200, 300, 400, 500, 600, 700] as const;

/** Ink can exceed the em-box slightly in healthy fonts; only flag a family
 *  when its usable ascent falls short of digit ink by more than this. */
const ASCENT_TOLERANCE = 2;

/** CSS generic families: never quarantined (they are the stack's safety net,
 *  and engines always resolve them to metric-sane platform fonts). */
const GENERIC_FAMILIES = new Set([
  'serif',
  'sans-serif',
  'monospace',
  'cursive',
  'fantasy',
  'system-ui',
  'ui-serif',
  'ui-sans-serif',
  'ui-monospace',
  'ui-rounded',
  'math',
  'emoji',
  'fangsong',
]);

/** Split a CSS `font-family` list into bare family names (quotes stripped,
 *  commas inside quoted names respected). */
export function splitFamilies(stack: string): string[] {
  const families: string[] = [];
  let current = '';
  let quote: string | null = null;
  for (const ch of stack) {
    if (quote) {
      if (ch === quote) quote = null;
      else current += ch;
    } else if (ch === '"' || ch === "'") {
      quote = ch;
    } else if (ch === ',') {
      if (current.trim()) families.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  if (current.trim()) families.push(current.trim());
  return families;
}

/** Serialize a family name back into a font-family list entry. Generic
 *  keywords must stay bare (quoting one names a real family instead); anything
 *  else is quoted so spaces survive. */
function serializeFamily(family: string): string {
  if (GENERIC_FAMILIES.has(family.toLowerCase())) return family;
  return `'${family.replace(/'/g, "\\'")}'`;
}

/** Whether one measurement is degenerate: the engine's usable line-layout
 *  ascent cannot contain the ink of bare digits, so baselines land mid-box
 *  and stacked layouts collide (#85). */
export function isDegenerate(sample: FontMetricsSample): boolean {
  return sample.inkAscent > 0 && sample.fontAscent + ASCENT_TOLERANCE < sample.inkAscent;
}

/**
 * Drop the families this engine reports degenerate metrics for. Returns the
 * filtered stack, or `null` when every family is healthy (callers then leave
 * the cascade untouched). Unavailable families measure as the engine's default
 * font — healthy — and are kept: CSS skips them anyway, and a webfont by that
 * name may still arrive later (the caller re-probes on font-load events).
 */
export function filterDegenerateFamilies(stack: string, measure: MeasureFamily): string | null {
  const families = splitFamilies(stack);
  const kept = families.filter((family) => {
    if (GENERIC_FAMILIES.has(family.toLowerCase())) return true;
    return !PROBE_WEIGHTS.some((weight) => {
      const sample = measure(family, weight);
      return sample !== null && isDegenerate(sample);
    });
  });
  if (kept.length === families.length) return null;
  return kept.map(serializeFamily).join(', ');
}

/**
 * The production {@link MeasureFamily}: canvas TextMetrics for bare digits.
 * Measures one family in isolation (no fallback list), so an unavailable
 * family reports the engine default font's healthy metrics. Returns `null`
 * when the environment lacks canvas text metrics (jsdom/happy-dom, old
 * engines) — the probe then simply stays inert.
 */
export function createCanvasMeasure(): MeasureFamily | null {
  if (typeof document === 'undefined') return null;
  const context = document.createElement('canvas').getContext?.('2d');
  if (!context || typeof context.measureText !== 'function') return null;
  const probe = context.measureText('75');
  if (typeof probe.fontBoundingBoxAscent !== 'number') return null;
  return (family, weight) => {
    context.font = `${weight} ${PROBE_FONT_SIZE}px ${serializeFamily(family)}`;
    const metrics = context.measureText('75');
    const fontAscent = metrics.fontBoundingBoxAscent;
    const inkAscent = metrics.actualBoundingBoxAscent;
    if (!Number.isFinite(fontAscent) || !Number.isFinite(inkAscent)) return null;
    return { fontAscent, inkAscent };
  };
}
