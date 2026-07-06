import { describe, it, expect, beforeEach } from 'vitest';
import { page } from '@vitest/browser/context';

import '../../src/ecosee-card';
import type { EcoseeCard } from '../../src/ecosee-card';
import type { EcoseeHomeScreen } from '../../src/screens/home-screen';
import type { EcoseeTemperatureOverlay } from '../../src/overlays/temperature-overlay';
import type { HomeView } from '../../src/climate/home-view';
import type { TempAdjustModel } from '../../src/climate/temperature-adjust';
import { fakeHass, climateEntity } from '../helpers/fake-hass';

// Issue #85: the third Gecko-vs-Blink rendering divergence to ship. The jsdom
// guards (cross-browser-typography.test.ts, container-sizing.test.ts) only
// string-match CSS text, so they stay green while the actual Firefox render is
// broken. This suite runs in REAL headless Firefox (vitest browser mode,
// Playwright provider — see vitest.browser.config.ts) and asserts on boxes and
// pixels the engine actually computed.
//
// The verified #85 root cause: the reporter's Home Assistant frontend loads a
// webfont (a CDN Gotham, originally) whose hhea ascent/descent/lineGap are all
// ZERO. Blink falls back to the font's sane OS/2 typo metrics; Gecko synthesizes
// symmetric metrics (ascent = descent = ½em), which drops the text baseline to the
// MIDDLE of every line box. Digit ink (~0.7em cap height) then pokes ~0.2em
// above its line box: the Home Screen's gradient-clipped temperature loses the
// top band of every digit (paint is clipped to the border box), and the
// Temperature Adjust chip numeral rises into the glyph box above it.
//
// The @font-face below reproduces that mechanism deterministically: it declares a
// page-scope family named 'Montserrat' — the FIRST choice of the card's own default
// font stack now that Gotham is no longer requested (ADR-0008), the exact family a
// dashboard could still inject broken — whose metric overrides pin ascent =
// descent = 50%, the symmetric metrics Gecko synthesizes for zeroed hhea. No
// network, no proprietary font files. The local() chain covers macOS and Linux CI.
const BROKEN_FONT_CSS = `
@font-face {
  font-family: 'Montserrat';
  src: local('Helvetica Neue'), local('Arial'), local('Liberation Sans'), local('DejaVu Sans');
  ascent-override: 50%;
  descent-override: 50%;
  line-gap-override: 0%;
}`;

const HOME_VIEW: HomeView = {
  available: true,
  name: 'Thermostat',
  currentTemp: 75,
  unit: '°F',
  humidity: 60,
  equipment: null,
  mode: 'heat_cool',
  setpoints: { heat: 70, cool: 75 },
  weatherAvailable: false,
  fanAvailable: false,
  weatherCondition: null,
  airQuality: null,
  uvIndex: null,
};

const TEMP_ADJUST_MODEL: TempAdjustModel = {
  available: true,
  unit: '°F',
  mode: 'heat_cool',
  heat: { setpoint: 'heat', value: 70, min: 45, max: 90, step: 1 },
  cool: { setpoint: 'cool', value: 75, min: 55, max: 95, step: 1 },
  active: 'cool',
  minGap: 3,
};

