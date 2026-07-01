import { describe, it, expect } from 'vitest';
import { toSensorsModel } from '../src/sensors/sensors';
import type { EcoseeCardConfig } from '../src/config';
import type { HassEntityBase, HomeAssistant } from '../src/types/hass';

/** Build a `hass` from an arbitrary set of entities + a unit. Mirrors the sibling
 *  seam tests, but the Sensors seam reads many entities (the thermostat plus each
 *  configured temperature / occupancy entity), so this takes a list. */
function hass(entities: HassEntityBase[], unit = '°F'): HomeAssistant {
  const states: Record<string, HassEntityBase> = {};
  for (const entity of entities) states[entity.entity_id] = entity;
  return {
    states,
    config: { unit_system: { temperature: unit } },
    callService: async () => undefined,
  };
}

function entity(
  entity_id: string,
  state: string,
  attributes: Record<string, unknown> = {},
): HassEntityBase {
  return { entity_id, state, attributes };
}

/** The bound thermostat reporting 72°. */
function thermostat(currentTemp: number | null = 72, friendly = 'Living Room'): HassEntityBase {
  return entity('climate.t', 'heat', {
    friendly_name: friendly,
    ...(currentTemp === null ? {} : { current_temperature: currentTemp }),
  });
}

const baseConfig: EcoseeCardConfig = { type: 'custom:ecosee-card', entity: 'climate.t' };

describe('toSensorsModel — card list', () => {
  it('includes the thermostat’s own temperature first, then configured sensors in order', () => {
    const model = toSensorsModel(
      hass([
        thermostat(72),
        entity('sensor.hallway', '73', { friendly_name: 'Hallway' }),
        entity('sensor.kitchen', '77', { friendly_name: 'Kitchen' }),
      ]),
      { ...baseConfig, sensors: [{ entity: 'sensor.hallway' }, { entity: 'sensor.kitchen' }] },
    );
    expect(model.cards.map((c) => [c.name, c.temp, c.isThermostat])).toEqual([
      ['Living Room', 72, true],
      ['Hallway', 73, false],
      ['Kitchen', 77, false],
    ]);
  });

  it('passes through the configured temperature unit', () => {
    const model = toSensorsModel(hass([thermostat(21), entity('sensor.hallway', '22', {})], '°C'), {
      ...baseConfig,
      sensors: [{ entity: 'sensor.hallway' }],
    });
    expect(model.unit).toBe('°C');
  });

  it('reads a sensor temperature from its state and falls back to current_temperature', () => {
    const model = toSensorsModel(
      hass([
        thermostat(72),
        entity('sensor.state_temp', '68', {}),
        entity('climate.remote', 'heat', { current_temperature: 70 }),
      ]),
      { ...baseConfig, sensors: [{ entity: 'sensor.state_temp' }, { entity: 'climate.remote' }] },
    );
    expect(model.cards.map((c) => [c.key, c.temp])).toEqual([
      ['climate.t', 72],
      ['sensor.state_temp', 68],
      ['climate.remote', 70],
    ]);
  });

  it('uses the name override, then friendly_name, then the entity id', () => {
    const model = toSensorsModel(
      hass([
        thermostat(72),
        entity('sensor.named', '73', { friendly_name: 'Friendly' }),
        entity('sensor.bare', '74', {}),
      ]),
      {
        ...baseConfig,
        sensors: [{ entity: 'sensor.named', name: 'Override' }, { entity: 'sensor.bare' }],
      },
    );
    expect(model.cards.map((c) => c.name)).toEqual(['Living Room', 'Override', 'sensor.bare']);
  });

  it('honors a thermostat name override from config', () => {
    const model = toSensorsModel(hass([thermostat(72), entity('sensor.hallway', '73', {})]), {
      ...baseConfig,
      name: 'Downstairs',
      sensors: [{ entity: 'sensor.hallway' }],
    });
    expect(model.cards[0]).toMatchObject({ name: 'Downstairs', isThermostat: true });
  });
});

