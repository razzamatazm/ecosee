import { describe, it, expect } from 'vitest';
import { toHomeView, formatTemp } from '../src/climate/home-view';
import type { EcoseeCardConfig } from '../src/config';
import type { HassEntityBase, HomeAssistant } from '../src/types/hass';

function hass(options: {
  climate: HassEntityBase;
  extraStates?: Record<string, HassEntityBase>;
  unit?: string;
}): HomeAssistant {
  return {
    states: { [options.climate.entity_id]: options.climate, ...options.extraStates },
    config: { unit_system: { temperature: options.unit ?? '°F' } },
    callService: async () => undefined,
  };
}

const config = (overrides: Partial<EcoseeCardConfig> = {}): EcoseeCardConfig => ({
  type: 'custom:ecosee-card',
  entity: 'climate.t',
  ...overrides,
});

describe('toHomeView — rich ecobee', () => {
  const view = toHomeView(
    hass({
      climate: {
        entity_id: 'climate.t',
        state: 'heat_cool',
        attributes: {
          friendly_name: 'Living Room',
          current_temperature: 75,
          current_humidity: 60,
          target_temp_low: 70,
          target_temp_high: 75,
          hvac_action: 'cooling',
        },
      },
      extraStates: {
        'weather.home': { entity_id: 'weather.home', state: 'sunny', attributes: {} },
      },
    }),
    config({ weather_entity: 'weather.home' }),
  );

  it('reads the current temperature and humidity', () => {
    expect(view.currentTemp).toBe(75);
    expect(view.humidity).toBe(60);
  });

  it('maps the dual setpoints into the setpoint display', () => {
    expect(view.setpoints).toEqual({ heat: 70, cool: 75 });
  });

  it('reads equipment status from hvac_action', () => {
    expect(view.equipment).toBe('cooling');
  });

  it('shows weather when a weather entity is configured', () => {
    expect(view.weatherAvailable).toBe(true);
  });

  it('surfaces the live weather condition for the Home Screen glyph', () => {
    expect(view.weatherCondition).toBe('sunny');
  });
});

describe('toHomeView — graceful degradation', () => {
  const view = toHomeView(
    hass({
      climate: {
        entity_id: 'climate.t',
        state: 'heat',
        attributes: { current_temperature: 64, temperature: 68 },
      },
    }),
    config(),
  );

  it('hides humidity and weather when their data is absent', () => {
    expect(view.humidity).toBeNull();
    expect(view.weatherAvailable).toBe(false);
    expect(view.weatherCondition).toBeNull();
  });

  it('still surfaces the single heat setpoint', () => {
    expect(view.setpoints).toEqual({ heat: 68, cool: null });
  });

  it('infers equipment from setpoints when hvac_action is missing', () => {
    // heat mode, current 64 < setpoint 68 ⇒ heating
    expect(view.equipment).toBe('heating');
  });
});

describe('toHomeView — edge cases', () => {
  it('marks a missing/unavailable entity as not available', () => {
    const view = toHomeView(
      hass({
        climate: { entity_id: 'climate.t', state: 'unavailable', attributes: {} },
      }),
      config(),
    );
    expect(view.available).toBe(false);
    expect(view.setpoints).toBeNull();
  });

  it('has no setpoints when the system is Off', () => {
    const view = toHomeView(
      hass({
        climate: {
          entity_id: 'climate.t',
          state: 'off',
          attributes: { current_temperature: 70, temperature: 72 },
        },
      }),
      config(),
    );
    expect(view.setpoints).toBeNull();
  });

  it('surfaces dry / fan_only as the mode with no setpoints', () => {
    for (const state of ['dry', 'fan_only'] as const) {
      const view = toHomeView(
        hass({
          climate: {
            entity_id: 'climate.t',
            state,
            attributes: { current_temperature: 72, temperature: 74 },
          },
        }),
        config(),
      );
      expect(view.mode).toBe(state);
      expect(view.setpoints).toBeNull();
      expect(view.equipment).toBeNull();
    }
  });

  it('falls back to a humidity_entity when the climate entity lacks humidity', () => {
    const view = toHomeView(
      hass({
        climate: {
          entity_id: 'climate.t',
          state: 'cool',
          attributes: { current_temperature: 72, temperature: 74 },
        },
        extraStates: {
          'sensor.hum': { entity_id: 'sensor.hum', state: '45', attributes: {} },
        },
      }),
      config({ humidity_entity: 'sensor.hum' }),
    );
    expect(view.humidity).toBe(45);
  });
});

