import { describe, it, expect } from 'vitest';
import { parseConfig } from '../src/config';

const base = { type: 'custom:ecosee-card', entity: 'climate.t' };

describe('parseConfig — sensors', () => {
  it('leaves sensors undefined when the key is absent', () => {
    expect(parseConfig(base).sensors).toBeUndefined();
  });

  it('accepts the object form with name and occupancy_entity', () => {
    const config = parseConfig({
      ...base,
      sensors: [
        { entity: 'sensor.hallway', name: 'Hallway', occupancy_entity: 'binary_sensor.hallway' },
        { entity: 'sensor.kitchen' },
      ],
    });
    expect(config.sensors).toEqual([
      { entity: 'sensor.hallway', name: 'Hallway', occupancy_entity: 'binary_sensor.hallway' },
      { entity: 'sensor.kitchen', name: undefined, occupancy_entity: undefined },
    ]);
  });

  it('accepts the bare entity-id string shorthand', () => {
    const config = parseConfig({ ...base, sensors: ['sensor.hallway', 'sensor.kitchen'] });
    expect(config.sensors).toEqual([{ entity: 'sensor.hallway' }, { entity: 'sensor.kitchen' }]);
  });

  it('accepts a mix of shorthand and object forms', () => {
    const config = parseConfig({
      ...base,
      sensors: ['sensor.hallway', { entity: 'sensor.kitchen', name: 'Kitchen' }],
    });
    expect(config.sensors).toEqual([
      { entity: 'sensor.hallway' },
      { entity: 'sensor.kitchen', name: 'Kitchen', occupancy_entity: undefined },
    ]);
  });

  it('throws when sensors is not a list', () => {
    expect(() => parseConfig({ ...base, sensors: 'sensor.hallway' })).toThrow(
      /`sensors` must be a list/,
    );
  });

  it('throws when a sensor entry has no entity id', () => {
    expect(() => parseConfig({ ...base, sensors: [{ name: 'Hallway' }] })).toThrow(
      /`sensors\[0\].entity` is required/,
    );
  });

  it('throws on an empty shorthand string', () => {
    expect(() => parseConfig({ ...base, sensors: [''] })).toThrow(
      /`sensors\[0\]` must be a non-empty/,
    );
  });

  it('throws when occupancy_entity is not a string', () => {
    expect(() =>
      parseConfig({ ...base, sensors: [{ entity: 'sensor.hallway', occupancy_entity: 42 }] }),
    ).toThrow(/`sensors\[0\].occupancy_entity` must be a string/);
  });
});

describe('parseConfig — air_quality_entity', () => {
  it('leaves air_quality_entity undefined when the key is absent', () => {
    expect(parseConfig(base).air_quality_entity).toBeUndefined();
  });

  it('accepts an entity id string', () => {
    expect(parseConfig({ ...base, air_quality_entity: 'sensor.aqi' }).air_quality_entity).toBe(
      'sensor.aqi',
    );
  });

  it('throws when air_quality_entity is not a string', () => {
    expect(() => parseConfig({ ...base, air_quality_entity: 42 })).toThrow(
      /`air_quality_entity` must be a string/,
    );
  });
});

describe('parseConfig — uv_index_entity', () => {
  it('leaves uv_index_entity undefined when the key is absent', () => {
    expect(parseConfig(base).uv_index_entity).toBeUndefined();
  });

  it('accepts an entity id string', () => {
    expect(parseConfig({ ...base, uv_index_entity: 'sensor.uv' }).uv_index_entity).toBe(
      'sensor.uv',
    );
  });

  it('throws when uv_index_entity is not a string', () => {
    expect(() => parseConfig({ ...base, uv_index_entity: 42 })).toThrow(
      /`uv_index_entity` must be a string/,
    );
  });
});

