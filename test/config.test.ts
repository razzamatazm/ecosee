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
