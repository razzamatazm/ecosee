import { describe, it, expect } from 'vitest';
import {
  toWeatherModel,
  getForecastsCall,
  parseForecastResponse,
  periodLabel,
  type ForecastEntry,
} from '../src/weather/weather';
import type { EcoseeCardConfig } from '../src/config';
import type { HassEntityBase, HomeAssistant } from '../src/types/hass';

function hass(weather?: HassEntityBase): HomeAssistant {
  return {
    states: weather ? { [weather.entity_id]: weather } : {},
    config: { unit_system: { temperature: '°F' } },
    callService: async () => undefined,
  };
}

const config: EcoseeCardConfig = {
  type: 'custom:ecosee-card',
  entity: 'climate.t',
  weather_entity: 'weather.home',
};

function weather(
  state: string,
  attributes: Record<string, unknown>,
  base?: Partial<HassEntityBase>,
): HassEntityBase {
  return { entity_id: 'weather.home', state, attributes, ...base };
}

/** A typical weather entity: a condition, current temp + humidity, attribution. */
const SUNNY = weather('sunny', {
  temperature: 75,
  humidity: 52,
  attribution: 'Apple Weather',
});

/** A daily forecast starting with today (`[0]`) — the device skips today on
 *  page 2, so only the four days *after* it (Jun 30 – Jul 3) should surface there,
 *  while today's PoP rides on page 1. */
const DAILY: ForecastEntry[] = [
  {
    datetime: '2026-06-29',
    condition: 'sunny',
    temperature: 75,
    templow: 60,
    precipitation_probability: 5,
  },
  {
    datetime: '2026-06-30',
    condition: 'sunny',
    temperature: 76,
    templow: 59,
    precipitation_probability: 0,
  },
  {
    datetime: '2026-07-01',
    condition: 'sunny',
    temperature: 77,
    templow: 58,
    precipitation_probability: 0,
  },
  {
    datetime: '2026-07-02',
    condition: 'sunny',
    temperature: 80,
    templow: 57,
    precipitation_probability: 10,
  },
  {
    datetime: '2026-07-03',
    condition: 'sunny',
    temperature: 82,
    templow: 58,
    precipitation_probability: 0,
  },
  {
    datetime: '2026-07-04',
    condition: 'sunny',
    temperature: 84,
    templow: 60,
    precipitation_probability: 0,
  },
];

/** Hourly forecast from a ~5pm "now" — the next three named periods are Evening,
 *  Overnight, Morning (datetimes are zone-naive so the local hour is fixed). */
const HOURLY: ForecastEntry[] = [
  { datetime: '2026-06-29T17:00:00', condition: 'clear-night', temperature: 74 },
  { datetime: '2026-06-29T18:00:00', temperature: 72 },
  { datetime: '2026-06-29T21:00:00', condition: 'partlycloudy', temperature: 61 },
  { datetime: '2026-06-29T23:00:00', temperature: 60 },
  { datetime: '2026-06-30T05:00:00', condition: 'partlycloudy', temperature: 59 },
];

describe('toWeatherModel — availability / graceful degradation', () => {
  it('is unavailable when no weather_entity is configured', () => {
    expect(toWeatherModel(hass(SUNNY), { ...config, weather_entity: undefined }).available).toBe(
      false,
    );
  });

  it('is unavailable when the configured weather entity is missing', () => {
    expect(toWeatherModel(hass(), config).available).toBe(false);
  });

  it('is unavailable when the weather entity is unavailable/unknown', () => {
    expect(toWeatherModel(hass(weather('unavailable', {})), config).available).toBe(false);
    expect(toWeatherModel(hass(weather('unknown', {})), config).available).toBe(false);
  });

  it('is available with current conditions drawn from the entity attributes', () => {
    const model = toWeatherModel(hass(SUNNY), config);
    expect(model.available).toBe(true);
    expect(model.current.temp).toBe(75);
    expect(model.current.humidity).toBe(52);
    expect(model.current.conditionLabel).toBe('Sunny');
    expect(model.attribution).toBe('Apple Weather');
  });
});