describe('parseConfig — inactivity_timeout', () => {
  it('leaves inactivity_timeout undefined when the key is absent', () => {
    expect(parseConfig(base).inactivity_timeout).toBeUndefined();
  });

  it('accepts a positive number of seconds', () => {
    expect(parseConfig({ ...base, inactivity_timeout: 30 }).inactivity_timeout).toBe(30);
  });

  it('accepts 0 (auto-revert disabled)', () => {
    expect(parseConfig({ ...base, inactivity_timeout: 0 }).inactivity_timeout).toBe(0);
  });

  it('throws on a negative value', () => {
    expect(() => parseConfig({ ...base, inactivity_timeout: -1 })).toThrow(
      /`inactivity_timeout` must be a non-negative number/,
    );
  });

  it('throws on a non-numeric value', () => {
    expect(() => parseConfig({ ...base, inactivity_timeout: '12' })).toThrow(
      /`inactivity_timeout` must be a non-negative number/,
    );
  });
});

describe('parseConfig — min_gap', () => {
  it('leaves min_gap undefined when the key is absent (seam applies unit default)', () => {
    expect(parseConfig(base).min_gap).toBeUndefined();
  });

  it('accepts a positive number of degrees', () => {
    expect(parseConfig({ ...base, min_gap: 4 }).min_gap).toBe(4);
  });

  it('accepts 0 (setpoints may meet)', () => {
    expect(parseConfig({ ...base, min_gap: 0 }).min_gap).toBe(0);
  });

  it('throws on a negative value', () => {
    expect(() => parseConfig({ ...base, min_gap: -1 })).toThrow(
      /`min_gap` must be a non-negative number/,
    );
  });

  it('throws on a non-numeric value', () => {
    expect(() => parseConfig({ ...base, min_gap: '3' })).toThrow(
      /`min_gap` must be a non-negative number/,
    );
  });
});

describe('parseConfig — standby_screen', () => {
  it('leaves standby_screen undefined when the key is absent (off by default)', () => {
    expect(parseConfig(base).standby_screen).toBeUndefined();
  });

  it('accepts an explicit boolean', () => {
    expect(parseConfig({ ...base, standby_screen: true }).standby_screen).toBe(true);
    expect(parseConfig({ ...base, standby_screen: false }).standby_screen).toBe(false);
  });

  it('throws when standby_screen is not a boolean', () => {
    expect(() => parseConfig({ ...base, standby_screen: 'on' })).toThrow(
      /`standby_screen` must be a boolean/,
    );
  });
});

describe('parseConfig — show_fan', () => {
  it('leaves show_fan undefined when the key is absent (auto default)', () => {
    expect(parseConfig(base).show_fan).toBeUndefined();
  });

  it('accepts each legal value', () => {
    expect(parseConfig({ ...base, show_fan: 'auto' }).show_fan).toBe('auto');
    expect(parseConfig({ ...base, show_fan: 'always' }).show_fan).toBe('always');
    expect(parseConfig({ ...base, show_fan: 'never' }).show_fan).toBe('never');
  });

  it('throws on an unknown value', () => {
    expect(() => parseConfig({ ...base, show_fan: 'sometimes' })).toThrow(
      /`show_fan` must be one of/,
    );
  });

  it('throws on a non-string value', () => {
    expect(() => parseConfig({ ...base, show_fan: true })).toThrow(/`show_fan` must be one of/);
  });
});

describe('parseConfig — standby (per-element visibility, YAML-only)', () => {
  it('leaves standby undefined when the key is absent (every element shown)', () => {
    expect(parseConfig(base).standby).toBeUndefined();
  });

  it('reads the per-element toggles, leaving unset ones undefined', () => {
    const config = parseConfig({ ...base, standby: { weather: false, glow: false } });
    expect(config.standby).toEqual({
      weather: false,
      outdoor_temp: undefined,
      current_temp: undefined,
      glow: false,
    });
  });

  it('accepts all four toggles', () => {
    const config = parseConfig({
      ...base,
      standby: { weather: true, outdoor_temp: false, current_temp: true, glow: false },
    });
    expect(config.standby).toEqual({
      weather: true,
      outdoor_temp: false,
      current_temp: true,
      glow: false,
    });
  });

  it('throws when standby is not an object', () => {
    expect(() => parseConfig({ ...base, standby: true })).toThrow(/`standby` must be an object/);
  });

  it('throws when a standby toggle is not a boolean', () => {
    expect(() => parseConfig({ ...base, standby: { glow: 'off' } })).toThrow(
      /`standby.glow` must be a boolean/,
    );
  });
});
