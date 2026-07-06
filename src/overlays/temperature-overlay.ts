import { LitElement, html, css, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { formatTemp } from '../climate/home-view';
import {
  nudge,
  scrub,
  selectSetpoint,
  scrubberWindow,
  setTemperatureCall,
  type Setpoint,
  type SetpointEdit,
  type TempAdjustModel,
} from '../climate/temperature-adjust';
import { icons } from '../icons';
import { emitServiceCall } from './service-call-event';
import { emitOverlayDismiss } from './overlay-dismiss';

/** Neighbors shown on each side of the selected value in the scrubber. */
const SCRUBBER_RADIUS = 2;

/** Vertical drag distance (px) that scrubs one step. Tuned for a wheel-like feel
 *  across the card's size range. */
const PX_PER_STEP = 22;

/** Trailing debounce before a change is written to the entity. A held ± button or
 *  a rapid burst of nudges coalesces into a single `set_temperature` call carrying
 *  the final value, instead of one write per step. This is what keeps cloud
 *  thermostats (Nest, ecobee) from rate-limiting the burst and reverting — the same
 *  "looks frozen" failure class as an under-minimum range. The bubble still tracks
 *  every step live; only the network write waits. */
const WRITE_DEBOUNCE_MS = 600;

/** How long to hold the user's just-written value on screen before deferring to
 *  incoming entity state. A slow-confirming (or rejecting) device would otherwise
 *  snap the handle back the instant any unrelated `hass` update recomputes the
 *  model with the not-yet-applied setpoint. If the device never confirms within
 *  this window we accept reality (the write was rejected — e.g. an invalid range). */
const RECONCILE_MS = 4000;

/** True when two models carry the same heat/cool setpoint values — the signal that
 *  the device has echoed a pending write and the optimistic hold can release. */
function sameSetpoints(a: TempAdjustModel, b: TempAdjustModel): boolean {
  return (a.heat?.value ?? null) === (b.heat?.value ?? null) &&
    (a.cool?.value ?? null) === (b.cool?.value ?? null);
}

/**
 * `<ecosee-temperature-overlay>` — the Temperature Adjust overlay's content
 * (slotted into <ecosee-overlay>). Laid out as the device is (see
 * docs/reference/temp-adjust-*.jpeg): a *vertical* value scrubber down the middle
 * with the selected setpoint in a gradient squircle bubble and higher values
 * above it, the ± nudge buttons stacked on the right (＋ above −), and the
 * setpoint chips stacked on the left (Cool above Heat) — one chip in Heat/Cool,
 * both in Heat / Cool (Auto), where a chip picks which setpoint the scrubber
 * edits. Tinted per the active setpoint — blue for Cool, warm amber for Heat
 * (visual-spec.md).
 *
 * Unlike the purely presentational <ecosee-home-screen> (which only renders the
 * card-owned `.view`), this is an interactive editor, so it owns the transient
 * edit state locally: it seeds `_edit` once from `model`, advances it through the
 * pure reducers in `temperature-adjust.ts`, and emits the shared `ecosee-service-call`
 * with the `climate.set_temperature` call so the host card writes the setpoint.
 * Each ± nudge commits immediately; a drag tracks the finger live but commits
 * once on release. There is no separate Apply step (and no hold-duration prompt,
 * ADR-0003). A value-neutral *tap* on the selected value (a press/release that
 * never moved it) dismisses the overlay without writing — matching the device —
 * while a scrub or a ± nudge, which change the value, keep it open (#93).
 */
@customElement('ecosee-temperature-overlay')
export class EcoseeTemperatureOverlay extends LitElement {
  /** Initial model, built by the host card from `hass` (read once on open). */
  @property({ attribute: false }) model?: TempAdjustModel;
  /** The bound entity the emitted `set_temperature` call targets. */
  @property({ attribute: false }) entityId = '';
  @state() private _edit?: TempAdjustModel;

  static override styles = css`
    :host {
      display: block;
      width: 100%;
      height: 100%;
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

    /* The overlay shell makes slotted content pointer-transparent so empty areas
       dismiss; our actual controls opt back in. Chips that aren't switchable stay
       transparent (a single-mode chip is a label, not a button). */
    .nudge button,
    .scrubber,
    button.chip {
      pointer-events: auto;
    }

    /* Three columns: setpoint chips (left) | vertical scrubber (center) | ±
       nudge buttons (right). Chips and buttons are centered on the row so they
       sit level with the selected-value bubble at the scrubber's midpoint. An
       inline-size container so the children resolve cqw off this definite width;
       the root's OWN padding is in the fixed unit (calc · --ecosee-u), not cqw,
       because a container-type element resolves its own cqw against the viewport —
       which ballooned the padding and collapsed the content on wide windows (the
       actual issue #35 bug, in every browser, not a Gecko-only rescale). */
    .adjust {
      container-type: inline-size;
      box-sizing: border-box;
      width: var(--ecosee-base-size, 460px);
      height: var(--ecosee-base-size, 460px);
      padding: calc(8 * var(--ecosee-u, 4.6px)) calc(7 * var(--ecosee-u, 4.6px));
      display: grid;
      grid-template-columns: max-content 1fr max-content;
      align-items: center;
      gap: calc(3 * var(--ecosee-u, 4.6px));
    }

    /* ± nudge buttons (right), stacked ＋ over −, tinted to the active setpoint. */
    .nudge {
      grid-column: 3;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 14cqw;
    }
    .nudge button {
      width: 12cqw;
      height: 12cqw;
    }
    .adjust.cool .nudge button {
      color: var(--ecosee-cool, #49b6ea);
    }
    .adjust.heat .nudge button {
      color: var(--ecosee-heat, #f3a13c);
    }

    /* Vertical scrubber (center): higher values above the bubble, lower below.
       The 1fr/auto/1fr rows keep the bubble centered even when the value is near
       a bound and one side has fewer neighbors. */
    .scrubber {
      grid-column: 2;
      align-self: stretch;
      display: grid;
      grid-template-rows: 1fr auto 1fr;
      justify-items: center;
      gap: 3cqw;
      /* Drag-to-scrub surface: swipe vertically to change the value. */
      touch-action: none;
      cursor: ns-resize;
    }
    .scrubber:focus-visible {
      outline: 0.5cqw solid var(--ecosee-accent, #62cfe9);
      outline-offset: 1.5cqw;
      border-radius: 8cqw;
    }
    .stack {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 4cqw;
    }
    .stack.above {
      align-self: end;
    }
    .stack.below {
      align-self: start;
    }
    .neighbor {
      font-size: 11cqw;
      font-weight: 300;
      color: var(--ecosee-muted, #6f96a3);
      opacity: 0.85;
    }
    .neighbor.far {
      font-size: 9cqw;
      opacity: 0.5;
    }
    .bubble {
      width: 36cqw;
      height: 36cqw;
      border-radius: 28%;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-size: 22cqw;
      font-weight: 200;
      /* Thin light numeral, as on the device (not dark) — reads on both gradients. */
      color: var(--ecosee-fg, #d4eff9);
    }
    .adjust.cool .bubble {
      background: var(--ecosee-cool-grad, #49b6ea);
    }
    .adjust.heat .bubble {
      background: var(--ecosee-heat-grad, #f3a13c);
    }

    /* Setpoint chips (left): small circular pucks, glyph over value, stacked
       Cool over Heat. Selected = filled; unselected = outlined. */
    .chips {
      grid-column: 1;
      display: flex;
      flex-direction: column;
      gap: 5cqw;
    }
    .chip {
      display: inline-flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      /* Clearance between glyph box and numeral line box. The numeral's INK
         sits where the font's baseline puts it, and a broken-metric webfont
         can baseline at the middle of the line box (issue #85), floating the
         ink ~0.2em above the box — a hair's gap lets it crash into the glyph.
         1.2cqw (~0.17em of the 7cqw numeral) absorbs that drift while the
         glyph + gap + numeral column still fits the 15.6cqw content box. */
      gap: 1.2cqw;
      width: 17cqw;
      height: 17cqw;
      border-radius: 50%;
      font-size: 7cqw;
      font-weight: 500;
      line-height: 1;
      border: 0.7cqw solid transparent;
    }
    .chip .glyph {
      width: 7cqw;
      height: 7cqw;
      /* Keep the glyph its full size in the flex column — never let it shrink out
         of its box under the numeral (the other half of the cramped Firefox chip,
         issue #74). */
      flex: none;
    }
    /* Render the chip glyph as a block replaced element: an inline SVG's baseline
       strut (phantom descender leading) is reserved by Firefox but swallowed by
       Blink, so the glyph rendered taller than its box in Firefox/Zen and
       overlapped the setpoint number. Block layout removes the strut in every
       engine while the SVG still fills its 7cqw box (width/height 100%). See
       docs/adr/0005-cross-browser-typography.md. */
    .glyph svg {
      display: block;
      width: 100%;
      height: 100%;
    }
    .chip.cool {
      color: var(--ecosee-cool, #49b6ea);
      border-color: var(--ecosee-cool, #49b6ea);
    }
    .chip.heat {
      color: var(--ecosee-heat, #f3a13c);
      border-color: var(--ecosee-heat, #f3a13c);
    }
    .chip.cool.selected {
      background: var(--ecosee-cool, #49b6ea);
      color: var(--ecosee-bg, #0a0d10);
    }
    .chip.heat.selected {
      background: var(--ecosee-heat, #f3a13c);
      color: var(--ecosee-bg, #0a0d10);
    }
  `;

  /** In-progress drag: the pointer Y and active value at press, so each move maps
   *  the absolute travel from `startY` → a scrubbed value without drift. `moved`
   *  records whether the gesture ever changed the value, so release can tell a
   *  value-neutral *tap* (dismisses, #93) from a *scrub* that netted back to the
   *  start (stays open — a scrub is not a tap). */
  private _drag: { startY: number; startValue: number; moved: boolean } | null = null;

  /** Set on release when the just-finished gesture was a value-neutral *tap* (a
   *  press/release that never moved the value), so the trailing `click` dismisses
   *  the overlay. Dismissing on the *click* — not on `pointerup` — is what stops the
   *  gesture's ghost click from reopening the overlay: the ✕ and backdrop dismiss on
   *  click and never suffer this, because the click that would reopen is the same one
   *  that closed, and it hit-tests the scrubber (still mounted at click time), not the
   *  Home Screen temperature button (#112). Suppressing the compat click on
   *  `pointerdown` instead — the 0.8.1 approach — is not honored by iOS WebKit for
   *  touch, so the ghost click survived and the overlay reopened on the device. */
  private _tapToDismiss = false;

  /** The value we last wrote (or scheduled to write) and are waiting for the
   *  device to echo back. While set, incoming `model` updates that don't yet
   *  reflect it are held off (see `willUpdate`) so the handle doesn't snap back
   *  mid-interaction. Cleared once the device confirms or `RECONCILE_MS` elapses. */
  private _pending: TempAdjustModel | null = null;

  /** Trailing-debounce timer for the pending write (`WRITE_DEBOUNCE_MS`). */
  private _writeTimer: ReturnType<typeof setTimeout> | null = null;

  /** Give-up timer for the optimistic hold (`RECONCILE_MS`). */
  private _reconcileTimer: ReturnType<typeof setTimeout> | null = null;

  override willUpdate(changed: PropertyValues<this>): void {
    if (!changed.has('model') || !this.model) return;
    const incoming = this.model;
    // Never re-seed mid-drag: a `hass` refresh landing during a scrub would yank
    // the handle out from under the finger.
    if (this._drag) return;
    // Optimistic hold (#3): while a write is pending, ignore model updates that
    // still carry the pre-write setpoints — otherwise an unrelated `hass` refresh
    // (current temp, humidity, …) would recompute the model and snap the handle
    // back to the value the device hasn't applied yet. Re-seed once the device
    // confirms (setpoints match), if the system mode changed underneath us, or
    // when no write is in flight.
    const hold =
      this._pending !== null &&
      incoming.mode === this._pending.mode &&
      !sameSetpoints(incoming, this._pending);
    if (hold) return;
    this._edit = incoming;
    this._pending = null;
    this._clearReconcile();
  }

  /** Emit the `climate.set_temperature` call that writes the current edit. */
  private _emit(model: TempAdjustModel): void {
    const call = setTemperatureCall(model, this.entityId);
    if (!call) return;
    emitServiceCall(this, call);
  }

  /** A change (nudge / chip / scrub release): reflect it live, mark it pending so
   *  incoming state won't clobber it, and debounce the actual write so a burst
   *  coalesces into one call (#1). */
  private _commit(next: TempAdjustModel): void {
    this._edit = next;
    this._pending = next;
    if (this._writeTimer) clearTimeout(this._writeTimer);
    this._writeTimer = setTimeout(() => this._flushWrite(), WRITE_DEBOUNCE_MS);
  }

  /** Fire the debounced write and start the reconcile hold. */
  private _flushWrite(): void {
    this._writeTimer = null;
    if (this._edit) this._emit(this._edit);
    this._startReconcile();
  }

  private _startReconcile(): void {
    this._clearReconcile();
    this._reconcileTimer = setTimeout(() => {
      // The device never echoed our value (likely rejected the range) — stop
      // holding and defer to whatever the entity actually reports now.
      this._reconcileTimer = null;
      this._pending = null;
      if (this.model) {
        this._edit = this.model;
        this.requestUpdate();
      }
    }, RECONCILE_MS);
  }

  private _clearReconcile(): void {
    if (this._reconcileTimer) clearTimeout(this._reconcileTimer);
    this._reconcileTimer = null;
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    // Flush any pending write so closing the overlay right after a nudge still
    // commits it, then drop the timers — nothing left to reconcile once gone.
    if (this._writeTimer) {
      clearTimeout(this._writeTimer);
      this._writeTimer = null;
      if (this._edit) this._emit(this._edit);
    }
    this._clearReconcile();
    this._pending = null;
  }

  // Drag-to-scrub: the scrubber is a vertical wheel — drag DOWN to raise the
  // active setpoint, UP to lower it (inverted, #53; ~PX_PER_STEP px = one step).
  // The value tracks the finger live, but the service call fires once on release,
  // not per move.
  private _onScrubberDown = (event: PointerEvent): void => {
    const model = this._edit;
    const edit = model && model[model.active];
    if (!edit) return;
    // A fresh gesture: clear any leftover tap decision until this release classifies it.
    this._tapToDismiss = false;
    const el = event.currentTarget as HTMLElement;
    // Focus the slider so ↑/↓ keys work after a pointer scrub, but WITHOUT scrolling
    // it into view: on iOS a bare `el.focus()` scrolls the focused element to the top
    // of its scroll container, which shoved the whole card up inside Home Assistant's
    // more-info dialog mid-scrub (the "display shifts up" report). `preventScroll`
    // keeps the focus without the scroll. Pointer-initiated focus doesn't match
    // `:focus-visible`, so no focus ring appears on tap — only keyboard operability
    // is retained. No `preventDefault` here: the trailing compat `click` is now
    // wanted (a value-neutral tap dismisses ON it — see `_onScrubberClick`), and iOS
    // WebKit ignores pointerdown `preventDefault` for touch anyway.
    el.focus({ preventScroll: true });
    this._drag = { startY: event.clientY, startValue: edit.value, moved: false };
    el.setPointerCapture(event.pointerId);
  };

  private _onScrubberMove = (event: PointerEvent): void => {
    if (!this._drag || !this._edit) return;
    // Downward pointer travel (currentY − startY) raises the value; `scrub` owns
    // the (inverted) direction and the px → step mapping.
    this._edit = scrub(
      this._edit,
      this._drag.startValue,
      event.clientY - this._drag.startY,
      PX_PER_STEP,
    );
    // Latch once the value leaves its start — this gesture is a scrub, not a tap,
    // even if it later drags back to where it began.
    const edit = this._edit[this._edit.active];
    if (edit && edit.value !== this._drag.startValue) this._drag.moved = true;
  };

  private _onScrubberUp = (event: PointerEvent): void => {
    const drag = this._drag;
    if (!drag) return;
    this._drag = null;
    const el = event.currentTarget as HTMLElement;
    if (el.hasPointerCapture(event.pointerId)) el.releasePointerCapture(event.pointerId);
    // Commit only when the drag actually moved the value — a tap (or a drag that
    // nets back to where it started) must not write an unrequested setpoint.
    const edit = this._edit && this._edit[this._edit.active];
    if (this._edit && edit && edit.value !== drag.startValue) {
      this._commit(this._edit);
      return;
    }
    // Value-neutral: a real `pointerup` that never moved the value is a *tap*. Defer
    // the dismiss to the trailing `click` (see `_tapToDismiss` / `_onScrubberClick`)
    // rather than closing here — closing on `pointerup` is what let the ghost click
    // reopen the overlay from the Home Screen on iOS (#112). A `pointercancel` (the
    // browser aborting the gesture) or a scrub that netted back to start (`moved`) is
    // not a tap and produces no dismiss.
    this._tapToDismiss = event.type === 'pointerup' && !drag.moved;
  };

  // The tap's trailing `click`: a value-neutral tap on the selected value dismisses
  // here, matching the device and sending no setpoint write (#93). Dismissing on the
  // click (like the ✕ and backdrop) — not on `pointerup` — means the click that would
  // otherwise reopen the overlay is the same one that closes it, and it lands on the
  // still-mounted scrubber, never the Home Screen temperature button underneath
  // (#112). A scrub/nudge emits no dismiss: `_tapToDismiss` is only set for a genuine
  // stationary tap, so a click that trails a scrub is ignored.
  private _onScrubberClick = (): void => {
    if (!this._tapToDismiss) return;
    this._tapToDismiss = false;
    emitOverlayDismiss(this);
  };

  // Gesture lock: while a drag is in progress, cancel the native touch so a
  // vertical scrub can't trigger the page's pull-to-refresh (or scroll). The
  // `.scrubber` already sets `touch-action: none`, which handles well-behaved
  // browsers; some kiosk/Fire-tablet WebViews honor it inconsistently and still
  // pull-to-refresh mid-scrub. Cancelling `touchmove` defeats that regardless,
  // because the browser can only start pull-to-refresh from a touch we let run.
  // Attached non-passive (Lit options object) so `preventDefault` is honored, and
  // gated on `_drag` so taps and any non-scrub touch are untouched. `_drag` is set
  // on pointerdown, which precedes the first touchmove, so the very first move —
  // the one that would commit the browser to pull-to-refresh — is already cancelled.
  // App-level pull-to-refresh (Fully Kiosk's setting, the HA Companion app's native
  // swipe-refresh) lives outside the WebView and can't be reached from here; that's
  // a toggle in the app, not a card fix.
  private _onScrubberTouchMove = {
    handleEvent: (event: TouchEvent): void => {
      if (this._drag) event.preventDefault();
    },
    passive: false,
  };

  // Keyboard operation of the scrubber slider (operable without a pointer): ↑/→
  // raise, ↓/← lower the active setpoint by one step. This follows the ARIA slider
  // convention and the unchanged "higher values up" layout, so it intentionally
  // stays as-is rather than inverting with the drag gesture (#53).
  private _onScrubberKey = (event: KeyboardEvent): void => {
    const model = this._edit;
    if (!model) return;
    if (event.key === 'ArrowUp' || event.key === 'ArrowRight') {
      event.preventDefault();
      this._commit(nudge(model, 1));
    } else if (event.key === 'ArrowDown' || event.key === 'ArrowLeft') {
      event.preventDefault();
      this._commit(nudge(model, -1));
    }
  };

  override render(): TemplateResult | typeof nothing {
    const model = this._edit;
    if (!model || !model.available) return nothing;
    const edit = model[model.active];
    if (!edit) return nothing;

    return html`
      <div class="adjust ${model.active}">
        ${this._renderChips(model)} ${this._renderScrubber(model, edit)}
        <div class="nudge">
          <button aria-label="Increase" @click=${() => this._commit(nudge(model, 1))}>
            ${icons.plus}
          </button>
          <button aria-label="Decrease" @click=${() => this._commit(nudge(model, -1))}>
            ${icons.minus}
          </button>
        </div>
      </div>
    `;
  }

  private _renderScrubber(model: TempAdjustModel, edit: SetpointEdit): TemplateResult {
    const values = scrubberWindow(edit, SCRUBBER_RADIUS);
    // Higher values above the bubble, lower below — matching the device. Each
    // side runs nearest-the-bubble last so the columns read toward the center.
    const above = values.filter((v) => v > edit.value).reverse();
    const below = values.filter((v) => v < edit.value).reverse();
    // Neighbors are display-only context; the value is changed by dragging the
    // scrubber (or the ± buttons), as on the device.
    const neighbor = (value: number): TemplateResult => {
      const far = Math.abs(value - edit.value) > edit.step * 1.5;
      return html`<div class="neighbor ${far ? 'far' : ''}">${formatTemp(value, model.unit)}</div>`;
    };
    return html`
      <div
        class="scrubber"
        role="slider"
        tabindex="0"
        aria-label=${`${model.active === 'cool' ? 'Cool' : 'Heat'} setpoint`}
        aria-valuenow=${edit.value}
        aria-valuemin=${edit.min ?? nothing}
        aria-valuemax=${edit.max ?? nothing}
        aria-valuetext=${formatTemp(edit.value, model.unit)}
        @pointerdown=${this._onScrubberDown}
        @pointermove=${this._onScrubberMove}
        @pointerup=${this._onScrubberUp}
        @pointercancel=${this._onScrubberUp}
        @click=${this._onScrubberClick}
        @touchmove=${this._onScrubberTouchMove}
        @keydown=${this._onScrubberKey}
      >
        <div class="stack above">${above.map(neighbor)}</div>
        <div class="bubble">${formatTemp(edit.value, model.unit)}</div>
        <div class="stack below">${below.map(neighbor)}</div>
      </div>
    `;
  }

  private _renderChips(model: TempAdjustModel): TemplateResult {
    return html`
      <div class="chips">${this._renderChip(model, 'cool')} ${this._renderChip(model, 'heat')}</div>
    `;
  }

  private _renderChip(model: TempAdjustModel, setpoint: Setpoint): TemplateResult | typeof nothing {
    const edit = model[setpoint];
    if (!edit) return nothing;
    const selected = model.active === setpoint;
    const glyph = setpoint === 'cool' ? icons.snowflake : icons.heat;
    const label = `${setpoint === 'cool' ? 'Cool' : 'Heat'} setpoint`;
    // A chip is only a control when there is another setpoint to switch to.
    const switchable = model.heat !== null && model.cool !== null;
    const body = html`<span class="glyph">${glyph}</span>${formatTemp(edit.value, model.unit)}`;
    const cls = `chip ${setpoint} ${selected ? 'selected' : ''}`;
    return switchable
      ? html`<button
          class=${cls}
          aria-pressed=${selected}
          aria-label=${label}
          @click=${() => (this._edit = selectSetpoint(model, setpoint))}
        >
          ${body}
        </button>`
      : html`<div class=${cls} aria-label=${label}>${body}</div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'ecosee-temperature-overlay': EcoseeTemperatureOverlay;
  }
}
