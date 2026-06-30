import type { HomeAssistant } from '../types/hass';
import type { EcoseeCardConfig } from '../config';
import { num } from './parse';

// The graceful-degradation seam (ADR-0001). `toHomeView` is a pure function from
// raw `hass` + config to a normalized, already-degraded view model: every field
// whose backing data is absent is `null`/`false`, so the Home Screen renders
// "present → show, absent → hide" without ever faking a control it can't back.

export type EquipmentStatus = 'heating' | 'cooling' | 'idle';
/** The bound entity's operating mode. The ecobee device exposes only Heat / Cool
 *  / Heat / Cool (Auto) / Off, but a generic `climate` entity (ADR-0001) may also
 *  run in `dry` or `fan_only`, so the Card recognizes those too. */
export type SystemMode = 'heat' | 'cool' | 'heat_cool' | 'dry' | 'fan_only' | 'off' | 'unknown';

/** Active setpoints shown in the Hold pill. Either side may be `null` when the
 *  System Mode only drives one setpoint (Heat-only / Cool-only). */
export interface HoldView {
  heat: number | null;
  cool: number | null;
}

/** US-EPA AQI severity band, keyed by the Home Screen to the element's color. */
export type AirQualityLevel =
  'good' | 'moderate' | 'sensitive' | 'unhealthy' | 'very-unhealthy' | 'hazardous';

/** The optional air-quality element's already-degraded data (issue #10): present
 *  only when a usable `air_quality_entity` is configured, `null` otherwise. */
export interface AirQualityView {
  /** The numeric AQI (US-EPA scale), rounded to a whole number. */
  aqi: number;
  /** Friendly category for the AQI band ("Good", "Moderate", …). */
  category: string;
  /** Severity band the view maps to the element's color. */
  level: AirQualityLevel;
}

export interface HomeView {
  /** False when the entity is missing or `unavailable` — Card shows a quiet shell. */
  available: boolean;
  name: string;
  /** `current_temperature` — the dominant number. Not a setpoint. */
  currentTemp: number | null;
  unit: string;
  humidity: number | null;
  /** From `hvac_action`; softly inferred when absent; `null` ⇒ indicator hidden. */
  equipment: EquipmentStatus | null;
  mode: SystemMode;
  /** Active setpoints, or `null` when none are expressible (e.g. System Mode Off). */
  hold: HoldView | null;
  /** Whether a Resume Schedule action is backable (gates the pill's ✕). */
  canResume: boolean;
  /** Whether a usable `weather` entity is configured (gates the weather icon). */
  weatherAvailable: boolean;
  /** The weather entity's current condition (`sunny` / `clear-night` / … ), or
   *  `null` when no usable weather entity is configured. The Home Screen's weather
   *  affordance shows this condition's glyph — the device reflects the live weather,
   *  not a fixed sun. */
  weatherCondition: string | null;
  /** The optional air-quality element, or `null` when no usable `air_quality_entity`
   *  is configured (the element is then hidden — ADR-0001 graceful degradation). */
  airQuality: AirQualityView | null;
}

/** Entity states that carry no usable data — a Card/Overlay degrades to its
 *  empty shell for any of these (shared across the climate seams). */
export const UNAVAILABLE = new Set(['unavailable', 'unknown', 'none', '']);

