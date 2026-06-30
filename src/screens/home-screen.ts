import { LitElement, html, css, nothing, type TemplateResult } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import type { EquipmentStatus, HomeView, SystemMode } from '../climate/home-view';
import { formatTemp } from '../climate/home-view';
import { icons } from '../icons';

/** Actions the Home Screen surfaces to the host card. `temperature` opens the
 *  Temperature Adjust overlay; `system-mode` / `weather` / `menu` open later
 *  Overlays; `resume` clears the active Hold. */
export type HomeAction = 'menu' | 'temperature' | 'weather' | 'resume' | 'system-mode';

/**
 * The default Card view, laid out as the device is (see
 * docs/reference/home-*.jpeg): a top row of affordance glyphs (weather left,
 * System Mode center, menu right), the humidity line and the large current
 * temperature centered beneath, and the horizontal Hold pill below the number.
 * Active equipment is shown as a colored edge glow around the squircle (blue
 * cooling / amber heating), keyed to `hvac_action` — not an icon. Purely
 * presentational: it renders whatever the already-degraded HomeView says and
 * emits `ecosee-action` events for the host card to handle.
 */
@customElement('ecosee-home-screen')
export class EcoseeHomeScreen extends LitElement {
  @property({ attribute: false }) view?: HomeView;

  static override styles = css`
    :host {
      display: block;
    }

    /* Responsive squircle: a sized container so children can scale with cqw, with
       a legible floor (min-size) and a capped ceiling (max-size). */
    .face {
      container-type: size;
      position: relative;
      box-sizing: border-box;
      width: clamp(var(--ecosee-min-size, 220px), 100%, var(--ecosee-max-size, 460px));
      aspect-ratio: var(--ecosee-aspect, 1 / 1);
      margin: 0 auto;
      padding: 7cqw 8cqw;
      display: flex;
      flex-direction: column;
      background: var(--ecosee-bg, #0a0d10);
      border-radius: var(--ecosee-radius, 15%);
      color: var(--ecosee-fg, #d4eff9);
      font-family: var(--ecosee-font, system-ui, sans-serif);
      overflow: hidden;
      user-select: none;
    }

    /* Equipment-status edge glow, keyed to hvac_action: blue while cooling,
       amber while heating, nothing when idle. The device shows a crisp bright
       outline tracing the squircle edge with a gentle falloff inward — a thin
       solid ring plus a tight and a wider blurred layer. */
    .face.cooling {
      box-shadow:
        inset 0 0 0 0.6cqw var(--ecosee-cool, #49b6ea),
        inset 0 0 3.5cqw color-mix(in srgb, var(--ecosee-cool, #49b6ea) 55%, transparent),
        inset 0 0 10cqw color-mix(in srgb, var(--ecosee-cool, #49b6ea) 25%, transparent);
    }
    .face.heating {
      box-shadow:
        inset 0 0 0 0.6cqw var(--ecosee-heat, #f3a13c),
        inset 0 0 3.5cqw color-mix(in srgb, var(--ecosee-heat, #f3a13c) 55%, transparent),
        inset 0 0 10cqw color-mix(in srgb, var(--ecosee-heat, #f3a13c) 25%, transparent);
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

    /* Centered cluster: humidity above the dominant number, Hold pill below. */
    .body {
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

    /* Horizontal Hold pill: heat – cool, then the Resume ✕ (the device's
       "until 5:28pm" expiry is omitted — HA can't express it, ADR-0003). */
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
    .resume {
      width: 8.5cqw;
      height: 8.5cqw;
      border-radius: 50%;
      border: 0.5cqw solid var(--ecosee-accent, #62cfe9);
      color: var(--ecosee-accent, #62cfe9);
      padding: 1.4cqw;
      margin-left: 0.5cqw;
    }
    .pill.heat .resume {
      border-color: var(--ecosee-heat, #f3a13c);
      color: var(--ecosee-heat, #f3a13c);
    }
    .pill.cool .resume {
      border-color: var(--ecosee-cool, #49b6ea);
      color: var(--ecosee-cool, #49b6ea);
    }

    .unavailable {
      font-size: 8cqw;
      font-weight: 300;
      color: var(--ecosee-muted, #6f96a3);
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
      <div class="face ${view.equipment ?? ''}" part="screen">
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
        </div>
      </div>
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
                ${icons.sun}
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
    const hold = view.hold;
    if (!hold || (hold.heat === null && hold.cool === null)) return nothing;
    // Single-setpoint pills are tinted to their mode; dual (Auto) stays cyan.
    const tint =
      hold.heat !== null && hold.cool !== null ? '' : hold.heat !== null ? 'heat' : 'cool';
    return html`
      <div class="pill ${tint}" part="hold-pill">
        ${
          hold.heat !== null
            ? html`<span class="heat">${formatTemp(hold.heat, view.unit)}</span>`
            : nothing
        }
        ${hold.heat !== null && hold.cool !== null ? html`<span class="dash">–</span>` : nothing}
        ${
          hold.cool !== null
            ? html`<span class="cool">${formatTemp(hold.cool, view.unit)}</span>`
            : nothing
        }
        ${
          view.canResume
            ? html`<button
                class="resume"
                aria-label="Resume schedule"
                @click=${() => this._emit('resume')}
              >
                ${icons.close}
              </button>`
            : nothing
        }
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
