// @vitest-environment happy-dom
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
// Side-effect import: register <ecosee-temperature-overlay> via @customElement.
import '../src/overlays/temperature-overlay';
import type { LitElement } from 'lit';
import { toTempAdjustModel } from '../src/climate/temperature-adjust';
import type { ServiceCall } from '../src/climate/service-call';
import { fakeHass, climateEntity } from './helpers/fake-hass';
import type { EcoseeCardConfig } from '../src/config';

// Interaction tests for the Temperature Adjust overlay's tap-to-dismiss contract
// (issue #93): a value-neutral tap on the selected value closes the overlay and
// writes nothing, while a scrub that changes the value and the ± nudges keep it
// open. Driven against the real element so the drag/tap discriminator in
// `_onScrubberUp` is exercised end to end. Only setPointerCapture is a no-op in
// happy-dom; the pointer event plumbing is otherwise real.

const config: EcoseeCardConfig = { type: 'custom:ecosee-card', entity: 'climate.t' };

/** A single-setpoint Heat model at `temp`°F on a whole-degree grid (45–92). */
function heatModel(temp = 68): ReturnType<typeof toTempAdjustModel> {
  const { hass } = fakeHass({
    entities: [
      climateEntity('heat', { temperature: temp, min_temp: 45, max_temp: 92, target_temp_step: 1 }),
    ],
  });
  return toTempAdjustModel(hass, config);
}

/** A `set_temperature` write to `temp`°F on `climate.t`. */
const setTemp = (temp: number) => ({
  domain: 'climate',
  service: 'set_temperature',
  data: { entity_id: 'climate.t', temperature: temp },
});

/** Push the trailing-debounce window past its edge so the pending write fires. */
const flushWrite = (): void => {
  vi.advanceTimersByTime(650);
};

type Overlay = LitElement & { model: unknown; entityId: string };

async function mount(): Promise<Overlay> {
  const el = document.createElement('ecosee-temperature-overlay') as Overlay;
  el.model = heatModel();
  el.entityId = 'climate.t';
  document.body.appendChild(el);
  await el.updateComplete;
  return el;
}

/** Record the events the overlay emits so a test can assert write + dismiss. */
function recordEvents(el: Element): { calls: ServiceCall[]; dismisses: number } {
  const record = { calls: [] as ServiceCall[], dismisses: 0 };
  el.addEventListener('ecosee-service-call', (e) =>
    record.calls.push((e as CustomEvent<{ call: ServiceCall }>).detail.call),
  );
  el.addEventListener('ecosee-overlay-dismiss', () => (record.dismisses += 1));
  return record;
}

/** Fire a pointer event carrying a screen-Y at the scrubber, returning the dispatched
 *  event so a test can inspect it (e.g. `defaultPrevented`). Pass `cancelable` when the
 *  test needs to observe whether a handler called `preventDefault`. */
function firePointer(
  el: Element,
  type: string,
  clientY: number,
  opts: { cancelable?: boolean } = {},
): PointerEvent {
  const event = new PointerEvent(type, {
    clientY,
    pointerId: 1,
    bubbles: true,
    composed: true,
    cancelable: opts.cancelable ?? false,
  });
  el.dispatchEvent(event);
  return event;
}

/** Dispatch the compatibility `click` that trails a pointer gesture — the event the
 *  tap-to-dismiss now rides (issue #112). happy-dom does not synthesize it from a
 *  pointerup, so tests fire it explicitly. */
function fireClick(el: Element): void {
  el.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));
}

const scrubberOf = (el: Overlay): HTMLElement =>
  el.shadowRoot!.querySelector('.scrubber') as HTMLElement;

const SET_69 = {
  domain: 'climate',
  service: 'set_temperature',
  data: { entity_id: 'climate.t', temperature: 69 },
};

beforeEach(() => {
  // Fake only the timer APIs the debounce/reconcile use; leave microtasks real so
  // Lit's `updateComplete` still resolves.
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
});

