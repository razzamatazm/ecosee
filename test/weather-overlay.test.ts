// @vitest-environment happy-dom
import { describe, it, expect, afterEach } from 'vitest';
// Side-effect import registers <ecosee-weather-overlay> via @customElement.
import '../src/overlays/weather-overlay';
import type { EcoseeWeatherOverlay } from '../src/overlays/weather-overlay';
import type { WeatherModel } from '../src/weather/weather';

// Render tests for the presentational Weather Overlay — the seam the pure
// `toWeatherModel` tests can't reach. They mount the real element with a fixed
// model and assert the DOM the QA issues are about: natural per-condition glyph
// color (#31), no "PoP" jargon (#32), and a legible labeled low (#33).

const MODEL: WeatherModel = {
  available: true,
  unit: '°F',
  attribution: 'Apple Weather',
  current: {
    condition: 'sunny',
    conditionLabel: 'Sunny',
    temp: 75,
    humidity: 52,
    pop: 5,
    asOf: null,
    periods: [],
  },
  forecast: [
    { datetime: '2026-06-30', condition: 'sunny', high: 76, low: 59, pop: 0 },
    { datetime: '2026-07-01', condition: 'rainy', high: 68, low: 55, pop: 80 },
    { datetime: '2026-07-02', condition: 'cloudy', high: 72, low: 57, pop: 20 },
    { datetime: '2026-07-03', condition: 'snowy', high: 34, low: 28, pop: 90 },
  ],
};

async function mount(model: WeatherModel): Promise<EcoseeWeatherOverlay> {
  const el = document.createElement('ecosee-weather-overlay') as EcoseeWeatherOverlay;
  el.model = model;
  document.body.appendChild(el);
  await el.updateComplete;
  return el;
}

/** Flip to page 2 (the 4-day forecast) via the pager's Next button. */
async function toForecast(el: EcoseeWeatherOverlay): Promise<void> {
  const next = el.shadowRoot!.querySelector('button[aria-label="Next page"]') as HTMLButtonElement;
  next.click();
  await el.updateComplete;
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('weather overlay — condition glyph color (#31)', () => {
  it('tints the current-conditions glyph with the per-condition color, not one flat color', async () => {
    const el = await mount(MODEL);
    const glyph = el.shadowRoot!.querySelector('.current-main .glyph') as HTMLElement;
    // sunny → the sun token (warm yellow), applied inline so it varies per condition.
    // Read the raw attribute: a `var()` color doesn't survive the parsed `.style.color`.
    expect(glyph.getAttribute('style')).toContain('--ecosee-weather-sun');
  });

  it('gives each forecast day its own condition color', async () => {
    const el = await mount(MODEL);
    await toForecast(el);
    // Direct child only — `.day-pop` also has a (`.glyph`) umbrella we don't tint.
    const glyphs = [...el.shadowRoot!.querySelectorAll('.day > .glyph')] as HTMLElement[];
    const colors = glyphs.map((g) => g.getAttribute('style') ?? '');
    // sunny / rainy / cloudy / snowy must not collapse to a single flat accent.
    expect(colors[0]).toContain('--ecosee-weather-sun');
    expect(colors[1]).toContain('--ecosee-weather-rain');
    expect(colors[2]).toContain('--ecosee-weather-cloud');
    expect(colors[3]).toContain('--ecosee-weather-snow');
    expect(new Set(colors).size).toBe(4);
  });
});

describe('weather overlay — precipitation label (#32)', () => {
  it('shows the chance of precip as an umbrella glyph + %, never the "PoP" jargon', async () => {
    const el = await mount(MODEL);
    await toForecast(el);
    const pop = el.shadowRoot!.querySelector('.day-pop') as HTMLElement;
    expect(pop.textContent).toContain('0%');
    expect(pop.textContent).not.toContain('PoP');
    // The umbrella carries the meaning in the narrow column.
    expect(pop.querySelector('svg')).not.toBeNull();
    // And the page-1 stat likewise drops the jargon.
    expect(el.shadowRoot!.textContent).not.toContain('PoP');
  });
});

describe('weather overlay — legible daily low (#33)', () => {
  it('labels the low "Lo …" rather than the section-heading-like "Night …"', async () => {
    const el = await mount(MODEL);
    await toForecast(el);
    const low = el.shadowRoot!.querySelector('.day-low') as HTMLElement;
    expect(low.textContent?.trim()).toBe('Lo 59');
    expect(el.shadowRoot!.textContent).not.toContain('Night');
  });
});
