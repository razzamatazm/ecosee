// @vitest-environment happy-dom
import { describe, it, expect, afterEach } from 'vitest';
import type { CSSResult } from 'lit';
// Side-effect imports: register the custom elements via @customElement.
import '../src/screens/home-screen';
import '../src/screens/standby-screen';
import '../src/overlays/overlay-shell';
import { EcoseeHomeScreen } from '../src/screens/home-screen';
import { EcoseeStandbyScreen } from '../src/screens/standby-screen';
import { EcoseeOverlay } from '../src/overlays/overlay-shell';
import { SQUIRCLE_PATH, shapeStyles } from '../src/styles/shape';
import type { HomeView } from '../src/climate/home-view';
import type { StandbyView } from '../src/screens/standby-screen';

const SVG_NS = 'http://www.w3.org/2000/svg';

// Regression guard for issue #76: the outer superellipse silhouette must be the
// SAME on every surface — the Home Screen, the Standby Screen, and every Overlay
// (all Overlays ride one shell). It used to live only on the Home Screen, so the
// Standby Screen and Overlays rendered as plain constant-radius rounded rectangles
// and the Card's outline changed shape as you moved between screens. These lock in
// the shared-shape contract so it can't drift back apart: every surface renders the
// shared `.shape` SVG whose fill traces SQUIRCLE_PATH, and no surface falls back to
// a `border-radius` rounded rect.

function homeView(overrides: Partial<HomeView> = {}): HomeView {
  return {
    available: true,
    name: 'Thermostat',
    currentTemp: 72,
    unit: '°F',
    humidity: null,
    equipment: null,
    mode: 'heat_cool',
    setpoints: { heat: 68, cool: 75 },
    weatherAvailable: false,
    weatherCondition: null,
    fanAvailable: false,
    airQuality: null,
    uvIndex: null,
    ...overrides,
  };
}

function standbyView(overrides: Partial<StandbyView> = {}): StandbyView {
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

async function mountHome(): Promise<EcoseeHomeScreen> {
  const el = document.createElement('ecosee-home-screen') as EcoseeHomeScreen;
  el.view = homeView();
  document.body.appendChild(el);
  await el.updateComplete;
  return el;
}

async function mountStandby(): Promise<EcoseeStandbyScreen> {
  const el = document.createElement('ecosee-standby-screen') as EcoseeStandbyScreen;
  el.view = standbyView();
  document.body.appendChild(el);
  await el.updateComplete;
  return el;
}

async function mountOverlay(): Promise<EcoseeOverlay> {
  const el = document.createElement('ecosee-overlay') as EcoseeOverlay;
  el.innerHTML = '<div>content</div>';
  document.body.appendChild(el);
  await el.updateComplete;
  return el;
}

// The `.shape` SVG's fill path, i.e. the actually-rendered outer silhouette.
function shapeFillPath(root: ParentNode): string | null {
  return root.querySelector('svg.shape path.fill')?.getAttribute('d') ?? null;
}

function cssTextOf(styles: CSSResult | CSSResult[]): string {
  return [styles].flat().map((s) => s.cssText).join('\n');
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('shared superellipse silhouette (issue #76)', () => {
  it('renders the shared shape fill on the Home Screen', async () => {
    const el = await mountHome();
    expect(shapeFillPath(el.shadowRoot!)).toBe(SQUIRCLE_PATH);
  });

  it('renders the shared shape fill on the Standby Screen', async () => {
    const el = await mountStandby();
    expect(shapeFillPath(el.shadowRoot!)).toBe(SQUIRCLE_PATH);
  });

  it('renders the shared shape fill on the Overlay shell (covers every Overlay)', async () => {
    const el = await mountOverlay();
    expect(shapeFillPath(el.shadowRoot!)).toBe(SQUIRCLE_PATH);
  });

  it('paints the near-black canvas fill through the shape, not a screen background', () => {
    // The shared module owns the canvas fill; it is keyed to --ecosee-bg so a token
    // override still recolors it (the issue: keep the canvas fill shared).
    expect(shapeStyles.cssText).toMatch(/\.fill\s*\{[^}]*fill:\s*var\(\s*--ecosee-bg/);
  });

  it('draws the equipment edge glow on the Home and Standby screens, not the Overlay shell (ADR-0009)', async () => {
    // ADR-0009 supersedes ADR-0006's Home-Screen-only glow: the Standby Screen now
    // shares the equipment glow too (it also has equipment state). The Overlay shell
    // has none — it shares the silhouette + canvas fill but never carries equipment.
    const [home, standby, overlay] = await Promise.all([
      mountHome(),
      mountStandby(),
      mountOverlay(),
    ]);
    expect(home.shadowRoot!.querySelector('svg.shape .glow')).not.toBeNull();
    expect(standby.shadowRoot!.querySelector('svg.shape .glow')).not.toBeNull();
    expect(overlay.shadowRoot!.querySelector('svg.shape .glow')).toBeNull();
  });

  it('renders the glow group + clip as REAL SVG elements, not XHTML (issue #89)', async () => {
    // Regression guard for #89: the glow group and its clipPath were split out of the
    // outer `<svg>` template into nested `html` fragments by the #76 extraction, so Lit
    // parsed them in the XHTML namespace. Browsers then treat `<g>`/`<path>`/`<clipPath>`
    // as inert unknown HTML inside the SVG and paint NO glow in any engine — the glow
    // never rendered while heating/cooling. They must live in the SVG namespace, exactly
    // like the always-SVG `.fill` path. The fix uses Lit's `svg` tag for those fragments.
    const el = await mountHome();
    const root = el.shadowRoot!;
    const fillNs = root.querySelector('svg.shape path.fill')!.namespaceURI;
    expect(fillNs).toBe(SVG_NS);

    const glow = root.querySelector('svg.shape .glow')!;
    expect(glow.namespaceURI).toBe(SVG_NS);

    const glowPaths = [...root.querySelectorAll('svg.shape .glow path')];
    expect(glowPaths).toHaveLength(3);
    for (const p of glowPaths) expect(p.namespaceURI).toBe(SVG_NS);

    const clipPath = root.querySelector('svg.shape clipPath')!;
    expect(clipPath.namespaceURI).toBe(SVG_NS);
    expect(clipPath.querySelector('path')!.namespaceURI).toBe(SVG_NS);
  });
});

describe('no surface falls back to a rounded-rectangle silhouette (issue #76)', () => {
  // The plain rounded rect used `border-radius: var(--ecosee-radius, ...)`. If it
  // creeps back onto a shared-shape surface, the silhouette drifts apart again.
  const surfaces: ReadonlyArray<readonly [string, CSSResult | CSSResult[]]> = [
    ['ecosee-home-screen', EcoseeHomeScreen.styles as CSSResult | CSSResult[]],
    ['ecosee-standby-screen', EcoseeStandbyScreen.styles as CSSResult | CSSResult[]],
    ['ecosee-overlay', EcoseeOverlay.styles as CSSResult | CSSResult[]],
  ];

  for (const [tag, styles] of surfaces) {
    it(`${tag} does not use --ecosee-radius / a corner border-radius on its surface`, () => {
      expect(cssTextOf(styles)).not.toMatch(/--ecosee-radius/);
    });

    it(`${tag} includes the shared shape styles`, () => {
      // The structural `.shape { position: absolute; ... }` block only comes from the
      // shared module, so its presence proves the surface consumes it.
      expect(cssTextOf(styles)).toContain(shapeStyles.cssText);
    });
  }
});
