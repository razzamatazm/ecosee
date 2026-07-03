import type { HomeAssistant } from '../types/hass';
import type { EcoseeCardConfig } from '../config';
import { num } from './parse';
import { toFanModel, showFanAffordance } from './fan';

// The graceful-degradation seam (ADR-0001). `toHomeView` is a pure function from
// raw `hass` + config to a normalized, already-degraded view model: every field
// whose backing data is absent is `null`/`false`, so the Home Screen renders
// "present → show, absent → hide" without ever faking a control it can't back.

export type EquipmentStatus = 'heating' | 'cooling' | 'idle';
/** The bound entity's operating mode. The ecobee device exposes only Heat / Cool
 *  / Heat / Cool (Auto) / Off, but a generic `climate` entity (ADR-0001) may also
 *  run in `dry` or `fan_only`, so the Card recognizes those too. */
export type SystemMode = 'heat' | 'cool' | 'heat_cool' | 'dry' | 'fan_only' | 'off' | 'unknown';

/** The active heat/cool setpoints. Either side may be `null` when the System Mode
 *  only drives one setpoint (Heat-only / Cool-only). */
export interface Setpoints {
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
  /** Arc fill fraction 0–1 — the raw AQI over the gauge scale max (300, where
   *  the Hazardous band begins; higher readings pin the arc full). */
  fraction: number;
}

/** UV-index severity band, keyed by the Home Screen to the gauge's color — green
 *  (Low) → violet (Extreme), following the WHO scale. */
export type UvLevel = 'none' | 'low' | 'moderate' | 'high' | 'very-high' | 'extreme';

/** The optional UV-index gauge's already-degraded data: present only when a usable
 *  `uv_index_entity` is configured, `null` otherwise (ADR-0001). */
export interface UvIndexView {
  /** The UV index, rounded to a whole number. */
  uvi: number;
  /** Friendly category for the UV band ("Low", "Moderate", …). */
  category: string;
  /** Severity band the gauge maps to its color. */
  level: UvLevel;
  /** Arc fill fraction 0–1 — the raw index over the scale max (11). */
  fraction: number;
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
  setpoints: Setpoints | null;
  /** Whether a usable `weather` entity is configured (gates the weather icon). */
  weatherAvailable: boolean;
  /** Whether the Home Screen shows its top-row fan glyph — the quick shortcut into
   *  the Fan sub-screen — the same way `weatherAvailable` gates the weather glyph
   *  (issue #45). Its default (issue #73) shows the glyph only for a real fan *speed*
   *  control; the `show_fan` config widens it to `always` (any fan, On/Auto included)
   *  or narrows it to `never`. See `showFanAffordance`. Either way the Fan sub-screen
   *  stays reachable through Main Menu → Fan (`toFanModel().available`). */
  fanAvailable: boolean;
  /** The weather entity's current condition (`sunny` / `clear-night` / … ), or
   *  `null` when no usable weather entity is configured. The Home Screen's weather
   *  affordance shows this condition's glyph — the device reflects the live weather,
   *  not a fixed sun. */
  weatherCondition: string | null;
  /** The optional air-quality element, or `null` when no usable `air_quality_entity`
   *  is configured (the element is then hidden — ADR-0001 graceful degradation). */
  airQuality: AirQualityView | null;
  /** The optional UV-index gauge, or `null` when no usable `uv_index_entity` is
   *  configured (the gauge is then hidden — ADR-0001 graceful degradation). */
  uvIndex: UvIndexView | null;
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
  setpoints: Setpoints | null,
): EquipmentStatus | null {
  if (currentTemp === null || setpoints === null) return null;
  if (mode === 'heat' && setpoints.heat !== null) {
    return currentTemp < setpoints.heat ? 'heating' : 'idle';
  }
  if (mode === 'cool' && setpoints.cool !== null) {
    return currentTemp > setpoints.cool ? 'cooling' : 'idle';
  }
  if (mode === 'heat_cool') {
    if (setpoints.heat !== null && currentTemp < setpoints.heat) return 'heating';
    if (setpoints.cool !== null && currentTemp > setpoints.cool) return 'cooling';
    return 'idle';
  }
  return null;
}

