import type { EcoseeCardConfig } from '../src/config';
import type { HomeAssistant, HassEntityBase } from '../src/types/hass';

// Hand-built `hass` snapshots for the preview harness. They exercise the
// graceful-degradation seam end to end: a rich ecobee, a bare generic
// thermostat, and an unavailable entity — without needing a running HA.

export interface Fixture {
  label: string;
  config: EcoseeCardConfig;
  hass: HomeAssistant;
}

function makeHass(options: {
  climate: HassEntityBase;
  weather?: boolean;
  unit?: string;
  extra?: HassEntityBase[];
}): HomeAssistant {
  const states: Record<string, HassEntityBase> = {
    [options.climate.entity_id]: options.climate,
  };
  if (options.weather) {
    states['weather.home'] = {
      entity_id: 'weather.home',
      state: 'sunny',
      attributes: {
        friendly_name: 'Home',
        temperature: 75,
        humidity: 52,
        temperature_unit: options.unit ?? '°F',
        attribution: 'Data provided by Apple Weather',
      },
      last_updated: '2026-06-29T17:00:00',
    };
  }
  for (const entity of options.extra ?? []) states[entity.entity_id] = entity;
  return {
    states,
    config: { unit_system: { temperature: options.unit ?? '°F' } },
    callService: async (domain, service, data, _target, _notify, returnResponse) => {
      console.info('[dev] callService', `${domain}.${service}`, data);
      // Stand in for `weather.get_forecasts` so the Weather overlay's page 2 / the
      // intra-day periods render in the preview harness.
      if (domain === 'weather' && service === 'get_forecasts' && returnResponse) {
        const forecast = data?.type === 'hourly' ? HOURLY_FORECAST : DAILY_FORECAST;
        return { response: { 'weather.home': { forecast } } };
      }
      return undefined;
    },
  };
}

// Mirrors docs/reference/weather-forecast.jpeg (page 2) and the intra-day periods
// on page 1, so the preview harness shows a populated Weather overlay. `[0]` is
// today (Jun 29) — the overlay skips it on page 2 and shows the next four days.
const DAILY_FORECAST = [
  {
    datetime: '2026-06-29',
    condition: 'sunny',
    temperature: 75,
    templow: 60,
    precipitation_probability: 0,
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
    precipitation_probability: 0,
  },
  {
    datetime: '2026-07-03',
    condition: 'sunny',
    temperature: 82,
    templow: 58,
    precipitation_probability: 0,
  },
];
const HOURLY_FORECAST = [
  { datetime: '2026-06-29T17:00:00', condition: 'clear-night', temperature: 74 },
  { datetime: '2026-06-29T21:00:00', condition: 'partlycloudy', temperature: 61 },
  { datetime: '2026-06-30T06:00:00', condition: 'partlycloudy', temperature: 59 },
];

// Reproduces docs/reference/home-hold.jpeg: Heat/Cool (Auto) setpoints 70–75,
// current 75, 60% humidity, actively cooling, weather present, ecobee-backed.
const ecobeeAuto: Fixture = {
  label: 'ecobee · Auto (the photo)',
  config: {
    type: 'custom:ecosee-card',
    entity: 'climate.living_room',
    weather_entity: 'weather.home',
  },
  hass: makeHass({
    weather: true,
    climate: {
      entity_id: 'climate.living_room',
      state: 'heat_cool',
      attributes: {
        friendly_name: 'Living Room',
        current_temperature: 75,
        current_humidity: 60,
        target_temp_low: 70,
        target_temp_high: 75,
        hvac_action: 'cooling',
        hvac_modes: ['off', 'heat', 'cool', 'heat_cool'],
        preset_modes: ['Home', 'Away', 'Sleep'],
        min_temp: 45,
        max_temp: 92,
        target_temp_step: 1,
      },
    },
  }),
};

const ecobeeHeating: Fixture = {
  label: 'ecobee · Heating',
  config: { type: 'custom:ecosee-card', entity: 'climate.bedroom', weather_entity: 'weather.home' },
  hass: makeHass({
    weather: true,
    climate: {
      entity_id: 'climate.bedroom',
      state: 'heat',
      attributes: {
        friendly_name: 'Bedroom',
        current_temperature: 67,
        current_humidity: 38,
        temperature: 70,
        hvac_action: 'heating',
        hvac_modes: ['off', 'heat', 'cool', 'heat_cool'],
        preset_modes: ['Home', 'Away', 'Sleep'],
        min_temp: 45,
        max_temp: 92,
        target_temp_step: 1,
      },
    },
  }),
};

// A bare generic thermostat: no humidity, no hvac_action, no weather.
// The rail collapses and equipment is softly inferred from the setpoints.
const genericDegraded: Fixture = {
  label: 'Generic · degraded',
  config: { type: 'custom:ecosee-card', entity: 'climate.garage' },
  hass: makeHass({
    climate: {
      entity_id: 'climate.garage',
      state: 'heat',
      attributes: {
        friendly_name: 'Garage',
        current_temperature: 64,
        temperature: 68,
      },
    },
  }),
};

// Cool-only: ❄ System Mode glyph, single cyan setpoint pill, blue equipment ring.
const ecobeeCooling: Fixture = {
  label: 'ecobee · Cool',
  config: { type: 'custom:ecosee-card', entity: 'climate.office', weather_entity: 'weather.home' },
  hass: makeHass({
    weather: true,
    climate: {
      entity_id: 'climate.office',
      state: 'cool',
      attributes: {
        friendly_name: 'Office',
        current_temperature: 76,
        current_humidity: 52,
        temperature: 73,
        hvac_action: 'cooling',
        hvac_modes: ['off', 'heat', 'cool', 'heat_cool'],
        min_temp: 45,
        max_temp: 92,
        target_temp_step: 1,
      },
    },
  }),
};

