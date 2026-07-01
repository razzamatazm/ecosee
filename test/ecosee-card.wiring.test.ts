// @vitest-environment happy-dom
import { describe, it, expect, afterEach } from 'vitest';
import type { LitElement } from 'lit';
// Side-effect import: registers <ecosee-card> and every overlay via @customElement.
// Imported for effect (not just the type) so esbuild can't elide it under
// isolatedModules — otherwise the elements never register and createElement is bare.
import '../src/ecosee-card';
import type { EcoseeCard } from '../src/ecosee-card';
import type { HomeAssistant } from '../src/types/hass';
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

/** Dispatch a Home Screen action the way <ecosee-home-screen> does. */
function fireAction(card: EcoseeCard, action: string): void {
  card.shadowRoot!.querySelector('ecosee-home-screen')!.dispatchEvent(
    new CustomEvent('ecosee-action', { detail: { action }, bubbles: true, composed: true }),
  );
}

/** Dispatch a Main Menu selection the way <ecosee-main-menu-overlay> does. */
function fireMenuSelect(card: EcoseeCard, target: string): void {
  card.shadowRoot!.querySelector('ecosee-main-menu-overlay')!.dispatchEvent(
    new CustomEvent('ecosee-menu-select', { detail: { target }, bubbles: true, composed: true }),
  );
}

/** Dispatch the shell's dismiss the way <ecosee-overlay>'s ✕ / backdrop does. */
function fireDismiss(card: EcoseeCard): void {
  card.shadowRoot!.querySelector('ecosee-overlay')!.dispatchEvent(
    new CustomEvent('ecosee-overlay-dismiss', { bubbles: true, composed: true }),
  );
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
});

describe('ecosee-card wiring — navigation (hub-and-picker)', () => {
  it('dismissing a menu-reached sub-screen returns to the Main Menu, not Home', async () => {
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

    fireAction(card, 'menu');
    await card.updateComplete;
    expect(overlayPresent(card, 'ecosee-main-menu-overlay')).toBe(true);

    // Choose Fan from the menu — pushed onto the stack.
    fireMenuSelect(card, 'fan');
    await card.updateComplete;
    expect(overlayPresent(card, 'ecosee-fan-overlay')).toBe(true);
    expect(overlayPresent(card, 'ecosee-main-menu-overlay')).toBe(false);

    // One dismiss pops a single level — back to the menu, not all the way Home.
    fireDismiss(card);
    await card.updateComplete;
    expect(overlayPresent(card, 'ecosee-main-menu-overlay')).toBe(true);
    expect(overlayPresent(card, 'ecosee-fan-overlay')).toBe(false);
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
