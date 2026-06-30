import { svg, type SVGTemplateResult } from 'lit';

// Inline single-color SVG glyphs (stroke/fill `currentColor`), sized by the
// consuming element's font-size / explicit dimensions. Kept deliberately simple
// and recognizable rather than tracing the device's exact vector art — that is a
// later fidelity pass.

const wrap = (body: SVGTemplateResult): SVGTemplateResult =>
  svg`<svg viewBox="0 0 24 24" width="100%" height="100%" aria-hidden="true">${body}</svg>`;

export const icons = {
  /** Main Menu affordance — three ascending bars. */
  menu: wrap(svg`
    <g fill="currentColor">
      <rect x="3" y="13" width="4" height="8" rx="1.5" />
      <rect x="10" y="9" width="4" height="12" rx="1.5" />
      <rect x="17" y="5" width="4" height="16" rx="1.5" />
    </g>
  `),

  /** Humidity — a slim diamond, matching the device's ◊ glyph. */
  humidity: wrap(svg`
    <path d="M12 3 L19 12 L12 21 L5 12 Z" fill="none" stroke="currentColor"
      stroke-width="1.8" stroke-linejoin="round" />
  `),

  /** Cooling / Cool mode. */
  snowflake: wrap(svg`
    <g fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"
      stroke-linejoin="round">
      <path d="M12 2 V22 M3.34 7 L20.66 17 M20.66 7 L3.34 17" />
      <path d="M12 5.5 L9.5 4 M12 5.5 L14.5 4 M12 18.5 L9.5 20 M12 18.5 L14.5 20" />
      <path d="M5.2 9 L5.2 6.2 L7.6 7.6 M18.8 9 L18.8 6.2 L16.4 7.6" />
      <path d="M5.2 15 L5.2 17.8 L7.6 16.4 M18.8 15 L18.8 17.8 L16.4 16.4" />
    </g>
  `),

  /** Heating / Heat mode — rising coils over a wave (hot-springs ♨ motif). */
  heat: wrap(svg`
    <g fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"
      stroke-linejoin="round">
      <path d="M8 13 C8 11 9.5 10.5 9.5 8.5 C9.5 6.5 8 6 8 4" />
      <path d="M12 13 C12 11 13.5 10.5 13.5 8.5 C13.5 6.5 12 6 12 4" />
      <path d="M16 13 C16 11 17.5 10.5 17.5 8.5 C17.5 6.5 16 6 16 4" />
      <path d="M4 19 C5.5 19 5.5 17.8 7 17.8 S8.5 19 10 19 11.5 17.8 13 17.8
        14.5 19 16 19 17.5 17.8 19 17.8 19.5 19 20 19" />
    </g>
  `),

  /** Weather affordance — a sun (rendered green per the visual spec). */
  sun: wrap(svg`
    <g fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round">
      <circle cx="12" cy="12" r="4.2" />
      <path d="M12 1.8 V4.4 M12 19.6 V22.2 M1.8 12 H4.4 M19.6 12 H22.2
        M4.5 4.5 L6.3 6.3 M17.7 17.7 L19.5 19.5 M19.5 4.5 L17.7 6.3
        M6.3 17.7 L4.5 19.5" />
    </g>
  `),

  /** Idle / neutral equipment status. */
  idle: wrap(svg`
    <circle cx="12" cy="12" r="3.6" fill="none" stroke="currentColor" stroke-width="1.8" />
  `),

  /** Resume Schedule — the ✕ inside the Hold pill. */
  close: wrap(svg`
    <path d="M7.5 7.5 L16.5 16.5 M16.5 7.5 L7.5 16.5" fill="none" stroke="currentColor"
      stroke-width="2.2" stroke-linecap="round" />
  `),
} as const;
