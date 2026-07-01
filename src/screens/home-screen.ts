import { LitElement, html, css, nothing, type TemplateResult } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import type {
  AirQualityView,
  EquipmentStatus,
  HomeView,
  SystemMode,
  UvIndexView,
} from '../climate/home-view';
import { formatTemp } from '../climate/home-view';
import { systemModeGlyph } from '../climate/system-mode';
import { icons, weatherIcon } from '../icons';
import { renderShape, shapeStyles } from '../styles/shape';

/** Actions the Home Screen surfaces to the host card. `temperature` opens the
 *  Temperature Adjust overlay; `system-mode` / `weather` / `fan` / `menu` open later
 *  Overlays. `fan` is the top-row shortcut into the Fan sub-screen (issue #45). */
export type HomeAction = 'menu' | 'temperature' | 'weather' | 'system-mode' | 'fan';

/** Which setpoint a tap should foreground. Carried on a `temperature` action when
 *  it fires from a specific setpoint oval, so the overlay opens editing that one. */
export type SetpointTarget = 'heat' | 'cool';

/** The `ecosee-action` event detail. `setpoint` is present only on a `temperature`
 *  action fired from a setpoint oval (absent when the current-temperature number is
 *  tapped — the overlay then picks its own default setpoint). */
export interface HomeActionDetail {
  action: HomeAction;
  setpoint?: SetpointTarget;
}

/**
 * The default Card view, laid out as the device is (see
 * docs/reference/home-*.jpeg): a top row of affordance glyphs (weather left,
 * System Mode center, menu right), the humidity line and the large current
 * temperature centered beneath, the setpoint ovals below the number, and the
 * optional air-quality element (issue #10) at the foot of the cluster. Active
 * equipment is shown as a colored edge glow around the squircle (blue cooling /
 * amber heating), keyed to `hvac_action` — not an icon. Purely presentational: it
 * renders whatever the already-degraded HomeView says and emits `ecosee-action`
 * events for the host card to handle.
 */
@customElement('ecosee-home-screen')
export class EcoseeHomeScreen extends LitElement {
  @property({ attribute: false }) view?: HomeView;