describe('toHomeView — fan availability (issue #45)', () => {
  const fanView = (attributes: Record<string, unknown>, state = 'cool') =>
    toHomeView(hass({ climate: { entity_id: 'climate.t', state, attributes } }), config());

  it('is true when the entity lists usable fan modes', () => {
    expect(fanView({ fan_modes: ['auto', 'on'] }).fanAvailable).toBe(true);
  });

  it('is false when the entity lists no fan modes', () => {
    expect(fanView({}).fanAvailable).toBe(false);
    expect(fanView({ fan_modes: [] }).fanAvailable).toBe(false);
  });

  it('is false when fan_modes holds no usable string', () => {
    expect(fanView({ fan_modes: [null, 5] as unknown[] }).fanAvailable).toBe(false);
  });

  it('is false for a missing or unavailable entity', () => {
    expect(fanView({ fan_modes: ['auto', 'on'] }, 'unavailable').fanAvailable).toBe(false);
    const missing = toHomeView(
      hass({ climate: { entity_id: 'climate.t', state: 'cool', attributes: {} } }),
      config({ entity: 'climate.none' }),
    );
    expect(missing.fanAvailable).toBe(false);
  });
});

describe('toHomeView — air quality', () => {
  const withAqi = (aqiState: HassEntityBase | undefined, configured = true) =>
    toHomeView(
      hass({
        climate: {
          entity_id: 'climate.t',
          state: 'cool',
          attributes: { current_temperature: 72, temperature: 74 },
        },
        extraStates: aqiState ? { [aqiState.entity_id]: aqiState } : undefined,
      }),
      config(configured ? { air_quality_entity: 'sensor.aqi' } : {}),
    );

  it('is null when no air_quality_entity is configured', () => {
    const view = withAqi(undefined, false);
    expect(view.airQuality).toBeNull();
  });

  it('is null when the configured entity is missing', () => {
    expect(withAqi(undefined).airQuality).toBeNull();
  });

  it('is null when the configured entity is unavailable', () => {
    const view = withAqi({ entity_id: 'sensor.aqi', state: 'unavailable', attributes: {} });
    expect(view.airQuality).toBeNull();
  });

  it('is null when the entity carries no numeric reading', () => {
    const view = withAqi({ entity_id: 'sensor.aqi', state: 'good', attributes: {} });
    expect(view.airQuality).toBeNull();
  });

  it('reads the AQI from the entity state and categorizes it', () => {
    const view = withAqi({ entity_id: 'sensor.aqi', state: '42', attributes: {} });
    expect(view.airQuality).toEqual({ aqi: 42, category: 'Good', level: 'good' });
  });

  it('falls back to the air_quality_index attribute when the state is non-numeric', () => {
    const view = withAqi({
      entity_id: 'sensor.aqi',
      state: 'moderate',
      attributes: { air_quality_index: 88 },
    });
    expect(view.airQuality).toEqual({ aqi: 88, category: 'Moderate', level: 'moderate' });
  });

  it('rounds a fractional AQI to a whole number', () => {
    const view = withAqi({ entity_id: 'sensor.aqi', state: '142.6', attributes: {} });
    expect(view.airQuality?.aqi).toBe(143);
  });

  it('maps each US EPA AQI band to its category and level', () => {
    const cases: Array<[number, string, string]> = [
      [50, 'Good', 'good'],
      [100, 'Moderate', 'moderate'],
      [150, 'Unhealthy for Sensitive Groups', 'sensitive'],
      [200, 'Unhealthy', 'unhealthy'],
      [300, 'Very Unhealthy', 'very-unhealthy'],
      [301, 'Hazardous', 'hazardous'],
    ];
    for (const [aqi, category, level] of cases) {
      const view = withAqi({ entity_id: 'sensor.aqi', state: String(aqi), attributes: {} });
      expect(view.airQuality).toEqual({ aqi, category, level });
    }
  });

  it('still surfaces air quality when the climate entity is unavailable', () => {
    const view = toHomeView(
      hass({
        climate: { entity_id: 'climate.t', state: 'unavailable', attributes: {} },
        extraStates: { 'sensor.aqi': { entity_id: 'sensor.aqi', state: '30', attributes: {} } },
      }),
      config({ air_quality_entity: 'sensor.aqi' }),
    );
    expect(view.available).toBe(false);
    expect(view.airQuality).toEqual({ aqi: 30, category: 'Good', level: 'good' });
  });
});

describe('formatTemp', () => {
  it('rounds to whole degrees in Fahrenheit', () => {
    expect(formatTemp(74.6, '°F')).toBe('75');
  });

  it('rounds to half degrees in Celsius', () => {
    expect(formatTemp(21.4, '°C')).toBe('21.5');
    expect(formatTemp(21.2, '°C')).toBe('21');
  });

  it('renders a dash for null', () => {
    expect(formatTemp(null, '°F')).toBe('–');
  });
});
