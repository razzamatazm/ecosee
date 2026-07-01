// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
// Side-effect imports: register the picker elements via @customElement.
import '../src/overlays/system-mode-overlay';
import '../src/overlays/comfort-setting-overlay';
import '../src/overlays/fan-overlay';
import type { LitElement } from 'lit';
import { toSystemModeModel } from '../src/climate/system-mode';
import { toComfortSettingModel } from '../src/climate/comfort-setting';
import { toFanModel } from '../src/climate/fan';
import { PICKER_CONFIRM_MS } from '../src/overlays/overlay-dismiss';
import type { ServiceCall } from '../src/climate/service-call';
import { fakeHass, climateEntity } from './helpers/fake-hass';
import type { EcoseeCardConfig } from '../src/config';
import type { HassEntityBase } from '../src/types/hass';

// Behaviour tests for the value pickers' shared selection contract (issues #38,
// #39): a tap moves the highlight *optimistically* (before the device echoes back),
// emits the write, then auto-closes after a brief confirm beat. Driven against the
// real elements so the local `_pending` state and the scheduled close are exercised
// end to end. Only setTimeout/clearTimeout are faked, leaving Lit's microtask-based
// `updateComplete` untouched.

const config: EcoseeCardConfig = { type: 'custom:ecosee-card', entity: 'climate.t' };

/** Mount a picker element with its model + target entity and wait for first render. */
async function mount<T extends LitElement>(el: T): Promise<T> {
  (el as unknown as { entityId: string }).entityId = 'climate.t';
  document.body.appendChild(el);
  await el.updateComplete;
  return el;
}

/** Record the events a picker emits so a test can assert the write + the auto-close. */
function recordEvents(el: Element): { calls: ServiceCall[]; dismisses: number } {
  const record = { calls: [] as ServiceCall[], dismisses: 0 };
  el.addEventListener('ecosee-service-call', (e) =>
    record.calls.push((e as CustomEvent<{ call: ServiceCall }>).detail.call),
  );
  el.addEventListener('ecosee-overlay-dismiss', () => (record.dismisses += 1));
  return record;
}

beforeEach(() => vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] }));
afterEach(() => {
  vi.useRealTimers();
  document.body.innerHTML = '';
});

