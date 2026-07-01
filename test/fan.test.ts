import { describe, it, expect } from 'vitest';
import { toFanModel, setFanModeCall, setFanMinOnTimeCall } from '../src/climate/fan';
import type { EcoseeCardConfig } from '../src/config';
import type { HassEntityBase, HomeAssistant } from '../src/types/hass';

const RUNTIME_ENTITY = 'number.fan_min_on_time';

function hass(...entities: HassEntityBase[]): HomeAssistant {
  const states: Record<string, HassEntityBase> = {};
  for (const entity of entities) states[entity.entity_id] = entity;
  return {
    states,
    config: { unit_system: { temperature: '°F' } },
    callService: async () => undefined,
  };
}

const config: EcoseeCardConfig = { type: 'custom:ecosee-card', entity: 'climate.t' };
const withRuntime: EcoseeCardConfig = { ...config, fan_min_on_time_entity: RUNTIME_ENTITY };

function climate(state: string, attributes: Record<string, unknown>): HassEntityBase {
  return { entity_id: 'climate.t', state, attributes };
}

function runtime(state: string, attributes: Record<string, unknown> = {}): HassEntityBase {
  return { entity_id: RUNTIME_ENTITY, state, attributes };
}

/** A fully-featured ecobee: Auto + On fan modes, currently on Auto. */
const FULL = climate('cool', { fan_modes: ['auto', 'on'], fan_mode: 'auto' });

describe('toFanModel — On / Auto toggle', () => {
  it('lists Auto then On (device order) with the device labels', () => {
    const model = toFanModel(hass(FULL), config);
    expect(model.available).toBe(true);
    expect(model.options.map((o) => [o.fanMode, o.label])).toEqual([
      ['auto', 'Auto'],
      ['on', 'On'],
    ]);
  });

  it('marks the entity’s current fan_mode as selected (and only that one)', () => {
    const model = toFanModel(
      hass(climate('cool', { fan_modes: ['auto', 'on'], fan_mode: 'on' })),
      config,
    );
    expect(model.options.filter((o) => o.selected).map((o) => o.fanMode)).toEqual(['on']);
  });

  it('normalizes Auto before On regardless of the entity’s listed order', () => {
    const model = toFanModel(hass(climate('cool', { fan_modes: ['on', 'auto'] })), config);
    expect(model.options.map((o) => o.fanMode)).toEqual(['auto', 'on']);
  });

  it('selects nothing when the entity reports no current fan_mode', () => {
    const model = toFanModel(hass(climate('cool', { fan_modes: ['auto', 'on'] })), config);
    expect(model.options.some((o) => o.selected)).toBe(false);
  });
});

describe('toFanModel — generic fan modes (graceful degradation)', () => {
  it('lists generic speed modes after the known ones, title-cased', () => {
    const model = toFanModel(
      hass(climate('cool', { fan_modes: ['low', 'auto', 'medium_high', 'on'], fan_mode: 'low' })),
      config,
    );
    expect(model.options.map((o) => [o.fanMode, o.label])).toEqual([
      ['auto', 'Auto'],
      ['on', 'On'],
      ['low', 'Low'],
      ['medium_high', 'Medium High'],
    ]);
    expect(model.options.find((o) => o.selected)?.fanMode).toBe('low');
  });

  it('drops non-string entries in fan_modes', () => {
    const model = toFanModel(
      hass(climate('cool', { fan_modes: [null, 'auto', 5, 'on'] as unknown[] })),
      config,
    );
    expect(model.options.map((o) => o.fanMode)).toEqual(['auto', 'on']);
  });

  it('is unavailable when the entity exposes no fan_modes', () => {
    expect(toFanModel(hass(climate('cool', {})), config).available).toBe(false);
    expect(toFanModel(hass(climate('cool', { fan_modes: [] })), config).available).toBe(false);
  });

  it('is unavailable for a missing or unavailable entity', () => {
    expect(toFanModel(hass(climate('unavailable', {})), config).available).toBe(false);
    expect(toFanModel(hass(FULL), { ...config, entity: 'climate.none' }).available).toBe(false);
  });
});

describe('toFanModel — minimum-runtime selector', () => {
  it('is absent when no fan_min_on_time entity is configured', () => {
    expect(toFanModel(hass(FULL), config).minRuntime).toBeNull();
  });

  it('is absent when the configured entity is missing or unavailable', () => {
    expect(toFanModel(hass(FULL), withRuntime).minRuntime).toBeNull();
    expect(toFanModel(hass(FULL, runtime('unavailable')), withRuntime).minRuntime).toBeNull();
    expect(toFanModel(hass(FULL, runtime('not-a-number')), withRuntime).minRuntime).toBeNull();
  });

  it('does not affect the toggle’s availability', () => {
    // The sub-screen is gated on fan_modes only; a missing runtime entity just
    // hides that one control.
    expect(toFanModel(hass(FULL), withRuntime).available).toBe(true);
  });

  it('reads the current value and builds the option grid from the entity bounds', () => {
    const model = toFanModel(hass(FULL, runtime('15', { min: 0, max: 20, step: 5 })), withRuntime);
    expect(model.minRuntime?.entityId).toBe(RUNTIME_ENTITY);
    expect(model.minRuntime?.value).toBe(15);
    expect(model.minRuntime?.options.map((o) => o.value)).toEqual([0, 5, 10, 15, 20]);
    expect(model.minRuntime?.options.map((o) => o.label)).toEqual([
      '0 min / hr',
      '5 min / hr',
      '10 min / hr',
      '15 min / hr',
      '20 min / hr',
    ]);
    expect(model.minRuntime?.options.filter((o) => o.selected).map((o) => o.value)).toEqual([15]);
  });

  it('defaults the ecobee bounds (0–55 by 5) when the entity omits them', () => {
    const model = toFanModel(hass(FULL, runtime('0')), withRuntime);
    const values = model.minRuntime?.options.map((o) => o.value) ?? [];
    expect(values[0]).toBe(0);
    expect(values[values.length - 1]).toBe(55);
    expect(values).toHaveLength(12);
  });

  it('keeps the current value selectable even when it falls off the step grid', () => {
    const model = toFanModel(hass(FULL, runtime('12', { min: 0, max: 20, step: 5 })), withRuntime);
    const twelve = model.minRuntime?.options.find((o) => o.value === 12);
    expect(twelve).toBeDefined();
    expect(twelve?.selected).toBe(true);
  });

  it('summarizes a zero runtime as having no minimum', () => {
    const model = toFanModel(hass(FULL, runtime('0')), withRuntime);
    expect(model.minRuntime?.summary).toBe('Your fan currently has no minimum runtime.');
  });

  it('summarizes a non-zero runtime with the active minutes', () => {
    const model = toFanModel(hass(FULL, runtime('20')), withRuntime);
    expect(model.minRuntime?.summary).toBe('Your fan currently runs at least 20 minutes per hour.');
  });
});

describe('setFanModeCall', () => {
  it('builds the climate.set_fan_mode call for the chosen mode', () => {
    expect(setFanModeCall('on', 'climate.t')).toEqual({
      domain: 'climate',
      service: 'set_fan_mode',
      data: { entity_id: 'climate.t', fan_mode: 'on' },
    });
  });
});

describe('setFanMinOnTimeCall', () => {
  it('builds the number.set_value call for the chosen runtime', () => {
    expect(setFanMinOnTimeCall(15, RUNTIME_ENTITY)).toEqual({
      domain: 'number',
      service: 'set_value',
      data: { entity_id: RUNTIME_ENTITY, value: 15 },
    });
  });
});