/** Layout and paint have settled before we measure. */
function settled(): Promise<void> {
  return new Promise((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
  );
}

beforeEach(() => {
  document.body.innerHTML = '';
  document.body.style.margin = '0';
  document.body.style.background = '#0a0d10';
  document.head.querySelector('#broken-montserrat')?.remove();
});

/** Mount the full card bound to a heat/cool thermostat so the host-level fixes
 *  (the broken-font quarantine probe) participate, exactly as on a dashboard.
 *  With `brokenFont`, the page declares the degenerate-metrics 'Montserrat' that
 *  the card's own default stack then resolves — the #85 breakage, post-Gotham. */
async function mountCard(brokenFont = false): Promise<EcoseeCard> {
  if (brokenFont) {
    const style = document.createElement('style');
    style.id = 'broken-montserrat';
    style.textContent = BROKEN_FONT_CSS;
    document.head.appendChild(style);
  }
  const wrap = document.createElement('div');
  wrap.style.width = '460px';
  document.body.appendChild(wrap);

  const { hass } = fakeHass({
    entities: [
      climateEntity('heat_cool', {
        friendly_name: 'Thermostat',
        current_temperature: 75,
        current_humidity: 60,
        target_temp_high: 75,
        target_temp_low: 70,
        min_temp: 45,
        max_temp: 95,
        hvac_modes: ['heat', 'cool', 'heat_cool', 'off'],
      }),
    ],
  });
  const card = document.createElement('ecosee-card') as EcoseeCard;
  wrap.appendChild(card);
  card.setConfig({ type: 'custom:ecosee-card', entity: 'climate.t' });
  card.hass = hass;
  await card.updateComplete;
  // The quarantine probe re-runs once webfonts settle; wait for that pass.
  await document.fonts.ready;
  await settled();
  return card;
}

/** The numeral text baseline, measured by wrapping the chip's bare text node
 *  and dropping a zero-size inline-block probe into the same line box (an
 *  empty inline-block baseline-aligns its bottom edge to the line's baseline). */
function textBaseline(textNode: Node): number {
  const range = document.createRange();
  range.selectNodeContents(textNode);
  const span = document.createElement('span');
  range.surroundContents(span);
  const probe = document.createElement('span');
  probe.style.cssText = 'display:inline-block;width:0;height:0;';
  span.appendChild(probe);
  const baseline = probe.getBoundingClientRect().bottom;
  probe.remove();
  return baseline;
}

/** Ink ascent of `text` (px) for the computed font of `el`, from the engine's
 *  own canvas text metrics. */
function inkAscent(el: Element, text: string): number {
  const cs = getComputedStyle(el);
  const ctx = document.createElement('canvas').getContext('2d');
  if (!ctx) throw new Error('no 2d context');
  ctx.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
  return ctx.measureText(text).actualBoundingBoxAscent;
}

/** Count bright ("ink") pixels inside `rect` on a real screenshot of the test
 *  iframe. The canvas behind the number is near-black (#0a0d10), the digits
 *  are bright cyan, so a luminance threshold separates ink from background. */
async function countInk(rect: DOMRect): Promise<number> {
  const { base64 } = await page.screenshot({ base64: true });
  const blob = await (await fetch(`data:image/png;base64,${base64}`)).blob();
  const bitmap = await createImageBitmap(blob);
  const scale = bitmap.width / window.innerWidth;
  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('no 2d context');
  ctx.drawImage(bitmap, 0, 0);
  const x = Math.max(0, Math.floor(rect.left * scale));
  const y = Math.max(0, Math.floor(rect.top * scale));
  const w = Math.min(canvas.width - x, Math.ceil(rect.width * scale));
  const h = Math.min(canvas.height - y, Math.ceil(rect.height * scale));
  const data = ctx.getImageData(x, y, w, h).data;
  let ink = 0;
  for (let i = 0; i < data.length; i += 4) {
    if (Math.max(data[i], data[i + 1], data[i + 2]) > 60) ink++;
  }
  return ink;
}

/** Pixel-coverage ratio of the gradient-clipped temperature against a
 *  solid-fill control render of the same element: 1.0 means every digit ink
 *  pixel the solid fill paints is also painted by the gradient clip. A third
 *  capture with the digits hidden measures the neighboring ink (humidity line,
 *  setpoint pills) that the padded region unavoidably includes, and subtracts
 *  it — shared ink would otherwise dilute a partial erasure toward 1.0. */
async function gradientCoverage(screen: EcoseeHomeScreen): Promise<number> {
  const temp = screen.shadowRoot?.querySelector<HTMLElement>('.temp');
  expect(temp).toBeTruthy();
  // Ink may legitimately overhang the border box; expand the sampled region so
  // erased ascender/descender ink is caught, not cropped.
  const r = temp!.getBoundingClientRect();
  const pad = r.height * 0.35;
  const region = DOMRect.fromRect({
    x: r.left - pad,
    y: r.top - pad,
    width: r.width + 2 * pad,
    height: r.height + 2 * pad,
  });
  const gradientInk = await countInk(region);
  temp!.style.setProperty('background', 'none');
  temp!.style.setProperty('-webkit-text-fill-color', 'currentColor');
  await settled();
  const controlInk = await countInk(region);
  temp!.style.setProperty('visibility', 'hidden');
  await settled();
  const neighborInk = await countInk(region);
  temp!.style.removeProperty('visibility');
  temp!.style.removeProperty('background');
  temp!.style.removeProperty('-webkit-text-fill-color');
  expect(controlInk - neighborInk).toBeGreaterThan(0);
  return (gradientInk - neighborInk) / (controlInk - neighborInk);
}

/** Assert every setpoint chip stacks its glyph strictly above the numeral INK
 *  (not just the numeral's line box — with degenerate font metrics the ink
 *  rides above its box, which is exactly the #85 overlap). */
function expectChipsStackCleanly(overlay: EcoseeTemperatureOverlay): void {
  const chips = overlay.shadowRoot?.querySelectorAll<HTMLElement>('.chip');
  expect(chips?.length).toBe(2);
  for (const chip of chips!) {
    const label = chip.getAttribute('aria-label');
    const glyph = chip.querySelector<HTMLElement>('.glyph');
    expect(glyph, `${label}: glyph`).toBeTruthy();
    const glyphRect = glyph!.getBoundingClientRect();
    // Gecko must actually size the glyph box — a collapsed glyph would "pass"
    // the overlap check while rendering nothing.
    expect(glyphRect.height, `${label}: glyph height`).toBeGreaterThan(1);
    expect(glyphRect.width, `${label}: glyph width`).toBeGreaterThan(1);

    const text = [...chip.childNodes].find(
      (n) => n.nodeType === Node.TEXT_NODE && n.textContent?.trim(),
    );
    expect(text, `${label}: numeral text node`).toBeTruthy();
    // Read the numeral BEFORE textBaseline(): wrapping via surroundContents
    // splits the original text node empty, so a later read measures ''.
    const numeral = text!.textContent!.trim();
    const inkTop = textBaseline(text!) - inkAscent(chip, numeral);
    expect(
      inkTop,
      `${label}: numeral ink (top ${inkTop.toFixed(1)}) overlaps glyph (bottom ${glyphRect.bottom.toFixed(1)})`,
    ).toBeGreaterThanOrEqual(glyphRect.bottom - 0.5);
  }
}

describe('Gecko rendering parity — broken-metric webfont (issue #85)', () => {
  it('paints the full current-temperature digit ink', async () => {
    const card = await mountCard(true);
    const screen = card.shadowRoot?.querySelector<EcoseeHomeScreen>('ecosee-home-screen');
    expect(screen).toBeTruthy();
    await screen!.updateComplete;

    const coverage = await gradientCoverage(screen!);
    // Identical renders differ only in antialiasing between the two fills; the
    // #85 failure erases whole digit strokes (coverage well under 0.8).
    expect(coverage).toBeGreaterThanOrEqual(0.9);
  });

  it('keeps the temperature digits inside the humidity/setpoint column flow', async () => {
    const card = await mountCard(true);
    const screen = card.shadowRoot?.querySelector<EcoseeHomeScreen>('ecosee-home-screen');
    await screen!.updateComplete;
    const temp = screen!.shadowRoot?.querySelector<HTMLElement>('.temp');
    const hum = screen!.shadowRoot?.querySelector<HTMLElement>('.hum');
    expect(temp).toBeTruthy();
    expect(hum).toBeTruthy();
    // With mid-box baselines the digit ink rides ~0.28em above its box and
    // crashes into the humidity line above; with a sane resolved font the ink
    // stays at or below the humidity line's bottom.
    const digits = temp!.textContent!.trim();
    const digitInkTop = textBaseline(temp!.firstChild!) - inkAscent(temp!, digits);
    expect(
      digitInkTop,
      `digit ink top ${digitInkTop.toFixed(1)} overlaps humidity line`,
    ).toBeGreaterThanOrEqual(hum!.getBoundingClientRect().bottom - 1);
  });

  it('stacks each Temperature Adjust chip glyph cleanly above its numeral', async () => {
    const card = await mountCard(true);
    const screen = card.shadowRoot?.querySelector<EcoseeHomeScreen>('ecosee-home-screen');
    screen!.dispatchEvent(
      new CustomEvent('ecosee-action', {
        detail: { action: 'temperature' },
        bubbles: true,
        composed: true,
      }),
    );
    await card.updateComplete;
    await settled();
    const overlay = card.shadowRoot?.querySelector<EcoseeTemperatureOverlay>(
      'ecosee-temperature-overlay',
    );
    expect(overlay, 'temperature overlay open').toBeTruthy();
    await overlay!.updateComplete;
    expectChipsStackCleanly(overlay!);
  });

  it('leaves a healthy font stack untouched (no quarantine false positive)', async () => {
    const card = await mountCard();
    expect(card.style.getPropertyValue('--ecosee-font')).toBe('');
    const screen = card.shadowRoot?.querySelector<EcoseeHomeScreen>('ecosee-home-screen');
    await screen!.updateComplete;
    const coverage = await gradientCoverage(screen!);
    expect(coverage).toBeGreaterThanOrEqual(0.9);
  });

  it('registers the bundled Montserrat so a bare page still gets the Skin face (ADR-0007)', async () => {
    await mountCard();
    // The engine must be able to actually load the runtime-registered faces —
    // fonts.load() resolves the faces it matched; empty means none registered.
    const loaded = await document.fonts.load("200 42px 'ecosee Montserrat'");
    expect(loaded.length).toBeGreaterThan(0);
    expect(document.fonts.check("500 16px 'ecosee Montserrat'")).toBe(true);
  });
});

describe('Gecko rendering parity — sane system font (issue #85 gross guard)', () => {
  it('paints the full digit ink of the standalone Home Screen temperature', async () => {
    const screen = document.createElement('ecosee-home-screen') as EcoseeHomeScreen;
    screen.view = HOME_VIEW;
    document.body.appendChild(screen);
    await screen.updateComplete;
    await settled();
    const coverage = await gradientCoverage(screen);
    expect(coverage).toBeGreaterThanOrEqual(0.9);
  });

  it('stacks the standalone overlay chips cleanly', async () => {
    const overlay = document.createElement(
      'ecosee-temperature-overlay',
    ) as EcoseeTemperatureOverlay;
    overlay.model = TEMP_ADJUST_MODEL;
    overlay.entityId = 'climate.test';
    document.body.appendChild(overlay);
    await overlay.updateComplete;
    await settled();
    expectChipsStackCleanly(overlay);
  });
});