describe('System Mode picker — optimistic select + auto-close', () => {
  // Currently Cool; Heat / Cool / Off available.
  function model(state = 'cool'): ReturnType<typeof toSystemModeModel> {
    const { hass } = fakeHass({
      entities: [climateEntity(state, { hvac_modes: ['off', 'heat', 'cool'] })],
    });
    return toSystemModeModel(hass, config);
  }

  it('moves the highlight to the tapped row immediately (before any echo) and emits the write', async () => {
    const el = document.createElement('ecosee-system-mode-overlay') as LitElement & {
      model: unknown;
    };
    el.model = model('cool');
    const rec = recordEvents(el);
    await mount(el);

    const options = [...el.shadowRoot!.querySelectorAll('.option')] as HTMLButtonElement[];
    const heat = options.find((o) => o.textContent?.trim() === 'Heat')!;
    const cool = options.find((o) => o.textContent?.trim() === 'Cool')!;
    expect(cool.classList.contains('selected')).toBe(true); // reported state

    heat.click();
    await el.updateComplete;

    // Highlight has moved optimistically — the model still reports Cool.
    expect(heat.classList.contains('selected')).toBe(true);
    expect(cool.classList.contains('selected')).toBe(false);
    expect(rec.calls).toEqual([
      {
        domain: 'climate',
        service: 'set_hvac_mode',
        data: { entity_id: 'climate.t', hvac_mode: 'heat' },
      },
    ]);
    expect(rec.dismisses).toBe(0); // not yet — the confirm beat is still running
  });

  it('auto-closes after the confirm beat', async () => {
    const el = document.createElement('ecosee-system-mode-overlay') as LitElement & {
      model: unknown;
    };
    el.model = model('cool');
    const rec = recordEvents(el);
    await mount(el);

    const heat = [...el.shadowRoot!.querySelectorAll('.option')].find(
      (o) => o.textContent?.trim() === 'Heat',
    ) as HTMLButtonElement;
    heat.click();

    vi.advanceTimersByTime(PICKER_CONFIRM_MS - 1);
    expect(rec.dismisses).toBe(0);
    vi.advanceTimersByTime(1);
    expect(rec.dismisses).toBe(1);
  });

  it('tapping the already-active row writes nothing but still closes (nothing left to do)', async () => {
    const el = document.createElement('ecosee-system-mode-overlay') as LitElement & {
      model: unknown;
    };
    el.model = model('cool');
    const rec = recordEvents(el);
    await mount(el);

    const cool = [...el.shadowRoot!.querySelectorAll('.option')].find(
      (o) => o.textContent?.trim() === 'Cool',
    ) as HTMLButtonElement;

    cool.click(); // the current mode — no redundant write…
    expect(rec.calls).toHaveLength(0);
    vi.advanceTimersByTime(PICKER_CONFIRM_MS); // …but the picker still closes
    expect(rec.dismisses).toBe(1);
  });

  it('a correction tap during the confirm beat re-points the pick and closes on the corrected value', async () => {
    const el = document.createElement('ecosee-system-mode-overlay') as LitElement & {
      model: unknown;
    };
    el.model = model('cool');
    const rec = recordEvents(el);
    await mount(el);

    const options = [...el.shadowRoot!.querySelectorAll('.option')] as HTMLButtonElement[];
    const heat = options.find((o) => o.textContent?.trim() === 'Heat')!;
    const off = options.find((o) => o.textContent?.trim() === 'Off')!;

    heat.click(); // mis-tap Heat
    vi.advanceTimersByTime(PICKER_CONFIRM_MS - 20); // …then correct before the beat elapses
    off.click();
    await el.updateComplete;

    // Both writes went out, in order; the highlight follows the correction.
    expect(rec.calls.map((c) => c.data!.hvac_mode)).toEqual(['heat', 'off']);
    expect(off.classList.contains('selected')).toBe(true);
    expect(heat.classList.contains('selected')).toBe(false);

    // The beat restarted at the correction, so the earlier deadline does not fire…
    vi.advanceTimersByTime(20);
    expect(rec.dismisses).toBe(0);
    // …it closes one full beat after the last tap.
    vi.advanceTimersByTime(PICKER_CONFIRM_MS - 20);
    expect(rec.dismisses).toBe(1);
  });
});

describe('Comfort Setting picker — optimistic select + auto-close', () => {
  it('moves the highlight, emits set_preset_mode, and auto-closes', async () => {
    const { hass } = fakeHass({
      entities: [
        climateEntity('heat', { preset_modes: ['home', 'away', 'sleep'], preset_mode: 'home' }),
      ],
    });
    const el = document.createElement('ecosee-comfort-setting-overlay') as LitElement & {
      model: unknown;
    };
    el.model = toComfortSettingModel(hass, config);
    const rec = recordEvents(el);
    await mount(el);

    const options = [...el.shadowRoot!.querySelectorAll('.option')] as HTMLButtonElement[];
    const home = options.find((o) => o.textContent?.includes('Home'))!;
    const away = options.find((o) => o.textContent?.includes('Away'))!;
    expect(home.classList.contains('selected')).toBe(true);

    away.click();
    await el.updateComplete;
    expect(away.classList.contains('selected')).toBe(true);
    expect(home.classList.contains('selected')).toBe(false);
    expect(rec.calls).toEqual([
      {
        domain: 'climate',
        service: 'set_preset_mode',
        data: { entity_id: 'climate.t', preset_mode: 'away' },
      },
    ]);

    vi.advanceTimersByTime(PICKER_CONFIRM_MS);
    expect(rec.dismisses).toBe(1);
  });
});

