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