afterEach(() => {
  document.body.innerHTML = '';
  vi.useRealTimers();
});

describe('Temperature Adjust — tap-to-dismiss (issue #93)', () => {
  it('a value-neutral tap on the selected value dismisses the overlay and writes nothing', async () => {
    const el = await mount();
    const rec = recordEvents(el);
    const scrubber = scrubberOf(el);

    // Press and release without moving — a tap on the selected value bubble. The
    // dismiss rides the trailing `click`, not the `pointerup`, so the ghost click that
    // would reopen the overlay is consumed by the scrubber, not the Home button (#112).
    firePointer(scrubber, 'pointerdown', 100);
    firePointer(scrubber, 'pointerup', 100);
    fireClick(scrubber);

    expect(rec.dismisses).toBe(1);
    expect(rec.calls).toHaveLength(0); // the dismissing tap sends no setpoint write
  });

  it('a scrub that changes the value writes the setpoint and does NOT dismiss', async () => {
    const el = await mount();
    const rec = recordEvents(el);
    const scrubber = scrubberOf(el);

    // Drag DOWN 22px (one PX_PER_STEP) → +1 step (68 → 69, inverted #53).
    firePointer(scrubber, 'pointerdown', 100);
    firePointer(scrubber, 'pointermove', 122);
    firePointer(scrubber, 'pointerup', 122);
    fireClick(scrubber); // a click may trail the drag; a scrub must never dismiss

    expect(rec.calls).toHaveLength(0); // write is debounced, not fired on release
    flushWrite();
    expect(rec.calls).toEqual([SET_69]);
    expect(rec.dismisses).toBe(0);
  });

  it('a ± nudge changes the value but does NOT dismiss', async () => {
    const el = await mount();
    const rec = recordEvents(el);
    const inc = el.shadowRoot!.querySelector('button[aria-label="Increase"]') as HTMLButtonElement;

    inc.click();
    await el.updateComplete;

    flushWrite();
    expect(rec.calls).toEqual([SET_69]);
    expect(rec.dismisses).toBe(0);
  });

  it('a scrub that nets back to the start value neither writes nor dismisses (it is a scrub, not a tap)', async () => {
    const el = await mount();
    const rec = recordEvents(el);
    const scrubber = scrubberOf(el);

    firePointer(scrubber, 'pointerdown', 100);
    firePointer(scrubber, 'pointermove', 122); // 68 → 69
    firePointer(scrubber, 'pointermove', 100); // back to 68
    firePointer(scrubber, 'pointerup', 100);
    fireClick(scrubber); // moved during the gesture → not a tap, so no dismiss

    expect(rec.dismisses).toBe(0);
    expect(rec.calls).toHaveLength(0);
  });

  it('a pointercancel (browser-aborted gesture), not a tap, neither writes nor dismisses', async () => {
    const el = await mount();
    const rec = recordEvents(el);
    const scrubber = scrubberOf(el);

    // Same shape as a value-neutral tap, but the browser cancels the gesture — this
    // must NOT be read as a tap-to-dismiss, even if a stray click trails it.
    firePointer(scrubber, 'pointerdown', 100);
    firePointer(scrubber, 'pointercancel', 100);
    fireClick(scrubber);

    expect(rec.dismisses).toBe(0);
    expect(rec.calls).toHaveLength(0);
  });
});

