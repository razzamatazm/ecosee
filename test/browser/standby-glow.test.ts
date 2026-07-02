import { describe, it, expect, beforeEach } from 'vitest';

import '../../src/screens/standby-screen';
import type { EcoseeStandbyScreen, StandbyView } from '../../src/screens/standby-screen';
import type { EquipmentStatus } from '../../src/climate/home-view';

// Issue #90 (a spec change superseding ADR-0006 via ADR-0009): the Equipment Status
// edge glow — previously Home-Screen-only — now also renders on the Standby Screen
// (the dimmed idle display) while cooling (blue) / heating (amber), nothing idle.
// The glow markup, reveal chain and currentColor coloring are shared with the Home
// Screen; the only Standby difference is a lower opacity that dims the glow into the
// standby palette.
//
// Like test/browser/equipment-glow.test.ts, this runs in REAL headless Firefox
// (vitest browser mode) because jsdom/happy-dom see the DOM tree but not paint —
// three Gecko-vs-Blink regressions (#35/#52, #74, #85) plus the #89 SVG-namespace
// glow regression all shipped past jsdom guards. Here the assertions are made
// against geometry and computed style the engine actually resolved: the glow must be
// a real SVG shape (non-empty getBBox), revealed (display: block), colored blue
// cooling / amber heating, dimmed (opacity < 1), and hidden while idle/absent.

const SVG_NS = 'http://www.w3.org/2000/svg';
const COOL = 'rgb(73, 182, 234)'; // --ecosee-cool default #49b6ea
const AMBER = 'rgb(243, 161, 60)'; // --ecosee-heat default #f3a13c
const DIM = '0.6'; // --ecosee-standby-glow-opacity default — dimmed for standby

function view(equipment: EquipmentStatus | null): StandbyView {
  return {
    available: true,
    currentTemp: 72,
    unit: '°F',
    outdoorTemp: 58,
    weatherCondition: 'sunny',
    equipment,
  };
}

/** Layout + paint settled before we measure. */
function settled(): Promise<void> {
  return new Promise((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
  );
}

async function mount(equipment: EquipmentStatus | null): Promise<EcoseeStandbyScreen> {
  const el = document.createElement('ecosee-standby-screen') as EcoseeStandbyScreen;
  // The screen sizes off --ecosee-base-size (normally set by <ecosee-card>); pin it
  // so the shape SVG has a definite box and the glow has real geometry to measure.
  el.style.setProperty('--ecosee-base-size', '460px');
  el.view = view(equipment);
  document.body.appendChild(el);
  await el.updateComplete;
  await settled();
  return el;
}

function glowGroup(el: EcoseeStandbyScreen): SVGGElement {
  return el.shadowRoot!.querySelector('svg.shape .glow') as SVGGElement;
}

beforeEach(() => {
  document.body.innerHTML = '';
  document.body.style.margin = '0';
});

describe('Equipment Status edge glow renders on the Standby Screen (issue #90)', () => {
  it('draws the glow as a real, non-empty SVG shape when cooling', async () => {
    const el = await mount('cooling');
    const paths = [...glowGroup(el).querySelectorAll('path')] as SVGPathElement[];
    expect(paths).toHaveLength(3);
    for (const p of paths) {
      // If these were XHTML `<path>` (the #89 bug), getBBox would not exist and the
      // element would paint nothing. Real SVG geometry proves it renders.
      expect(p.namespaceURI).toBe(SVG_NS);
      const box = p.getBBox();
      expect(box.width).toBeGreaterThan(0);
      expect(box.height).toBeGreaterThan(0);
    }
  });

  it('reveals a BLUE, dimmed glow while cooling', async () => {
    const el = await mount('cooling');
    const cs = getComputedStyle(glowGroup(el));
    expect(cs.display).toBe('block');
    expect(cs.color).toBe(COOL);
    // Dimmed for standby (ADR-0009): the glow is revealed at reduced opacity, the one
    // difference from the Home Screen's full-strength glow.
    expect(cs.opacity).toBe(DIM);
    const strokes = [...glowGroup(el).querySelectorAll('path')].map(
      (p) => getComputedStyle(p).stroke,
    );
    for (const s of strokes) expect(s).toBe(COOL); // stroke: currentColor
  });

  it('reveals an AMBER, dimmed glow while heating', async () => {
    const el = await mount('heating');
    const cs = getComputedStyle(glowGroup(el));
    expect(cs.display).toBe('block');
    expect(cs.color).toBe(AMBER);
    expect(cs.opacity).toBe(DIM);
    const strokes = [...glowGroup(el).querySelectorAll('path')].map(
      (p) => getComputedStyle(p).stroke,
    );
    for (const s of strokes) expect(s).toBe(AMBER);
  });

  it('shows NO glow while idle (intentional — same invariant as the Home Screen)', async () => {
    const el = await mount('idle');
    expect(getComputedStyle(glowGroup(el)).display).toBe('none');
  });

  it('shows NO glow when equipment status is absent', async () => {
    const el = await mount(null);
    expect(getComputedStyle(glowGroup(el)).display).toBe('none');
  });
});
