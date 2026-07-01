import { describe, it, expect } from 'vitest';
import { toMainMenuModel } from '../src/menu/main-menu';
import type { EcoseeCardConfig } from '../src/config';
import type { HassEntityBase, HomeAssistant } from '../src/types/hass';

function hass(climate: HassEntityBase, weather?: HassEntityBase): HomeAssistant {
  const states: Record<string, HassEntityBase> = { [climate.entity_id]: climate };
  if (weather) states[weather.entity_id] = weather;
  return {
    states,
    config: { unit_system: { temperature: '°F' } },
    callService: async () => undefined,
  };
}

const WEATHER: HassEntityBase = {
  entity_id: 'weather.home',
  state: 'sunny',
  attributes: { temperature: 75 },
};

const config: EcoseeCardConfig = { type: 'custom:ecosee-card', entity: 'climate.t' };
const withWeather: EcoseeCardConfig = { ...config, weather_entity: 'weather.home' };

function climate(state: string, attributes: Record<string, unknown>): HassEntityBase {
  return { entity_id: 'climate.t', state, attributes };
}

/** A fully-featured ecobee: all four System Modes. */
const FULL = climate('heat_cool', { hvac_modes: ['off', 'heat', 'cool', 'heat_cool'] });

describe('toMainMenuModel — reachable sub-screens', () => {
  it('lists System when the entity supports System Modes', () => {
    const model = toMainMenuModel(hass(FULL), config);
    expect(model.available).toBe(true);
    expect(model.entries.map((e) => [e.target, e.label])).toEqual([['system', 'System']]);
  });

  it('lists System when the entity has Comfort Settings but no System Modes', () => {
    // The System sub-screen holds both selectors, so presets alone make it reachable
    // (the System Mode selector then degrades away inside the sub-screen).
    const model = toMainMenuModel(
      hass(climate('heat', { preset_modes: ['Home', 'Away'] })),
      config,
    );
    expect(model.entries.map((e) => e.target)).toEqual(['system']);
  });

  it('lists Fan after System when the entity supports fan_modes', () => {
    const model = toMainMenuModel(
      hass(climate('heat_cool', { hvac_modes: ['off', 'heat'], fan_modes: ['auto', 'on'] })),
      config,
    );
    expect(model.entries.map((e) => [e.target, e.label])).toEqual([
      ['system', 'System'],
      ['fan', 'Fan'],
    ]);
  });

  it('omits Fan when the entity exposes no fan_modes', () => {
    const model = toMainMenuModel(hass(FULL), config);
    expect(model.entries.map((e) => e.target)).not.toContain('fan');
  });

  it('lists Fan on its own when the entity has fan_modes but no System Modes', () => {
    const model = toMainMenuModel(hass(climate('cool', { fan_modes: ['auto', 'on'] })), config);
    expect(model.entries.map((e) => e.target)).toEqual(['fan']);
  });

  it('lists Sensors when at least one configured sensor is usable', () => {
    const withSensor: HomeAssistant = {
      ...hass(FULL),
      states: {
        'climate.t': FULL,
        'sensor.hallway': { entity_id: 'sensor.hallway', state: '73', attributes: {} },
      },
    };
    const model = toMainMenuModel(withSensor, {
      ...config,
      sensors: [{ entity: 'sensor.hallway' }],
    });
    expect(model.entries.map((e) => e.target)).toEqual(['system', 'sensors']);
  });

  it('omits Sensors when no sensor is configured (the thermostat temp alone does not surface it)', () => {
    const withTemp = climate('heat_cool', {
      hvac_modes: ['off', 'heat', 'cool', 'heat_cool'],
      current_temperature: 72,
    });
    const model = toMainMenuModel(hass(withTemp), config);
    expect(model.entries.map((e) => e.target)).toEqual(['system']);
  });

  it('lists Weather when a usable weather_entity is configured', () => {
    const model = toMainMenuModel(hass(FULL, WEATHER), withWeather);
    expect(model.entries.map((e) => [e.target, e.label])).toEqual([
      ['system', 'System'],
      ['weather', 'Weather'],
    ]);
  });

  it('omits Weather when its entity is configured but unavailable', () => {
    const offline: HassEntityBase = { ...WEATHER, state: 'unavailable' };
    const model = toMainMenuModel(hass(FULL, offline), withWeather);
    expect(model.entries.map((e) => e.target)).toEqual(['system']);
  });
});

describe('toMainMenuModel — graceful degradation', () => {
  it('omits System (and reports unavailable) when the entity backs neither modes nor presets', () => {
    const model = toMainMenuModel(hass(climate('heat', {})), config);
    expect(model.entries).toEqual([]);
    expect(model.available).toBe(false);
  });

  it('is unavailable for a missing or unavailable entity', () => {
    expect(toMainMenuModel(hass(climate('unavailable', {})), config).available).toBe(false);
    expect(toMainMenuModel(hass(FULL), { ...config, entity: 'climate.none' }).available).toBe(
      false,
    );
  });
});
