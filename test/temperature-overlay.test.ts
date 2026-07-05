// @vitest-environment happy-dom
import { describe, it, expect, afterEach } from 'vitest';
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

/** A single-setpoint Heat model at 68°F on a whole-degree grid (45–92). */
function heatModel(): ReturnType<typeof toTempAdjustModel> {
  const { hass } = fakeHass({
    entities: [
      climateEntity('heat', { temperature: 68, min_temp: 45, max_temp: 92, target_temp_step: 1 }),
    ],
  });
  return toTempAdjustModel(hass, config);
}

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

const scrubberOf = (el: Overlay): HTMLElement =>
  el.shadowRoot!.querySelector('.scrubber') as HTMLElement;

const SET_69 = {
  domain: 'climate',
  service: 'set_temperature',
  data: { entity_id: 'climate.t', temperature: 69 },
};

afterEach(() => {
  document.body.innerHTML = '';
});

describe('Temperature Adjust — tap-to-dismiss (issue #93)', () => {
  it('a value-neutral tap on the selected value dismisses the overlay and writes nothing', async () => {
    const el = await mount();
    const rec = recordEvents(el);
    const scrubber = scrubberOf(el);

    // Press and release without moving — a tap on the selected value bubble.
    firePointer(scrubber, 'pointerdown', 100);
    firePointer(scrubber, 'pointerup', 100);

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

    expect(rec.calls).toEqual([SET_69]);
    expect(rec.dismisses).toBe(0);
  });

  it('a ± nudge changes the value but does NOT dismiss', async () => {
    const el = await mount();
    const rec = recordEvents(el);
    const inc = el.shadowRoot!.querySelector('button[aria-label="Increase"]') as HTMLButtonElement;

    inc.click();
    await el.updateComplete;

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

    expect(rec.dismisses).toBe(0);
    expect(rec.calls).toHaveLength(0);
  });

  it('a pointercancel (browser-aborted gesture), not a tap, neither writes nor dismisses', async () => {
    const el = await mount();
    const rec = recordEvents(el);
    const scrubber = scrubberOf(el);

    // Same shape as a value-neutral tap, but the browser cancels the gesture — this
    // must NOT be read as a tap-to-dismiss.
    firePointer(scrubber, 'pointerdown', 100);
    firePointer(scrubber, 'pointercancel', 100);

    expect(rec.dismisses).toBe(0);
    expect(rec.calls).toHaveLength(0);
  });
});

// Ghost-click guard (issue #112): the scrubber dismisses on `pointerup`, so the
// gesture's trailing compatibility `click` is unwanted — left alone it lands on the
// Home Screen temperature button exposed once the overlay closes and re-opens it.
// `_onScrubberDown` suppresses that click with preventDefault, then restores the focus
// preventDefault would otherwise strip so keyboard adjustment stays reachable.
describe('Temperature Adjust — scrubber ghost-click guard (issue #112)', () => {
  it('preventDefaults the scrubber pointerdown so the tap synthesizes no ghost click', async () => {
    const el = await mount();
    const down = firePointer(scrubberOf(el), 'pointerdown', 100, { cancelable: true });
    expect(down.defaultPrevented).toBe(true);
  });

  it('still focuses the scrubber on pointerdown, so ↑/↓ keys work after a pointer scrub', async () => {
    const el = await mount();
    const scrubber = scrubberOf(el);
    firePointer(scrubber, 'pointerdown', 100);
    expect(el.shadowRoot!.activeElement).toBe(scrubber);
  });
});
