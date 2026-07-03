// @vitest-environment happy-dom
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
// Side-effect import: registers <ecosee-card>, <ecosee-home-screen>,
// <ecosee-standby-screen> and every overlay via @customElement.
import '../src/ecosee-card';
import type { EcoseeCard } from '../src/ecosee-card';
import type { HomeAssistant } from '../src/types/hass';
import type { EcoseeCardConfig } from '../src/config';
import { STANDBY_RETURN_MS } from '../src/overlays/inactivity-timer';
import { toStandbyView } from '../src/screens/standby-view';
import { toHomeView } from '../src/climate/home-view';
import { fakeHass, climateEntity } from './helpers/fake-hass';

// Issue #65: the Home ↔ Standby switching. These mount the real <ecosee-card> and
// drive the idle countdown with fake timers, asserting which top-level view is
// rendered. Distinct from the Overlay auto-revert (issue #13 / #60).

const weatherEntity = (state = 'sunny', temperature = 55) => ({
  entity_id: 'weather.home',
  state,
  attributes: { temperature, temperature_unit: '°F' },
});

async function mountCard(
  hass: HomeAssistant,
  config: Partial<EcoseeCardConfig> = {},
): Promise<EcoseeCard> {
  const card = document.createElement('ecosee-card') as EcoseeCard;
  card.setConfig({ type: 'custom:ecosee-card', entity: 'climate.t', ...config });
  card.hass = hass;
  document.body.appendChild(card);
  await card.updateComplete;
  return card;
}

const has = (card: EcoseeCard, tag: string): boolean =>
  card.shadowRoot!.querySelector(tag) !== null;

/** Fire a bare interaction the way a tap / mouseover reaches the card. Bubbles to
 *  the listener the card hangs on the Home Screen / Standby Screen container. */
function fireInteraction(card: EcoseeCard, tag: string, type = 'pointerdown'): void {
  card.shadowRoot!.querySelector(tag)!.dispatchEvent(new Event(type, { bubbles: true }));
}

// Fake only the timeout pair so Lit's microtask-based render still flushes (the
// same pattern the picker auto-close tests use); the Standby clock's setInterval
// stays real and out of the way.
beforeEach(() => vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] }));
afterEach(() => {
  vi.useRealTimers();
  document.body.innerHTML = '';
});

describe('toStandbyView — hass → view (issue #65)', () => {
  it('reuses Home Screen current temp/unit and Weather outdoor temp/condition', () => {
    const { hass } = fakeHass({
      entities: [climateEntity('cool', { current_temperature: 72 }), weatherEntity('cloudy', 48)],
    });
    const view = toStandbyView(hass, {
      type: 'custom:ecosee-card',
      entity: 'climate.t',
      weather_entity: 'weather.home',
      standby_screen: true,
    });
    expect(view).toMatchObject({
      available: true,
      currentTemp: 72,
      unit: '°F',
      outdoorTemp: 48,
      weatherCondition: 'cloudy',
    });
  });

  it('degrades outdoor temp / condition to null when no weather entity is configured', () => {
    const { hass } = fakeHass({ entities: [climateEntity('cool', { current_temperature: 72 })] });
    const view = toStandbyView(hass, {
      type: 'custom:ecosee-card',
      entity: 'climate.t',
      standby_screen: true,
    });
    expect(view.outdoorTemp).toBeNull();
    expect(view.weatherCondition).toBeNull();
  });

  it('mirrors the Home Screen equipment status so the Standby edge glow matches (issue #90)', () => {
    // Same hvac_action → same equipment string that drives the edge glow, so Standby
    // and Home light on identical states without a second derivation (ADR-0009).
    const { hass } = fakeHass({
      entities: [climateEntity('cool', { current_temperature: 72, hvac_action: 'cooling' })],
    });
    const config = {
      type: 'custom:ecosee-card',
      entity: 'climate.t',
      standby_screen: true,
    } as const;
    expect(toStandbyView(hass, config).equipment).toBe('cooling');
    expect(toStandbyView(hass, config).equipment).toBe(toHomeView(hass, config).equipment);
  });

  it('leaves equipment null when hvac_action is absent and nothing is inferable', () => {
    const { hass } = fakeHass({ entities: [climateEntity('cool', { current_temperature: 72 })] });
    const view = toStandbyView(hass, {
      type: 'custom:ecosee-card',
      entity: 'climate.t',
      standby_screen: true,
    });
    expect(view.equipment).toBeNull();
  });
});

describe('toStandbyView — per-element visibility (standby config, YAML-only)', () => {
  const rich = () =>
    fakeHass({
      entities: [
        climateEntity('cool', { current_temperature: 72, hvac_action: 'cooling' }),
        weatherEntity('cloudy', 48),
      ],
    }).hass;
  const base = {
    type: 'custom:ecosee-card',
    entity: 'climate.t',
    weather_entity: 'weather.home',
    standby_screen: true,
  } as const;

  it('shows every element by default (no standby key)', () => {
    const view = toStandbyView(rich(), base);
    expect(view).toMatchObject({
      currentTemp: 72,
      outdoorTemp: 48,
      weatherCondition: 'cloudy',
      equipment: 'cooling',
    });
  });

  it('hides the weather glyph but keeps the outdoor temp with weather: false', () => {
    const view = toStandbyView(rich(), { ...base, standby: { weather: false } });
    expect(view.weatherCondition).toBeNull();
    expect(view.outdoorTemp).toBe(48);
  });

  it('drops the whole outdoor row with outdoor_temp: false', () => {
    const view = toStandbyView(rich(), { ...base, standby: { outdoor_temp: false } });
    expect(view.outdoorTemp).toBeNull();
  });

  it('hides the current temperature with current_temp: false', () => {
    const view = toStandbyView(rich(), { ...base, standby: { current_temp: false } });
    expect(view.currentTemp).toBeNull();
  });

  it('kills the equipment glow (and its label) with glow: false', () => {
    const view = toStandbyView(rich(), { ...base, standby: { glow: false } });
    expect(view.equipment).toBeNull();
  });

  it('leaves an unset toggle showing its element', () => {
    const view = toStandbyView(rich(), { ...base, standby: { glow: false } });
    // Only glow was turned off; the rest still render.
    expect(view.currentTemp).toBe(72);
    expect(view.weatherCondition).toBe('cloudy');
  });
});

