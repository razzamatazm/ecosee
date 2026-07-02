import { describe, it, expect, beforeEach } from 'vitest';

import '../../src/screens/home-screen';
import type { EcoseeHomeScreen } from '../../src/screens/home-screen';
import type { HomeView, EquipmentStatus } from '../../src/climate/home-view';

// Issue #89: the Equipment Status edge glow never rendered on the Home Screen
// while heating or cooling — in BOTH Chrome and Firefox. Root cause: the #76
// silhouette extraction split the glow group + its clipPath out of the outer
// `<svg>` template into nested Lit `html` fragments, which Lit parses in the
// XHTML namespace. The browser then treats `<g>`/`<path>`/`<clipPath>` as inert
// unknown HTML inside the SVG and paints nothing. The reveal CSS keyed to the
// `.screen.cooling` / `.screen.heating` class was fine all along.
//
// The jsdom/happy-dom guards only see the DOM tree, not paint, and three
// Gecko-vs-Blink regressions (#35/#52, #74, #85) shipped that way. This suite
// runs in REAL headless Firefox (vitest browser mode) so the assertions are made
// against geometry and computed style the engine actually resolved: the glow must
// be a real SVG shape (non-empty getBBox), revealed (display: block) and colored
// blue while cooling / amber while heating, and hidden while idle.

const SVG_NS = 'http://www.w3.org/2000/svg';
const COOL = 'rgb(73, 182, 234)'; // --ecosee-cool default #49b6ea
const AMBER = 'rgb(243, 161, 60)'; // --ecosee-heat default #f3a13c

function view(equipment: EquipmentStatus | null): HomeView {
  return {
    available: true,
    name: 'Thermostat',
    currentTemp: 72,
    unit: '°F',
    humidity: 40,
    equipment,
    mode: 'heat_cool',
    setpoints: { heat: 70, cool: 75 },
    weatherAvailable: false,
    weatherCondition: null,
    fanAvailable: false,
    airQuality: null,
    uvIndex: null,
  };
}

/** Layout + paint settled before we measure. */
function settled(): Promise<void> {
  return new Promise((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
  );
}

async function mount(equipment: EquipmentStatus | null): Promise<EcoseeHomeScreen> {
  const el = document.createElement('ecosee-home-screen') as EcoseeHomeScreen;
  // The screen sizes off --ecosee-base-size (normally set by <ecosee-card>); pin it
  // so the shape SVG has a definite box and the glow has real geometry to measure.
  el.style.setProperty('--ecosee-base-size', '460px');
  el.view = view(equipment);
  document.body.appendChild(el);
  await el.updateComplete;
  await settled();
  return el;
}

function glowGroup(el: EcoseeHomeScreen): SVGGElement {
  return el.shadowRoot!.querySelector('svg.shape .glow') as SVGGElement;
}

beforeEach(() => {
  document.body.innerHTML = '';
  document.body.style.margin = '0';
});

describe('Equipment Status edge glow renders on the Home Screen (issue #89)', () => {
  it('draws the glow as a real, non-empty SVG shape when cooling', async () => {
    const el = await mount('cooling');
    const paths = [...glowGroup(el).querySelectorAll('path')] as SVGPathElement[];
    expect(paths).toHaveLength(3);
    for (const p of paths) {
      // If these were XHTML `<path>` (the bug), getBBox would not exist and the
      // element would paint nothing. Real SVG geometry proves it renders.
      expect(p.namespaceURI).toBe(SVG_NS);
      const box = p.getBBox();
      expect(box.width).toBeGreaterThan(0);
      expect(box.height).toBeGreaterThan(0);
    }
  });

  it('reveals a BLUE glow while cooling', async () => {
    const el = await mount('cooling');
    const cs = getComputedStyle(glowGroup(el));
    expect(cs.display).toBe('block');
    expect(cs.color).toBe(COOL);
    const strokes = [...glowGroup(el).querySelectorAll('path')].map(
      (p) => getComputedStyle(p).stroke,
    );
    for (const s of strokes) expect(s).toBe(COOL); // stroke: currentColor
  });

  it('reveals an AMBER glow while heating', async () => {
    const el = await mount('heating');
    const cs = getComputedStyle(glowGroup(el));
    expect(cs.display).toBe('block');
    expect(cs.color).toBe(AMBER);
    const strokes = [...glowGroup(el).querySelectorAll('path')].map(
      (p) => getComputedStyle(p).stroke,
    );
    for (const s of strokes) expect(s).toBe(AMBER);
  });

  it('shows NO glow while idle (intentional — not a bug)', async () => {
    const el = await mount('idle');
    expect(getComputedStyle(glowGroup(el)).display).toBe('none');
  });

  it('shows NO glow when equipment status is absent', async () => {
    const el = await mount(null);
    expect(getComputedStyle(glowGroup(el)).display).toBe('none');
  });
});
