import { LitElement, html, css, nothing, type TemplateResult } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import {
  setPresetModeCall,
  type ComfortIcon,
  type ComfortSettingModel,
  type ComfortSettingOption,
} from '../climate/comfort-setting';
import { icons } from '../icons';

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
 * Like the System Mode picker, this owns no edit state. Choosing a Comfort Setting
 * is a single discrete write that applies it as a Hold: it emits
 * `ecosee-set-comfort-setting` with the `climate.set_preset_mode` call and lets the
 * highlight follow the entity's reported `preset_mode` once `hass` reflects it.
 * Tapping the already-active row is a no-op. Dismissal is the shell's job (✕ /
 * outside-tap).
 */
@customElement('ecosee-comfort-setting-overlay')
export class EcoseeComfortSettingOverlay extends LitElement {
  /** The presets + active selection, derived by the host card from `hass`. */
  @property({ attribute: false }) model?: ComfortSettingModel;
  /** The bound entity the emitted `set_preset_mode` call targets. */
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
      width: 68cqw;
      max-height: 80cqh;
      overflow-y: auto;
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

    /* Selected row: filled cyan with dark text (visual-spec.md). */
    .option.selected {
      background: var(--ecosee-accent, #62cfe9);
      color: var(--ecosee-bg, #0a0d10);
      cursor: default;
    }
  `;

  private _select(option: ComfortSettingOption): void {
    if (option.selected) return; // already the active Comfort Setting — nothing to write
    this.dispatchEvent(
      new CustomEvent('ecosee-set-comfort-setting', {
        detail: { call: setPresetModeCall(option.preset, this.entityId) },
        bubbles: true,
        composed: true,
      }),
    );
  }

  override render(): TemplateResult | typeof nothing {
    const model = this.model;
    if (!model || !model.available) return nothing;
    return html`
      <div class="picker">
        <div class="list" role="group" aria-label="Comfort Setting">
          ${model.options.map(
            (option) => html`
              <button
                class="option ${option.selected ? 'selected' : ''}"
                aria-pressed=${option.selected}
                @click=${() => this._select(option)}
              >
                <span class="glyph">${GLYPHS[option.icon]}</span>
                <span class="label">${option.label}</span>
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
    'ecosee-comfort-setting-overlay': EcoseeComfortSettingOverlay;
  }
}
