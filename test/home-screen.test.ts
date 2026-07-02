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

// The top-row layout (issue #77): the affordance glyphs spread evenly across the
// row (not clustered left), with the middle glyph(s) RAISED — following the
// superellipse's top curve, which drops toward the corners. The System Mode
// indicator stays centered as the fan affordance appears/disappears, so a
// persistent left anchor holds the left corner even when neither weather nor fan
// is present. The `raised` class carries the vertical lift and is the seam here.
describe('Home Screen top-row layout', () => {
  function topChildClasses(el: EcoseeHomeScreen): string[] {
    // The layout order across the flattened flex row: the left cluster's contents
    // (weather/anchor, then fan) followed by the centered mode and the right menu.
    const top = el.shadowRoot!.querySelector('.top')!;
    const left = top.querySelector('.top-left')!;
    return [
      ...[...left.children].map((c) => c.className),
      ...[...top.children]
        .filter((c) => !c.classList.contains('top-left'))
        .map((c) => c.className),
    ];
  }

  it('raises the two middle glyphs (fan + System Mode) in the four-glyph case', async () => {
    const el = await mount(
      view({ weatherAvailable: true, weatherCondition: 'sunny', fanAvailable: true }),
    );
    const weather = el.shadowRoot!.querySelector('.weather')!;
    const fan = el.shadowRoot!.querySelector('.fan')!;
    const mode = el.shadowRoot!.querySelector('.mode')!;
    const menu = el.shadowRoot!.querySelector('.menu')!;
    // Corner glyphs stay on the baseline; the middle two are raised.
    expect(weather.classList.contains('raised')).toBe(false);
    expect(fan.classList.contains('raised')).toBe(true);
    expect(mode.classList.contains('raised')).toBe(true);
    expect(menu.classList.contains('raised')).toBe(false);
    // Left-to-right order across the spread row.
    expect(topChildClasses(el)).toEqual(['weather', 'fan raised', 'mode raised', 'menu']);
  });

  it('raises only the center System Mode indicator in the three-glyph case', async () => {
    const el = await mount(
      view({ weatherAvailable: true, weatherCondition: 'sunny', fanAvailable: false }),
    );
    expect(el.shadowRoot!.querySelector('.fan')).toBeNull();
    expect(el.shadowRoot!.querySelector('.weather')!.classList.contains('raised')).toBe(false);
    expect(el.shadowRoot!.querySelector('.mode')!.classList.contains('raised')).toBe(true);
    expect(el.shadowRoot!.querySelector('.menu')!.classList.contains('raised')).toBe(false);
    expect(topChildClasses(el)).toEqual(['weather', 'mode raised', 'menu']);
  });

  it('keeps a left anchor so the mode stays centered when neither weather nor fan is present', async () => {
    const el = await mount(view({ weatherAvailable: false, fanAvailable: false }));
    // No weather/fan, but a zero-width anchor holds the left corner so space-between
    // keeps the mode dead center rather than collapsing it to the left edge.
    expect(el.shadowRoot!.querySelector('.weather')).toBeNull();
    expect(el.shadowRoot!.querySelector('.fan')).toBeNull();
    expect(el.shadowRoot!.querySelector('.top-anchor')).not.toBeNull();
    expect(topChildClasses(el)).toEqual(['top-anchor', 'mode raised', 'menu']);
  });
});

