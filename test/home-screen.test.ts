// @vitest-environment happy-dom
import { describe, it, expect, afterEach } from 'vitest';
// Side-effect import: registers <ecosee-home-screen> via @customElement.
import '../src/screens/home-screen';
import type { EcoseeHomeScreen, HomeActionDetail } from '../src/screens/home-screen';
import type { HomeView } from '../src/climate/home-view';

// Render tests for the Home Screen's setpoint ovals (issue #42): the device
// presents active setpoints as amber Heat / blue Cool ovals — two side by side in
// Heat / Cool (Auto), one centered in a single-setpoint mode — each a tap target
// that opens Temperature Adjust for its own setpoint. There is no combined range
// pill / Hold pill / Resume ✕ (ADR-0004).

function view(overrides: Partial<HomeView> = {}): HomeView {
  return {
    available: true,
    name: 'Living Room',
    currentTemp: 72,
    unit: '°F',
    humidity: null,
    equipment: null,
    mode: 'heat_cool',
    setpoints: { heat: 70, cool: 75 },
    weatherAvailable: false,
    weatherCondition: null,
    fanAvailable: false,
    airQuality: null,
    uvIndex: null,
    ...overrides,
  };
}

async function mount(v: HomeView): Promise<EcoseeHomeScreen> {
  const el = document.createElement('ecosee-home-screen') as EcoseeHomeScreen;
  el.view = v;
  document.body.appendChild(el);
  await el.updateComplete;
  return el;
}

function ovals(el: EcoseeHomeScreen): HTMLButtonElement[] {
  return [...el.shadowRoot!.querySelectorAll('.oval')] as HTMLButtonElement[];
}

function fanAffordance(el: EcoseeHomeScreen): HTMLButtonElement | null {
  return el.shadowRoot!.querySelector('.fan');
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('Home Screen setpoint ovals', () => {
  it('shows both ovals in Heat / Cool (Auto), heat left and cool right', async () => {
    const el = await mount(view({ mode: 'heat_cool', setpoints: { heat: 70, cool: 75 } }));
    const [heat, cool] = ovals(el);
    expect(heat.classList.contains('heat')).toBe(true);
    expect(heat.getAttribute('aria-label')).toBe('Adjust heat setpoint');
    expect(heat.textContent?.trim()).toBe('70');
    expect(cool.classList.contains('cool')).toBe(true);
    expect(cool.getAttribute('aria-label')).toBe('Adjust cool setpoint');
    expect(cool.textContent?.trim()).toBe('75');
  });

  it('shows only the amber heat oval, centered, in Heat-only', async () => {
    const el = await mount(view({ mode: 'heat', setpoints: { heat: 68, cool: null } }));
    const list = ovals(el);
    expect(list).toHaveLength(1);
    expect(list[0].classList.contains('heat')).toBe(true);
    expect(list[0].textContent?.trim()).toBe('68');
  });

  it('shows only the blue cool oval, centered, in Cool-only', async () => {
    const el = await mount(view({ mode: 'cool', setpoints: { heat: null, cool: 74 } }));
    const list = ovals(el);
    expect(list).toHaveLength(1);
    expect(list[0].classList.contains('cool')).toBe(true);
    expect(list[0].textContent?.trim()).toBe('74');
  });

  it('shows no ovals when there are no active setpoints (e.g. Off)', async () => {
    const el = await mount(view({ mode: 'off', setpoints: null }));
    expect(ovals(el)).toHaveLength(0);
  });

  it('has dropped the old combined range pill treatment', async () => {
    const el = await mount(view());
    // No pill container, no en-dash separator — the ovals fully replace it.
    expect(el.shadowRoot!.querySelector('.pill')).toBeNull();
    expect(el.shadowRoot!.querySelector('.dash')).toBeNull();
  });

  it('emits a temperature action carrying the tapped setpoint', async () => {
    const el = await mount(view({ mode: 'heat_cool', setpoints: { heat: 70, cool: 75 } }));
    const fired: HomeActionDetail[] = [];
    el.addEventListener('ecosee-action', (e) =>
      fired.push((e as CustomEvent<HomeActionDetail>).detail),
    );
    const [heat, cool] = ovals(el);

    heat.click();
    cool.click();

    expect(fired).toEqual([
      { action: 'temperature', setpoint: 'heat' },
      { action: 'temperature', setpoint: 'cool' },
    ]);
  });
});

// The top-row fan shortcut (issue #45): a fourth affordance beside weather / System
// Mode / menu, shown only when the entity exposes fan control, that opens the Fan
// sub-screen directly.
describe('Home Screen fan affordance', () => {
  it('shows the fan affordance in the top row when fan control is available', async () => {
    const el = await mount(view({ fanAvailable: true }));
    const fan = fanAffordance(el);
    expect(fan).not.toBeNull();
    expect(fan!.getAttribute('aria-label')).toBe('Fan');
    // It sits in the left shortcut cluster, alongside where weather lives.
    expect(fan!.closest('.top-left')).not.toBeNull();
  });

  it('hides the fan affordance when the entity exposes no fan control', async () => {
    const el = await mount(view({ fanAvailable: false }));
    expect(fanAffordance(el)).toBeNull();
  });

  it('emits a fan action when tapped', async () => {
    const el = await mount(view({ fanAvailable: true }));
    const fired: HomeActionDetail[] = [];
    el.addEventListener('ecosee-action', (e) =>
      fired.push((e as CustomEvent<HomeActionDetail>).detail),
    );

    fanAffordance(el)!.click();

    expect(fired).toEqual([{ action: 'fan', setpoint: undefined }]);
  });

  it('renders the fan affordance alongside the weather affordance without shifting the centered mode', async () => {
    const el = await mount(
      view({ fanAvailable: true, weatherAvailable: true, weatherCondition: 'sunny' }),
    );
    // Both left-cluster affordances present, mode indicator still centered (its own cell).
    const left = el.shadowRoot!.querySelector('.top-left')!;
    expect(left.querySelector('.weather')).not.toBeNull();
    expect(left.querySelector('.fan')).not.toBeNull();
    expect(el.shadowRoot!.querySelector('.mode')).not.toBeNull();
  });
});

// The optional UV-index gauge (design import): an arc meter at the foot of the
// cluster, backed by its own uv_index_entity and tinted by the reading's WHO band.
describe('Home Screen UV-index gauge', () => {
  it('hides the gauge when no UV index is available', async () => {
    const el = await mount(view({ uvIndex: null }));
    expect(el.shadowRoot!.querySelector('.uvi')).toBeNull();
  });

  it('shows the gauge with the band number, category, and level tint when present', async () => {
    const el = await mount(
      view({ uvIndex: { uvi: 7, category: 'High', level: 'high', fraction: 7 / 11 } }),
    );
    const gauge = el.shadowRoot!.querySelector('.uvi');
    expect(gauge).not.toBeNull();
    expect(gauge!.classList.contains('high')).toBe(true);
    expect(gauge!.getAttribute('part')).toBe('uv-index');
    expect(gauge!.querySelector('.num')?.textContent?.trim()).toBe('7');
    expect(gauge!.querySelector('.cat')?.textContent?.trim()).toBe('High');
  });

  it('fills the arc to the reading fraction of the scale', async () => {
    const el = await mount(
      view({ uvIndex: { uvi: 11, category: 'Extreme', level: 'extreme', fraction: 1 } }),
    );
    const arc = el.shadowRoot!.querySelector('.uvi .arc');
    // fraction 1 → full arc → dashoffset 0.
    expect(Number(arc!.getAttribute('stroke-dashoffset'))).toBeCloseTo(0);
  });
});