// Off: (OFF) System Mode glyph, no setpoint pill, no equipment ring.
const ecobeeOff: Fixture = {
  label: 'ecobee · Off',
  config: { type: 'custom:ecosee-card', entity: 'climate.den', weather_entity: 'weather.home' },
  hass: makeHass({
    weather: true,
    climate: {
      entity_id: 'climate.den',
      state: 'off',
      attributes: {
        friendly_name: 'Den',
        current_temperature: 74,
        current_humidity: 56,
        hvac_action: 'off',
        hvac_modes: ['off', 'heat', 'cool', 'heat_cool'],
      },
    },
  }),
};

// Reproduces docs/reference/sensors.jpeg: the thermostat's own temp first, then a
// curated list of remote sensors — some with an occupancy entity (→ "Occupied"),
// some without (badge hidden, ADR-0001). Open Main Menu › Sensors to view.
const ecobeeSensors: Fixture = {
  label: 'ecobee · Sensors',
  config: {
    type: 'custom:ecosee-card',
    entity: 'climate.living_room',
    weather_entity: 'weather.home',
    sensors: [
      { entity: 'sensor.hallway_temp', name: 'Hallway', occupancy_entity: 'binary_sensor.hallway' },
      {
        entity: 'sensor.office_temp',
        name: 'Erica Office',
        occupancy_entity: 'binary_sensor.office',
      },
      { entity: 'sensor.kitchen_temp', name: 'Kitchen', occupancy_entity: 'binary_sensor.kitchen' },
      { entity: 'sensor.garage_temp', name: 'Garage' },
    ],
  },
  hass: makeHass({
    weather: true,
    climate: {
      entity_id: 'climate.living_room',
      state: 'heat_cool',
      attributes: {
        friendly_name: 'Living Room',
        current_temperature: 72,
        current_humidity: 60,
        target_temp_low: 70,
        target_temp_high: 75,
        hvac_action: 'idle',
        hvac_modes: ['off', 'heat', 'cool', 'heat_cool'],
      },
    },
    extra: [
      { entity_id: 'sensor.hallway_temp', state: '73', attributes: { friendly_name: 'Hallway' } },
      { entity_id: 'sensor.office_temp', state: '75', attributes: { friendly_name: 'Office' } },
      { entity_id: 'sensor.kitchen_temp', state: '77', attributes: { friendly_name: 'Kitchen' } },
      { entity_id: 'sensor.garage_temp', state: '64', attributes: { friendly_name: 'Garage' } },
      { entity_id: 'binary_sensor.hallway', state: 'on', attributes: {} },
      { entity_id: 'binary_sensor.office', state: 'on', attributes: {} },
      { entity_id: 'binary_sensor.kitchen', state: 'on', attributes: {} },
    ],
  }),
};

// The optional foot gauges (issues #10 / #75): an ecobee with an
// `air_quality_entity` reading 142 — the "Unhealthy for Sensitive Groups"
// band — AND a `uv_index_entity`, so the twin arc meters can be exercised
// side by side across the width slider (they must not overflow the squircle).
const ecobeeAirQuality: Fixture = {
  label: 'ecobee · Air quality + UV',
  config: {
    type: 'custom:ecosee-card',
    entity: 'climate.living_room',
    weather_entity: 'weather.home',
    air_quality_entity: 'sensor.air_quality_index',
    uv_index_entity: 'sensor.uv_index',
  },
  hass: makeHass({
    weather: true,
    climate: {
      entity_id: 'climate.living_room',
      state: 'heat_cool',
      attributes: {
        friendly_name: 'Living Room',
        current_temperature: 75,
        current_humidity: 60,
        target_temp_low: 70,
        target_temp_high: 75,
        hvac_action: 'idle',
        hvac_modes: ['off', 'heat', 'cool', 'heat_cool'],
      },
    },
    extra: [
      {
        entity_id: 'sensor.air_quality_index',
        state: '142',
        attributes: { friendly_name: 'Air Quality', device_class: 'aqi' },
      },
      {
        entity_id: 'sensor.uv_index',
        state: '6',
        attributes: { friendly_name: 'UV Index' },
      },
    ],
  }),
};

const unavailable: Fixture = {
  label: 'Unavailable entity',
  config: { type: 'custom:ecosee-card', entity: 'climate.living_room' },
  hass: makeHass({
    climate: {
      entity_id: 'climate.living_room',
      state: 'unavailable',
      attributes: { friendly_name: 'Living Room' },
    },
  }),
};

// The bound climate entity is unavailable but the air-quality entity is fine — the
// element is backed by its own entity, so it still renders on the quiet shell
// (issue #10). Reads 38 → "Good".
const unavailableWithAirQuality: Fixture = {
  label: 'Unavailable · air quality still shown',
  config: {
    type: 'custom:ecosee-card',
    entity: 'climate.living_room',
    air_quality_entity: 'sensor.air_quality_index',
  },
  hass: makeHass({
    climate: {
      entity_id: 'climate.living_room',
      state: 'unavailable',
      attributes: { friendly_name: 'Living Room' },
    },
    extra: [
      {
        entity_id: 'sensor.air_quality_index',
        state: '38',
        attributes: { friendly_name: 'Air Quality', device_class: 'aqi' },
      },
    ],
  }),
};

export const fixtures: Fixture[] = [
  ecobeeAuto,
  ecobeeHeating,
  ecobeeCooling,
  ecobeeOff,
  ecobeeSensors,
  ecobeeAirQuality,
  genericDegraded,
  unavailable,
  unavailableWithAirQuality,
];
