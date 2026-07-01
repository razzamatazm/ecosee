import { LitElement, html, css, nothing, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { styleMap } from 'lit/directives/style-map.js';
import { formatTemp } from '../climate/home-view';
import { conditionColor, icons, weatherIcon } from '../icons';
import type { WeatherDay, WeatherModel, WeatherPeriod } from '../weather/weather';

/**
 * `<ecosee-weather-overlay>` — the Weather Overlay's content (slotted into
 * <ecosee-overlay>). Laid out as the device is across two pages (see
 * docs/reference/weather-current.jpeg / weather-forecast.jpeg):
 *
 *   page 1 — current: the condition text + "as of" line, a large condition glyph
 *            beside the current outdoor temp, the chance-of-precip / Hum. line, and
 *            the next intra-day periods (Evening / Overnight / Morning);
 *   page 2 — a 4-day forecast: per day a glyph, the high, a labeled "Lo [low]", and
 *            an umbrella ☂ + chance-of-precip %.
 *
 * Both pages carry the "N of 2" pager and the "Data provided by …" footer. The
 * condition glyphs take a natural per-condition color (`conditionColor`, issue #31 —
 * yellow sun, grey cloud, blue rain); everything else is cyan on black. The
 * chance-of-precip is shown as an umbrella glyph + % rather than the "PoP" jargon
 * (issue #32). Unlike the editing overlays, Weather is read-only: it derives no service
 * call and emits no domain event — the only interaction is paging, which is local
 * view state (the overlay shell still owns dismissal via ✕ / outside-tap).
 *
 * Purely presentational: it renders the already-degraded WeatherModel the host
 * card derived. When the entity offers no forecast the model's `forecast` is empty
 * and `current.periods` is empty, so page 2 and the periods row simply drop and
 * the pager collapses to a single page (ADR-0001 graceful degradation).
 */
@customElement('ecosee-weather-overlay')
export class EcoseeWeatherOverlay extends LitElement {
  /** The already-degraded current + forecast view, derived by the host card. */
  @property({ attribute: false }) model?: WeatherModel;
  /** Which page is showing (0 = current, 1 = forecast). Local view state. */
  @state() private _page = 0;

  static override styles = css`
    :host {
      display: block;
      width: 100%;
      height: 100%;
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

    /* Inline-size container so everything scales with cqw off the definite width,
       with the root's own padding/gap in the fixed unit (calc · --ecosee-u) so they can't couple to the viewport, the real bug — a container-type element resolves its OWN cqw against the viewport (issue #35). Title up top (clearing the shell's ✕),
       the active page filling the middle, the pager + provider at the foot —
       matching the device's vertical rhythm. */
    .weather {
      container-type: inline-size;
      box-sizing: border-box;
      width: var(--ecosee-base-size, 460px);
      height: var(--ecosee-base-size, 460px);
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
      padding: calc(12 * var(--ecosee-u, 4.6px)) calc(7 * var(--ecosee-u, 4.6px))
        calc(7 * var(--ecosee-u, 4.6px));
    }

    .title {
      margin: 0;
      font-size: 8cqw;
      font-weight: 600;
      letter-spacing: 0.01em;
      color: var(--ecosee-accent, #62cfe9);
    }
    .subtitle {
      margin-top: 1.4cqw;
      font-size: 4.6cqw;
      font-weight: 400;
      color: var(--ecosee-muted, #6f96a3);
    }

    /* The active page occupies the space between title and footer. */
    .page {
      flex: 1;
      width: 100%;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 4cqw;
    }

    /* page 1 — current conditions */
    .current-main {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 2cqw;
    }
    .current-main .glyph {
      width: 22cqw;
      height: 22cqw;
    }
    .current-temp {
      font-size: 30cqw;
      font-weight: 200;
      line-height: 0.85;
      letter-spacing: -0.03em;
      color: var(--ecosee-accent, #62cfe9);
    }
    .stats {
      display: inline-flex;
      gap: 8cqw;
      font-size: 6cqw;
      font-weight: 400;
      color: var(--ecosee-accent, #62cfe9);
    }
    .stat {
      display: inline-flex;
      align-items: center;
      gap: 1.6cqw;
    }
    .stat .glyph {
      width: 5.4cqw;
      height: 5.4cqw;
    }
    .periods {
      display: inline-flex;
      gap: 8cqw;
    }
    .period {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 1cqw;
    }
    .period-top {
      display: inline-flex;
      align-items: center;
      gap: 1.4cqw;
    }
    .period .glyph {
      width: 7.5cqw;
      height: 7.5cqw;
    }
    .period-temp {
      font-size: 7cqw;
      font-weight: 300;
      color: var(--ecosee-accent, #62cfe9);
    }
    .period-label {
      font-size: 4.8cqw;
      color: var(--ecosee-accent, #62cfe9);
    }

    /* page 2 — 4-day forecast */
    .forecast {
      width: 100%;
      display: grid;
      grid-auto-flow: column;
      grid-auto-columns: 1fr;
      gap: 2cqw;
    }
    .day {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 1.6cqw;
    }
    .day-name {
      font-size: 6cqw;
      font-weight: 500;
      color: var(--ecosee-accent, #62cfe9);
    }
    .day .glyph {
      width: 11cqw;
      height: 11cqw;
    }
    .day-high {
      font-size: 13cqw;
      font-weight: 300;
      line-height: 1;
      color: var(--ecosee-accent, #62cfe9);
    }
    /* The low sits muted beneath the (accent) high so the pair reads as high/low at
       a glance — the "Lo" label plus the demoted color keep it from being mistaken
       for a section heading the way the old "Night NN" did (issue #33). */
    .day-low {
      font-size: 4.6cqw;
      font-weight: 400;
      color: var(--ecosee-muted, #6f96a3);
    }
    /* Chance-of-precip as an umbrella glyph + %, no "PoP" jargon (issue #32).
       nowrap keeps the glyph + "100%" on one line in the narrow day column. */
    .day-pop {
      display: inline-flex;
      align-items: center;
      gap: 1.2cqw;
      white-space: nowrap;
      font-size: 4.6cqw;
      font-weight: 400;
      color: var(--ecosee-accent, #62cfe9);
    }
    .day-pop .glyph {
      width: 4.4cqw;
      height: 4.4cqw;
    }

    /* footer — pager + provider credit */
    .footer {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 1.8cqw;
    }
    .pager {
      display: inline-flex;
      align-items: center;
      gap: 4cqw;
      font-size: 5.4cqw;
      font-weight: 500;
      color: var(--ecosee-accent, #62cfe9);
    }
    /* Only the pager is interactive; the rest of the (read-only) content stays
       pointer-transparent so an outside tap falls through to the shell's backdrop. */
    .pager button {
      pointer-events: auto;
      width: 7cqw;
      height: 7cqw;
      color: var(--ecosee-accent, #62cfe9);
    }
    .pager button:focus-visible {
      outline: 0.5cqw solid var(--ecosee-accent, #62cfe9);
      outline-offset: 0.5cqw;
      border-radius: 2cqw;
    }
    .pager .chev {
      width: 5cqw;
      height: 5cqw;
    }
    .pager .chev.prev {
      transform: scaleX(-1);
    }
    .provider {
      font-size: 4cqw;
      color: var(--ecosee-muted, #6f96a3);
    }
  `;

  /** Page by a delta, wrapping (both pager arrows stay live, as on the device). */
  private _pageBy = (delta: 1 | -1): void => {
    this._page = (this._page + delta + 2) % 2;
  };

  override render(): TemplateResult | typeof nothing {
    const model = this.model;
    if (!model || !model.available) return nothing;
    const hasForecast = model.forecast.length > 0;
    // Clamp to page 1 when there is no forecast to show.
    const page = hasForecast ? this._page : 0;

    return html`
      <div class="weather" role="group" aria-label="Weather">
        <h2 class="title">${page === 0 ? this._currentTitle(model) : '4 Day Forecast'}</h2>
        ${
          page === 0 && model.current.asOf
            ? html`<div class="subtitle">${this._formatAsOf(model.current.asOf)}</div>`
            : nothing
        }
        <div class="page">
          ${page === 0 ? this._renderCurrent(model) : this._renderForecast(model)}
        </div>
        ${this._renderFooter(model, page, hasForecast)}
      </div>
    `;
  }

  private _currentTitle(model: WeatherModel): string {
    return model.current.conditionLabel || 'Weather';
  }

  private _renderCurrent(model: WeatherModel): TemplateResult {
    const c = model.current;
    return html`
      <div class="current-main">
        <span class="glyph" style=${styleMap({ color: conditionColor(c.condition) })}
          >${weatherIcon(c.condition)}</span
        >
        <span class="current-temp">${formatTemp(c.temp, model.unit)}</span>
      </div>
      ${
        c.pop !== null || c.humidity !== null
          ? html`<div class="stats">
              ${
                c.pop !== null
                  ? html`<span class="stat"
                      ><span class="glyph">${icons.umbrella}</span>${Math.round(c.pop)}%</span
                    >`
                  : nothing
              }
              ${
                c.humidity !== null
                  ? html`<span class="stat"
                      ><span class="glyph">${icons.humidity}</span>Hum.
                      ${Math.round(c.humidity)}%</span
                    >`
                  : nothing
              }
            </div>`
          : nothing
      }
      ${
        c.periods.length > 0
          ? html`<div class="periods">
              ${c.periods.map((p) => this._renderPeriod(p, model.unit))}
            </div>`
          : nothing
      }
    `;
  }

  private _renderPeriod(period: WeatherPeriod, unit: string): TemplateResult {
    return html`
      <div class="period">
        <span class="period-top">
          <span class="glyph" style=${styleMap({ color: conditionColor(period.condition) })}
            >${weatherIcon(period.condition)}</span
          >
          <span class="period-temp">${formatTemp(period.temp, unit)}</span>
        </span>
        <span class="period-label">${period.label}</span>
      </div>
    `;
  }

  private _renderForecast(model: WeatherModel): TemplateResult {
    return html`
      <div class="forecast">${model.forecast.map((day) => this._renderDay(day, model.unit))}</div>
    `;
  }

  private _renderDay(day: WeatherDay, unit: string): TemplateResult {
    return html`
      <div class="day">
        <span class="day-name">${this._formatDay(day.datetime)}</span>
        <span class="glyph" style=${styleMap({ color: conditionColor(day.condition) })}
          >${weatherIcon(day.condition)}</span
        >
        <span class="day-high">${formatTemp(day.high, unit)}</span>
        <span class="day-low">Lo ${formatTemp(day.low, unit)}</span>
        <span class="day-pop"
          ><span class="glyph">${icons.umbrella}</span>${
            day.pop !== null ? `${Math.round(day.pop)}%` : '–'
          }</span
        >
      </div>
    `;
  }

  private _renderFooter(
    model: WeatherModel,
    page: number,
    hasForecast: boolean,
  ): TemplateResult | typeof nothing {
    const provider = model.attribution;
    if (!hasForecast && !provider) return nothing;
    return html`
      <div class="footer">
        ${
          hasForecast
            ? html`<div class="pager">
                <button aria-label="Previous page" @click=${() => this._pageBy(-1)}>
                  <span class="chev prev">${icons.chevron}</span>
                </button>
                <span>${page + 1} of 2</span>
                <button aria-label="Next page" @click=${() => this._pageBy(1)}>
                  <span class="chev">${icons.chevron}</span>
                </button>
              </div>`
            : nothing
        }
        ${provider ? html`<div class="provider">${this._providerFooter(provider)}</div>` : nothing}
      </div>
    `;
  }

  /** "Data provided by …" — but render a credit that already says so verbatim, so
   *  a full attribution sentence isn't double-prefixed. */
  private _providerFooter(attribution: string): string {
    return /provided by/i.test(attribution) ? attribution : `Data provided by ${attribution}`;
  }

  /** "Jun 29 as of 5:00 pm" from the entity's raw timestamp (locale-formatted). */
  private _formatAsOf(iso: string): string | typeof nothing {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return nothing;
    const day = date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    const time = date
      .toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
      .toLowerCase();
    return `${day} as of ${time}`;
  }

  /** Short weekday for a forecast day's raw timestamp (e.g. "Tue"). */
  private _formatDay(iso: string): string {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleDateString(undefined, { weekday: 'short' });
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'ecosee-weather-overlay': EcoseeWeatherOverlay;
  }
}
