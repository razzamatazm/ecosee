// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
// Side-effect import: registers <ecosee-standby-screen> via @customElement.
import '../src/screens/standby-screen';
import { formatClock } from '../src/screens/standby-screen';
import type { EcoseeStandbyScreen, StandbyView } from '../src/screens/standby-screen';

// The Standby Screen (issue #63): the device's dimmed idle display — condition
// glyph + outdoor temp on top, the large current temperature in the middle, and a
// live wall clock at the bottom, all white-on-black. It follows home-screen.ts:
// purely presentational, driven by an already-degraded view model, so an absent
// datum is simply hidden (ADR-0001 graceful degradation). The clock is the one
// exception — it is the device's own wall time, not hass-backed, so it always
// shows and ticks live.

function view(overrides: Partial<StandbyView> = {}): StandbyView {
  return {
    available: true,
    currentTemp: 72,
    unit: '°F',
    outdoorTemp: 58,
    weatherCondition: 'sunny',
    equipment: null,
    ...overrides,
  };
}

async function mount(v?: StandbyView): Promise<EcoseeStandbyScreen> {
  const el = document.createElement('ecosee-standby-screen') as EcoseeStandbyScreen;
  if (v) el.view = v;
  document.body.appendChild(el);
  await el.updateComplete;
  return el;
}

const current = (el: EcoseeStandbyScreen) => el.shadowRoot!.querySelector('.current');
const outdoor = (el: EcoseeStandbyScreen) => el.shadowRoot!.querySelector('.outdoor');
const clock = (el: EcoseeStandbyScreen) => el.shadowRoot!.querySelector('.clock');
const screenRoot = (el: EcoseeStandbyScreen) => el.shadowRoot!.querySelector('.screen')!;
const glowGroup = (el: EcoseeStandbyScreen) => el.shadowRoot!.querySelector('svg.shape .glow');
const srLabel = (el: EcoseeStandbyScreen) => el.shadowRoot!.querySelector('.sr-only');

beforeEach(() => {
  vi.useFakeTimers();
  // A fixed idle moment so the wall clock is deterministic across runs/timezones.
  vi.setSystemTime(new Date('2026-07-01T17:39:00'));
});

afterEach(() => {
  vi.useRealTimers();
  document.body.innerHTML = '';
});

describe('Standby Screen current temperature', () => {
  it('renders the large current temperature', async () => {
    const el = await mount(view({ currentTemp: 72, unit: '°F' }));
    expect(current(el)?.textContent?.trim()).toBe('72');
  });

  it('hides the current temperature when the entity is unavailable', async () => {
    const el = await mount(view({ available: false, currentTemp: null }));
    expect(current(el)?.textContent?.trim()).toBe('');
  });
});

describe('Standby Screen outdoor temperature', () => {
  it('renders the outdoor temp with the weather condition glyph when present', async () => {
    const el = await mount(view({ outdoorTemp: 58, weatherCondition: 'sunny' }));
    const row = outdoor(el);
    expect(row).not.toBeNull();
    expect(row!.querySelector('.glyph svg')).not.toBeNull();
    expect(row!.querySelector('.outdoor-temp')?.textContent?.trim()).toBe('58');
  });

  it('hides the outdoor row when the outdoor temp is absent', async () => {
    const el = await mount(view({ outdoorTemp: null }));
    expect(outdoor(el)).toBeNull();
  });

  it('shows the outdoor temp without a glyph when the condition is absent', async () => {
    const el = await mount(view({ outdoorTemp: 58, weatherCondition: null }));
    const row = outdoor(el);
    expect(row).not.toBeNull();
    expect(row!.querySelector('.glyph')).toBeNull();
    expect(row!.querySelector('.outdoor-temp')?.textContent?.trim()).toBe('58');
  });
});

describe('Standby Screen wall clock', () => {
  it('renders the current wall-clock time', async () => {
    const el = await mount(view());
    expect(clock(el)?.textContent?.trim()).toBe('5:39 PM');
  });

  it('shows the live clock even with no view model (it is not hass-backed)', async () => {
    const el = await mount();
    expect(clock(el)?.textContent?.trim()).toBe('5:39 PM');
  });

  it('updates the clock as time advances — a live clock, not a static timestamp', async () => {
    const el = await mount(view());
    expect(clock(el)?.textContent?.trim()).toBe('5:39 PM');

    // Advance two minutes: the self-updating interval re-reads the wall time.
    await vi.advanceTimersByTimeAsync(120_000);
    await el.updateComplete;

    expect(clock(el)?.textContent?.trim()).toBe('5:41 PM');
  });
});

describe('Standby Screen equipment edge glow (issue #90)', () => {
  // ADR-0009 supersedes ADR-0006's Home-Screen-only glow: the Standby Screen now
  // renders the same edge glow, keyed to the same equipment status. The glow group
  // is always drawn (renderShape({ glow: true })) and revealed/colored by the
  // equipment class on the `.screen` root — exactly the Home Screen's reveal chain,
  // mirrored here. These jsdom checks assert the structural reveal contract (the
  // class that lights the glow); the real computed reveal + dimming + color are
  // proven against a live engine in test/browser/standby-glow.test.ts.

  it('always renders the shared glow group so the reveal has something to light', async () => {
    const el = await mount(view({ equipment: 'idle' }));
    expect(glowGroup(el)).not.toBeNull();
    expect(glowGroup(el)!.querySelectorAll('path')).toHaveLength(3);
  });

  it('reveals the glow while cooling — the `.screen` root carries the cooling class', async () => {
    const el = await mount(view({ equipment: 'cooling' }));
    expect(screenRoot(el).classList.contains('cooling')).toBe(true);
    expect(screenRoot(el).classList.contains('heating')).toBe(false);
    expect(srLabel(el)?.textContent?.trim()).toBe('Cooling');
  });

  it('reveals the glow while heating — the `.screen` root carries the heating class', async () => {
    const el = await mount(view({ equipment: 'heating' }));
    expect(screenRoot(el).classList.contains('heating')).toBe(true);
    expect(screenRoot(el).classList.contains('cooling')).toBe(false);
    expect(srLabel(el)?.textContent?.trim()).toBe('Heating');
  });

  it('shows NO glow reveal while idle (no cooling/heating class — intentional, not a bug)', async () => {
    const el = await mount(view({ equipment: 'idle' }));
    expect(screenRoot(el).classList.contains('cooling')).toBe(false);
    expect(screenRoot(el).classList.contains('heating')).toBe(false);
  });

  it('shows NO glow reveal when equipment status is absent', async () => {
    const el = await mount(view({ equipment: null }));
    expect(screenRoot(el).classList.contains('cooling')).toBe(false);
    expect(screenRoot(el).classList.contains('heating')).toBe(false);
    expect(srLabel(el)).toBeNull();
  });
});

describe('formatClock', () => {
  it('formats a Date as a 12-hour wall clock with AM/PM', () => {
    expect(formatClock(new Date('2026-07-01T00:05:00'))).toBe('12:05 AM');
    expect(formatClock(new Date('2026-07-01T09:07:00'))).toBe('9:07 AM');
    expect(formatClock(new Date('2026-07-01T12:00:00'))).toBe('12:00 PM');
    expect(formatClock(new Date('2026-07-01T17:39:00'))).toBe('5:39 PM');
  });
});