  static override styles = [
    // The shared superellipse surface (issue #76): positions the `.shape` SVG and
    // paints the canvas fill through the squircle path. Every surface consumes this
    // so the Card's silhouette never changes between screens. The Home Screen adds
    // the equipment edge glow on top via `renderShape({ glow: true })` and the glow
    // CSS below.
    shapeStyles,
    css`
    :host {
      display: block;
    }

    /* Fixed layout canvas: the device is laid out ONCE at --ecosee-base-size and
       <ecosee-card> scales the whole Card to fit its slot (issue #35 / #36), so the
       layout never reflows per-width and renders identically at every size and in
       every browser. This is an inline-size query container, so the children below
       scale with cqw off this box's definite CONTENT width (its authored
       proportions). The container's OWN padding, though, is the fixed unit
       calc(N * --ecosee-u) — NOT cqw: an element resolves its own container-query
       units against the *viewport* (nothing above it is a container), so a cqw
       padding here ballooned on wide windows and collapsed the content (the real
       issue #35 bug, in every browser). overflow: hidden keeps the box square; the
       squircle surface is drawn by the inline SVG (.shape) below — no background or
       border-radius here, so the superellipse, its glow and any clip trace one curve. */
    .screen {
      container-type: inline-size;
      position: relative;
      box-sizing: border-box;
      width: var(--ecosee-base-size, 460px);
      height: var(--ecosee-base-size, 460px);
      overflow: hidden;
      padding: calc(7 * var(--ecosee-u, 4.6px)) calc(8 * var(--ecosee-u, 4.6px));
      display: flex;
      flex-direction: column;
      color: var(--ecosee-fg, #d4eff9);
      font-family: var(--ecosee-font, system-ui, sans-serif);
      user-select: none;
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

    /* Render inline glyphs as block replaced elements. An inline SVG carries a
       baseline strut (phantom descender leading) that Firefox reserves but Blink
       effectively swallows — that divergence is what cramped the glyph-over-numeral
       chips and misaligned stacked glyphs in Firefox/Zen (issue #74). Block layout
       removes the strut in every engine; the SVG still fills its sized .glyph box
       (width/height 100%). See docs/adr/0005-cross-browser-typography.md. */
    .glyph svg {
      display: block;
      width: 100%;
      height: 100%;
    }

    /* Top row: the affordance glyphs spread EVENLY across the full width — weather
       (left corner), the optional fan shortcut, System Mode, menu (right corner) —
       rather than bunching a left cluster (issue #77). space-between distributes them
       with equal gaps, so the row reads the same whether it holds 3 or 4 glyphs, and
       the middle glyph(s) carry the .raised class to lift them off the baseline. A
       persistent left anchor (rendered when neither weather nor fan is present) holds
       the left corner so the mode stays centered and the arrangement stays stable as
       the fan affordance appears/disappears. Its own inset (on top of .screen's
       padding) drops the row below the squircle's top curve and pulls the corner
       glyphs in off the rounded corners, matching the device (home-*.jpeg) — the
       superellipse cuts in sharply near the top, so without this the corner glyphs sit
       too high and too close to the edge; the horizontal inset also keeps the end
       glyphs off the border (issue #54). */
    .top {
      position: relative;
      z-index: 1;
      box-sizing: border-box;
      width: 100%;
      padding: 3cqw 6cqw 0;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    /* The left shortcut cluster: weather and/or the fan shortcut, each gated on its
       own data (issue #45). display: contents flattens it so weather/fan/anchor sit
       directly in the row's flex flow and take part in the even spread — the cluster
       is a grouping seam only, with no box of its own. */
    .top-left {
      display: contents;
    }
    /* Zero-width left-corner anchor, rendered only when neither weather nor fan is
       present. It occupies the leftmost flex slot so space-between keeps the System
       Mode indicator dead center instead of collapsing it to the left edge. */
    .top-anchor {
      width: 0;
    }
    /* The middle glyph(s) sit higher than the corner glyphs, following the
       superellipse's top edge, which curves down toward the corners — the fan
       shortcut and System Mode indicator in the four-glyph case, the lone centered
       System Mode indicator in the three-glyph case (issue #77). A slight, even lift;
       the corner glyphs (weather, menu) stay on the baseline. */
    .raised {
      transform: translateY(-3cqw);
    }
    /* The weather and fan affordances are white on the Home Screen, like every other
       top-row glyph (the weather condition's natural color is reserved for the Weather
       Overlay's glyphs; the device colors this control row white — issue #37). */
    .weather,
    .fan {
      width: 9.5cqw;
      height: 9.5cqw;
      color: var(--ecosee-top-row, #ffffff);
    }
    /* System Mode indicator (tap → System Mode picker); white like the rest of the
       top row — the heat/cool color language is reserved for setpoints/equipment,
       so the indicator does not carry mode-specific color (issue #37). */
    .mode {
      color: var(--ecosee-top-row, #ffffff);
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
      width: 9.5cqw;
      height: 9.5cqw;
      color: var(--ecosee-top-row, #ffffff);
    }

    /* Centered cluster: humidity above the dominant number, setpoint ovals below.
       The bottom inset shifts the centering axis up so the whole cluster sits in the
       upper-middle of the screen, matching the Home Screen reference photos (the
       humidity line, big number, and oval(s) all sit noticeably above true center in
       the Heat/Cool hold and System Off shots — issue #55) rather than floating at
       dead center. */
    .body {
      position: relative;
      z-index: 1;
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 3cqw;
      padding-bottom: 18cqw;
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
       gradient is layered as progressive enhancement over a solid cyan fallback.
       display: inline-block (NOT the base button's inline-flex): Firefox does not
       reliably clip a gradient background to text inside a flex/inline-flex
       container, which rendered the number mangled in Firefox/Zen — an oversized
       slanted "7" split from the "4" (issue #74). Block-level text layout clips
       the gradient identically in every engine. Do NOT restore flex here.
       See docs/adr/0005-cross-browser-typography.md. */
    .temp {
      display: inline-block;
      text-align: center;
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

    /* Setpoint ovals: one per active setpoint, matching the device — an amber
       Heat oval (♨ + temp) and a blue Cool oval (❄ + temp). Heat / Cool (Auto)
       shows both side by side (heat left, cool right); a single-setpoint mode
       shows just its own, centered by the row. Each oval is a tap target that
       opens Temperature Adjust for that setpoint. No Hold pill / Resume ✕
       (ADR-0004). */
    .setpoints {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 3cqw;
    }
    /* A stadium-shaped pill tinted to its mode: colored glyph + numeral over a
       faint same-color wash with a matching outline (the .aqi badge idiom), so
       the amber/blue reads as a colored oval without a heavy fill fighting the
       near-black canvas. */
    .oval {
      display: inline-flex;
      align-items: center;
      gap: 1.8cqw;
      padding: 1.8cqw 4.4cqw;
      border: 0.6cqw solid currentColor;
      border-radius: 999px;
      background: color-mix(in srgb, currentColor 14%, transparent);
      font-size: 8cqw;
      font-weight: 600;
      line-height: 1;
      cursor: pointer;
    }
    .oval .glyph {
      width: 6.5cqw;
      height: 6.5cqw;
    }
    .oval.heat {
      color: var(--ecosee-heat, #f3a13c);
    }
    .oval.cool {
      color: var(--ecosee-cool, #49b6ea);
    }

    .unavailable {
      font-size: 8cqw;
      font-weight: 300;
      color: var(--ecosee-muted, #6f96a3);
    }

    /* Foot cluster (issue #75): the air-quality element and UV-index gauge share one
       count-aware row. flex row + justify-content: center lays the pair side by side
       when both are present — so the taller UV gauge no longer stacks below the AQI
       badge and clips against the bottom squircle curve — and centers a single
       indicator when only one is (the setpoint-oval single-vs-both idiom). Their
       differing heights are centered on the cross axis. Gap in cqw like the rest of
       .body (issue #35). */
    .foot {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 5cqw;
    }

    /* Optional air-quality element (issue #10): a subtle badge at the foot of the
       cluster — a wind glyph + the AQI number (issue #66 dropped the visible category
       word). The CSS color carries the severity band (the glyph and number inherit it;
       the badge tints from it), so the band reads at a glance the way the device colors
       air quality. */
    .aqi {
      display: inline-flex;
      align-items: center;
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

    /* Optional UV-index gauge: an arc meter at the foot of the cluster, mirroring the
       air-quality element's placement. The full green→violet gradient arc fills to the
       reading's fraction of the WHO scale (via stroke-dashoffset); the rounded index
       sits in the arc's mouth and, with the category word, takes the reading's band
       color (the "UVI" label stays muted). Hidden entirely when no uv_index_entity is
       configured. Sized in cqw like the rest of .body. */
    .uvi {
      display: inline-flex;
      flex-direction: column;
      align-items: center;
      gap: 0.4cqw;
      line-height: 1.1;
      color: var(--ecosee-uv-none, #5a6068);
    }
    .uvi .gauge {
      position: relative;
      width: 26cqw;
      /* 26 * 0.64 — the arc's 100×64 viewBox aspect, so the SVG scales uniformly. */
      height: 16.6cqw;
    }
    .uvi .gauge svg {
      display: block;
      width: 100%;
      height: 100%;
      overflow: visible;
    }
    .uvi .track {
      fill: none;
      stroke: #2b3037;
      stroke-width: 9;
      stroke-linecap: round;
    }
    .uvi .arc {
      fill: none;
      stroke: url(#ecosee-uv-gradient);
      stroke-width: 9;
      stroke-linecap: round;
    }
    /* The index sits in the mouth of the arc, tinted by the band (inherits .uvi color). */
    .uvi .num {
      position: absolute;
      left: 0;
      right: 0;
      top: 64%;
      transform: translateY(-50%);
      text-align: center;
      font-size: 6.5cqw;
      font-weight: 700;
      font-variant-numeric: tabular-nums;
    }
    .uvi .label {
      font-size: 3.6cqw;
      font-weight: 600;
      letter-spacing: 0.16em;
      color: var(--ecosee-muted, #6f96a3);
    }
    .uvi .cat {
      font-size: 4.4cqw;
      font-weight: 600;
      letter-spacing: 0.02em;
      text-align: center;
    }
    .uvi.low {
      color: var(--ecosee-uv-low, #35c46b);
    }
    .uvi.moderate {
      color: var(--ecosee-uv-moderate, #ffd400);
    }
    .uvi.high {
      color: var(--ecosee-uv-high, #ff8a1e);
    }
    .uvi.very-high {
      color: var(--ecosee-uv-very-high, #ff3b3b);
    }
    .uvi.extreme {
      color: var(--ecosee-uv-extreme, #b45cff);
    }
  `,
  ];