// The optional UV-index gauge (design import): an arc meter at the foot of the
// cluster, backed by its own uv_index_entity and tinted by the reading's WHO band.
describe('Home Screen UV-index gauge', () => {
  it('hides the gauge when no UV index is available', async () => {
    const el = await mount(view({ uvIndex: null }));
    expect(el.shadowRoot!.querySelector('.uvi')).toBeNull();
  });

  it('shows the number and band tint with no visible category word when present', async () => {
    const el = await mount(
      view({ uvIndex: { uvi: 7, category: 'High', level: 'high', fraction: 7 / 11 } }),
    );
    const gauge = el.shadowRoot!.querySelector('.uvi');
    expect(gauge).not.toBeNull();
    // The band color still carries the severity.
    expect(gauge!.classList.contains('high')).toBe(true);
    expect(gauge!.getAttribute('part')).toBe('uv-index');
    expect(gauge!.querySelector('.num')?.textContent?.trim()).toBe('7');
    // The visible category word is gone (issue #91, mirroring #66).
    expect(gauge!.querySelector('.cat')).toBeNull();
  });

  it('keeps the category in an accessible label for screen readers', async () => {
    const el = await mount(
      view({ uvIndex: { uvi: 11, category: 'Extreme', level: 'extreme', fraction: 1 } }),
    );
    const sr = el.shadowRoot!.querySelector('.uvi .sr-only');
    // Not rendered as visible text, but still announced to assistive tech.
    expect(sr?.textContent).toContain('UV index: Extreme');
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

// The optional air-quality element (issue #10) simplified to just the glyph and
// number (issue #66): the color carries the severity band, so the visible category
// word is dropped — but the band stays announced via an accessible label.
describe('Home Screen air-quality element', () => {
  it('hides the element when no air quality is available', async () => {
    const el = await mount(view({ airQuality: null }));
    expect(el.shadowRoot!.querySelector('.aqi')).toBeNull();
  });

  it('shows the glyph and number with the band tint, and no visible category text', async () => {
    const el = await mount(view({ airQuality: { aqi: 42, category: 'Good', level: 'good' } }));
    const aqi = el.shadowRoot!.querySelector('.aqi');
    expect(aqi).not.toBeNull();
    expect(aqi!.classList.contains('good')).toBe(true);
    expect(aqi!.getAttribute('part')).toBe('air-quality');
    expect(aqi!.querySelector('.num')?.textContent?.trim()).toBe('42');
    // The visible category word is gone (issue #66).
    expect(aqi!.querySelector('.cat')).toBeNull();
  });

  it('keeps the category in an accessible label for screen readers', async () => {
    const el = await mount(
      view({
        airQuality: {
          aqi: 143,
          category: 'Unhealthy for Sensitive Groups',
          level: 'sensitive',
        },
      }),
    );
    const sr = el.shadowRoot!.querySelector('.aqi .sr-only');
    // Not rendered as visible text, but still announced to assistive tech.
    expect(sr?.textContent).toContain('Unhealthy for Sensitive Groups');
  });
});

// The foot cluster (issue #75): the air-quality element and UV-index gauge share a
// single count-aware row. Both present → they sit side by side (so the taller gauge
// no longer stacks below and clips against the bottom squircle curve); only one
// present → that indicator is centered on its own, the same single-vs-both pattern
// the setpoint ovals already use.
describe('Home Screen foot cluster (air quality + UV index)', () => {
  const aq = { aqi: 42, category: 'Good', level: 'good' } as const;
  const uv = { uvi: 7, category: 'High', level: 'high', fraction: 7 / 11 } as const;

  it('renders no foot row when neither indicator is present', async () => {
    const el = await mount(view({ airQuality: null, uvIndex: null }));
    expect(el.shadowRoot!.querySelector('.foot')).toBeNull();
  });

  it('lays both indicators side by side in one foot row when both are present', async () => {
    const el = await mount(view({ airQuality: aq, uvIndex: uv }));
    const foot = el.shadowRoot!.querySelector('.foot');
    expect(foot).not.toBeNull();
    const aqi = el.shadowRoot!.querySelector('.aqi');
    const uvi = el.shadowRoot!.querySelector('.uvi');
    expect(aqi).not.toBeNull();
    expect(uvi).not.toBeNull();
    // Both share the single foot row (siblings), so they lay out side by side
    // rather than stacking one below the other.
    expect(aqi!.parentElement).toBe(foot);
    expect(uvi!.parentElement).toBe(foot);
  });

  it('centers the air-quality element alone in the foot row when it is the only indicator', async () => {
    const el = await mount(view({ airQuality: aq, uvIndex: null }));
    const foot = el.shadowRoot!.querySelector('.foot');
    expect(foot).not.toBeNull();
    expect(el.shadowRoot!.querySelector('.uvi')).toBeNull();
    expect(foot!.querySelector('.aqi')).not.toBeNull();
    expect(foot!.childElementCount).toBe(1);
  });

  it('centers the UV-index gauge alone in the foot row when it is the only indicator', async () => {
    const el = await mount(view({ airQuality: null, uvIndex: uv }));
    const foot = el.shadowRoot!.querySelector('.foot');
    expect(foot).not.toBeNull();
    expect(el.shadowRoot!.querySelector('.aqi')).toBeNull();
    expect(foot!.querySelector('.uvi')).not.toBeNull();
    expect(foot!.childElementCount).toBe(1);
  });
});