describe('toWeatherModel — current conditions', () => {
  it('maps a known HA condition to a friendly label', () => {
    expect(toWeatherModel(hass(weather('partlycloudy', {})), config).current.conditionLabel).toBe(
      'Partly Cloudy',
    );
    expect(toWeatherModel(hass(weather('clear-night', {})), config).current.conditionLabel).toBe(
      'Clear',
    );
  });

  it('title-cases an unrecognized condition string rather than showing it raw', () => {
    expect(toWeatherModel(hass(weather('mostly-clear', {})), config).current.conditionLabel).toBe(
      'Mostly Clear',
    );
  });

  it('exposes "as of" from the entity timestamp, or null when absent', () => {
    const stamped = weather('sunny', {}, { last_updated: '2026-06-29T17:00:00' });
    expect(toWeatherModel(hass(stamped), config).current.asOf).toBe('2026-06-29T17:00:00');
    expect(toWeatherModel(hass(SUNNY), config).current.asOf).toBeNull();
  });

  it('prefers the weather entity’s own temperature_unit over the climate unit', () => {
    const metric = weather('sunny', { temperature: 24, temperature_unit: '°C' });
    expect(toWeatherModel(hass(metric), config).unit).toBe('°C');
    expect(toWeatherModel(hass(SUNNY), config).unit).toBe('°F');
  });

  it('hides humidity when the entity does not report it', () => {
    expect(
      toWeatherModel(hass(weather('sunny', { temperature: 75 })), config).current.humidity,
    ).toBe(null);
  });
});

describe('toWeatherModel — forecast (page 2)', () => {
  it('builds the four days after today, skipping today’s (first daily) entry', () => {
    const model = toWeatherModel(hass(SUNNY), config, { daily: DAILY });
    expect(model.forecast).toHaveLength(4);
    expect(model.forecast[0]).toMatchObject({
      datetime: '2026-06-30',
      high: 76,
      low: 59,
      pop: 0,
      condition: 'sunny',
    });
    expect(model.forecast.map((d) => d.high)).toEqual([76, 77, 80, 82]);
  });

  it('sources the current-page PoP from today’s (first daily) entry', () => {
    expect(toWeatherModel(hass(SUNNY), config, { daily: DAILY }).current.pop).toBe(5);
    expect(toWeatherModel(hass(SUNNY), config).current.pop).toBeNull();
  });

  it('degrades page 2 to empty when no forecast is provided', () => {
    expect(toWeatherModel(hass(SUNNY), config).forecast).toEqual([]);
    expect(toWeatherModel(hass(SUNNY), config, { daily: [] }).forecast).toEqual([]);
  });

  it('keeps today’s PoP but degrades page 2 when only today is forecast', () => {
    const today = DAILY.slice(0, 1);
    const model = toWeatherModel(hass(SUNNY), config, { daily: today });
    expect(model.forecast).toEqual([]);
    expect(model.current.pop).toBe(5);
  });
});

describe('toWeatherModel — intra-day periods (page 1)', () => {
  it('derives the next three named periods from the hourly forecast', () => {
    const periods = toWeatherModel(hass(SUNNY), config, { hourly: HOURLY }).current.periods;
    expect(periods.map((p) => p.label)).toEqual(['Evening', 'Overnight', 'Morning']);
    expect(periods.map((p) => p.temp)).toEqual([74, 61, 59]);
    expect(periods[0].condition).toBe('clear-night');
  });

  it('degrades periods to empty when no hourly forecast is provided', () => {
    expect(toWeatherModel(hass(SUNNY), config).current.periods).toEqual([]);
    expect(toWeatherModel(hass(SUNNY), config, { hourly: [] }).current.periods).toEqual([]);
  });
});

describe('periodLabel', () => {
  it('buckets an hour-of-day into a named intra-day period', () => {
    expect(periodLabel(8)).toBe('Morning');
    expect(periodLabel(14)).toBe('Afternoon');
    expect(periodLabel(18)).toBe('Evening');
    expect(periodLabel(23)).toBe('Overnight');
    expect(periodLabel(2)).toBe('Overnight');
  });
});

describe('getForecastsCall', () => {
  it('builds the weather.get_forecasts call for a forecast type', () => {
    expect(getForecastsCall('weather.home', 'daily')).toEqual({
      domain: 'weather',
      service: 'get_forecasts',
      data: { type: 'daily', entity_id: 'weather.home' },
    });
  });
});

describe('parseForecastResponse', () => {
  it('extracts the forecast array for the entity from a get_forecasts response', () => {
    const response = {
      response: { 'weather.home': { forecast: [{ datetime: '2026-06-30', temperature: 76 }] } },
    };
    expect(parseForecastResponse(response, 'weather.home')).toEqual([
      { datetime: '2026-06-30', temperature: 76 },
    ]);
  });

  it('returns an empty list for a malformed or empty response', () => {
    expect(parseForecastResponse(undefined, 'weather.home')).toEqual([]);
    expect(parseForecastResponse({}, 'weather.home')).toEqual([]);
    expect(parseForecastResponse({ response: {} }, 'weather.home')).toEqual([]);
    expect(parseForecastResponse({ response: { 'weather.home': {} } }, 'weather.home')).toEqual([]);
  });
});
