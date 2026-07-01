import { LitElement, html, css, nothing, type TemplateResult } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import type { AirQualityView, EquipmentStatus, HomeView, SystemMode } from '../climate/home-view';
import { formatTemp } from '../climate/home-view';
import { icons, weatherIcon } from '../icons';

/**
 * The screen's outline as a true **superellipse** ( |x/a|⁴ + |y/b|⁴ = 1 ), the
 * device's squircle — rounder and softer at the corners than a constant-radius
 * `border-radius`. Sampled at 128 points in a 0–100 viewBox (pulled fractionally
 * inside the box so the crisp edge stroke, drawn centred on the path, sits at the
 * screen boundary). One path drives the background fill, the clip, and the
 * equipment edge glow so all three trace the identical curve. The SVG scales with
 * the responsive container via `preserveAspectRatio="none"`.
 */
const SQUIRCLE_PATH =
  'M99.40 50.00L99.37 60.94L99.28 65.47L99.13 68.92L98.92 71.82L98.65 74.35L98.32 76.62L97.93 78.67L97.48 80.56L96.97 82.30L96.39 83.92L95.75 85.42L95.05 86.82L94.27 88.13L93.43 89.35L92.52 90.48L91.54 91.54L90.48 92.52L89.35 93.43L88.13 94.27L86.82 95.05L85.42 95.75L83.92 96.39L82.30 96.97L80.56 97.48L78.67 97.93L76.62 98.32L74.35 98.65L71.82 98.92L68.92 99.13L65.47 99.28L60.94 99.37L50.00 99.40L39.06 99.37L34.53 99.28L31.08 99.13L28.18 98.92L25.65 98.65L23.38 98.32L21.33 97.93L19.44 97.48L17.70 96.97L16.08 96.39L14.58 95.75L13.18 95.05L11.87 94.27L10.65 93.43L9.52 92.52L8.46 91.54L7.48 90.48L6.57 89.35L5.73 88.13L4.95 86.82L4.25 85.42L3.61 83.92L3.03 82.30L2.52 80.56L2.07 78.67L1.68 76.62L1.35 74.35L1.08 71.82L0.87 68.92L0.72 65.47L0.63 60.94L0.60 50.00L0.63 39.06L0.72 34.53L0.87 31.08L1.08 28.18L1.35 25.65L1.68 23.38L2.07 21.33L2.52 19.44L3.03 17.70L3.61 16.08L4.25 14.58L4.95 13.18L5.73 11.87L6.57 10.65L7.48 9.52L8.46 8.46L9.52 7.48L10.65 6.57L11.87 5.73L13.18 4.95L14.58 4.25L16.08 3.61L17.70 3.03L19.44 2.52L21.33 2.07L23.38 1.68L25.65 1.35L28.18 1.08L31.08 0.87L34.53 0.72L39.06 0.63L50.00 0.60L60.94 0.63L65.47 0.72L68.92 0.87L71.82 1.08L74.35 1.35L76.62 1.68L78.67 2.07L80.56 2.52L82.30 3.03L83.92 3.61L85.42 4.25L86.82 4.95L88.13 5.73L89.35 6.57L90.48 7.48L91.54 8.46L92.52 9.52L93.43 10.65L94.27 11.87L95.05 13.18L95.75 14.58L96.39 16.08L96.97 17.70L97.48 19.44L97.93 21.33L98.32 23.38L98.65 25.65L98.92 28.18L99.13 31.08L99.28 34.53L99.37 39.06Z';

/** Actions the Home Screen surfaces to the host card. `temperature` opens the
 *  Temperature Adjust overlay; `system-mode` / `weather` / `menu` open later
 *  Overlays. */
export type HomeAction = 'menu' | 'temperature' | 'weather' | 'system-mode';

