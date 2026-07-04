// @vitest-environment happy-dom
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import type { LitElement } from 'lit';
// Side-effect import: registers <ecosee-card> and every overlay via @customElement.
// Imported for effect (not just the type) so esbuild can't elide it under
// isolatedModules — otherwise the elements never register and createElement is bare.
import '../src/ecosee-card';
import type { EcoseeCard } from '../src/ecosee-card';
import type { HomeAssistant } from '../src/types/hass';
import { PICKER_CONFIRM_MS } from '../src/overlays/overlay-dismiss';
import { fakeHass, climateEntity } from './helpers/fake-hass';

// Wiring tests: these mount the real <ecosee-card> and drive it through the
// documented events, then assert what reaches `hass.callService`. They cover the
// seam the pure model tests can't — the overlay → card event wiring, the nav
// stack, and the apply path — which only became reachable once the card routes
// every Overlay through one descriptor table and one `ecosee-service-call` event.

async function mountCard(hass: HomeAssistant, entity = 'climate.t'): Promise<EcoseeCard> {
  const card = document.createElement('ecosee-card') as EcoseeCard;
  card.setConfig({ type: 'custom:ecosee-card', entity });
  card.hass = hass;
  document.body.appendChild(card);
  await card.updateComplete;
  return card;
}

/** Dispatch a Home Screen action the way <ecosee-home-screen> does. A `setpoint`
 *  rides along the way a setpoint-oval tap does (issue #42); omit it for the
 *  current-temperature number tap. */
function fireAction(card: EcoseeCard, action: string, setpoint?: 'heat' | 'cool'): void {
  card.shadowRoot!.querySelector('ecosee-home-screen')!.dispatchEvent(
    new CustomEvent('ecosee-action', {
      detail: { action, setpoint },
      bubbles: true,
      composed: true,
    }),
  );
}

/** Dispatch a bottom tab-bar tap the way <ecosee-overlay> does (a section target, or
 *  `thermostat` for the temp badge that returns Home). */
function fireTabSelect(card: EcoseeCard, target: string): void {
  card
    .shadowRoot!.querySelector('ecosee-overlay')!
    .dispatchEvent(
      new CustomEvent('ecosee-tab-select', { detail: { target }, bubbles: true, composed: true }),
    );
}

/** Dispatch a System sub-screen selection the way <ecosee-system-overlay> does. */
function fireSystemSelect(card: EcoseeCard, target: string): void {
  card.shadowRoot!.querySelector('ecosee-system-overlay')!.dispatchEvent(
    new CustomEvent('ecosee-system-select', {
      detail: { target },
      bubbles: true,
      composed: true,
    }),
  );
}

/** Dispatch the shell's dismiss the way <ecosee-overlay>'s ✕ / backdrop does. */
function fireDismiss(card: EcoseeCard): void {
  card
    .shadowRoot!.querySelector('ecosee-overlay')!
    .dispatchEvent(new CustomEvent('ecosee-overlay-dismiss', { bubbles: true, composed: true }));
}

