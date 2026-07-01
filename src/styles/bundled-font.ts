/*!
 * Montserrat (https://github.com/JulietaUla/Montserrat), bundled as the Card's
 * guaranteed fallback face under the SIL Open Font License 1.1 — full license
 * text in src/assets/fonts/montserrat/OFL.txt (ADR-0007).
 */

// The Skin's typeface without asking the user for anything (issue #85 follow-up,
// ADR-0007). The stack still requests Gotham / a dashboard-provided Montserrat
// first, but HACS ships exactly one file (dist/ecosee.js, see hacs.json), so the
// only zero-config way to GUARANTEE a Gotham-alike with healthy metrics on every
// dashboard — including offline installs — is to carry the .woff2 files inside
// the bundle as data: URIs and register them at runtime. They register under the
// private family 'ecosee Montserrat' rather than 'Montserrat' so a theme's own
// Montserrat declaration is never fought over — if the theme provides a healthy
// one it simply wins earlier in the stack (and if it is metric-broken, the
// quarantine probe drops it and this face takes over).
//
// @font-face only works document-wide (rules inside shadow roots are ignored),
// so the faces are injected once into <head> when the first Card connects.

import montserrat200 from '../assets/fonts/montserrat/montserrat-latin-200.woff2?inline';
import montserrat300 from '../assets/fonts/montserrat/montserrat-latin-300.woff2?inline';
import montserrat400 from '../assets/fonts/montserrat/montserrat-latin-400.woff2?inline';
import montserrat500 from '../assets/fonts/montserrat/montserrat-latin-500.woff2?inline';
import montserrat600 from '../assets/fonts/montserrat/montserrat-latin-600.woff2?inline';
import montserrat700 from '../assets/fonts/montserrat/montserrat-latin-700.woff2?inline';

/** The private family the bundled faces register under; tokens.ts places it in
 *  `--ecosee-font` right after the dashboard-provided candidates. */
export const BUNDLED_FAMILY = 'ecosee Montserrat';

const STYLE_ID = 'ecosee-bundled-font';

const WEIGHTS: ReadonlyArray<[number, string]> = [
  [200, montserrat200],
  [300, montserrat300],
  [400, montserrat400],
  [500, montserrat500],
  [600, montserrat600],
  [700, montserrat700],
];

function faceRule(weight: number, dataUri: string): string {
  return `@font-face {
  font-family: '${BUNDLED_FAMILY}';
  font-style: normal;
  font-weight: ${weight};
  font-display: swap;
  src: url('${dataUri}') format('woff2');
}`;
}

/** Register the bundled faces on the document, once. Safe to call from every
 *  Card connect; inert without a document (SSR). */
export function ensureBundledFont(doc: Document | undefined = globalThis.document): void {
  if (!doc?.head || doc.getElementById(STYLE_ID)) return;
  const style = doc.createElement('style');
  style.id = STYLE_ID;
  style.textContent = WEIGHTS.map(([weight, uri]) => faceRule(weight, uri)).join('\n');
  doc.head.appendChild(style);
}