/**
 * The default Card view, laid out as the device is (see
 * docs/reference/home-*.jpeg): a top row of affordance glyphs (weather left,
 * System Mode center, menu right), the humidity line and the large current
 * temperature centered beneath, the horizontal setpoint pill below the number, and the
 * optional air-quality element (issue #10) at the foot of the cluster. Active
 * equipment is shown as a colored edge glow around the squircle (blue cooling /
 * amber heating), keyed to `hvac_action` — not an icon. Purely presentational: it
 * renders whatever the already-degraded HomeView says and emits `ecosee-action`
 * events for the host card to handle.
 */
@customElement('ecosee-home-screen')
export class EcoseeHomeScreen extends LitElement {
  @property({ attribute: false }) view?: HomeView;

  static override styles = css`
    :host {
      display: block;
    }

    /* Responsive squircle: a sized container so children can scale with cqw, with
       a legible floor (min-size) and a capped ceiling (max-size). The squircle
       surface itself is drawn by the inline SVG (.shape) below — no background or
       border-radius here, so the true superellipse, its glow and any clip all
       trace the one curve. */
    .screen {
      container-type: size;
      position: relative;
      box-sizing: border-box;
      width: clamp(var(--ecosee-min-size, 220px), 100%, var(--ecosee-max-size, 460px));
      aspect-ratio: var(--ecosee-aspect, 1 / 1);
      margin: 0 auto;
      padding: 7cqw 8cqw;
      display: flex;
      flex-direction: column;
      color: var(--ecosee-fg, #d4eff9);
      font-family: var(--ecosee-font, system-ui, sans-serif);
      user-select: none;
    }

    /* The superellipse surface + equipment edge glow, drawn behind the content.
       preserveAspectRatio="none" stretches the 0–100 viewBox to the container, so
       the curve and the (user-unit) stroke widths scale with the card. */
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
    /* Equipment-status edge glow, keyed to hvac_action: a crisp bright line tracing
       the squircle edge with a gentle inward falloff (blue cooling / amber heating,
       nothing idle). Three concentric strokes of the same curve — wide+faint,
       medium, then crisp — clipped to the squircle so the bloom falls only inward,
       matching the device's clean outline. The color derives from the accent
       tokens, so a token override recolors the glow. */
    .shape .glow {
      display: none;
    }
    .shape .glow path {
      fill: none;
      stroke: currentColor;
    }
    .screen.cooling .glow {
      display: block;
      color: var(--ecosee-cool, #49b6ea);
    }
    .screen.heating .glow {
      display: block;
      color: var(--ecosee-heat, #f3a13c);
    }

    .sr-only {
      position: absolute;
      width: 1px;
      height: 1px;
      overflow: hidden;
      clip: rect(0 0 0 0);
      white-space: nowrap;
    }

    button {
      appearance: none;
      background: none;
      border: none;
      margin: 0;
      padding: 0;
      color: inherit;
      font: inherit;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      justify-content: center;
    }

    /* Top row: weather (left), System Mode (center), menu (right). Explicit
       columns keep each anchored even when weather is absent. */
    .top {
      position: relative;
      z-index: 1;
      width: 100%;
      display: grid;
      grid-template-columns: 1fr auto 1fr;
      align-items: center;
    }
    /* The weather affordance is cyan on the Home Screen, like every other top-row
       glyph (the device reserves green for the Weather Overlay's condition art). */
    .weather {
      grid-column: 1;
      justify-self: start;
      width: 9.5cqw;
      height: 9.5cqw;
      color: var(--ecosee-accent, #62cfe9);
    }
    /* System Mode indicator (tap → System Mode picker); always cyan, like the
       device — the heat/cool color language is reserved for setpoints/equipment. */
    .mode {
      grid-column: 2;
      justify-self: center;
      color: var(--ecosee-accent, #62cfe9);
    }
    .mode .glyph {
      width: 10cqw;
      height: 10cqw;
    }
    .mode-off {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border: 0.5cqw solid currentColor;
      border-radius: 999px;
      padding: 1cqw 2.6cqw;
      font-size: 5cqw;
      font-weight: 600;
      letter-spacing: 0.08em;
    }
    .menu {
      grid-column: 3;
      justify-self: end;
      width: 9.5cqw;
      height: 9.5cqw;
      color: var(--ecosee-accent, #62cfe9);
    }

    /* Centered cluster: humidity above the dominant number, setpoint pill below. */
    .body {
      position: relative;
      z-index: 1;
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 3cqw;
    }

    .hum {
      display: inline-flex;
      align-items: center;
      gap: 1.6cqw;
      font-size: 7cqw;
      font-weight: 300;
      letter-spacing: 0.02em;
      color: var(--ecosee-accent, #62cfe9);
    }
    .hum .glyph {
      width: 6cqw;
      height: 6cqw;
    }

    /* The dominant number: thin cyan glyphs with the device's faint top-bright
       sheen. Proportional lining figures match the device's narrow 1 / 7. The
       gradient is layered as progressive enhancement over a solid cyan fallback. */
    .temp {
      font-size: 42cqw;
      font-weight: 200;
      line-height: 0.84;
      letter-spacing: -0.05em;
      font-variant-numeric: lining-nums proportional-nums;
      color: var(--ecosee-accent, #62cfe9);
      cursor: pointer;
    }
    @supports (background-clip: text) or (-webkit-background-clip: text) {
      .temp {
        background: var(--ecosee-temp-grad, linear-gradient(180deg, #cdeffb 0%, #62cfe9 72%));
        background-clip: text;
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
      }
    }

    /* Horizontal setpoint pill: heat – cool (the device's "until 5:28pm" expiry is
       omitted — HA can't express it, ADR-0003). */
    .pill {
      display: inline-flex;
      align-items: center;
      gap: 2.5cqw;
      padding: 2.4cqw 4cqw;
      border: 0.6cqw solid var(--ecosee-accent, #62cfe9);
      border-radius: 999px;
      font-size: 8cqw;
      font-weight: 500;
      line-height: 1;
    }
    /* The device weights the setpoint numerals bold and the separator light. */
    .pill .heat {
      color: var(--ecosee-heat, #f3a13c);
      font-weight: 600;
    }
    .pill .cool {
      color: var(--ecosee-cool, #49b6ea);
      font-weight: 600;
    }
    .pill .dash {
      color: var(--ecosee-muted, #6f96a3);
      font-weight: 400;
    }
    /* A single-setpoint pill is tinted to its mode; the dual (Auto) pill stays
       cyan, matching the device. */
    .pill.heat {
      border-color: var(--ecosee-heat, #f3a13c);
    }
    .pill.cool {
      border-color: var(--ecosee-cool, #49b6ea);
    }

    .unavailable {
      font-size: 8cqw;
      font-weight: 300;
      color: var(--ecosee-muted, #6f96a3);
    }

    /* Optional air-quality element (issue #10): a subtle badge at the foot of the
       cluster — a wind glyph + the AQI number on top, the category beneath. The CSS
       color carries the severity band (the glyph and number inherit it; the badge
       tints from it), so the band reads at a glance the way the device colors air
       quality. The category sits on its own centered line and the badge is capped at
       the container width, so the long "Unhealthy for Sensitive Groups" label wraps
       instead of overflowing the squircle at any size. */
    .aqi {
      display: inline-flex;
      flex-direction: column;
      align-items: center;
      gap: 0.6cqw;
      max-width: 100%;
      box-sizing: border-box;
      padding: 1.6cqw 3.6cqw;
      border-radius: 6cqw;
      line-height: 1.1;
      color: var(--ecosee-aqi-good, #5bbf6a);
      background: color-mix(in srgb, currentColor 14%, transparent);
    }
    /* The glyph + number read together as the dominant reading. */
    .aqi .reading {
      display: inline-flex;
      align-items: center;
      gap: 1.8cqw;
      font-size: 6cqw;
      font-weight: 700;
    }
    .aqi .glyph {
      width: 6cqw;
      height: 6cqw;
    }
    /* The category stays a muted neutral so the colored number carries the band;
       smaller and centered. Capped at a fraction of the container so the long
       "Unhealthy for Sensitive Groups" label wraps between words onto a few centered
       lines instead of overflowing the squircle — at any card size, since the cap is
       proportional (cqw). */
    .aqi .cat {
      max-width: 66cqw;
      font-size: 4.4cqw;
      font-weight: 500;
      letter-spacing: 0.02em;
      text-align: center;
      text-wrap: balance;
      color: var(--ecosee-muted, #6f96a3);
    }
    .aqi.moderate {
      color: var(--ecosee-aqi-moderate, #e6c84d);
    }
    .aqi.sensitive {
      color: var(--ecosee-aqi-sensitive, #ef9a4d);
    }
    .aqi.unhealthy {
      color: var(--ecosee-aqi-unhealthy, #e5604d);
    }
    .aqi.very-unhealthy {
      color: var(--ecosee-aqi-very-unhealthy, #b06fce);
    }
    .aqi.hazardous {
      color: var(--ecosee-aqi-hazardous, #9c5a6a);
    }

    /* Adapt when the container is narrow: ease the number down. */
    @container (max-width: 300px) {
      .temp {
        font-size: 38cqw;
      }
    }
  `;

