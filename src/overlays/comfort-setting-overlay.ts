import { LitElement, html, css, nothing, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import {
  setPresetModeCall,
  type ComfortIcon,
  type ComfortSettingModel,
  type ComfortSettingOption,
} from '../climate/comfort-setting';
import { icons } from '../icons';
import { emitServiceCall } from './service-call-event';
import { reschedulePickerClose } from './overlay-dismiss';

/** Maps a derived glyph key onto a Skin icon. The seam emits only these keys, so a
 *  custom preset whose configured override is unknown has already degraded to
 *  `comfort` upstream. */
const GLYPHS: Record<ComfortIcon, TemplateResult> = {
  home: icons.home,
  away: icons.away,
  sleep: icons.sleep,
  comfort: icons.comfort,
};

/**
 * `<ecosee-comfort-setting-overlay>` — the Comfort Setting picker's content
 * (slotted into <ecosee-overlay>, reached from the Main Menu › System sub-screen).
 * Laid out like the System Mode picker: a single cyan-outlined segmented list with
 * hairline dividers, listing the entity's `preset_modes` in its own order. Each row
 * pairs a glyph with the Comfort Setting's name (the named ecobee settings — Home /
 * Away / Sleep — get their own icons; custom presets a default). The active
 * Comfort Setting's row is filled cyan with dark text (the squircle "selected"
 * motif); the rest are cyan on black.
 *
 * Like the System Mode picker, this owns no lasting edit state. Choosing a Comfort
 * Setting is a single discrete write that applies the preset via
 * `climate.set_preset_mode`: it highlights the chosen row optimistically on tap
 * (`_pending`, issue #38), emits the shared `ecosee-service-call` with that call,
 * then auto-closes after a brief confirm beat (issue #39), returning to the screen it
 * was opened from (the System sub-screen), which reflects the real `preset_mode` once
 * `hass` catches up. A correction tap during the beat re-points the pick and restarts
 * it; tapping the already-active row commits nothing but still closes.
 */
@customElement('ecosee-comfort-setting-overlay')
export class EcoseeComfortSettingOverlay extends LitElement {
  /** The presets + active selection, derived by the host card from `hass`. */
  @property({ attribute: false }) model?: ComfortSettingModel;
  /** The bound entity the emitted `set_preset_mode` call targets. */
  @property({ attribute: false }) entityId = '';
  /** The optimistically-chosen preset, set on tap so the highlight moves before the
   *  device echoes back (issue #38); `null` until a pick. Doubles as the
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
      width: 68cqw;
      max-height: 80cqw;
      /* Vertical scroll only. A bare overflow-y:auto forces the visible x-axis to
         compute to auto too, so a long label produced a left-right scroll (kiosk
         pull-to-scrub territory). Pin x to hidden; long labels truncate (see the
         .label rule), matching the device's own ellipsis behavior. */
      overflow: hidden auto;
      border: 0.6cqw solid var(--ecosee-accent, #62cfe9);
      border-radius: 6cqw;
      pointer-events: auto;
    }

    .option {
      appearance: none;
      background: none;
      margin: 0;
      box-sizing: border-box;
      width: 100%;
      display: flex;
      align-items: center;
      gap: 3.5cqw;
      padding: 4.5cqw 4cqw;
      font: inherit;
      font-size: 7.5cqw;
      font-weight: 500;
      color: var(--ecosee-accent, #62cfe9);
      text-align: left;
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

    .glyph {
      width: 7.5cqw;
      height: 7.5cqw;
      flex: none;
    }

    /* Long preset names truncate with an ellipsis rather than widen the row.
       min-width:0 lets the flex item shrink below its content width (the default
       auto min is what let it push the row past the list). */
    .label {
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
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

  private _select(option: ComfortSettingOption): void {
    if (this._pending === option.preset) return; // already the settling pick — nothing to do
    // Tapping the current Comfort Setting with no pick in flight: nothing to write,
    // but honour "nothing left to do" by closing anyway (issue #39).
    const noChange = this._pending === null && option.selected;
    this._pending = option.preset; // move / hold the highlight now (issue #38)
    if (!noChange) emitServiceCall(this, setPresetModeCall(option.preset, this.entityId));
    this._closeTimer = reschedulePickerClose(this, this._closeTimer); // confirm beat, then close
  }

  override render(): TemplateResult | typeof nothing {
    const model = this.model;
    if (!model || !model.available) return nothing;
    return html`
      <div class="picker">
        <div class="list" role="group" aria-label="Comfort Setting">
          ${model.options.map((option) => {
            // Once a pick is settling, the optimistic choice wins the highlight;
            // otherwise it follows the entity's reported preset.
            const selected =
              this._pending !== null ? option.preset === this._pending : option.selected;
            return html`
              <button
                class="option ${selected ? 'selected' : ''}"
                aria-pressed=${selected}
                @click=${() => this._select(option)}
              >
                <span class="glyph">${GLYPHS[option.icon]}</span>
                <span class="label">${option.label}</span>
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
    'ecosee-comfort-setting-overlay': EcoseeComfortSettingOverlay;
  }
}
