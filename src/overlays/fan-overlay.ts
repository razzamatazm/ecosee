import { LitElement, html, css, nothing, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import {
  setFanModeCall,
  setFanMinOnTimeCall,
  type FanModel,
  type FanOption,
  type MinRuntimeModel,
} from '../climate/fan';
import { icons } from '../icons';
import { emitServiceCall } from './service-call-event';
import { reschedulePickerClose } from './overlay-dismiss';

/**
 * `<ecosee-fan-overlay>` — the Fan sub-screen's content (slotted into
 * <ecosee-overlay>). Laid out as the device is (see docs/reference/fan-mode.jpeg):
 * a "Fan Mode" title, then the On / Auto segmented pill toggle, then — when a
 * `fan_min_on_time` number entity is configured — the minimum-runtime helper copy
 * and its dropdown selector ("0 min / hr"). The active fan mode's segment is filled
 * cyan with dark text (the squircle "selected" motif); the rest are cyan on black.
 *
 * Like the System Mode picker (and unlike the Temperature Adjust overlay), this
 * owns no lasting edit state: each choice is a single discrete write. Selecting a
 * fan mode highlights it optimistically on tap (`_pending`, issue #38), emits the
 * shared `ecosee-service-call` with the `climate.set_fan_mode` call, then auto-closes
 * after a brief confirm beat (issue #39) — a correction tap during the beat re-points
 * the pick and restarts it, and tapping the already-active mode commits nothing but
 * still closes. The minimum-runtime dropdown is a secondary setting on the same
 * screen: choosing a runtime emits the same event with the `number.set_value` call
 * but keeps the screen open (so you can set runtime *and* a fan mode in one visit;
 * closing on a native-select change would also be jarring). A runtime change is
 * ignored once a fan-mode pick has started the closing beat.
 */
@customElement('ecosee-fan-overlay')
export class EcoseeFanOverlay extends LitElement {
  /** The fan options + optional runtime selector, derived by the host from `hass`. */
  @property({ attribute: false }) model?: FanModel;
  /** The bound climate entity the emitted `set_fan_mode` call targets. */
  @property({ attribute: false }) entityId = '';
  /** The optimistically-chosen fan mode, set on tap so the segment fills before the
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

    /* Multi-speed layout (issue #44): past the device's two modes a horizontal pill
       gets cramped, so stack the segments into a proper N-way selector — a rounded
       cyan-outlined panel of full-width capsule segments, the active one filled. Each
       segment keeps the same fill/outline language, so a two-mode fan (the common
       case) is untouched. */
    .toggle.stacked {
      flex-direction: column;
      align-items: stretch;
      gap: 1.2cqw;
      width: 64cqw;
      max-width: 100%;
      border-radius: 9cqw;
    }
    .toggle.stacked .segment {
      min-width: 0;
      width: 100%;
      padding: 3cqw 4cqw;
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

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    if (this._closeTimer !== undefined) clearTimeout(this._closeTimer);
  }

  private _selectMode(option: FanOption): void {
    if (this._pending === option.fanMode) return; // already the settling pick — nothing to do
    // Tapping the current fan mode with no pick in flight: nothing to write, but
    // honour "nothing left to do" by closing anyway (issue #39).
    const noChange = this._pending === null && option.selected;
    this._pending = option.fanMode; // fill / hold the segment now (issue #38)
    if (!noChange) emitServiceCall(this, setFanModeCall(option.fanMode, this.entityId));
    this._closeTimer = reschedulePickerClose(this, this._closeTimer); // confirm beat, then close
  }

  private _onRuntimeChange(event: Event, runtime: MinRuntimeModel): void {
    if (this._pending !== null) return; // a fan-mode pick is settling — ignore
    const value = Number((event.target as HTMLSelectElement).value);
    if (!Number.isFinite(value) || value === runtime.value) return;
    emitServiceCall(this, setFanMinOnTimeCall(value, runtime.entityId));
  }

  override render(): TemplateResult | typeof nothing {
    const model = this.model;
    if (!model || !model.available) return nothing;
    // Two modes (the device's On / Auto) fit the horizontal pill; more than that
    // (a multi-speed fan: low / medium / high / …) would cram a stretched pill, so
    // stack them into a vertical N-way selector instead (issue #44).
    const stacked = model.options.length > 2;
    return html`
      <div class="fan">
        <h2 class="title">Fan Mode</h2>
        <div class="toggle ${stacked ? 'stacked' : ''}" role="group" aria-label="Fan Mode">
          ${model.options.map((option) => {
            // Once a pick is settling, the optimistic choice wins the fill;
            // otherwise it follows the entity's reported fan mode.
            const selected =
              this._pending !== null ? option.fanMode === this._pending : option.selected;
            return html`
              <button
                class="segment ${selected ? 'selected' : ''}"
                aria-pressed=${selected}
                @click=${() => this._selectMode(option)}
              >
                ${option.label}
              </button>
            `;
          })}
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
