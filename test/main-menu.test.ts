import { describe, it, expect } from 'vitest';
import { toMainMenuModel } from '../src/menu/main-menu';
import type { EcoseeCardConfig } from '../src/config';
import type { HassEntityBase, HomeAssistant } from '../src/types/hass';

function hass(climate: HassEntityBase): HomeAssistant {
  return {
    states: { [climate.entity_id]: climate },
    entities: { [climate.entity_id]: { platform: 'ecobee' } },
    config: { unit_system: { temperature: '°F' } },
    callService: async () => undefined,
  };
}

const config: EcoseeCardConfig = { type: 'custom:ecosee-card', entity: 'climate.t' };

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