  private _emit(action: HomeAction, setpoint?: SetpointTarget): void {
    this.dispatchEvent(
      new CustomEvent<HomeActionDetail>('ecosee-action', {
        detail: { action, setpoint },
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
                  ${this._renderSetpoints(view)}
                `
              : html`<div class="unavailable">${view.name} unavailable</div>`
          }
          ${
            // The optional air-quality element and UV-index gauge share one
            // count-aware foot row: side by side when both are present, a single
            // centered indicator when only one is (issue #75). Both are backed by
            // their own entities, independent of the bound climate entity, so the
            // row sits below either the live readout or the unavailable shell.
            this._renderFoot(view)
          }
        </div>
      </div>
    `;
  }

  /** The shared superellipse surface + the Home Screen's equipment edge glow, drawn
   *  behind the content. The shape (SQUIRCLE_PATH) comes from the shared module so
   *  every screen traces the identical curve (issue #76); `glow: true` adds the three
   *  stacked strokes, hidden until the equipment class on `.screen` reveals/colors
   *  them. */
  private _renderShape(): TemplateResult {
    return renderShape({ glow: true });
  }

  private _renderTop(view: HomeView): TemplateResult {
    return html`
      <div class="top">
        <div class="top-left">
          ${
            view.weatherAvailable
              ? html`<button
                  class="weather"
                  aria-label="Weather"
                  @click=${() => this._emit('weather')}
                >
                  ${weatherIcon(view.weatherCondition ?? '')}
                </button>`
              : // A zero-width anchor holds the leftmost slot when there is no weather
                // affordance, so the even spread keeps the System Mode indicator
                // centered instead of collapsing it to the left edge (issue #77). When
                // the fan affordance is present it becomes the visible middle glyph.
                view.fanAvailable
                ? nothing
                : html`<span class="top-anchor" aria-hidden="true"></span>`
          }
          ${
            // Fan affordance — the quick shortcut into fan speed selection, shown only
            // when the entity exposes a real speed control beyond On/Auto (issues #45,
            // #73); On/Auto-only fans stay reachable via Main Menu → Fan. It shares `icons.fan`
            // with the center Fan-Only mode indicator, but the two never conflate: the
            // fixed slots carry the distinction — a corner glyph is always an
            // affordance (tap → its Overlay), the center glyph is always the System
            // Mode indicator (issue #45's note). It is raised as a middle glyph only
            // when weather holds the left corner; a weatherless row makes the fan the
            // left corner, so it stays on the baseline like the other corners (#77).
            view.fanAvailable
              ? html`<button
                  class=${view.weatherAvailable ? 'fan raised' : 'fan'}
                  aria-label="Fan"
                  @click=${() => this._emit('fan')}
                >
                  ${icons.fan}
                </button>`
              : nothing
          }
        </div>
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
        : html`<span class="glyph">${systemModeGlyph(mode)}</span>`;
    return html`<button
      class="mode raised"
      aria-label=${this._modeLabel(mode)}
      @click=${() => this._emit('system-mode')}
    >
      ${content}
    </button>`;
  }

  /** The active setpoint(s) as ecobee-style ovals — the amber Heat oval and/or the
   *  blue Cool oval, matching how the device presents them (heat left, cool right in
   *  Heat / Cool (Auto); a single centered oval in Heat-only / Cool-only). Each oval
   *  is a tap target that opens Temperature Adjust for its own setpoint. */
  private _renderSetpoints(view: HomeView): TemplateResult | typeof nothing {
    const setpoints = view.setpoints;
    if (!setpoints || (setpoints.heat === null && setpoints.cool === null)) return nothing;
    return html`
      <div class="setpoints" part="setpoints">
        ${setpoints.heat !== null ? this._renderOval('heat', setpoints.heat, view.unit) : nothing}
        ${setpoints.cool !== null ? this._renderOval('cool', setpoints.cool, view.unit) : nothing}
      </div>
    `;
  }

  private _renderOval(setpoint: SetpointTarget, value: number, unit: string): TemplateResult {
    const glyph = setpoint === 'heat' ? icons.heat : icons.snowflake;
    const label = setpoint === 'heat' ? 'Adjust heat setpoint' : 'Adjust cool setpoint';
    return html`<button
      class="oval ${setpoint}"
      aria-label=${label}
      @click=${() => this._emit('temperature', setpoint)}
    >
      <span class="glyph">${glyph}</span>${formatTemp(value, unit)}
    </button>`;
  }

  /** The foot cluster: the optional air-quality element and UV-index gauge in a
   *  single count-aware row (issue #75). Each is independently optional and only
   *  rendered when its own sub-model is present (ADR-0001 graceful degradation).
   *  When both are present they lay out side by side, so the taller UV gauge no
   *  longer stacks below the AQI badge and clips against the bottom squircle curve;
   *  when only one is present the row centers it on its own — the same
   *  single-vs-both centering the setpoint ovals use. When neither is present the
   *  row is omitted entirely so it adds no gap to the cluster. */
  private _renderFoot(view: HomeView): TemplateResult | typeof nothing {
    if (!view.airQuality && !view.uvIndex) return nothing;
    return html`
      <div class="foot" part="foot">
        ${this._renderAirQuality(view.airQuality)} ${this._renderUvIndex(view.uvIndex)}
      </div>
    `;
  }

  /** The optional air-quality element (issue #10). Rendered only when the seam
   *  supplies a model — absent/unavailable data leaves `airQuality` null, so the
   *  element simply isn't shown (ADR-0001 graceful degradation). Shows just the glyph
   *  and AQI number (issue #66): the band color already carries the severity, so the
   *  visible category word is dropped — the `sr-only` label still announces the band
   *  ("Air quality: Good") so the reading stays accessible. */
  private _renderAirQuality(airQuality: AirQualityView | null): TemplateResult | typeof nothing {
    if (!airQuality) return nothing;
    return html`
      <div class="aqi ${airQuality.level}" part="air-quality">
        <span class="sr-only">Air quality: ${airQuality.category}</span>
        <span class="reading">
          <span class="glyph">${icons.wind}</span>
          <span class="num">${airQuality.aqi}</span>
        </span>
      </div>
    `;
  }

  /** The optional UV-index gauge. Rendered only when the seam supplies a model —
   *  absent/unavailable data leaves `uvIndex` null, so the gauge isn't shown
   *  (ADR-0001). The arc is a radius-38 semicircle (path length π·38 ≈ 119.4); its
   *  `stroke-dashoffset` fills it from the green end to the reading's fraction of the
   *  scale. The `sr-only` prefix gives the bare index screen-reader context. */
  private _renderUvIndex(uvIndex: UvIndexView | null): TemplateResult | typeof nothing {
    if (!uvIndex) return nothing;
    const arcLength = 119.4;
    const dashOffset = arcLength * (1 - uvIndex.fraction);
    return html`
      <div class="uvi ${uvIndex.level}" part="uv-index">
        <span class="sr-only">UV index</span>
        <div class="gauge">
          <svg viewBox="0 0 100 64" aria-hidden="true">
            <defs>
              <linearGradient id="ecosee-uv-gradient" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stop-color="#35c46b"></stop>
                <stop offset="30%" stop-color="#ffd400"></stop>
                <stop offset="55%" stop-color="#ff8a1e"></stop>
                <stop offset="78%" stop-color="#ff3b3b"></stop>
                <stop offset="100%" stop-color="#b45cff"></stop>
              </linearGradient>
            </defs>
            <path class="track" d="M12,50 A38,38 0 0 1 88,50"></path>
            <path
              class="arc"
              d="M12,50 A38,38 0 0 1 88,50"
              stroke-dasharray=${arcLength}
              stroke-dashoffset=${dashOffset}
            ></path>
          </svg>
          <span class="num">${uvIndex.uvi}</span>
        </div>
        <span class="label">UVI</span>
        <span class="cat">${uvIndex.category}</span>
      </div>
    `;
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
