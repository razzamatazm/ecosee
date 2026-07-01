import { LitElement, html, css, nothing, type TemplateResult } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';
import { formatTemp } from '../climate/home-view';
import type { SensorsModel, SensorCard } from '../sensors/sensors';
import { icons } from '../icons';

/**
 * `<ecosee-sensors-overlay>` — the Sensors sub-screen's content (slotted into
 * <ecosee-overlay>). Laid out as the device is (see docs/reference/sensors.jpeg):
 * the "Main Menu" › "Sensors" breadcrumb near the top, then a vertical stack of
 * horizontal **cards** — each a cyan-outlined squircle with a sensor glyph, the
 * sensor name, a `73° | Occupied` reading line, and a circled expand chevron.
 *
 * Purely presentational and **read-only**: it renders the already-degraded
 * SensorsModel (the thermostat's own temp first, then each usable curated sensor;
 * unavailable sensors and absent occupancy are dropped upstream by
 * `toSensorsModel`). There is no "participating in average" control — Home
 * Assistant can't back it (issue #9). The expand chevron is a fidelity affordance;
 * there is no per-sensor detail screen, so cards emit no events. Dismissal is the
 * shell's job (✕ / outside-tap), which returns to the Main Menu (hub-and-picker).
 */
@customElement('ecosee-sensors-overlay')
export class EcoseeSensorsOverlay extends LitElement {
  /** The already-degraded sensor cards, derived by the host card from `hass`. */
  @property({ attribute: false }) model?: SensorsModel;

  static override styles = css`
    :host {
      display: block;
      width: 100%;
      height: 100%;
    }

    /* Breadcrumb header near the top, the card stack beneath (sensors.jpeg), not a
       vertically-centered cluster. Inline-size container so cards scale with cqw
       off the definite width, with the root's own padding/gap in the fixed unit (calc · --ecosee-u) so they can't couple to the viewport, the real bug — a container-type element resolves its OWN cqw against the viewport (issue #35). */
    .sensors {
      container-type: inline-size;
      box-sizing: border-box;
      width: var(--ecosee-base-size, 460px);
      height: var(--ecosee-base-size, 460px);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: flex-start;
      gap: calc(5 * var(--ecosee-u, 4.6px));
      padding: calc(13 * var(--ecosee-u, 4.6px)) calc(8 * var(--ecosee-u, 4.6px))
        calc(8 * var(--ecosee-u, 4.6px));
    }

    .header {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 1cqw;
    }
    .title {
      margin: 0;
      font-size: 9cqw;
      font-weight: 600;
      letter-spacing: 0.02em;
      color: var(--ecosee-accent, #62cfe9);
    }
    .subtitle {
      margin: 0;
      font-size: 6cqw;
      font-weight: 600;
      color: var(--ecosee-accent, #62cfe9);
    }

    /* The card stack. Opts back into pointer events (the shell makes slotted
       content transparent so empty areas dismiss) so a long list can scroll;
       empty margins still fall through to the backdrop. */
    .list {
      width: 84cqw;
      max-height: 60cqw;
      display: flex;
      flex-direction: column;
      gap: 3cqw;
      overflow-y: auto;
      pointer-events: auto;
      /* Hide the scrollbar — the device has none (it's a touchscreen). */
      scrollbar-width: none;
    }
    .list::-webkit-scrollbar {
      display: none;
    }

    /* One horizontal sensor card: a cyan-outlined squircle. */
    .card {
      box-sizing: border-box;
      flex: none;
      display: flex;
      align-items: center;
      gap: 3.5cqw;
      padding: 3.4cqw 4cqw;
      border: 0.6cqw solid var(--ecosee-accent, #62cfe9);
      border-radius: 5cqw;
    }

    .card-icon {
      width: 8cqw;
      height: 8cqw;
      flex: none;
      color: var(--ecosee-accent, #62cfe9);
    }

    .text {
      flex: 1;
      min-width: 0;
      display: flex;
      flex-direction: column;
      gap: 0.8cqw;
    }
    .name {
      font-size: 6cqw;
      font-weight: 600;
      color: var(--ecosee-accent, #62cfe9);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .reading {
      display: flex;
      align-items: baseline;
      gap: 2cqw;
      font-size: 5cqw;
      font-weight: 500;
      color: var(--ecosee-accent, #62cfe9);
    }
    /* The vertical-bar divider between temperature and occupancy, dimmed. */
    .sep {
      color: color-mix(in srgb, var(--ecosee-accent, #62cfe9) 45%, transparent);
    }

    /* The circled expand chevron (fidelity affordance; read-only). */
    .chevron {
      box-sizing: border-box;
      width: 8cqw;
      height: 8cqw;
      flex: none;
      padding: 1.7cqw;
      border: 0.5cqw solid var(--ecosee-accent, #62cfe9);
      border-radius: 50%;
      color: var(--ecosee-accent, #62cfe9);
    }
  `;

  private _renderCard(card: SensorCard, unit: string): TemplateResult {
    return html`
      <div class="card" role="listitem">
        <span class="card-icon" aria-hidden="true">
          ${card.isThermostat ? icons.thermostat : icons.sensor}
        </span>
        <div class="text">
          <div class="name">${card.name}</div>
          <div class="reading">
            <span class="temp">${formatTemp(card.temp, unit)}°</span>
            ${
              card.occupied === null
                ? nothing
                : html`<span class="sep" aria-hidden="true">|</span>
                    <span class="occ">${card.occupied ? 'Occupied' : 'Unoccupied'}</span>`
            }
          </div>
        </div>
        <span class="chevron" aria-hidden="true">${icons.chevron}</span>
      </div>
    `;
  }

  override render(): TemplateResult | typeof nothing {
    const model = this.model;
    if (!model || !model.available) return nothing;
    return html`
      <div class="sensors">
        <div class="header">
          <h2 class="title">Main Menu</h2>
          <p class="subtitle">Sensors</p>
        </div>
        <div class="list" role="list" aria-label="Sensors">
          ${repeat(
            model.cards,
            (card) => card.key,
            (card) => this._renderCard(card, model.unit),
          )}
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'ecosee-sensors-overlay': EcoseeSensorsOverlay;
  }
}
