import { describe, it, expect } from 'vitest';
import { toHomeView, formatTemp } from '../src/climate/home-view';
import type { EcoseeCardConfig } from '../src/config';
import type { HassEntityBase, HomeAssistant } from '../src/types/hass';

function hass(options: {
  climate: HassEntityBase;
  platform?: string;
  extraStates?: Record<string, HassEntityBase>;
  unit?: string;
}): HomeAssistant {
  return {
    states: { [options.climate.entity_id]: options.climate, ...options.extraStates },
    entities: { [options.climate.entity_id]: { platform: options.platform } },
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
      platform: 'ecobee',
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

  it('maps the dual setpoints into the hold pill', () => {
    expect(view.hold).toEqual({ heat: 70, cool: 75 });
  });

  it('reads equipment status from hvac_action', () => {
    expect(view.equipment).toBe('cooling');
  });

  it('offers Resume only for ecobee-backed entities and shows weather', () => {
    expect(view.canResume).toBe(true);
    expect(view.weatherAvailable).toBe(true);
  });
});

describe('toHomeView — graceful degradation', () => {
  const view = toHomeView(
    hass({
      platform: 'generic_thermostat',
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
  });

  it('hides Resume for non-ecobee entities', () => {
    expect(view.canResume).toBe(false);
  });

  it('still surfaces the single heat setpoint', () => {
    expect(view.hold).toEqual({ heat: 68, cool: null });
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
    expect(view.hold).toBeNull();
  });

  it('shows no hold pill when the system is Off', () => {
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
    expect(view.hold).toBeNull();
    expect(view.canResume).toBe(false);
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