// Ghost-click guard (issue #112, iOS redux): a value-neutral tap dismisses on the
// trailing `click` — like the ✕ and backdrop — NOT on `pointerup`. Closing on
// pointerup tore the overlay down before the gesture's ghost click, which then
// hit-tested the exposed Home Screen temperature button and reopened the overlay. The
// 0.8.1 fix (preventDefault on pointerdown to suppress the compat click) is not
// honored by iOS WebKit for touch, so the reopen persisted on the device; dismissing
// ON the click sidesteps the whole class — the click lands on the still-mounted
// scrubber, never the button underneath.
describe('Temperature Adjust — scrubber ghost-click guard (issue #112)', () => {
  it('does not dismiss on pointerup alone — the dismiss rides the trailing click', async () => {
    const el = await mount();
    const rec = recordEvents(el);
    const scrubber = scrubberOf(el);

    firePointer(scrubber, 'pointerdown', 100);
    firePointer(scrubber, 'pointerup', 100);
    expect(rec.dismisses).toBe(0); // still open until the click lands on the scrubber

    fireClick(scrubber);
    expect(rec.dismisses).toBe(1);
  });

  it('leaves the pointerdown default intact, so the tap still synthesizes its click', async () => {
    const el = await mount();
    // The click is now WANTED — it carries the dismiss — so pointerdown must NOT
    // preventDefault (the opposite of the 0.8.1 guard, which iOS ignored anyway).
    const down = firePointer(scrubberOf(el), 'pointerdown', 100, { cancelable: true });
    expect(down.defaultPrevented).toBe(false);
  });

  it('focuses the scrubber on pointerdown (preventScroll), so ↑/↓ keys work after a pointer scrub', async () => {
    const el = await mount();
    const scrubber = scrubberOf(el);
    firePointer(scrubber, 'pointerdown', 100);
    // Focus is retained for keyboard operability; `preventScroll` stops iOS from
    // scrolling the slider into view mid-scrub (the "display shifts up" report).
    expect(el.shadowRoot!.activeElement).toBe(scrubber);
  });
});

describe('Temperature Adjust — debounced write + optimistic hold', () => {
  const nudgeUp = async (el: Overlay): Promise<void> => {
    (el.shadowRoot!.querySelector('button[aria-label="Increase"]') as HTMLButtonElement).click();
    await el.updateComplete;
  };

  it('coalesces a rapid burst of nudges into a single write of the final value', async () => {
    const el = await mount();
    const rec = recordEvents(el);

    await nudgeUp(el); // 68 → 69
    await nudgeUp(el); // 69 → 70
    expect(rec.calls).toHaveLength(0); // nothing written mid-burst

    flushWrite();
    expect(rec.calls).toEqual([setTemp(70)]); // one call, latest value only
  });

  it('flushes the pending write when the overlay closes before the debounce fires', async () => {
    const el = await mount();
    const rec = recordEvents(el);

    await nudgeUp(el); // 68 → 69, write still pending
    el.remove(); // close before the debounce window elapses

    expect(rec.calls).toEqual([SET_69]); // the edit is not lost
  });

  it('holds the just-written value against an unrelated hass update that lacks it', async () => {
    const el = await mount();
    const rec = recordEvents(el);

    await nudgeUp(el); // 68 → 69
    flushWrite(); // write 69; now optimistically holding 69

    // An unrelated refresh recomputes the model still at the pre-write 68.
    el.model = heatModel(68);
    await el.updateComplete;

    // If the handle had snapped back to 68, the next nudge would write 69 again.
    await nudgeUp(el);
    flushWrite();
    expect(rec.calls).toEqual([setTemp(69), setTemp(70)]);
  });

  it('gives up the hold after the reconcile window and accepts the reported state', async () => {
    const el = await mount();
    const rec = recordEvents(el);

    await nudgeUp(el); // 68 → 69
    flushWrite(); // write 69; holding

    // The device rejected the write and someone/something set it to 60 instead.
    el.model = heatModel(60);
    await el.updateComplete;
    vi.advanceTimersByTime(4100); // past RECONCILE_MS → hold expires, accept reality (60)
    await el.updateComplete;

    // Nudging now builds on the accepted 60, proving the hold released.
    await nudgeUp(el);
    flushWrite();
    expect(rec.calls).toEqual([setTemp(69), setTemp(61)]);
  });
});
