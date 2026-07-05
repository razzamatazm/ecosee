import { describe, it, expect, beforeEach } from 'vitest';

import '../../src/overlays/overlay-shell';
import type { EcoseeOverlay } from '../../src/overlays/overlay-shell';
import type { EquipmentStatus } from '../../src/climate/home-view';

// ADR-0011 (from the owner's report): the Equipment Status edge glow — already on the
// Home Screen (ADR-0006) and Standby Screen (ADR-0009) — now also renders on the shared
// Overlay shell, so the "system is running" cue persists while an Overlay covers the
// Home Screen (the shell's opaque canvas otherwise hides the Home Screen's glow). Unlike
// the dimmed Standby glow, the overlay is a bright active surface, so it uses the Home
// Screen's FULL-strength glow (opacity 1).
//
// Like the other browser/*-glow tests, this runs in REAL headless Firefox (vitest
// browser mode) because happy-dom sees the DOM tree but not paint. Assertions are made
// against geometry and computed style the engine actually resolved: the glow must be a
// real SVG shape (non-empty getBBox), revealed (display: block), colored blue cooling /
// amber heating at full strength, and hidden while idle/absent.

const SVG_NS = 'http://www.w3.org/2000/svg';
const COOL = 'rgb(73, 182, 234)'; // --ecosee-cool default #49b6ea
const AMBER = 'rgb(243, 161, 60)'; // --ecosee-heat default #f3a13c

/** Layout + paint settled before we measure. */
function settled(): Promise<void> {
  return new Promise((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
  );
}

async function mount(equipment: EquipmentStatus | null): Promise<EcoseeOverlay> {
  const el = document.createElement('ecosee-overlay') as EcoseeOverlay;
  // The shell sizes off --ecosee-base-size (normally set by <ecosee-card>); pin it so
  // the shape SVG has a definite box and the glow has real geometry to measure.
  el.style.setProperty('--ecosee-base-size', '460px');
  el.innerHTML = '<div>content</div>';
  el.equipment = equipment;
  document.body.appendChild(el);
  await el.updateComplete;
  await settled();
  return el;
}

function glowGroup(el: EcoseeOverlay): SVGGElement {
  return el.shadowRoot!.querySelector('svg.shape .glow') as SVGGElement;
}

beforeEach(() => {
  document.body.innerHTML = '';
  document.body.style.margin = '0';
});

describe('Equipment Status edge glow renders on the Overlay shell (ADR-0011)', () => {
  it('draws the glow as a real, non-empty SVG shape when cooling', async () => {
    const el = await mount('cooling');
    const paths = [...glowGroup(el).querySelectorAll('path')] as SVGPathElement[];
    expect(paths).toHaveLength(3);
    for (const p of paths) {
      expect(p.namespaceURI).toBe(SVG_NS);
      const box = p.getBBox();
      expect(box.width).toBeGreaterThan(0);
      expect(box.height).toBeGreaterThan(0);
    }
  });

  it('reveals a BLUE, full-strength glow while cooling', async () => {
    const el = await mount('cooling');
    const cs = getComputedStyle(glowGroup(el));
    expect(cs.display).toBe('block');
    expect(cs.color).toBe(COOL);
    // NOT dimmed — the overlay is a bright active surface, so it matches the Home
    // Screen's full-strength glow rather than the Standby Screen's dimmed one.
    expect(cs.opacity).toBe('1');
    const strokes = [...glowGroup(el).querySelectorAll('path')].map(
      (p) => getComputedStyle(p).stroke,
    );
    for (const s of strokes) expect(s).toBe(COOL); // stroke: currentColor
  });

  it('reveals an AMBER, full-strength glow while heating', async () => {
    const el = await mount('heating');
    const cs = getComputedStyle(glowGroup(el));
    expect(cs.display).toBe('block');
    expect(cs.color).toBe(AMBER);
    expect(cs.opacity).toBe('1');
    const strokes = [...glowGroup(el).querySelectorAll('path')].map(
      (p) => getComputedStyle(p).stroke,
    );
    for (const s of strokes) expect(s).toBe(AMBER);
  });

  it('shows NO glow while idle (same invariant as the Home and Standby screens)', async () => {
    const el = await mount('idle');
    expect(getComputedStyle(glowGroup(el)).display).toBe('none');
  });

  it('shows NO glow when equipment status is absent', async () => {
    const el = await mount(null);
    expect(getComputedStyle(glowGroup(el)).display).toBe('none');
  });
});
