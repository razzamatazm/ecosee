import { LitElement, html, css, nothing, type TemplateResult } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import type { EquipmentStatus, HomeView } from '../climate/home-view';
import { formatTemp } from '../climate/home-view';
import { icons } from '../icons';

/** Actions the Home Screen surfaces to the host card. Overlays are the next
 *  milestone, so for now the card stubs them; `resume` is wired through. */
export type HomeAction = 'menu' | 'temperature' | 'weather' | 'resume';

/**
 * The default Card view: a flat squircle bearing the large current temperature,
 * a left rail of glyphs (humidity / equipment / weather), and the Hold pill.
 * Purely presentational — it renders whatever the already-degraded HomeView says,
 * and emits `ecosee-action` events for the host card to handle.
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
      padding: 9cqw 8cqw;
      display: grid;
      grid-template-columns: max-content 1fr max-content;
      align-items: center;
      gap: 4cqw;
      background: var(--ecosee-bg, #0a0d10);
      border-radius: var(--ecosee-radius, 15%);
      color: var(--ecosee-fg, #d4eff9);
      font-family: var(--ecosee-font, system-ui, sans-serif);
      overflow: hidden;
      user-select: none;
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

    .menu {
      position: absolute;
      top: 7cqw;
      left: 8cqw;
      width: 11cqw;
      height: 11cqw;
      color: var(--ecosee-accent, #62cfe9);
    }

    .rail {
      grid-column: 1;
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: 6cqw;
      color: var(--ecosee-accent, #62cfe9);
    }

    .hum {
      display: inline-flex;
      align-items: center;
      gap: 1.6cqw;
      font-size: 7cqw;
      font-weight: 300;
      letter-spacing: 0.02em;
    }
    .hum .glyph {
      width: 6.5cqw;
      height: 6.5cqw;
    }

    .equip {
      width: 12cqw;
      height: 12cqw;
    }
    .equip.cooling {
      color: var(--ecosee-cool, #49b6ea);
    }
    .equip.heating {
      color: var(--ecosee-heat, #f3a13c);
    }
    .equip.idle {
      color: var(--ecosee-idle, #6f96a3);
    }

    .weather {
      width: 11cqw;
      height: 11cqw;
      color: var(--ecosee-weather, #7fd08a);
    }

    .temp {
      grid-column: 2;
      justify-self: center;
      align-self: center;
      font-size: 44cqw;
      font-weight: 200;
      line-height: 0.84;
      letter-spacing: -0.04em;
      color: var(--ecosee-fg, #d4eff9);
      cursor: pointer;
    }

    .pill {
      grid-column: 3;
      justify-self: end;
      display: inline-flex;
      flex-direction: column;
      align-items: center;
      gap: 3cqw;
      padding: 4cqw 2.5cqw;
      border: 0.6cqw solid var(--ecosee-accent, #62cfe9);
      border-radius: 999px;
      min-width: 14cqw;
    }
    .resume {
      width: 9cqw;
      height: 9cqw;
      border-radius: 50%;
      border: 0.6cqw solid var(--ecosee-accent, #62cfe9);
      color: var(--ecosee-accent, #62cfe9);
      padding: 1.6cqw;
    }
    .range {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 1cqw;
      font-size: 8cqw;
      font-weight: 500;
      line-height: 1;
    }
    .range .heat {
      color: var(--ecosee-heat, #f3a13c);
    }
    .range .cool {
      color: var(--ecosee-cool, #49b6ea);
    }
    .range .dash {
      color: var(--ecosee-muted, #6f96a3);
      font-size: 5cqw;
    }

    /* Adapt when the container is narrow: tighten spacing and ease the number down. */
    @container (max-width: 300px) {
      .temp {
        font-size: 40cqw;
      }
      .rail {
        gap: 4.5cqw;
      }
    }

    .unavailable {
      grid-column: 1 / -1;
      justify-self: center;
      align-self: center;
      font-size: 8cqw;
      font-weight: 300;
      color: var(--ecosee-muted, #6f96a3);
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
      <div class="face" part="face">
        <button class="menu" aria-label="Open menu" @click=${() => this._emit('menu')}>
          ${icons.menu}
        </button>

        ${this._renderRail(view)}

        ${view.available
          ? html`<button
              class="temp"
              aria-label="Adjust temperature"
              @click=${() => this._emit('temperature')}
            >
              ${formatTemp(view.currentTemp, view.unit)}
            </button>`
          : html`<div class="unavailable">${view.name} unavailable</div>`}

        ${this._renderPill(view)}
      </div>
    `;
  }

  private _renderRail(view: HomeView): TemplateResult {
    return html`
      <div class="rail">
        ${view.humidity !== null
          ? html`<div class="hum">
              <span class="glyph">${icons.humidity}</span>${Math.round(view.humidity)}%
            </div>`
          : nothing}
        ${view.equipment
          ? html`<div class="equip ${view.equipment}" aria-label=${this._equipLabel(view.equipment)}>
              ${this._equipIcon(view.equipment)}
            </div>`
          : nothing}
        ${view.weatherAvailable
          ? html`<button class="weather" aria-label="Weather" @click=${() => this._emit('weather')}>
              ${icons.sun}
            </button>`
          : nothing}
      </div>
    `;
  }

  private _renderPill(view: HomeView): TemplateResult | typeof nothing {
    const hold = view.hold;
    if (!hold || (hold.heat === null && hold.cool === null)) return nothing;
    return html`
      <div class="pill" part="hold-pill">
        ${view.canResume
          ? html`<button class="resume" aria-label="Resume schedule" @click=${() =>
              this._emit('resume')}>
              ${icons.close}
            </button>`
          : nothing}
        <div class="range">
          ${hold.heat !== null ? html`<span class="heat">${formatTemp(hold.heat, view.unit)}</span>` : nothing}
          ${hold.heat !== null && hold.cool !== null ? html`<span class="dash">–</span>` : nothing}
          ${hold.cool !== null ? html`<span class="cool">${formatTemp(hold.cool, view.unit)}</span>` : nothing}
        </div>
      </div>
    `;
  }

  private _equipIcon(equipment: EquipmentStatus): TemplateResult {
    if (equipment === 'cooling') return icons.snowflake;
    if (equipment === 'heating') return icons.heat;
    return icons.idle;
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