  private _emit(action: HomeAction): void {
    this.dispatchEvent(
      new CustomEvent<{ action: HomeAction }>('ecosee-action', {
        detail: { action },
        bubbles: true,
        composed: true,
      }),
    );
  }

  override render(): TemplateResult | typeof nothing {
    const view = this.view;
    if (!view) return nothing;

    return html`
      <div class="screen ${view.equipment ?? ''}" part="screen">
        ${this._renderShape()}
        ${
          view.equipment
            ? html`<span class="sr-only">${this._equipLabel(view.equipment)}</span>`
            : nothing
        }
        ${this._renderTop(view)}
        <div class="body">
          ${
            view.available
              ? html`
                  ${
                    view.humidity !== null
                      ? html`<div class="hum">
                          <span class="glyph">${icons.humidity}</span>${Math.round(view.humidity)}%
                        </div>`
                      : nothing
                  }
                  <button
                    class="temp"
                    aria-label="Adjust temperature"
                    @click=${() => this._emit('temperature')}
                  >
                    ${formatTemp(view.currentTemp, view.unit)}
                  </button>
                  ${this._renderPill(view)}
                `
              : html`<div class="unavailable">${view.name} unavailable</div>`
          }
          ${
            // The air-quality element is backed by its own entity, independent of
            // the bound climate entity — so it sits at the foot of the cluster below
            // either the live readout or the unavailable shell (issue #10).
            this._renderAirQuality(view.airQuality)
          }
        </div>
      </div>
    `;
  }