describe('ecosee-card — Home ↔ Standby switching (issue #65)', () => {
  it('switches to the Standby Screen after 60s idle on the bare Home Screen', async () => {
    const { hass } = fakeHass({ entities: [climateEntity('cool', { current_temperature: 72 })] });
    const card = await mountCard(hass, { standby_screen: true });

    expect(has(card, 'ecosee-home-screen')).toBe(true);
    expect(has(card, 'ecosee-standby-screen')).toBe(false);

    vi.advanceTimersByTime(STANDBY_RETURN_MS);
    await card.updateComplete;

    expect(has(card, 'ecosee-standby-screen')).toBe(true);
    expect(has(card, 'ecosee-home-screen')).toBe(false);
  });

  it('returns to the Home Screen on interaction with the Standby Screen, then re-arms', async () => {
    const { hass } = fakeHass({ entities: [climateEntity('cool', { current_temperature: 72 })] });
    const card = await mountCard(hass, { standby_screen: true });

    vi.advanceTimersByTime(STANDBY_RETURN_MS);
    await card.updateComplete;
    expect(has(card, 'ecosee-standby-screen')).toBe(true);

    // A tap on the Standby Screen brings the Home Screen back…
    fireInteraction(card, 'ecosee-standby-screen');
    await card.updateComplete;
    expect(has(card, 'ecosee-home-screen')).toBe(true);
    expect(has(card, 'ecosee-standby-screen')).toBe(false);

    // …and a fresh 60s idle stretch drops it to Standby again.
    vi.advanceTimersByTime(STANDBY_RETURN_MS);
    await card.updateComplete;
    expect(has(card, 'ecosee-standby-screen')).toBe(true);
  });

  it('resets the countdown on interaction with the bare Home Screen', async () => {
    const { hass } = fakeHass({ entities: [climateEntity('cool', { current_temperature: 72 })] });
    const card = await mountCard(hass, { standby_screen: true });

    // Interact just before expiry, then wait almost another full window: no switch.
    vi.advanceTimersByTime(STANDBY_RETURN_MS - 1_000);
    fireInteraction(card, 'ecosee-home-screen', 'mouseover');
    vi.advanceTimersByTime(STANDBY_RETURN_MS - 1_000);
    await card.updateComplete;
    expect(has(card, 'ecosee-standby-screen')).toBe(false);

    // Only a full window since the last interaction switches it.
    vi.advanceTimersByTime(1_000);
    await card.updateComplete;
    expect(has(card, 'ecosee-standby-screen')).toBe(true);
  });

  it('does not switch while an Overlay is open, and re-arms once back on Home', async () => {
    const { hass } = fakeHass({
      entities: [climateEntity('cool', { hvac_modes: ['off', 'heat', 'cool'] })],
    });
    // Disable the Overlay auto-revert (issue #13, 25s) so the Overlay stays open
    // across the 60s window — this test isolates the SEPARATE Home→Standby timer.
    const card = await mountCard(hass, { standby_screen: true, inactivity_timeout: 0 });

    // Open an Overlay (System Mode picker) from Home.
    card.shadowRoot!.querySelector('ecosee-home-screen')!.dispatchEvent(
      new CustomEvent('ecosee-action', {
        detail: { action: 'system-mode' },
        bubbles: true,
        composed: true,
      }),
    );
    await card.updateComplete;
    expect(has(card, 'ecosee-overlay')).toBe(true);

    // 60s with an Overlay open must NOT drop to Standby.
    vi.advanceTimersByTime(STANDBY_RETURN_MS);
    await card.updateComplete;
    expect(has(card, 'ecosee-standby-screen')).toBe(false);

    // Dismiss back to the bare Home Screen — the countdown re-arms.
    card
      .shadowRoot!.querySelector('ecosee-overlay')!
      .dispatchEvent(new CustomEvent('ecosee-overlay-dismiss', { bubbles: true, composed: true }));
    await card.updateComplete;
    vi.advanceTimersByTime(STANDBY_RETURN_MS);
    await card.updateComplete;
    expect(has(card, 'ecosee-standby-screen')).toBe(true);
  });

  it('never switches when the feature is disabled', async () => {
    const { hass } = fakeHass({ entities: [climateEntity('cool', { current_temperature: 72 })] });
    const card = await mountCard(hass); // standby_screen absent ⇒ off

    vi.advanceTimersByTime(STANDBY_RETURN_MS * 3);
    await card.updateComplete;
    expect(has(card, 'ecosee-standby-screen')).toBe(false);
    expect(has(card, 'ecosee-home-screen')).toBe(true);
  });
});
