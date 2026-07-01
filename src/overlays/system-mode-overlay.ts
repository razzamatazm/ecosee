import { LitElement, html, css, nothing, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import {
  setHvacModeCall,
  type SystemModeModel,
  type SystemModeOption,
} from '../climate/system-mode';
import { emitServiceCall } from './service-call-event';
import { reschedulePickerClose } from './overlay-dismiss';

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
 * multi-step scrub survives `hass` pushes — this picker owns no lasting edit state.
 * Choosing a mode is a single discrete write that emits the shared
 * `ecosee-service-call` with the `climate.set_hvac_mode` call. So the tap reads as
 * instant rather than waiting on the device's echo (issue #38), the chosen row is
 * highlighted optimistically (`_pending`) the moment it is tapped; the picker then
 * auto-closes after a brief confirm beat (issue #39), returning to the screen it was
 * opened from (Home, or the System sub-screen when reached through the Main Menu),
 * which reflects the real `hvac_mode` once `hass` catches up. A correction tap during
 * the beat re-points the pick and restarts it; tapping the already-active row commits
 * nothing but still closes (nothing left to do).
 */
@customElement('ecosee-system-mode-overlay')
export class EcoseeSystemModeOverlay extends LitElement {
  /** The supported modes + current selection, derived by the host card from `hass`. */
  @property({ attribute: false }) model?: SystemModeModel;
  /** The bound entity the emitted `set_hvac_mode` call targets. */
  @property({ attribute: false }) entityId = '';
  /** The optimistically-chosen `hvac_mode`, set on tap so the highlight moves before
   *  the device echoes back (issue #38); `null` until a pick. Doubles as the
   *  "a pick is settling" guard until the overlay auto-closes. */
  @state() private _pending: string | null = null;
  /** Handle for the pending auto-close, cancelled if the overlay is torn down first. */
  private _closeTimer?: ReturnType<typeof setTimeout>;

  static override styles = css`
    :host {
      display: block;
      width: 100%;
      height: 100%;
    }

    /* Center the list within the shell; inline-size container so rows scale with
       cqw off the definite width, with the root's own padding/gap in the fixed unit (calc · --ecosee-u) so they can't couple to the viewport, the real bug — a container-type element resolves its OWN cqw against the viewport (issue #35). */
    .picker {
      container-type: inline-size;
      box-sizing: border-box;
      width: var(--ecosee-base-size, 460px);
      height: var(--ecosee-base-size, 460px);
      display: flex;
      align-items: center;
      justify-content: center;
      padding: calc(10 * var(--ecosee-u, 4.6px));
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

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    if (this._closeTimer !== undefined) clearTimeout(this._closeTimer);
  }

  private _select(option: SystemModeOption): void {
    if (this._pending === option.hvacMode) return; // already the settling pick — nothing to do
    // Tapping the current device mode with no pick in flight: nothing to write, but
    // honour "nothing left to do" by closing anyway (issue #39).
    const noChange = this._pending === null && option.selected;
    this._pending = option.hvacMode; // move / hold the highlight now (issue #38)
    if (!noChange) emitServiceCall(this, setHvacModeCall(option.hvacMode, this.entityId));
    this._closeTimer = reschedulePickerClose(this, this._closeTimer); // confirm beat, then close
  }

  override render(): TemplateResult | typeof nothing {
    const model = this.model;
    if (!model || !model.available) return nothing;
    return html`
      <div class="picker">
        <div class="list" role="group" aria-label="System Mode">
          ${model.options.map((option) => {
            // Once a pick is settling, the optimistic choice wins the highlight;
            // otherwise it follows the entity's reported mode.
            const selected =
              this._pending !== null ? option.hvacMode === this._pending : option.selected;
            return html`
              <button
                class="option ${selected ? 'selected' : ''}"
                aria-pressed=${selected}
                @click=${() => this._select(option)}
              >
                ${option.label}
              </button>
            `;
          })}
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
