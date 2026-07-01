import { describe, it, expect } from 'vitest';
import { toSystemModeModel, setHvacModeCall } from '../src/climate/system-mode';
import type { EcoseeCardConfig } from '../src/config';
import type { HassEntityBase, HomeAssistant } from '../src/types/hass';

function hass(climate: HassEntityBase): HomeAssistant {
  return {
    states: { [climate.entity_id]: climate },
    config: { unit_system: { temperature: '°F' } },
    callService: async () => undefined,
  };
}

const config: EcoseeCardConfig = { type: 'custom:ecosee-card', entity: 'climate.t' };

function climate(state: string, attributes: Record<string, unknown>): HassEntityBase {
  return { entity_id: 'climate.t', state, attributes };
}

/** A fully-featured ecobee: all four System Modes, currently in Auto. */
const FULL = climate('heat_cool', {
  hvac_modes: ['off', 'heat', 'cool', 'heat_cool'],
});

describe('toSystemModeModel — option list', () => {
  it('lists supported modes in the device order with the exact device labels', () => {
    const model = toSystemModeModel(hass(FULL), config);
    expect(model.available).toBe(true);
    expect(model.options.map((o) => o.label)).toEqual([
      'Heat',
      'Cool',
      'Heat / Cool (Auto)',
      'Off',
    ]);
  });

  it('marks the entity’s current mode as selected (and only that one)', () => {
    const model = toSystemModeModel(hass(FULL), config);
    expect(model.options.filter((o) => o.selected).map((o) => o.mode)).toEqual(['heat_cool']);
  });

  it('shows only the modes the entity supports', () => {
    const model = toSystemModeModel(hass(climate('heat', { hvac_modes: ['off', 'heat'] })), config);
    expect(model.options.map((o) => o.mode)).toEqual(['heat', 'off']);
    expect(model.options.find((o) => o.mode === 'heat')?.selected).toBe(true);
  });

  it('lists Dry and Fan only (with HA labels) between Auto and Off', () => {
    const model = toSystemModeModel(
      hass(climate('dry', { hvac_modes: ['off', 'heat', 'cool', 'heat_cool', 'dry', 'fan_only'] })),
      config,
    );
    expect(model.options.map((o) => [o.mode, o.label])).toEqual([
      ['heat', 'Heat'],
      ['cool', 'Cool'],
      ['heat_cool', 'Heat / Cool (Auto)'],
      ['dry', 'Dry'],
      ['fan_only', 'Fan only'],
      ['off', 'Off'],
    ]);
    expect(model.options.find((o) => o.selected)?.mode).toBe('dry');
  });
});

describe('toSystemModeModel — Heat / Cool (Auto) spelling', () => {
  it('maps a legacy `auto` mode to the Heat / Cool (Auto) label and writes back `auto`', () => {
    const model = toSystemModeModel(hass(climate('auto', { hvac_modes: ['off', 'auto'] })), config);
    const auto = model.options.find((o) => o.mode === 'heat_cool');
    expect(auto?.label).toBe('Heat / Cool (Auto)');
    expect(auto?.hvacMode).toBe('auto');
    expect(auto?.selected).toBe(true);
  });

  it('maps a modern `heat_cool` mode to the Heat / Cool (Auto) label and writes back `heat_cool`', () => {
    const model = toSystemModeModel(
      hass(climate('cool', { hvac_modes: ['heat_cool', 'cool'] })),
      config,
    );
    expect(model.options.find((o) => o.mode === 'heat_cool')?.hvacMode).toBe('heat_cool');
  });

  it('collapses an entity exposing both spellings into one Heat / Cool (Auto) row, preferring heat_cool', () => {
    const model = toSystemModeModel(
      hass(climate('off', { hvac_modes: ['off', 'auto', 'heat_cool'] })),
      config,
    );
    const autos = model.options.filter((o) => o.mode === 'heat_cool');
    expect(autos).toHaveLength(1);
    expect(autos[0].hvacMode).toBe('heat_cool');
  });
});

describe('toSystemModeModel — graceful degradation', () => {
  it('omits an unrecognized hvac_mode string', () => {
    const model = toSystemModeModel(
      hass(climate('heat', { hvac_modes: ['off', 'heat', 'something_odd'] })),
      config,
    );
    expect(model.options.map((o) => o.mode)).toEqual(['heat', 'off']);
  });

  it('is unavailable when the entity exposes no hvac_modes', () => {
    expect(toSystemModeModel(hass(climate('heat', {})), config).available).toBe(false);
    expect(toSystemModeModel(hass(climate('heat', { hvac_modes: [] })), config).available).toBe(
      false,
    );
  });

  it('is unavailable for a missing or unavailable entity', () => {
    expect(toSystemModeModel(hass(climate('unavailable', {})), config).available).toBe(false);
    expect(toSystemModeModel(hass(FULL), { ...config, entity: 'climate.none' }).available).toBe(
      false,
    );
  });
});

describe('setHvacModeCall', () => {
  it('builds the climate.set_hvac_mode call for the chosen mode', () => {
    expect(setHvacModeCall('heat_cool', 'climate.t')).toEqual({
      domain: 'climate',
      service: 'set_hvac_mode',
      data: { entity_id: 'climate.t', hvac_mode: 'heat_cool' },
    });
  });
});