function deriveSetpoints(mode: SystemMode, attrs: Record<string, unknown>): Setpoints | null {
  if (mode === 'heat_cool') {
    const heat = num(attrs.target_temp_low);
    const cool = num(attrs.target_temp_high);
    return heat === null && cool === null ? null : { heat, cool };
  }
  const single = num(attrs.temperature);
  if (single === null) return null;
  if (mode === 'heat') return { heat: single, cool: null };
  if (mode === 'cool') return { heat: null, cool: single };
  return null; // off / dry / fan_only / unknown ⇒ no setpoints
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
 *  (ADR-0001 graceful degradation). The arc fills from the raw AQI over the gauge
 *  scale max (300 — where Hazardous begins); the band/number use the rounded value,
 *  mirroring the UV-index gauge. */
function toAirQuality(hass: HomeAssistant, config: EcoseeCardConfig): AirQualityView | null {
  const entityId = config.air_quality_entity;
  if (!entityId) return null;
  const entity = hass.states[entityId];
  if (!entity || UNAVAILABLE.has(entity.state)) return null;
  const aqi = num(entity.state) ?? num(entity.attributes.air_quality_index);
  if (aqi === null) return null;
  const rounded = Math.round(aqi);
  return { aqi: rounded, ...aqiBand(rounded), fraction: Math.min(Math.max(aqi, 0) / 300, 1) };
}

/** Categorize a UV index into its band. Thresholds follow the design's scale
 *  (0 None, 1–3 Low, 4–5 Moderate, 6–7 High, 8–10 Very high, 11+ Extreme). */
function uvBand(uvi: number): { category: string; level: UvLevel } {
  if (uvi <= 0) return { category: 'None', level: 'none' };
  if (uvi <= 3) return { category: 'Low', level: 'low' };
  if (uvi <= 5) return { category: 'Moderate', level: 'moderate' };
  if (uvi <= 7) return { category: 'High', level: 'high' };
  if (uvi <= 10) return { category: 'Very high', level: 'very-high' };
  return { category: 'Extreme', level: 'extreme' };
}

/** Derive the optional UV-index gauge from the configured `uv_index_entity`: its
 *  numeric state, or a `uv_index` attribute. Returns `null` — gauge hidden — when
 *  the key is unset, the entity is missing/unavailable, or it carries no numeric
 *  reading (ADR-0001 graceful degradation). The arc fills from the raw index over
 *  the scale max (11); the band/number use the rounded value. */
function toUvIndex(hass: HomeAssistant, config: EcoseeCardConfig): UvIndexView | null {
  const entityId = config.uv_index_entity;
  if (!entityId) return null;
  const entity = hass.states[entityId];
  if (!entity || UNAVAILABLE.has(entity.state)) return null;
  const raw = num(entity.state) ?? num(entity.attributes.uv_index);
  if (raw === null) return null;
  const value = Math.max(0, raw);
  const rounded = Math.round(value);
  return { uvi: rounded, ...uvBand(rounded), fraction: Math.min(value / 11, 1) };
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
      setpoints: null,
      weatherAvailable: weather !== null,
      weatherCondition: weather,
      fanAvailable: false,
      airQuality: toAirQuality(hass, config),
      uvIndex: toUvIndex(hass, config),
    };
  }

  const attrs = entity.attributes;
  const mode = toMode(entity.state);
  const currentTemp = num(attrs.current_temperature);
  const setpoints = deriveSetpoints(mode, attrs);
  const equipment =
    fromHvacAction(str(attrs.hvac_action)) ?? inferEquipment(mode, currentTemp, setpoints);
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
    setpoints,
    weatherAvailable: weather !== null,
    weatherCondition: weather,
    fanAvailable: showFanAffordance(toFanModel(hass, config), config.show_fan),
    airQuality: toAirQuality(hass, config),
    uvIndex: toUvIndex(hass, config),
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