function overlayPresent(card: EcoseeCard, tag: string): boolean {
  return card.shadowRoot!.querySelector(tag) !== null;
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('ecosee-card wiring — apply path', () => {
  it('forwards a temperature change from the overlay to hass.callService via the one ecosee-service-call event', async () => {
    const { hass, calls } = fakeHass({
      entities: [
        climateEntity('heat', { temperature: 70, min_temp: 60, max_temp: 80, target_temp_step: 1 }),
      ],
    });
    const card = await mountCard(hass);

    fireAction(card, 'temperature');
    await card.updateComplete;

    const overlay = card.shadowRoot!.querySelector('ecosee-temperature-overlay') as LitElement;
    expect(overlay).toBeTruthy();
    await overlay.updateComplete;

    // Nudge the setpoint up: the overlay emits `ecosee-service-call`, which the card
    // must catch on the shell and forward to Home Assistant. (Proves the listener
    // moved onto <ecosee-overlay> actually receives the unified event.)
    const increase = overlay.shadowRoot!.querySelector(
      'button[aria-label="Increase"]',
    ) as HTMLButtonElement;
    increase.click();

    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({
      domain: 'climate',
      service: 'set_temperature',
      data: { entity_id: 'climate.t', temperature: 71 },
    });
  });

  it('foregrounds the tapped setpoint oval when opening Temperature Adjust (issue #42)', async () => {
    const { hass, calls } = fakeHass({
      entities: [
        climateEntity('heat_cool', {
          target_temp_low: 68,
          target_temp_high: 76,
          min_temp: 60,
          max_temp: 85,
          target_temp_step: 1,
        }),
      ],
    });
    const card = await mountCard(hass);

    // Tapping the heat oval carries `setpoint: 'heat'`, so a nudge must move the
    // *heat* setpoint (target_temp_low), not the cool default the overlay would
    // otherwise foreground in Heat / Cool (Auto).
    fireAction(card, 'temperature', 'heat');
    await card.updateComplete;
    const overlay = card.shadowRoot!.querySelector('ecosee-temperature-overlay') as LitElement;
    await overlay.updateComplete;
    (
      overlay.shadowRoot!.querySelector('button[aria-label="Increase"]') as HTMLButtonElement
    ).click();

    expect(calls[0]).toMatchObject({
      domain: 'climate',
      service: 'set_temperature',
      data: { entity_id: 'climate.t', target_temp_low: 69, target_temp_high: 76 },
    });
  });

  it('defaults to the cool setpoint when the current-temperature number is tapped', async () => {
    const { hass, calls } = fakeHass({
      entities: [
        climateEntity('heat_cool', {
          target_temp_low: 68,
          target_temp_high: 76,
          min_temp: 60,
          max_temp: 85,
          target_temp_step: 1,
        }),
      ],
    });
    const card = await mountCard(hass);

    // No setpoint rides the number tap, so the overlay keeps its own default (cool)
    // — a nudge moves target_temp_high.
    fireAction(card, 'temperature');
    await card.updateComplete;
    const overlay = card.shadowRoot!.querySelector('ecosee-temperature-overlay') as LitElement;
    await overlay.updateComplete;
    (
      overlay.shadowRoot!.querySelector('button[aria-label="Increase"]') as HTMLButtonElement
    ).click();

    expect(calls[0]).toMatchObject({
      domain: 'climate',
      service: 'set_temperature',
      data: { entity_id: 'climate.t', target_temp_low: 68, target_temp_high: 77 },
    });
  });
});

describe('ecosee-card wiring — navigation (tab bar)', () => {
  it('the gear opens a Main Menu section directly; a tab switch replaces it; dismiss returns Home', async () => {
    const { hass } = fakeHass({
      entities: [
        climateEntity('heat', {
          hvac_modes: ['off', 'heat', 'cool'],
          fan_modes: ['on', 'auto'],
          fan_mode: 'auto',
        }),
      ],
    });
    const card = await mountCard(hass);

    // The gear lands directly on the first reachable section (System) — no
    // drill-down list in between.
    fireAction(card, 'menu');
    await card.updateComplete;
    expect(overlayPresent(card, 'ecosee-system-overlay')).toBe(true);

    // A tab tap replaces the section (a flat switch, not a push).
    fireTabSelect(card, 'fan');
    await card.updateComplete;
    expect(overlayPresent(card, 'ecosee-fan-overlay')).toBe(true);
    expect(overlayPresent(card, 'ecosee-system-overlay')).toBe(false);

    // Dismissing a section returns Home (there is no menu to fall back to).
    fireDismiss(card);
    await card.updateComplete;
    expect(overlayPresent(card, 'ecosee-fan-overlay')).toBe(false);
  });

  it('the tab bar temp badge returns to Home from a section', async () => {
    const { hass } = fakeHass({
      entities: [climateEntity('heat', { hvac_modes: ['off', 'heat', 'cool'] })],
    });
    const card = await mountCard(hass);

    fireAction(card, 'menu');
    await card.updateComplete;
    expect(overlayPresent(card, 'ecosee-system-overlay')).toBe(true);

    fireTabSelect(card, 'thermostat');
    await card.updateComplete;
    expect(overlayPresent(card, 'ecosee-system-overlay')).toBe(false);
  });

  it('opens the Fan sub-screen from the Home top-row shortcut, dismissing back to Home (issue #45)', async () => {
    const { hass } = fakeHass({
      entities: [
        climateEntity('cool', {
          fan_modes: ['auto', 'on', 'low', 'medium', 'high'],
          fan_mode: 'auto',
        }),
      ],
    });
    const card = await mountCard(hass);

    // The Home shortcut fires a bare `fan` action (no setpoint); it opens the Fan
    // overlay straight from Home.
    fireAction(card, 'fan');
    await card.updateComplete;
    expect(overlayPresent(card, 'ecosee-fan-overlay')).toBe(true);

    // Opened from Home, so a single dismiss lands back on the bare Home Screen.
    fireDismiss(card);
    await card.updateComplete;
    expect(overlayPresent(card, 'ecosee-overlay')).toBe(false);
  });

  it('does not open the Fan shortcut when the entity exposes no fan control (availability gate)', async () => {
    const { hass } = fakeHass({ entities: [climateEntity('cool', {})] });
    const card = await mountCard(hass);

    fireAction(card, 'fan');
    await card.updateComplete;
    expect(overlayPresent(card, 'ecosee-fan-overlay')).toBe(false);
    expect(overlayPresent(card, 'ecosee-overlay')).toBe(false);
  });

  it('does not open an Overlay whose backing data is absent (availability gate)', async () => {
    const { hass } = fakeHass({ entities: [climateEntity('off', {})] });
    const card = await mountCard(hass);

    // 'off' entity exposes no hvac_modes, so the System Mode picker has nothing to
    // show: the gate in `_open` keeps it closed.
    fireAction(card, 'system-mode');
    await card.updateComplete;
    expect(overlayPresent(card, 'ecosee-system-mode-overlay')).toBe(false);
    expect(overlayPresent(card, 'ecosee-overlay')).toBe(false);
  });
});

describe('ecosee-card wiring — pickers close on selection (issues #38/#39)', () => {
  // Only setTimeout/clearTimeout are faked so Lit's microtask-based render still runs.
  beforeEach(() => vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] }));
  afterEach(() => vi.useRealTimers());

  it('applies the mode and then auto-closes a Home-opened System Mode picker back to Home', async () => {
    const { hass, calls } = fakeHass({
      entities: [climateEntity('cool', { hvac_modes: ['off', 'heat', 'cool'] })],
    });
    const card = await mountCard(hass);

    fireAction(card, 'system-mode');
    await card.updateComplete;
    const overlay = card.shadowRoot!.querySelector('ecosee-system-mode-overlay') as LitElement;
    await overlay.updateComplete;

    const heat = [...overlay.shadowRoot!.querySelectorAll('.option')].find(
      (o) => o.textContent?.trim() === 'Heat',
    ) as HTMLButtonElement;
    heat.click();

    // The write goes out immediately…
    expect(calls).toEqual([
      {
        domain: 'climate',
        service: 'set_hvac_mode',
        data: { entity_id: 'climate.t', hvac_mode: 'heat' },
        returnResponse: undefined,
      },
    ]);
    // …the picker is still up during the confirm beat…
    expect(overlayPresent(card, 'ecosee-system-mode-overlay')).toBe(true);

    // …then it auto-closes all the way back to the bare Home Screen.
    vi.advanceTimersByTime(PICKER_CONFIRM_MS);
    await card.updateComplete;
    expect(overlayPresent(card, 'ecosee-overlay')).toBe(false);
  });

  it('a picker opened from a section returns to that section (System), not Home', async () => {
    const { hass } = fakeHass({
      entities: [climateEntity('cool', { hvac_modes: ['off', 'heat', 'cool'] })],
    });
    const card = await mountCard(hass);

    // The gear lands on the System section; its selectors push focused pickers.
    fireAction(card, 'menu');
    await card.updateComplete;
    expect(overlayPresent(card, 'ecosee-system-overlay')).toBe(true);

    fireSystemSelect(card, 'system-mode');
    await card.updateComplete;
    const overlay = card.shadowRoot!.querySelector('ecosee-system-mode-overlay') as LitElement;
    await overlay.updateComplete;

    (
      [...overlay.shadowRoot!.querySelectorAll('.option')].find(
        (o) => o.textContent?.trim() === 'Heat',
      ) as HTMLButtonElement
    ).click();
    vi.advanceTimersByTime(PICKER_CONFIRM_MS);
    await card.updateComplete;

    // One level popped: back to the System sub-screen, not all the way Home.
    expect(overlayPresent(card, 'ecosee-system-overlay')).toBe(true);
    expect(overlayPresent(card, 'ecosee-system-mode-overlay')).toBe(false);
  });
});
