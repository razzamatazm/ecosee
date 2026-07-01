import { css } from 'lit';

// Design tokens as inherited CSS custom properties. Declared on the card's
// :host so they cascade through the shadow boundary into <ecosee-home-screen>
// and any future overlay element. Values trace the device's flat squircle motif:
// near-black canvas, cyan accents, amber Heat / blue Cool (visual-spec.md).
export const tokens = css`
  :host {
    --ecosee-bg: #0a0d10;
    --ecosee-fg: #d4eff9;
    --ecosee-accent: #62cfe9;
    --ecosee-muted: #6f96a3;
    --ecosee-idle: #6f96a3;
    /* The three top-row Home Screen affordances (weather / System Mode / menu)
       render white, not the cyan accent — the device colors this control row white
       (issue #37). Overridable per dashboard like every other Skin color. */
    --ecosee-top-row: #ffffff;

    /* The dominant current-temperature number: cyan with the device's faint
       top-bright sheen (a near-white cyan fading into the accent). */
    --ecosee-temp-grad: linear-gradient(180deg, #cdeffb 0%, #62cfe9 72%);

    --ecosee-heat: #f3a13c;
    --ecosee-heat-grad: linear-gradient(150deg, #f7c84d 0%, #ee7a2c 100%);
    --ecosee-cool: #49b6ea;
    --ecosee-cool-grad: linear-gradient(150deg, #74d4f3 0%, #2d7ed6 100%);
    /* Weather Overlay condition-glyph colors (issue #31): a natural per-condition
       palette so a sunny day and a cloudy day read from color, not glyph shape
       alone. conditionColor (icons.ts) maps each HA condition to one of these;
       overridable per dashboard like the other accents. Tuned to sit within the
       near-black premium aesthetic. */
    --ecosee-weather-sun: #f4c74a;
    --ecosee-weather-clear: #b7c4da;
    --ecosee-weather-partly: #cdd6dc;
    --ecosee-weather-cloud: #9fabb4;
    --ecosee-weather-rain: #5aa6e6;
    /* Violet, not another yellow — a storm must stay legible from the sun by color
       alone, not just glyph shape (issue #31). */
    --ecosee-weather-storm: #c9a4f0;
    --ecosee-weather-snow: #dcecf5;

    /* Air-quality element severity bands (issue #10): the US-EPA AQI scale, green
       (Good) → maroon (Hazardous). The optional element colors its number/glyph by
       the reading's band; overridable per dashboard like every other accent. */
    --ecosee-aqi-good: #5bbf6a;
    --ecosee-aqi-moderate: #e6c84d;
    --ecosee-aqi-sensitive: #ef9a4d;
    --ecosee-aqi-unhealthy: #e5604d;
    --ecosee-aqi-very-unhealthy: #b06fce;
    --ecosee-aqi-hazardous: #9c5a6a;

    /* Optional UV-index gauge severity bands: the WHO UV scale, green (Low) →
       violet (Extreme). The gauge tints its number/category by the reading's band
       (the arc itself is the full-scale gradient); overridable per dashboard. */
    --ecosee-uv-none: #5a6068;
    --ecosee-uv-low: #35c46b;
    --ecosee-uv-moderate: #ffd400;
    --ecosee-uv-high: #ff8a1e;
    --ecosee-uv-very-high: #ff3b3b;
    --ecosee-uv-extreme: #b45cff;

    /* Fixed-canvas squircle (issue #35 / #36): the device is laid out ONCE at
       --ecosee-base-size and then the whole Card is scaled as a single unit to
       fit its slot — the internal layout never reflows per-width, so it renders
       identically at every width. The card measures its slot and clamps the
       on-screen size between this legible floor and capped ceiling, then applies
       one transform: scale(). base equals max by default, so the largest render
       is 1:1 (crispest) and everything narrower only ever scales down. Corner
       radius is overridable per dashboard; the device renders square. */
    --ecosee-base-size: 460px;
    --ecosee-min-size: 220px;
    --ecosee-max-size: 460px;
    --ecosee-radius: 15%;

    /* The device's layout unit: 1% of the fixed canvas edge (base-size / 100).
       Every internal length is expressed as calc(N * var(--ecosee-u)), so the
       whole layout is sized off this ONE fixed px scale and the transform: scale()
       above does the responsive work. This replaced container-query units (cqw):
       an element that is itself a container-type container resolves its OWN cqw
       properties (e.g. its padding) against the *viewport*, not the card, because
       nothing above it establishes a query container — so on a wide window that
       padding ballooned and collapsed the content, shrinking every child. This
       unit has no such coupling: it is always base-size/100 regardless of viewport
       or browser (issue #35). Follows base-size if a dashboard overrides it. */
    --ecosee-u: calc(var(--ecosee-base-size, 460px) / 100);

    /* The device's typeface is Gotham (Hoefler&Co). Gotham is proprietary and
       cannot be bundled with the card, so we request it by name first — it is used
       wherever the user's theme/system provides it — then fall back through the
       closest available geometric sans-serifs: Montserrat (the closest freely-
       licensed Gotham-alike, if installed/served), then Avenir Next / Avenir (which
       ship on Apple devices — the common dashboard client — and read far closer to
       Gotham than the grotesque Helvetica Neue), then the prior system stack. To
       guarantee Gotham itself, supply it via your Home Assistant frontend. */
    --ecosee-font:
      'Gotham', 'Gotham SSm', 'Montserrat', 'Avenir Next', 'Avenir', 'Helvetica Neue', 'Segoe UI',
      system-ui, -apple-system, sans-serif;
  }
`;