function str(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

export function toMode(state: string): SystemMode {
  switch (state) {
    case 'heat':
      return 'heat';
    case 'cool':
      return 'cool';
    case 'heat_cool':
    case 'auto':
      return 'heat_cool';
    case 'dry':
      return 'dry';
    case 'fan_only':
      return 'fan_only';
    case 'off':
      return 'off';
    default:
      return 'unknown';
  }
}

function fromHvacAction(action: string | undefined): EquipmentStatus | null {
  switch (action) {
    case 'heating':
      return 'heating';
    case 'cooling':
      return 'cooling';
    case 'idle':
    case 'off':
      return 'idle';
    default:
      // 'drying' / 'fan' / undefined — not represented on the Home Screen.
      return null;
  }
}

/** Best-effort equipment status when `hvac_action` is absent: compare the current
 *  temperature against the active setpoints. Conservative — returns `null` (hidden)
 *  rather than guessing when there is nothing to compare. */
function inferEquipment(
  mode: SystemMode,
  currentTemp: number | null,
  hold: HoldView | null,
): EquipmentStatus | null {
  if (currentTemp === null || hold === null) return null;
  if (mode === 'heat' && hold.heat !== null) {
    return currentTemp < hold.heat ? 'heating' : 'idle';
  }
  if (mode === 'cool' && hold.cool !== null) {
    return currentTemp > hold.cool ? 'cooling' : 'idle';
  }
  if (mode === 'heat_cool') {
    if (hold.heat !== null && currentTemp < hold.heat) return 'heating';
    if (hold.cool !== null && currentTemp > hold.cool) return 'cooling';
    return 'idle';
  }
  return null;
}

function deriveSetpoints(mode: SystemMode, attrs: Record<string, unknown>): HoldView | null {
  if (mode === 'heat_cool') {
    const heat = num(attrs.target_temp_low);
    const cool = num(attrs.target_temp_high);
    return heat === null && cool === null ? null : { heat, cool };
  }
  const single = num(attrs.temperature);
  if (single === null) return null;
  if (mode === 'heat') return { heat: single, cool: null };
  if (mode === 'cool') return { heat: null, cool: single };
  return null; // off / dry / fan_only / unknown ⇒ no pill
}

/** The configured `weather` entity's current condition, or `null` when none is
 *  configured/usable. Doubles as the availability check (the Home Screen shows the
 *  weather affordance iff this is non-null) and supplies the glyph the device
 *  reflects from the live condition. */
function weatherCondition(hass: HomeAssistant, weatherEntity: string | undefined): string | null {
  if (!weatherEntity) return null;
  const entity = hass.states[weatherEntity];
  if (!entity || UNAVAILABLE.has(entity.state)) return null;
  return entity.state;
}

/** Resume Schedule is ecobee-specific (`ecobee.resume_program`); only offer it
 *  when the bound entity is actually backed by the ecobee integration. */
function canResume(hass: HomeAssistant, entityId: string, mode: SystemMode): boolean {
  return mode !== 'off' && hass.entities?.[entityId]?.platform === 'ecobee';
}

/** Categorize a US-EPA air-quality index into its band. The thresholds are the
 *  standard EPA breakpoints; an out-of-range value clamps to the nearest band. */
function aqiBand(aqi: number): { category: string; level: AirQualityLevel } {
  if (aqi <= 50) return { category: 'Good', level: 'good' };
  if (aqi <= 100) return { category: 'Moderate', level: 'moderate' };
  if (aqi <= 150) return { category: 'Unhealthy for Sensitive Groups', level: 'sensitive' };
  if (aqi <= 200) return { category: 'Unhealthy', level: 'unhealthy' };
  if (aqi <= 300) return { category: 'Very Unhealthy', level: 'very-unhealthy' };
  return { category: 'Hazardous', level: 'hazardous' };
}

/** Derive the optional air-quality element (issue #10) from the configured
 *  `air_quality_entity`: its numeric state, or an `air_quality_index` attribute for
 *  the legacy `air_quality` domain. Returns `null` — element hidden — when the key
 *  is unset, the entity is missing/unavailable, or it carries no numeric reading
 *  (ADR-0001 graceful degradation). */
function toAirQuality(hass: HomeAssistant, config: EcoseeCardConfig): AirQualityView | null {
  const entityId = config.air_quality_entity;
  if (!entityId) return null;
  const entity = hass.states[entityId];
  if (!entity || UNAVAILABLE.has(entity.state)) return null;
  const aqi = num(entity.state) ?? num(entity.attributes.air_quality_index);
  if (aqi === null) return null;
  const rounded = Math.round(aqi);
  return { aqi: rounded, ...aqiBand(rounded) };
}

export function toHomeView(hass: HomeAssistant, config: EcoseeCardConfig): HomeView {
  const entity = hass.states[config.entity];
  const unit = hass.config?.unit_system?.temperature ?? '°';
  const name = config.name ?? str(entity?.attributes.friendly_name) ?? config.entity;

  const weather = weatherCondition(hass, config.weather_entity);

  if (!entity || UNAVAILABLE.has(entity.state)) {
    return {
      available: false,
      name,
      currentTemp: null,
      unit,
      humidity: null,
      equipment: null,
      mode: 'unknown',
      hold: null,
      canResume: false,
      weatherAvailable: weather !== null,
      weatherCondition: weather,
      airQuality: toAirQuality(hass, config),
    };
  }

  const attrs = entity.attributes;
  const mode = toMode(entity.state);
  const currentTemp = num(attrs.current_temperature);
  const hold = deriveSetpoints(mode, attrs);
  const equipment =
    fromHvacAction(str(attrs.hvac_action)) ?? inferEquipment(mode, currentTemp, hold);
  const humidity =
    num(attrs.current_humidity) ??
    (config.humidity_entity ? num(hass.states[config.humidity_entity]?.state) : null);

  return {
    available: true,
    name,
    currentTemp,
    unit,
    humidity,
    equipment,
    mode,
    hold,
    canResume: canResume(hass, config.entity, mode),
    weatherAvailable: weather !== null,
    weatherCondition: weather,
    airQuality: toAirQuality(hass, config),
  };
}

/** Display formatting for temperatures: whole degrees in °F, half degrees in °C,
 *  matching how the device renders numbers. */
export function formatTemp(value: number | null, unit: string): string {
  if (value === null) return '–';
  const celsius = unit.includes('C');
  const rounded = celsius ? Math.round(value * 2) / 2 : Math.round(value);
  return celsius && !Number.isInteger(rounded) ? rounded.toFixed(1) : String(rounded);
}
