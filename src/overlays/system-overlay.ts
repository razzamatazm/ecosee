import { LitElement, html, css, nothing, type TemplateResult } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import type { SystemModeModel } from '../climate/system-mode';
import type { ComfortSettingModel } from '../climate/comfort-setting';
import type { EquipmentStatus } from '../climate/home-view';
import { icons } from '../icons';

/** The two pickers the System sub-screen routes to. These double as the host
 *  card's overlay kinds, so a selection pushes its picker straight onto the nav
 *  stack. */
export type SystemSelectTarget = 'system-mode' | 'comfort-setting';

/**
 * `<ecosee-system-overlay>` — the Main Menu › System sub-screen (slotted into
 * <ecosee-overlay>). Laid out as the device is (see docs/reference/menu-system.jpeg):
 * the "Main Menu" title with a "System" subtitle, then the two selectors — System
 * Mode and Comfort Setting — each a labeled cyan-outlined pill showing the active
 * value with a ▾ caret, and the equipment-status line beneath ("No Equipment
 * Running" / "Heating" / "Cooling").
 *
 * This is the hub half of hub-and-picker (CONTEXT.md Main Menu): it only *routes* —
 * tapping a selector emits `ecosee-system-select` and the host card opens that
 * picker's Overlay; the sub-screen itself owns no edit state. Purely presentational:
 * it renders the already-degraded models (a selector whose backing data is absent is
 * dropped upstream) and leaves dismissal to the shell (✕ / outside-tap).
 */
@customElement('ecosee-system-overlay')
export class EcoseeSystemOverlay extends LitElement {
  /** Supported System Modes + current selection (gates the System Mode selector). */
  @property({ attribute: false }) systemMode?: SystemModeModel;
  /** Available Comfort Settings + active one (gates the Comfort Setting selector). */
  @property({ attribute: false }) comfort?: ComfortSettingModel;
  /** Current Equipment Status (`null` ⇒ the status line is hidden). */
  @property({ attribute: false }) equipment: EquipmentStatus | null = null;

  static override styles = css`
    :host {
      display: block;
      width: 100%;
      height: 100%;
    }

    /* Title near the top, the selectors beneath, then the equipment line
       (visual-spec.md / menu-system.jpeg). Sized container so type scales with cqw. */
    .system {
      container-type: size;
      box-sizing: border-box;
      width: 100%;
      height: 100%;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: flex-start;
      gap: 8cqw;
      padding: 14cqw 8cqw 10cqw;
      text-align: center;
    }

    .head {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 1.5cqw;
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
      font-size: 6.5cqw;
      font-weight: 500;
      color: var(--ecosee-accent, #62cfe9);
    }

    /* Selectors sit side by side, wrapping to stacked rows when their values are too
       wide to share a row (e.g. "Heat / Cool (Auto)"). */
    .selectors {
      width: 100%;
      display: flex;
      flex-wrap: wrap;
      align-items: flex-start;
      justify-content: center;
      gap: 5cqw 6cqw;
    }
    .selector {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 2.5cqw;
    }
    .selector-label {
      font-size: 6.5cqw;
      font-weight: 600;
      color: var(--ecosee-accent, #62cfe9);
    }

    /* The cyan-outlined value pill; opts back into pointer events (the shell makes
       slotted content transparent so empty areas dismiss). */
    .field {
      appearance: none;
      margin: 0;
      box-sizing: border-box;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 2.5cqw;
      min-width: 30cqw;
      max-width: 80cqw;
      padding: 3cqw 4cqw;
      background: none;
      font: inherit;
      font-size: 6.5cqw;
      font-weight: 500;
      color: var(--ecosee-accent, #62cfe9);
      border: 0.6cqw solid var(--ecosee-accent, #62cfe9);
      border-radius: 4cqw;
      cursor: pointer;
      pointer-events: auto;
    }
    .field:focus-visible {
      outline: 0.5cqw solid var(--ecosee-accent, #62cfe9);
      outline-offset: 1cqw;
    }
    .caret {
      width: 5cqw;
      height: 5cqw;
      flex: none;
    }

    .equipment {
      margin: 0;
      font-size: 7cqw;
      font-weight: 600;
      color: var(--ecosee-accent, #62cfe9);
    }
  `;

  private _select(target: SystemSelectTarget): void {
    this.dispatchEvent(
      new CustomEvent('ecosee-system-select', {
        detail: { target },
        bubbles: true,
        composed: true,
      }),
    );
  }

  override render(): TemplateResult | typeof nothing {
    // Mirror the sibling overlays' degradation guard: with neither selector backable
    // the sub-screen has nothing to hold, so the host unmounts the shell rather than
    // leaving an empty titled screen (ADR-0001; cf. system-mode-overlay).
    if (!this.systemMode?.available && !this.comfort?.available) return nothing;
    return html`
      <div class="system">
        <div class="head">
          <h2 class="title">Main Menu</h2>
          <p class="subtitle">System</p>
        </div>
        <div class="selectors">
          ${this._renderSelector('System Mode', this._modeValue(), 'system-mode', this.systemMode)}
          ${this._renderSelector(
            'Comfort Setting',
            this._comfortValue(),
            'comfort-setting',
            this.comfort,
          )}
        </div>
        ${
          this.equipment !== null
            ? html`<p class="equipment">${this._equipmentLabel(this.equipment)}</p>`
            : nothing
        }
      </div>
    `;
  }

  private _renderSelector(
    label: string,
    value: string,
    target: SystemSelectTarget,
    model: SystemModeModel | ComfortSettingModel | undefined,
  ): TemplateResult | typeof nothing {
    if (!model || !model.available) return nothing;
    return html`
      <div class="selector">
        <span class="selector-label">${label}</span>
        <button
          class="field"
          aria-label=${`${label}: ${value}`}
          @click=${() => this._select(target)}
        >
          <span class="value">${value}</span>
          <span class="caret">${icons.caret}</span>
        </button>
      </div>
    `;
  }

  /** The active System Mode's label for the selector summary (— if none reported). */
  private _modeValue(): string {
    return this.systemMode?.options.find((o) => o.selected)?.label ?? '—';
  }

  /** The active Comfort Setting's label for the selector summary (— if none held). */
  private _comfortValue(): string {
    return this.comfort?.options.find((o) => o.selected)?.label ?? '—';
  }

  private _equipmentLabel(equipment: EquipmentStatus): string {
    if (equipment === 'heating') return 'Heating';
    if (equipment === 'cooling') return 'Cooling';
    return 'No Equipment Running';
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'ecosee-system-overlay': EcoseeSystemOverlay;
  }
}