  /** The superellipse surface + equipment edge glow, drawn behind the content.
   *  One path (SQUIRCLE_PATH) fills the screen, clips the glow, and is stroked
   *  three times for the crisp-edge-plus-inward-falloff glow. The `.glow` group is
   *  hidden until the equipment class on `.screen` reveals/colors it. */
  private _renderShape(): TemplateResult {
    return html`
      <svg class="shape" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <clipPath id="ecosee-squircle">
            <path d=${SQUIRCLE_PATH} />
          </clipPath>
        </defs>
        <path class="fill" d=${SQUIRCLE_PATH} />
        <g class="glow" clip-path="url(#ecosee-squircle)">
          <path d=${SQUIRCLE_PATH} stroke-width="5.5" opacity="0.18" />
          <path d=${SQUIRCLE_PATH} stroke-width="2.2" opacity="0.5" />
          <path d=${SQUIRCLE_PATH} stroke-width="0.9" opacity="1" />
        </g>
      </svg>
    `;
  }

  private _renderTop(view: HomeView): TemplateResult {
    return html`
      <div class="top">
        ${
          view.weatherAvailable
            ? html`<button
                class="weather"
                aria-label="Weather"
                @click=${() => this._emit('weather')}
              >
                ${weatherIcon(view.weatherCondition ?? '')}
              </button>`
            : nothing
        }
        ${this._renderMode(view)}
        <button class="menu" aria-label="Open menu" @click=${() => this._emit('menu')}>
          ${icons.menu}
        </button>
      </div>
    `;
  }