describe('toSensorsModel — occupancy badge', () => {
  it('reports occupied=true when the occupancy entity is on', () => {
    const model = toSensorsModel(
      hass([
        thermostat(72),
        entity('sensor.hallway', '73', {}),
        entity('binary_sensor.hallway', 'on', {}),
      ]),
      {
        ...baseConfig,
        sensors: [{ entity: 'sensor.hallway', occupancy_entity: 'binary_sensor.hallway' }],
      },
    );
    expect(model.cards[1].occupied).toBe(true);
  });

  it('reports occupied=false when the occupancy entity is off', () => {
    const model = toSensorsModel(
      hass([
        thermostat(72),
        entity('sensor.hallway', '73', {}),
        entity('binary_sensor.hallway', 'off', {}),
      ]),
      {
        ...baseConfig,
        sensors: [{ entity: 'sensor.hallway', occupancy_entity: 'binary_sensor.hallway' }],
      },
    );
    expect(model.cards[1].occupied).toBe(false);
  });

  it('reports occupied=null (no badge) when no occupancy entity is configured', () => {
    const model = toSensorsModel(hass([thermostat(72), entity('sensor.hallway', '73', {})]), {
      ...baseConfig,
      sensors: [{ entity: 'sensor.hallway' }],
    });
    expect(model.cards[1].occupied).toBeNull();
  });

  it('degrades occupied to null when the occupancy entity is missing or unavailable', () => {
    const missing = toSensorsModel(hass([thermostat(72), entity('sensor.hallway', '73', {})]), {
      ...baseConfig,
      sensors: [{ entity: 'sensor.hallway', occupancy_entity: 'binary_sensor.gone' }],
    });
    expect(missing.cards[1].occupied).toBeNull();

    const unavailable = toSensorsModel(
      hass([
        thermostat(72),
        entity('sensor.hallway', '73', {}),
        entity('binary_sensor.hallway', 'unavailable', {}),
      ]),
      {
        ...baseConfig,
        sensors: [{ entity: 'sensor.hallway', occupancy_entity: 'binary_sensor.hallway' }],
      },
    );
    expect(unavailable.cards[1].occupied).toBeNull();
  });

  it('never attaches an occupancy badge to the thermostat’s own card', () => {
    const model = toSensorsModel(hass([thermostat(72), entity('sensor.hallway', '73', {})]), {
      ...baseConfig,
      sensors: [{ entity: 'sensor.hallway' }],
    });
    expect(model.cards[0].occupied).toBeNull();
  });
});

describe('toSensorsModel — graceful degradation', () => {
  it('drops a sensor whose entity is missing, unavailable, or non-numeric', () => {
    const model = toSensorsModel(
      hass([
        thermostat(72),
        entity('sensor.unavail', 'unavailable', {}),
        entity('sensor.text', 'comfortable', {}),
        entity('sensor.ok', '75', {}),
      ]),
      {
        ...baseConfig,
        sensors: [
          { entity: 'sensor.unavail' },
          { entity: 'sensor.text' },
          { entity: 'sensor.gone' },
          { entity: 'sensor.ok' },
        ],
      },
    );
    expect(model.cards.map((c) => c.key)).toEqual(['climate.t', 'sensor.ok']);
  });

  it('omits the thermostat card when its current_temperature is absent, keeping sensors', () => {
    const model = toSensorsModel(hass([thermostat(null), entity('sensor.hallway', '73', {})]), {
      ...baseConfig,
      sensors: [{ entity: 'sensor.hallway' }],
    });
    expect(model.cards.map((c) => c.key)).toEqual(['sensor.hallway']);
    expect(model.available).toBe(true);
  });

  it('omits the thermostat card when the bound entity is unavailable', () => {
    const model = toSensorsModel(
      hass([
        entity('climate.t', 'unavailable', { friendly_name: 'Living Room' }),
        entity('sensor.hallway', '73', {}),
      ]),
      { ...baseConfig, sensors: [{ entity: 'sensor.hallway' }] },
    );
    expect(model.cards.map((c) => c.isThermostat)).toEqual([false]);
  });
});

describe('toSensorsModel — availability (gates the sub-screen)', () => {
  it('is available when at least one configured sensor is usable', () => {
    const model = toSensorsModel(hass([thermostat(72), entity('sensor.hallway', '73', {})]), {
      ...baseConfig,
      sensors: [{ entity: 'sensor.hallway' }],
    });
    expect(model.available).toBe(true);
  });

  it('is unavailable when no sensors are configured (the thermostat alone does not surface it)', () => {
    const model = toSensorsModel(hass([thermostat(72)]), baseConfig);
    expect(model.available).toBe(false);
    expect(model.cards).toEqual([]);
  });

  it('is unavailable when every configured sensor degrades away', () => {
    const model = toSensorsModel(
      hass([thermostat(72), entity('sensor.hallway', 'unavailable', {})]),
      { ...baseConfig, sensors: [{ entity: 'sensor.hallway' }] },
    );
    expect(model.available).toBe(false);
  });
});
