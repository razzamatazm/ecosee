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

    /* The dominant current-temperature number: cyan with the device's faint
       top-bright sheen (a near-white cyan fading into the accent). */
    --ecosee-temp-grad: linear-gradient(180deg, #cdeffb 0%, #62cfe9 72%);

    --ecosee-heat: #f3a13c;
    --ecosee-heat-grad: linear-gradient(150deg, #f7c84d 0%, #ee7a2c 100%);
    --ecosee-cool: #49b6ea;
    --ecosee-cool-grad: linear-gradient(150deg, #74d4f3 0%, #2d7ed6 100%);
    --ecosee-weather: #7fd08a;

    /* Responsive squircle: scale to the container between a legible floor and a
       capped ceiling; aspect + corner radius are overridable per dashboard. */
    --ecosee-min-size: 220px;
    --ecosee-max-size: 460px;
    --ecosee-aspect: 1 / 1;
    --ecosee-radius: 15%;

    --ecosee-font: 'Helvetica Neue', 'Segoe UI', system-ui, -apple-system, sans-serif;
  }
`;