  private _renderMode(view: HomeView): TemplateResult | typeof nothing {
    const mode = view.mode;
    if (mode === 'unknown') return nothing;
    const content =
      mode === 'off'
        ? html`<span class="mode-off">OFF</span>`
        : html`<span class="glyph">${this._modeGlyph(mode)}</span>`;
    return html`<button
      class="mode"
      aria-label=${this._modeLabel(mode)}
      @click=${() => this._emit('system-mode')}
    >
      ${content}
    </button>`;
  }

  private _renderPill(view: HomeView): TemplateResult | typeof nothing {
    const setpoints = view.setpoints;
    if (!setpoints || (setpoints.heat === null && setpoints.cool === null)) return nothing;
    // Single-setpoint pills are tinted to their mode; dual (Auto) stays cyan.
    const tint =
      setpoints.heat !== null && setpoints.cool !== null
        ? ''
        : setpoints.heat !== null
          ? 'heat'
          : 'cool';
    return html`
      <div class="pill ${tint}" part="setpoints">
        ${
          setpoints.heat !== null
            ? html`<span class="heat">${formatTemp(setpoints.heat, view.unit)}</span>`
            : nothing
        }
        ${
          setpoints.heat !== null && setpoints.cool !== null
            ? html`<span class="dash">–</span>`
            : nothing
        }
        ${
          setpoints.cool !== null
            ? html`<span class="cool">${formatTemp(setpoints.cool, view.unit)}</span>`
            : nothing
        }
      </div>
    `;
  }

  /** The optional air-quality element (issue #10). Rendered only when the seam
   *  supplies a model — absent/unavailable data leaves `airQuality` null, so the
   *  element simply isn't shown (ADR-0001 graceful degradation). The `sr-only`
   *  prefix gives the bare number + category screen-reader context. */
  private _renderAirQuality(airQuality: AirQualityView | null): TemplateResult | typeof nothing {
    if (!airQuality) return nothing;
    return html`
      <div class="aqi ${airQuality.level}" part="air-quality">
        <span class="sr-only">Air quality</span>
        <span class="reading">
          <span class="glyph">${icons.wind}</span>
          <span class="num">${airQuality.aqi}</span>
        </span>
        <span class="cat">${airQuality.category}</span>
      </div>
    `;
  }

  private _modeGlyph(mode: SystemMode): TemplateResult {
    if (mode === 'cool') return icons.snowflake;
    if (mode === 'heat') return icons.heat;
    if (mode === 'dry') return icons.drop;
    if (mode === 'fan_only') return icons.fan;
    return icons.auto; // heat_cool
  }

  private _modeLabel(mode: SystemMode): string {
    switch (mode) {
      case 'heat':
        return 'System Mode: Heat';
      case 'cool':
        return 'System Mode: Cool';
      case 'heat_cool':
        return 'System Mode: Heat / Cool (Auto)';
      case 'dry':
        return 'System Mode: Dry';
      case 'fan_only':
        return 'System Mode: Fan only';
      case 'off':
        return 'System Mode: Off';
      default:
        return 'System Mode';
    }
  }

  private _equipLabel(equipment: EquipmentStatus): string {
    if (equipment === 'cooling') return 'Cooling';
    if (equipment === 'heating') return 'Heating';
    return 'Idle';
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'ecosee-home-screen': EcoseeHomeScreen;
  }
}
