import { css, html, svg, nothing, type CSSResult, type TemplateResult } from 'lit';

/**
 * The device's outer silhouette, shared by every surface (issue #76). One
 * **superellipse** ( |x/a|⁴ + |y/b|⁴ = 1 ) — the ecobee squircle, rounder and
 * softer at the corners than a constant-radius `border-radius`. Sampled at 128
 * points in a 0–100 viewBox (pulled fractionally inside the box so the crisp
 * edge stroke, drawn centred on the path, sits at the screen boundary). One path
 * drives the background fill, the clip, and the equipment edge glow so all three
 * trace the identical curve. The SVG scales with each responsive container via
 * `preserveAspectRatio="none"`.
 *
 * Extracted from the Home Screen so the Standby Screen and every Overlay render
 * the *same* silhouette rather than plain rounded rectangles (issue #76): the
 * Card's outer shape no longer changes as you move between screens.
 */
export const SQUIRCLE_PATH =
  'M99.40 50.00L99.37 60.94L99.28 65.47L99.13 68.92L98.92 71.82L98.65 74.35L98.32 76.62L97.93 78.67L97.48 80.56L96.97 82.30L96.39 83.92L95.75 85.42L95.05 86.82L94.27 88.13L93.43 89.35L92.52 90.48L91.54 91.54L90.48 92.52L89.35 93.43L88.13 94.27L86.82 95.05L85.42 95.75L83.92 96.39L82.30 96.97L80.56 97.48L78.67 97.93L76.62 98.32L74.35 98.65L71.82 98.92L68.92 99.13L65.47 99.28L60.94 99.37L50.00 99.40L39.06 99.37L34.53 99.28L31.08 99.13L28.18 98.92L25.65 98.65L23.38 98.32L21.33 97.93L19.44 97.48L17.70 96.97L16.08 96.39L14.58 95.75L13.18 95.05L11.87 94.27L10.65 93.43L9.52 92.52L8.46 91.54L7.48 90.48L6.57 89.35L5.73 88.13L4.95 86.82L4.25 85.42L3.61 83.92L3.03 82.30L2.52 80.56L2.07 78.67L1.68 76.62L1.35 74.35L1.08 71.82L0.87 68.92L0.72 65.47L0.63 60.94L0.60 50.00L0.63 39.06L0.72 34.53L0.87 31.08L1.08 28.18L1.35 25.65L1.68 23.38L2.07 21.33L2.52 19.44L3.03 17.70L3.61 16.08L4.25 14.58L4.95 13.18L5.73 11.87L6.57 10.65L7.48 9.52L8.46 8.46L9.52 7.48L10.65 6.57L11.87 5.73L13.18 4.95L14.58 4.25L16.08 3.61L17.70 3.03L19.44 2.52L21.33 2.07L23.38 1.68L25.65 1.35L28.18 1.08L31.08 0.87L34.53 0.72L39.06 0.63L50.00 0.60L60.94 0.63L65.47 0.72L68.92 0.87L71.82 1.08L74.35 1.35L76.62 1.68L78.67 2.07L80.56 2.52L82.30 3.03L83.92 3.61L85.42 4.25L86.82 4.95L88.13 5.73L89.35 6.57L90.48 7.48L91.54 8.46L92.52 9.52L93.43 10.65L94.27 11.87L95.05 13.18L95.75 14.58L96.39 16.08L96.97 17.70L97.48 19.44L97.93 21.33L98.32 23.38L98.65 25.65L98.92 28.18L99.13 31.08L99.28 34.53L99.37 39.06Z';

/**
 * Structural CSS for the shared superellipse surface. Include it in a component's
 * `static styles` (as an array element) alongside its own block; it positions the
 * `.shape` SVG behind the content and paints the near-black canvas fill *through*
 * the superellipse path — so the corners outside the curve stay transparent and
 * the silhouette is the squircle, not the square box (the corners are clipped by
 * the surrounding surface's `overflow: hidden`). It carries no container-query
 * units, so it is safe in both the fixed-canvas Overlay shell and the query-
 * container screens (issue #35). The equipment edge glow is *not* here: only the
 * Home Screen opts into it via `renderShape({ glow: true })` and owns its reveal
 * CSS, so the shared contract is silhouette + canvas fill only (issue #76).
 */
export const shapeStyles: CSSResult = css`
  .shape {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    display: block;
    z-index: 0;
    pointer-events: none;
  }
  .shape .fill {
    fill: var(--ecosee-bg, #0a0d10);
  }
`;

/** Options for {@link renderShape}. */
export interface ShapeOptions {
  /**
   * Draw the equipment edge glow group (three stacked strokes of the same curve,
   * clipped to the squircle). Home Screen only — the group is hidden by default
   * and revealed/colored by the `.screen.cooling` / `.screen.heating` class the
   * Home Screen owns. Off for every other surface, which shares the silhouette +
   * canvas fill but has no equipment state.
   */
  glow?: boolean;
}

/**
 * The shared superellipse surface, drawn behind a surface's content. One path
 * (SQUIRCLE_PATH) fills the canvas; with `glow: true` it is also clipped and
 * stroked three times for the Home Screen's crisp-edge-plus-inward-falloff
 * equipment glow. Pair with {@link shapeStyles} and render it as the first child
 * of a `position: relative; overflow: hidden` surface.
 */
export function renderShape(options: ShapeOptions = {}): TemplateResult {
  const { glow = false } = options;
  return html`
    <svg class="shape" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
      ${
        // These fragments MUST use Lit's `svg` tag, not `html`: a nested `html`
        // template is parsed as a standalone HTML fragment, so `<defs>`/`<clipPath>`/
        // `<g>`/`<path>` land in the XHTML namespace and render as inert unknown
        // elements inside the SVG — the equipment edge glow then never paints in ANY
        // engine (issue #89, a regression from the #76 silhouette extraction that split
        // this markup out of the outer `<svg>` template). `svg` parses them in the SVG
        // namespace so they are real graphics. The outer `<svg>` + `.fill` stay `html`.
        glow
          ? svg`<defs>
              <clipPath id="ecosee-squircle">
                <path d=${SQUIRCLE_PATH} />
              </clipPath>
            </defs>`
          : nothing
      }
      <path class="fill" d=${SQUIRCLE_PATH} />
      ${
        glow
          ? svg`<g class="glow" clip-path="url(#ecosee-squircle)">
              <path d=${SQUIRCLE_PATH} stroke-width="5.5" opacity="0.18" />
              <path d=${SQUIRCLE_PATH} stroke-width="2.2" opacity="0.5" />
              <path d=${SQUIRCLE_PATH} stroke-width="0.9" opacity="1" />
            </g>`
          : nothing
      }
    </svg>
  `;
}
