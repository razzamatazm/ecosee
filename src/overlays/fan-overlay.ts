import { LitElement, html, css, nothing, type TemplateResult } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import {
  setFanModeCall,
  setFanMinOnTimeCall,
  type FanModel,
  type FanOption,
  type MinRuntimeModel,
} from '../climate/fan';
import { icons } from '../icons';

/**
 * `<ecosee-fan-overlay>` — the Fan sub-screen's content (slotted into
 * <ecosee-overlay>). Laid out as the device is (see docs/reference/fan-mode.jpeg):
 * a "Fan Mode" title, then the On / Auto segmented pill toggle, then — when a
 * `fan_min_on_time` number entity is configured — the minimum-runtime helper copy
 * and its dropdown selector ("0 min / hr"). The active fan mode's segment is filled
 * cyan with dark text (the squircle "selected" motif); the rest are cyan on black.
 *
 * Like the System Mode picker (and unlike the Temperature Adjust overlay), this
 * owns no edit state: each choice is a single discrete write. Selecting a fan mode
 * emits `ecosee-set-fan` with the `climate.set_fan_mode` call; choosing a runtime
 * emits the same event with the `number.set_value` call. The host card recomputes
 * the model from `hass`, so the highlight / selection follows the entity's reported
 * values once they reflect. Tapping the already-selected mode is a no-op. Dismissal
 * is the shell's job (✕ / outside-tap).
 */
@customElement('ecosee-fan-overlay')
export class EcoseeFanOverlay extends LitElement {
  /** The fan options + optional runtime selector, derived by the host from `hass`. */
  @property({ attribute: false }) model?: FanModel;
  /** The bound climate entity the emitted `set_fan_mode` call targets. */
  @property({ attribute: false }) entityId = '';

  static override styles = css`
    :host {
      display: block;
      width: 100%;
      height: 100%;
    }

    /* Title near the top with the controls beneath (fan-mode.jpeg), not a
       vertically-centered cluster. Sized container so everything scales with cqw. */
    .fan {
      container-type: size;
      box-sizing: border-box;
      width: 100%;
      height: 100%;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: flex-start;
      gap: 6cqw;
      padding: 13cqw 9cqw 9cqw;
      text-align: center;
    }

    .title {
      margin: 0;
      font-size: 8cqw;
      font-weight: 600;
      letter-spacing: 0.02em;
      color: var(--ecosee-accent, #62cfe9);
    }

    /* The On / Auto segmented pill: a cyan-outlined pill holding the segments; the
       selected segment is a filled cyan rounded pill with dark text. Opts back into
       pointer events (the shell makes slotted content transparent so empty areas
       dismiss). */
    .toggle {
      display: inline-flex;
      align-items: stretch;
      border: 0.5cqw solid var(--ecosee-accent, #62cfe9);
      border-radius: 100cqw;
      padding: 1.2cqw;
      pointer-events: auto;
    }

    .segment {
      appearance: none;
      background: none;
      border: none;
      margin: 0;
      font: inherit;
      font-size: 7cqw;
      font-weight: 500;
      color: var(--ecosee-accent, #62cfe9);
      padding: 3cqw 9cqw;
      min-width: 22cqw;
      border-radius: 100cqw;
      cursor: pointer;
    }
    .segment:focus-visible {
      outline: 0.5cqw solid var(--ecosee-accent, #62cfe9);
      outline-offset: 0.6cqw;
    }
    .segment.selected {
      background: var(--ecosee-accent, #62cfe9);
      color: var(--ecosee-bg, #0a0d10);
      cursor: default;
    }

    /* Minimum-runtime block: bold summary line, instructional hint, then the
       dropdown selector. */
    .runtime {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 4cqw;
      margin-top: 2cqw;
    }
    .summary {
      margin: 0;
      font-size: 6.5cqw;
      font-weight: 600;
      color: var(--ecosee-accent, #62cfe9);
    }
    .hint {
      margin: 0;
      font-size: 5.5cqw;
      font-weight: 400;
      line-height: 1.3;
      color: var(--ecosee-accent, #62cfe9);
      opacity: 0.85;
    }

    /* Cyan-outlined dropdown pill (fan-mode.jpeg). The visible label + ⌄ caret are
       driven by the model, with a transparent native <select> layered over the pill
       to capture taps and open the platform list. Sourcing the label from the model
       (rather than the select's own value) keeps the current runtime reflected on
       first open, sidestepping the <select> value-binding order in Lit. */
    .select-pill {
      position: relative;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 3cqw;
      margin-top: 1cqw;
      padding: 3cqw 7cqw;
      border: 0.5cqw solid var(--ecosee-accent, #62cfe9);
      border-radius: 100cqw;
      color: var(--ecosee-accent, #62cfe9);
      font-size: 6.5cqw;
      font-weight: 500;
    }
    .select-label {
      pointer-events: none;
    }
    .caret {
      width: 5cqw;
      height: 5cqw;
      flex: none;
      color: var(--ecosee-accent, #62cfe9);
      pointer-events: none;
    }
    .select-native {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      margin: 0;
      padding: 0;
      border: none;
      appearance: none;
      -webkit-appearance: none;
      background: none;
      color: transparent;
      font: inherit;
      opacity: 0;
      cursor: pointer;
      /* The shell makes slotted content pointer-transparent; this control opts back
         in (the decorative label/caret above stay transparent → empty taps dismiss). */
      pointer-events: auto;
    }
    .select-pill:focus-within {
      outline: 0.5cqw solid var(--ecosee-accent, #62cfe9);
      outline-offset: 0.6cqw;
    }
    /* Best-effort skin for the native dropdown list (platform support varies). */
    .select-native option {
      color: var(--ecosee-fg, #d4eff9);
      background: var(--ecosee-bg, #0a0d10);
    }
  `;

