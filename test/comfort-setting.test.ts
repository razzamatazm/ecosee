import { describe, it, expect } from 'vitest';
import { toComfortSettingModel, setPresetModeCall } from '../src/climate/comfort-setting';
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

/** A fully-featured ecobee: the three named Comfort Settings plus a custom one,
 *  currently held on Home. */
const FULL = climate('heat_cool', {
  preset_modes: ['Home', 'Away', 'Sleep', 'Vacation'],
  preset_mode: 'Home',
});

describe('toComfortSettingModel — option list', () => {
  it('lists presets in the entity’s order, passing custom names through verbatim', () => {
    const model = toComfortSettingModel(hass(FULL), config);
    expect(model.available).toBe(true);
    expect(model.options.map((o) => o.label)).toEqual(['Home', 'Away', 'Sleep', 'Vacation']);
    expect(model.options.map((o) => o.preset)).toEqual(['Home', 'Away', 'Sleep', 'Vacation']);
  });

  it('marks the entity’s active preset as selected (and only that one)', () => {
    const model = toComfortSettingModel(hass(FULL), config);
    expect(model.options.filter((o) => o.selected).map((o) => o.preset)).toEqual(['Home']);
  });

  it('maps the named ecobee Comfort Settings to their icons (case-insensitively, canonical labels)', () => {
    const model = toComfortSettingModel(
      hass(climate('heat', { preset_modes: ['home', 'away', 'sleep'], preset_mode: 'home' })),
      config,
    );
    expect(model.options.map((o) => [o.label, o.icon])).toEqual([
      ['Home', 'home'],
      ['Away', 'away'],
      ['Sleep', 'sleep'],
    ]);
  });

  it('gives custom presets the default comfort icon', () => {
    const model = toComfortSettingModel(hass(FULL), config);
    expect(model.options.find((o) => o.preset === 'Vacation')?.icon).toBe('comfort');
  });
});

describe('toComfortSettingModel — default icon override', () => {
  it('uses the configured default icon for custom presets', () => {
    const model = toComfortSettingModel(hass(FULL), { ...config, default_comfort_icon: 'sleep' });
    expect(model.options.find((o) => o.preset === 'Vacation')?.icon).toBe('sleep');
    // Known presets keep their own icon regardless of the override.
    expect(model.options.find((o) => o.preset === 'Home')?.icon).toBe('home');
  });

  it('falls back to the comfort icon when the override is not a known glyph', () => {
    const model = toComfortSettingModel(hass(FULL), {
      ...config,
      default_comfort_icon: 'mdi:bogus',
    });
    expect(model.options.find((o) => o.preset === 'Vacation')?.icon).toBe('comfort');
  });
});

describe('toComfortSettingModel — graceful degradation', () => {
  it('skips non-string / empty preset entries', () => {
    const model = toComfortSettingModel(
      hass(climate('heat', { preset_modes: ['Home', '', 42, 'Away'], preset_mode: 'Home' })),
      config,
    );
    expect(model.options.map((o) => o.preset)).toEqual(['Home', 'Away']);
  });

  it('is unavailable when the entity exposes no presets', () => {
    expect(toComfortSettingModel(hass(climate('heat', {})), config).available).toBe(false);
    expect(
      toComfortSettingModel(hass(climate('heat', { preset_modes: [] })), config).available,
    ).toBe(false);
  });

  it('is unavailable for a missing or unavailable entity', () => {
    expect(toComfortSettingModel(hass(climate('unavailable', {})), config).available).toBe(false);
    expect(toComfortSettingModel(hass(FULL), { ...config, entity: 'climate.none' }).available).toBe(
      false,
    );
  });

  it('marks nothing selected when no preset is active', () => {
    const model = toComfortSettingModel(
      hass(climate('heat', { preset_modes: ['Home', 'Away'] })),
      config,
    );
    expect(model.options.some((o) => o.selected)).toBe(false);
  });
});

describe('setPresetModeCall', () => {
  it('builds the climate.set_preset_mode call for the chosen preset', () => {
    expect(setPresetModeCall('Away', 'climate.t')).toEqual({
      domain: 'climate',
      service: 'set_preset_mode',
      data: { entity_id: 'climate.t', preset_mode: 'Away' },
    });
  });
});
