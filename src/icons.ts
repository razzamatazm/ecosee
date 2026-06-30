import { svg, type SVGTemplateResult } from 'lit';

// Inline single-color SVG glyphs (stroke/fill `currentColor`), sized by the
// consuming element's font-size / explicit dimensions. These are being traced
// toward the device's exact vector art incrementally (the humidity droplet has
// had a fidelity pass); the remaining glyphs are still recognizable
// approximations pending closer reference (issue #3).

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

  /** Humidity — the device's water-droplet glyph: a teardrop with a pointed top
   *  and a rounded body (the `◊` in the docs is shorthand for this raindrop). */
  humidity: wrap(svg`
    <path d="M12 3 C12 3 6 10.2 6 14.5 A6 6 0 0 0 18 14.5 C18 10.2 12 3 12 3 Z"
      fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" />
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

  /** Resume Schedule — the ✕ inside the Hold pill; also the overlay close. */
  close: wrap(svg`
    <path d="M7.5 7.5 L16.5 16.5 M16.5 7.5 L7.5 16.5" fill="none" stroke="currentColor"
      stroke-width="2.2" stroke-linecap="round" />
  `),

  /** A right chevron, used two ways: the forward-navigation glyph trailing a Main
   *  Menu row (opens a sub-screen), and the circled expand affordance on a Sensors
   *  card (read-only — there is no per-sensor detail screen). */
  chevron: wrap(svg`
    <path d="M9 5 L16 12 L9 19" fill="none" stroke="currentColor" stroke-width="2"
      stroke-linecap="round" stroke-linejoin="round" />
  `),

  /** Down caret — the ▾ inside a System sub-screen selector (opens its picker). */
  caret: wrap(svg`
    <path d="M6 9.5 L12 15.5 L18 9.5" fill="none" stroke="currentColor" stroke-width="2"
      stroke-linecap="round" stroke-linejoin="round" />
  `),

  /** Dropdown caret — the ⌄ trailing the Fan minimum-runtime selector. */
  caretDown: wrap(svg`
    <path d="M6 9 L12 15 L18 9" fill="none" stroke="currentColor" stroke-width="2"
      stroke-linecap="round" stroke-linejoin="round" />
  `),

  /** Nudge up — a circled plus, matching the Temperature Adjust buttons. */
  plus: wrap(svg`
    <g fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round">
      <circle cx="12" cy="12" r="9.2" />
      <path d="M12 7.6 V16.4 M7.6 12 H16.4" />
    </g>
  `),

  /** Nudge down — a circled minus. */
  minus: wrap(svg`
    <g fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round">
      <circle cx="12" cy="12" r="9.2" />
      <path d="M7.6 12 H16.4" />
    </g>
  `),

  /** Dry System Mode — a water droplet (generic `climate` only; not an ecobee mode). */
  drop: wrap(svg`
    <path d="M12 3 C12 3 5.5 10.5 5.5 15 A6.5 6.5 0 0 0 18.5 15 C18.5 10.5 12 3 12 3 Z"
      fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" />
  `),

  /** Fan only System Mode — a simple fan (generic `climate` only; not an ecobee mode). */
  fan: wrap(svg`
    <g fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"
      stroke-linejoin="round">
      <circle cx="12" cy="12" r="1.8" fill="currentColor" stroke="none" />
      <path d="M12 10.2 C12 6 11 3.5 13.5 3.5 C16 3.5 15.5 8 12 10.2 Z" />
      <path d="M13.8 12 C18 12 20.5 11 20.5 13.5 C20.5 16 16 15.5 13.8 12 Z" />
      <path d="M10.2 12 C6 12 3.5 13 3.5 10.5 C3.5 8 8 8.5 10.2 12 Z" />
      <path d="M12 13.8 C12 18 13 20.5 10.5 20.5 C8 20.5 8.5 16 12 13.8 Z" />
    </g>
  `),

  /** Heat / Cool (Auto) System Mode — a snowflake fused with a leaf (cool + eco),
   *  matching the device's combined Auto glyph. */
  auto: wrap(svg`
    <g fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"
      stroke-linejoin="round">
      <path d="M8.5 3 V12 M4.6 5.25 L12.4 9.75 M12.4 5.25 L4.6 9.75" />
      <path d="M20.8 11.4 C14.6 11.9 11.9 15.5 12.4 21.2 C18.6 20.7 21.3 17.1 20.8 11.4 Z" />
      <path d="M14 19.4 C15.6 16.2 17.8 14 20.2 12.8" />
    </g>
  `),

  /** Home Comfort Setting — a house. */
  home: wrap(svg`
    <g fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"
      stroke-linejoin="round">
      <path d="M3.5 11.5 L12 4 L20.5 11.5" />
      <path d="M5.5 10 V20 H18.5 V10" />
      <path d="M10 20 V14.5 H14 V20" />
    </g>
  `),

  /** Away Comfort Setting — a suitcase (the device's "leaving home" motif). */
  away: wrap(svg`
    <g fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"
      stroke-linejoin="round">
      <rect x="4" y="8" width="16" height="12" rx="2" />
      <path d="M9 8 V6 A1.5 1.5 0 0 1 10.5 4.5 H13.5 A1.5 1.5 0 0 1 15 6 V8" />
      <path d="M12 11 V17" />
    </g>
  `),

  /** Sleep Comfort Setting — a crescent moon. */
  sleep: wrap(svg`
    <path d="M20 14.2 A8 8 0 1 1 10.4 4.2 A6.4 6.4 0 0 0 20 14.2 Z" fill="none"
      stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" />
  `),

  /** Default / custom Comfort Setting — a four-point sparkle (a named, user-defined
   *  preset with no built-in glyph). */
  comfort: wrap(svg`
    <path d="M12 4 C12.7 10.3 13.7 11.3 20 12 C13.7 12.7 12.7 13.7 12 20
      C11.3 13.7 10.3 12.7 4 12 C10.3 11.3 11.3 10.3 12 4 Z" fill="none"
      stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" />
  `),

  /** The thermostat's own Sensors card — the wall display: a landscape squircle
   *  with a small reading dot. Marks the auto-included thermostat temperature. */
  thermostat: wrap(svg`
    <g fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round">
      <rect x="3.5" y="7.5" width="17" height="9" rx="3.2" />
      <circle cx="8.5" cy="12" r="1.6" fill="currentColor" stroke="none" />
    </g>
  `),

  /** A curated remote sensor's Sensors card — the ecobee SmartSensor silhouette:
   *  a rounded head on a small stand (its occupancy-sensing form). */
  sensor: wrap(svg`
    <g fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"
      stroke-linejoin="round">
      <circle cx="12" cy="8" r="4" />
      <path d="M12 12 V15.5 M7.5 19 Q12 15.8 16.5 19" />
    </g>
  `),

  // Weather-condition glyphs (rendered green per the visual spec). Mapped from a
  // Home Assistant `weather` condition by `weatherIcon` below; `sun` (above) covers
  // a clear day. Deliberately simple, recognizable shapes — not the device's exact
  // vector art (a later fidelity pass).

  /** Clear night — a crescent moon. */
  moon: wrap(svg`
    <path d="M15.6 3.4 A9 9 0 1 0 20.6 14.4 A7 7 0 0 1 15.6 3.4 Z" fill="none"
      stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" />
  `),

  /** Overcast — a single cloud. */
  cloud: wrap(svg`
    <path d="M7.4 18 A4 4 0 0 1 6.9 10.1 A5.2 5.2 0 0 1 17 9.4 A3.7 3.7 0 0 1 17.1 18 Z"
      fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" />
  `),

  /** Partly cloudy — a sun peeking from behind a cloud. */
  cloudSun: wrap(svg`
    <g fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"
      stroke-linejoin="round">
      <path d="M8.5 3 V4.4 M3.2 8.3 H4.6 M4.6 4.4 L5.6 5.4 M12.4 4.4 L11.4 5.4" />
      <circle cx="8.5" cy="8.3" r="2.7" />
      <path d="M9.8 19 A3.3 3.3 0 0 1 9.5 12.5 A4.4 4.4 0 0 1 18 13.2 A2.9 2.9 0 0 1 18.1 19 Z" />
    </g>
  `),

  /** Rain — a cloud over slanted streaks. */
  rain: wrap(svg`
    <g fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"
      stroke-linejoin="round">
      <path d="M7.4 13.6 A3.6 3.6 0 0 1 6.9 6.2 A4.8 4.8 0 0 1 16.6 5.6 A3.3 3.3 0 0 1 16.8 13.6 Z" />
      <path d="M8.6 16.4 L7.4 19.4 M12 16.4 L10.8 19.4 M15.4 16.4 L14.2 19.4" />
    </g>
  `),

  /** Snow — a cloud over three flakes. */
  snow: wrap(svg`
    <g stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
      <path d="M7.4 13.4 A3.6 3.6 0 0 1 6.9 6 A4.8 4.8 0 0 1 16.6 5.4 A3.3 3.3 0 0 1 16.8 13.4 Z"
        fill="none" />
      <circle cx="8.4" cy="17.6" r="0.9" fill="currentColor" stroke="none" />
      <circle cx="12" cy="18.6" r="0.9" fill="currentColor" stroke="none" />
      <circle cx="15.6" cy="17.6" r="0.9" fill="currentColor" stroke="none" />
    </g>
  `),

  /** Fog — stacked drifting lines. */
  fog: wrap(svg`
    <g fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round">
      <path d="M4 8 H19 M5.5 12 H20 M3.5 16 H17.5 M6 20 H18" />
    </g>
  `),

  /** Thunderstorm — a cloud with a lightning bolt. */
  lightning: wrap(svg`
    <g fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"
      stroke-linejoin="round">
      <path d="M7.4 12.6 A3.4 3.4 0 0 1 6.9 5.5 A4.6 4.6 0 0 1 16.3 4.9 A3.1 3.1 0 0 1 16.5 12.6 Z" />
      <path d="M12.4 11.6 L9.6 16.2 H12 L10.4 20.4" />
    </g>
  `),

  /** Air quality — drifting wind/breeze lines. Neutral regardless of the reading's
   *  severity (the element's color carries that), so it reads as "air" whether the
   *  air is clean or not. */
  wind: wrap(svg`
    <g fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"
      stroke-linejoin="round">
      <path d="M3 8 H13.5 A2.4 2.4 0 1 0 11.1 5.6" />
      <path d="M3 12 H18 A2.4 2.4 0 1 1 15.6 14.4" />
      <path d="M3 16 H9.5 A2 2 0 1 1 7.5 18" />
    </g>
  `),

  /** Probability of precipitation — an umbrella with a falling drop. */
  umbrella: wrap(svg`
    <g fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"
      stroke-linejoin="round">
      <path d="M3.4 11.6 A8.6 8.6 0 0 1 20.6 11.6 Z" />
      <path d="M12 11.6 V19 A2.3 2.3 0 0 0 16.2 19.7" />
    </g>
  `),
} as const;

/** Map a Home Assistant `weather` condition string to a glyph. Falls back to a
 *  partly-cloudy glyph for unrecognized / under-specified conditions so the
 *  Weather Overlay always shows something coherent (ADR-0001). */
export function weatherIcon(condition: string): SVGTemplateResult {
  switch (condition) {
    case 'sunny':
      return icons.sun;
    case 'clear-night':
      return icons.moon;
    case 'cloudy':
      return icons.cloud;
    case 'rainy':
    case 'pouring':
      return icons.rain;
    case 'lightning':
    case 'lightning-rainy':
      return icons.lightning;
    case 'snowy':
    case 'snowy-rainy':
    case 'hail':
      return icons.snow;
    case 'fog':
      return icons.fog;
    case 'partlycloudy':
    default:
      return icons.cloudSun;
  }
}
