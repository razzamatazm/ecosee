import { svg, type SVGTemplateResult } from 'lit';

// Inline single-color SVG glyphs (stroke/fill `currentColor`), sized by the
// consuming element's font-size / explicit dimensions. These are being traced
// toward the device's exact vector art incrementally (the humidity droplet has
// had a fidelity pass); the remaining glyphs are still recognizable
// approximations pending closer reference (issue #3).

const wrap = (body: SVGTemplateResult): SVGTemplateResult =>
  svg`<svg viewBox="0 0 24 24" width="100%" height="100%" aria-hidden="true">${body}</svg>`;

export const icons = {
  /** Main Menu affordance — a cog (gear): a toothed ring with a hollow hub (the
   *  inner circle is a second sub-path, so the even-odd fill punches the hub out).
   *  Opens the Main Menu. */
  menu: wrap(svg`
    <path fill="currentColor" fill-rule="evenodd" d="M19.14 12.94c.04-.3.06-.61.06-.94
      0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22
      l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41
      l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61
      l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32
      c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84
      c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32
      c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6
      3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z" />
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

  /** Weather affordance / clear-day condition — a sun. Rendered white on the Home
   *  Screen top row (issue #37) and warm-yellow inside the Weather Overlay
   *  (`conditionColor`, issue #31) — the color comes from the consuming element,
   *  not the glyph. */
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

  /** The overlay close ✕. */
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

  /** Heat / Cool (Auto) System Mode — the ecobee Auto mark (see
   *  docs/reference/home-hold.jpeg): the left half of a six-pointed snowflake (cool)
   *  fused with a two-leaf eco sprig (heat/eco) on the right, reading as "both
   *  heating and cooling" (issue #41). The vertical spine is the seam between the
   *  two halves; the leaves are hollow outlines that bulge away from it. */
  auto: wrap(svg`
    <g fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"
      stroke-linejoin="round">
      <path d="M10.8 2 V22 M10.8 12 L3.5 7.4 M10.8 12 L3.5 16.6 M10.8 5.6 L8.5 4.2
        M10.8 18.4 L8.5 19.8 M4.8 8.6 L4.4 6.4 L6.4 7.1 M4.8 15.4 L4.4 17.6 L6.4 16.9" />
      <path d="M15 11.2 C13 9 12.9 5 15.9 2.9 C18.4 4.8 17.6 9 15 11.2 Z" />
      <path d="M13.2 16.8 C14.2 12.6 16.6 9.6 20 8.4 C21.5 11 21.3 15.2 19.2 17.7
        C17.6 19.5 14.8 19 13.2 16.8 Z" />
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

  // Weather-condition glyphs. Mapped from a Home Assistant `weather` condition by
  // `weatherIcon` below; `sun` (above) covers a clear day. Tinted a natural
  // per-condition color inside the Weather Overlay (`conditionColor`, issue #31),
  // and white as the Home Screen top-row affordance (issue #37) — the color comes
  // from the consuming element. Deliberately simple, recognizable shapes — not the
  // device's exact vector art (a later fidelity pass).

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

/** The natural per-condition color the Weather Overlay tints a condition's glyph
 *  (issue #31): a warm-yellow sun, grey clouds, blue rain, icy snow — so the
 *  condition reads from color, not glyph shape alone. Each color is an overridable
 *  `--ecosee-weather-*` token (declared in styles/tokens.ts) with a baked-in hex
 *  fallback, matching the Skin's `var(--token, #hex)` convention. Grouped like
 *  `weatherIcon` (pouring rides the rain color, hail the snow color; fog folds into
 *  the cloud grey rather than taking its own tint); an unrecognized condition takes
 *  the partly-cloudy tint alongside the partly-cloudy glyph it degrades to. */
export function conditionColor(condition: string): string {
  switch (condition) {
    case 'sunny':
      return 'var(--ecosee-weather-sun, #f4c74a)';
    case 'clear-night':
      return 'var(--ecosee-weather-clear, #b7c4da)';
    case 'cloudy':
    case 'fog':
      return 'var(--ecosee-weather-cloud, #9fabb4)';
    case 'rainy':
    case 'pouring':
      return 'var(--ecosee-weather-rain, #5aa6e6)';
    case 'lightning':
    case 'lightning-rainy':
      return 'var(--ecosee-weather-storm, #c9a4f0)';
    case 'snowy':
    case 'snowy-rainy':
    case 'hail':
      return 'var(--ecosee-weather-snow, #dcecf5)';
    case 'partlycloudy':
    default:
      return 'var(--ecosee-weather-partly, #cdd6dc)';
  }
}