  private _selectMode(option: FanOption): void {
    if (option.selected) return; // already the active mode — nothing to write
    this.dispatchEvent(
      new CustomEvent('ecosee-set-fan', {
        detail: { call: setFanModeCall(option.fanMode, this.entityId) },
        bubbles: true,
        composed: true,
      }),
    );
  }

  private _onRuntimeChange(event: Event, runtime: MinRuntimeModel): void {
    const value = Number((event.target as HTMLSelectElement).value);
    if (!Number.isFinite(value) || value === runtime.value) return;
    this.dispatchEvent(
      new CustomEvent('ecosee-set-fan', {
        detail: { call: setFanMinOnTimeCall(value, runtime.entityId) },
        bubbles: true,
        composed: true,
      }),
    );
  }

  override render(): TemplateResult | typeof nothing {
    const model = this.model;
    if (!model || !model.available) return nothing;
    return html`
      <div class="fan">
        <h2 class="title">Fan Mode</h2>
        <div class="toggle" role="group" aria-label="Fan Mode">
          ${model.options.map(
            (option) => html`
              <button
                class="segment ${option.selected ? 'selected' : ''}"
                aria-pressed=${option.selected}
                @click=${() => this._selectMode(option)}
              >
                ${option.label}
              </button>
            `,
          )}
        </div>
        ${this._renderRuntime(model.minRuntime)}
      </div>
    `;
  }

  private _renderRuntime(runtime: MinRuntimeModel | null): TemplateResult | typeof nothing {
    if (!runtime) return nothing;
    const current = runtime.options.find((option) => option.selected);
    return html`
      <div class="runtime">
        <p class="summary">${runtime.summary}</p>
        <p class="hint">
          You can change your fan's minimum hourly runtime by tapping the setting below.
        </p>
        <div class="select-pill">
          <span class="select-label">${current?.label}</span>
          <span class="caret">${icons.caretDown}</span>
          <select
            class="select-native"
            aria-label="Minimum fan runtime"
            @change=${(event: Event) => this._onRuntimeChange(event, runtime)}
          >
            ${runtime.options.map(
              (option) =>
                html`<option value=${option.value} ?selected=${option.selected}>
                  ${option.label}
                </option>`,
            )}
          </select>
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'ecosee-fan-overlay': EcoseeFanOverlay;
  }
}
