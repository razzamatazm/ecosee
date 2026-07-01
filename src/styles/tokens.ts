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

    /* Responsive squircle: scale to the container between a legible floor and a
       capped ceiling; aspect + corner radius are overridable per dashboard. */
    --ecosee-min-size: 220px;
    --ecosee-max-size: 460px;
    --ecosee-aspect: 1 / 1;
    --ecosee-radius: 15%;

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
