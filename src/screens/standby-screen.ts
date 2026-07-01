import { LitElement, html, css, nothing, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { formatTemp } from '../climate/home-view';
import { weatherIcon } from '../icons';

/**
 * The already-degraded data the Standby Screen renders. A sibling of `HomeView`
 * (climate/home-view.ts): every field whose backing data is absent is
 * `null`/`false`, so the view renders "present → show, absent → hide" without
 * faking anything (ADR-0001 graceful degradation). The wall clock is deliberately
 * NOT in here — it is the device's own current time, not read off `hass`, so the
 * component owns it (a live, self-updating clock, issue #63). The seam that builds
 * this from `hass` + config, and the switching that shows the Standby Screen, are a
 * separate issue (#62 / #65); this view is purely presentational and importable on
 * its own.
 */
export interface StandbyView {
  /** False when the bound entity is missing / `unavailable` — the big current
   *  number is then hidden (the clock still shows; it is not hass-backed). */
  available: boolean;
  /** `current_temperature` — the dominant number, reused from the Home Screen. */
  currentTemp: number | null;
  unit: string;
  /** The outdoor temperature number. Net-new to the base view (it lived only in the
   *  Weather Overlay before). `null` ⇒ the outdoor row is hidden. */
  outdoorTemp: number | null;
  /** The weather entity's current condition (`sunny` / `clear-night` / …), or
   *  `null` — supplies the glyph beside the outdoor temp; absent ⇒ number only. */
  weatherCondition: string | null;
}

/** Format a `Date` as the device's idle wall clock: a 12-hour time with a leading
 *  hour (no zero pad), zero-padded minutes, and an AM/PM suffix (e.g. "5:39 PM").
 *  Deterministic and locale-independent so the idle clock reads the same everywhere
 *  and is straightforward to test. Uses the runtime's local timezone — for an
 *  on-wall thermostat that is the home's. */
export function formatClock(date: Date): string {
  const hour24 = date.getHours();
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const period = hour24 < 12 ? 'AM' : 'PM';
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
  return `${hour12}:${minutes} ${period}`;
}

/**
 * The Standby Screen — the device's dimmed idle display (issue #63). A minimal,
 * white-on-black layout mirroring the physical unit's idle display: the weather
 * condition glyph + outdoor temperature on top, the large current temperature in
 * the middle, and the live wall clock at the bottom. Purely presentational like the
 * Home Screen: it renders whatever the already-degraded `StandbyView` says (hiding
 * absent data) and adds nothing interactive. The only live element is the clock,
 * which the component ticks itself once a second so it stays current without any
 * host wiring.
 */
@customElement('ecosee-standby-screen')
export class EcoseeStandbyScreen extends LitElement {
  @property({ attribute: false }) view?: StandbyView;

  /** The current wall time, re-read on a 1s interval so the clock is live (not a
   *  static timestamp). Reactive so each update re-renders; Lit skips DOM writes
   *  when the formatted string is unchanged. */
  @state() private _now = new Date();

  private _timer: ReturnType<typeof setInterval> | null = null;

  static override styles = css`
    :host {
      display: block;
    }

    /* Same fixed layout canvas as the Home Screen (issue #35 / #36): the device is
       laid out ONCE at --ecosee-base-size and <ecosee-card> scales the whole Card to
       fit its slot, so nothing reflows per-width. This is an inline-size query
       container so the children scale in cqw; the box's own padding uses the fixed
       --ecosee-u unit (never cqw — an element resolves its own cqw against the
       viewport). The idle display is minimal white-on-black: the near-black canvas with
       the overridable corner radius, everything drawn in white. */
    .screen {
      container-type: inline-size;
      position: relative;
      box-sizing: border-box;
      width: var(--ecosee-base-size, 460px);
      height: var(--ecosee-base-size, 460px);
      overflow: hidden;
      padding: calc(10 * var(--ecosee-u, 4.6px)) calc(8 * var(--ecosee-u, 4.6px));
      display: flex;
      flex-direction: column;
      align-items: center;
      background: var(--ecosee-bg, #0a0d10);
      border-radius: var(--ecosee-radius, 15%);
      color: var(--ecosee-standby-fg, #ffffff);
      font-family: var(--ecosee-font, system-ui, sans-serif);
      user-select: none;
    }

    /* Condition glyph + outdoor temperature, at the top. Hidden entirely when no
       outdoor temp is present; the glyph alone drops out when the condition is
       absent (graceful degradation). */
    .outdoor {
      display: inline-flex;
      align-items: center;
      gap: 2cqw;
      font-size: 9cqw;
      font-weight: 300;
      letter-spacing: 0.02em;
      font-variant-numeric: lining-nums proportional-nums;
    }
    .outdoor .glyph {
      width: 9cqw;
      height: 9cqw;
    }

    /* The dominant current temperature, centered in the remaining space. Reuses the
       Home Screen's number treatment (thin, tight lining figures) but rendered in
       white for the idle display rather than the cyan accent. */
    .current {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 42cqw;
      font-weight: 200;
      line-height: 0.84;
      letter-spacing: -0.05em;
      font-variant-numeric: lining-nums proportional-nums;
    }

    /* The live wall clock, at the bottom. Tabular figures so the digits do not
       shuffle as the minute ticks over. */
    .clock {
      font-size: 11cqw;
      font-weight: 300;
      letter-spacing: 0.04em;
      font-variant-numeric: tabular-nums;
    }
  `;

  override connectedCallback(): void {
    super.connectedCallback();
    // Seed and start the live clock. Ticking every second keeps the minute
    // rollover prompt without the host needing to feed a time in.
    this._now = new Date();
    this._timer = setInterval(() => {
      this._now = new Date();
    }, 1000);
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    if (this._timer !== null) {
      clearInterval(this._timer);
      this._timer = null;
    }
  }

  override render(): TemplateResult {
    const view = this.view;
    return html`
      <div class="screen" part="screen">
        ${this._renderOutdoor(view)}
        <div class="current" part="current">
          ${
            view?.available && view.currentTemp !== null
              ? html`<span aria-label="Current temperature"
                  >${formatTemp(view.currentTemp, view.unit)}</span
                >`
              : nothing
          }
        </div>
        <div class="clock" part="clock" aria-label="Time">${formatClock(this._now)}</div>
      </div>
    `;
  }

  /** The top row: the weather condition glyph beside the outdoor temperature. Hidden
   *  when no outdoor temp is present; the glyph alone is dropped when the condition
   *  is absent (ADR-0001 graceful degradation). */
  private _renderOutdoor(view?: StandbyView): TemplateResult | typeof nothing {
    if (!view || view.outdoorTemp === null) return nothing;
    return html`
      <div class="outdoor" part="outdoor" aria-label="Outdoor temperature">
        ${
          view.weatherCondition
            ? html`<span class="glyph">${weatherIcon(view.weatherCondition)}</span>`
            : nothing
        }
        <span class="outdoor-temp">${formatTemp(view.outdoorTemp, view.unit)}</span>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'ecosee-standby-screen': EcoseeStandbyScreen;
  }
}
