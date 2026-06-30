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
  platform?: string;
  weather?: boolean;
  unit?: string;
}): HomeAssistant {
  const states: Record<string, HassEntityBase> = {
    [options.climate.entity_id]: options.climate,
  };
  if (options.weather) {
    states['weather.home'] = {
      entity_id: 'weather.home',
      state: 'sunny',
      attributes: { friendly_name: 'Home', temperature: 82 },
    };
  }
  return {
    states,
    entities: {
      [options.climate.entity_id]: { platform: options.platform ?? 'generic_thermostat' },
    },
    config: { unit_system: { temperature: options.unit ?? '°F' } },
    callService: async (domain, service, data) => {
      console.info('[dev] callService', `${domain}.${service}`, data);
    },
  };
}

// Reproduces docs/reference/home-hold.jpeg: Heat/Cool (Auto) hold 70–75,
// current 75, 60% humidity, actively cooling, weather present, ecobee-backed.
const ecobeeAutoHold: Fixture = {
  label: 'ecobee · Auto hold (the photo)',
  config: {
    type: 'custom:ecosee-card',
    entity: 'climate.living_room',
    weather_entity: 'weather.home',
  },
  hass: makeHass({
    platform: 'ecobee',
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
    platform: 'ecobee',
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

// A bare generic thermostat: no humidity, no hvac_action, no weather, not ecobee.
// The rail collapses, equipment is softly inferred, and the pill shows no ✕.
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
    platform: 'ecobee',
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

// Off: (OFF) System Mode glyph, no Hold pill, no equipment ring.
const ecobeeOff: Fixture = {
  label: 'ecobee · Off',
  config: { type: 'custom:ecosee-card', entity: 'climate.den', weather_entity: 'weather.home' },
  hass: makeHass({
    platform: 'ecobee',
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

export const fixtures: Fixture[] = [
  ecobeeAutoHold,
  ecobeeHeating,
  ecobeeCooling,
  ecobeeOff,
  genericDegraded,
  unavailable,
];
