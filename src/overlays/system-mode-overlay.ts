import { LitElement, html, css, nothing, type TemplateResult } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import {
  setHvacModeCall,
  type SystemModeModel,
  type SystemModeOption,
} from '../climate/system-mode';
import { emitServiceCall } from './service-call-event';

/**
 * `<ecosee-system-mode-overlay>` — the System Mode picker's content (slotted into
 * <ecosee-overlay>). Laid out as the device is (see
 * docs/reference/system-mode-picker.jpeg): a single vertical segmented list,
 * cyan-outlined with hairline dividers between rows, listing the entity's
 * supported System Modes in the device's order with its exact labels (Heat /
 * Cool / Heat / Cool (Auto) / Off). The current mode's row is filled cyan with
 * dark text (the squircle "selected" motif); the rest are cyan text on black.
 *
 * Unlike the Temperature Adjust overlay — which holds in-progress edit state so a
 * multi-step scrub survives `hass` pushes — this picker owns no edit state.
 * Choosing a mode is a single discrete write: it emits the shared
 * `ecosee-service-call` with the `climate.set_hvac_mode` call and lets the highlight follow the
 * entity's reported `hvac_mode` once `hass` reflects it (the host card recomputes
 * the model live, so the selection updates in place). Tapping the already-selected
 * row is a no-op. Dismissal is the shell's job (✕ / outside-tap).
 */
@customElement('ecosee-system-mode-overlay')
export class EcoseeSystemModeOverlay extends LitElement {
  /** The supported modes + current selection, derived by the host card from `hass`. */
  @property({ attribute: false }) model?: SystemModeModel;
  /** The bound entity the emitted `set_hvac_mode` call targets. */
  @property({ attribute: false }) entityId = '';

  static override styles = css`
    :host {
      display: block;
      width: 100%;
      height: 100%;
    }

    /* Center the list within the shell; sized container so rows scale with cqw. */
    .picker {
      container-type: size;
      box-sizing: border-box;
      width: 100%;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 10cqw;
    }

    /* The cyan-outlined segmented list. overflow:hidden clips the selected row's
       fill to the rounded corners. The list opts back into pointer events (the
       shell makes slotted content transparent so empty areas dismiss). */
    .list {
      width: 64cqw;
      border: 0.6cqw solid var(--ecosee-accent, #62cfe9);
      border-radius: 6cqw;
      overflow: hidden;
      pointer-events: auto;
    }

    .option {
      appearance: none;
      background: none;
      margin: 0;
      box-sizing: border-box;
      width: 100%;
      padding: 5.5cqw 4cqw;
      font: inherit;
      font-size: 8cqw;
      font-weight: 500;
      color: var(--ecosee-accent, #62cfe9);
      text-align: center;
      cursor: pointer;
      /* Hairline divider between rows; the first row has the list's own border.
         Derived from the accent token (at low alpha) so the Skin stays themeable. */
      border: none;
      border-top: 0.4cqw solid color-mix(in srgb, var(--ecosee-accent, #62cfe9) 30%, transparent);
    }
    .option:first-child {
      border-top: none;
    }
    .option:focus-visible {
      outline: 0.5cqw solid var(--ecosee-accent, #62cfe9);
      outline-offset: -1.5cqw;
    }

    /* Selected row: filled cyan with dark text (visual-spec.md). */
    .option.selected {
      background: var(--ecosee-accent, #62cfe9);
      color: var(--ecosee-bg, #0a0d10);
      cursor: default;
    }
  `;

  private _select(option: SystemModeOption): void {
    if (option.selected) return; // already the active mode — nothing to write
    emitServiceCall(this, setHvacModeCall(option.hvacMode, this.entityId));
  }

  override render(): TemplateResult | typeof nothing {
    const model = this.model;
    if (!model || !model.available) return nothing;
    return html`
      <div class="picker">
        <div class="list" role="group" aria-label="System Mode">
          ${model.options.map(
            (option) => html`
              <button
                class="option ${option.selected ? 'selected' : ''}"
                aria-pressed=${option.selected}
                @click=${() => this._select(option)}
              >
                ${option.label}
              </button>
            `,
          )}
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'ecosee-system-mode-overlay': EcoseeSystemModeOverlay;
  }
}