describe('Fan picker — mode selects-and-closes, runtime applies without closing', () => {
  function fanEntity(extra: Record<string, unknown> = {}): HassEntityBase {
    return climateEntity('heat', { fan_modes: ['on', 'auto'], fan_mode: 'auto', ...extra });
  }

  it('fills the tapped segment, emits set_fan_mode, and auto-closes', async () => {
    const { hass } = fakeHass({ entities: [fanEntity()] });
    const el = document.createElement('ecosee-fan-overlay') as LitElement & { model: unknown };
    el.model = toFanModel(hass, config);
    const rec = recordEvents(el);
    await mount(el);

    const segments = [...el.shadowRoot!.querySelectorAll('.segment')] as HTMLButtonElement[];
    const on = segments.find((s) => s.textContent?.trim() === 'On')!;
    const auto = segments.find((s) => s.textContent?.trim() === 'Auto')!;
    expect(auto.classList.contains('selected')).toBe(true);

    on.click();
    await el.updateComplete;
    expect(on.classList.contains('selected')).toBe(true);
    expect(auto.classList.contains('selected')).toBe(false);
    expect(rec.calls).toEqual([
      {
        domain: 'climate',
        service: 'set_fan_mode',
        data: { entity_id: 'climate.t', fan_mode: 'on' },
      },
    ]);

    vi.advanceTimersByTime(PICKER_CONFIRM_MS);
    expect(rec.dismisses).toBe(1);
  });

  it('applies a minimum-runtime change without closing the screen', async () => {
    // A configured fan_min_on_time number entity gives the runtime dropdown its data.
    const runtimeConfig: EcoseeCardConfig = { ...config, fan_min_on_time_entity: 'number.min' };
    const { hass } = fakeHass({
      entities: [
        fanEntity(),
        {
          entity_id: 'number.min',
          state: '0',
          attributes: { min: 0, max: 55, step: 5, unit_of_measurement: 'min' },
        },
      ],
    });
    const model = toFanModel(hass, runtimeConfig);
    const runtime = model.minRuntime;
    expect(runtime).not.toBeNull();

    const el = document.createElement('ecosee-fan-overlay') as LitElement & { model: unknown };
    el.model = model;
    const rec = recordEvents(el);
    await mount(el);

    const select = el.shadowRoot!.querySelector('.select-native') as HTMLSelectElement;
    select.value = String(runtime!.options.find((o) => !o.selected)!.value);
    select.dispatchEvent(new Event('change'));

    expect(rec.calls).toHaveLength(1); // the write went out
    vi.advanceTimersByTime(PICKER_CONFIRM_MS * 4);
    expect(rec.dismisses).toBe(0); // …but the screen stayed open
  });

  // Multi-speed layout (issue #44): the device's two modes keep the horizontal pill,
  // but a fan with more modes stacks them into an N-way selector rather than cramming
  // a stretched two-segment pill.
  it('keeps the horizontal pill for the two-mode On / Auto fan', async () => {
    const { hass } = fakeHass({ entities: [fanEntity()] });
    const el = document.createElement('ecosee-fan-overlay') as LitElement & { model: unknown };
    el.model = toFanModel(hass, config);
    await mount(el);

    const toggle = el.shadowRoot!.querySelector('.toggle')!;
    expect(toggle.classList.contains('stacked')).toBe(false);
  });

  it('stacks a multi-speed fan into an N-way selector, rendering every mode', async () => {
    const { hass } = fakeHass({
      entities: [
        fanEntity({ fan_modes: ['auto', 'on', 'low', 'medium', 'high'], fan_mode: 'medium' }),
      ],
    });
    const el = document.createElement('ecosee-fan-overlay') as LitElement & { model: unknown };
    el.model = toFanModel(hass, config);
    const rec = recordEvents(el);
    await mount(el);

    const toggle = el.shadowRoot!.querySelector('.toggle')!;
    expect(toggle.classList.contains('stacked')).toBe(true);

    const segments = [...el.shadowRoot!.querySelectorAll('.segment')] as HTMLButtonElement[];
    expect(segments.map((s) => s.textContent?.trim())).toEqual([
      'Auto',
      'On',
      'Low',
      'Medium',
      'High',
    ]);
    // Selection still works in the stacked layout: the current mode is filled, and a
    // tap on another emits its write.
    const medium = segments.find((s) => s.textContent?.trim() === 'Medium')!;
    const high = segments.find((s) => s.textContent?.trim() === 'High')!;
    expect(medium.classList.contains('selected')).toBe(true);

    high.click();
    await el.updateComplete;
    expect(high.classList.contains('selected')).toBe(true);
    expect(rec.calls).toEqual([
      {
        domain: 'climate',
        service: 'set_fan_mode',
        data: { entity_id: 'climate.t', fan_mode: 'high' },
      },
    ]);
  });
});
