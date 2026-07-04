import type { HassEntityBase, HomeAssistant } from '../types/hass';
import type { EcoseeCardConfig, SensorConfig } from '../config';
import { num } from '../climate/parse';
import { UNAVAILABLE } from '../climate/home-view';

// The derivation seam for the Sensors sub-screen (the sibling of `toHomeView` /
// `toSystemModeModel`). `toSensorsModel` builds an
// already-degraded list of sensor cards from raw `hass` + config: the thermostat's
// own temperature first, then each user-curated temperature entity, dropping any
// that is missing / unavailable / non-numeric and attaching an occupancy badge
// when a usable occupancy entity is configured or auto-paired from the sensor's
// device (ADR-0010; CONTEXT.md Sensors Screen;
// ADR-0001 graceful degradation). All the entity-reading lives here so it is
// unit-testable without rendering a Lit element; the overlay is purely
// presentational and read-only (no "participating in average" UI — HA can't back
// it, per issue #9).

/** One horizontal sensor card: a name, a current temperature (already confirmed
 *  present — the card is dropped otherwise), tri-state occupancy, and whether this
 *  is the thermostat's own card (always first; gets the device glyph). */
export interface SensorCard {
  /** Stable list key — the source entity id. */
  key: string;
  /** Display name (config override → friendly_name → entity id). */
  name: string;
  /** Parsed current temperature, formatted by the overlay against `unit`. */
  temp: number;
  /** Tri-state occupancy: `null` when no usable occupancy entity is configured or
   *  auto-paired for this sensor (badge hidden, ADR-0001); otherwise whether it
   *  reports occupied. */
  occupied: boolean | null;
  /** True only for the thermostat's own temperature card (always first). */
  isThermostat: boolean;
}

export interface SensorsModel {
  /** The temperature unit (°F / °C) the overlay formats card temperatures with. */
  unit: string;
  /** False when no *configured* sensor yields a usable card — the Sensors
   *  sub-screen is then hidden (issue #9 acceptance criteria). The thermostat's
   *  own temperature alone does not surface the sub-screen, so `cards` is empty
   *  whenever this is false. */
  available: boolean;
  /** The thermostat's own temp first (when usable), then each usable configured
   *  sensor in config order. Empty when `available` is false. */
  cards: SensorCard[];
}

function str(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function isUsable(hass: HomeAssistant, entityId: string) {
  const entity = hass.states[entityId];
  if (!entity || UNAVAILABLE.has(entity.state)) return undefined;
  return entity;
}

/** Read a temperature from a sensor: a plain `sensor.*` carries the value in its
 *  state; a `climate`/remote entity carries it in `current_temperature`. */
function readTemp(entity: HassEntityBase): number | null {
  return num(entity.state) ?? num(entity.attributes.current_temperature);
}

/** The `device_class` an occupancy binary_sensor reports — the value we auto-pair
 *  on. ecobee registers each remote sensor as one device carrying both a
 *  `sensor.*_temperature` and a `binary_sensor.*_occupancy` with this class. */
const OCCUPANCY_DEVICE_CLASS = 'occupancy';

/** Auto-pair (ADR-0010): given a configured temperature entity, find an occupancy
 *  binary_sensor that shares its device — the ecobee remote-sensor case, where the
 *  temperature and occupancy entities live on the same device. Returns the sibling's
 *  entity id, or `undefined` when the entity registry is absent, the temp entity has
 *  no device, or that device carries no occupancy binary_sensor. In every such case
 *  the badge stays hidden (ADR-0001 graceful degradation). This is a fallback only —
 *  an explicit `occupancy_entity` bypasses it entirely (see `occupancy`). */
function autoPairOccupancy(hass: HomeAssistant, tempEntityId: string): string | undefined {
  const registry = hass.entities;
  if (!registry) return undefined;
  const deviceId = registry[tempEntityId]?.device_id;
  if (!deviceId) return undefined;
  for (const [id, entry] of Object.entries(registry)) {
    if (entry.device_id !== deviceId || !id.startsWith('binary_sensor.')) continue;
    if (hass.states[id]?.attributes.device_class === OCCUPANCY_DEVICE_CLASS) return id;
  }
  return undefined;
}

/** Tri-state occupancy for a configured sensor. An explicit `occupancy_entity` wins;
 *  otherwise we auto-pair the temperature sensor's device sibling (autoPairOccupancy).
 *  `null` when neither resolves, or the resolved entity is missing/unavailable (badge
 *  hidden); otherwise whether the (binary) occupancy entity reports `on`. */
function occupancy(hass: HomeAssistant, sensor: SensorConfig): boolean | null {
  const occupancyEntity = sensor.occupancy_entity ?? autoPairOccupancy(hass, sensor.entity);
  if (!occupancyEntity) return null;
  const entity = isUsable(hass, occupancyEntity);
  if (!entity) return null;
  return entity.state === 'on';
}

function toSensorCard(hass: HomeAssistant, sensor: SensorConfig): SensorCard | null {
  const entity = isUsable(hass, sensor.entity);
  if (!entity) return null;
  const temp = readTemp(entity);
  if (temp === null) return null;
  return {
    key: sensor.entity,
    name: sensor.name ?? str(entity.attributes.friendly_name) ?? sensor.entity,
    temp,
    occupied: occupancy(hass, sensor),
    isThermostat: false,
  };
}

/** The thermostat's own temperature card (always first when present). Its
 *  occupancy is always `null` — there is no generic occupancy source for the bound
 *  `climate` entity itself. */
function toThermostatCard(hass: HomeAssistant, config: EcoseeCardConfig): SensorCard | null {
  const entity = isUsable(hass, config.entity);
  if (!entity) return null;
  const temp = num(entity.attributes.current_temperature);
  if (temp === null) return null;
  return {
    key: config.entity,
    name: config.name ?? str(entity.attributes.friendly_name) ?? config.entity,
    temp,
    occupied: null,
    isThermostat: true,
  };
}

export function toSensorsModel(hass: HomeAssistant, config: EcoseeCardConfig): SensorsModel {
  const unit = hass.config?.unit_system?.temperature ?? '°';

  // Configured sensors gate the whole sub-screen: with none usable the Sensors
  // entry is hidden, and the thermostat's own temp alone does not surface it
  // (issue #9). So derive the configured cards first.
  const configured = (config.sensors ?? [])
    .map((sensor) => toSensorCard(hass, sensor))
    .filter((card): card is SensorCard => card !== null);

  if (configured.length === 0) return { unit, available: false, cards: [] };

  const thermostat = toThermostatCard(hass, config);
  const cards = thermostat ? [thermostat, ...configured] : configured;
  return { unit, available: true, cards };
}
