import type { HomeAssistant } from '../types/hass';
import type { EcoseeCardConfig } from '../config';

// The graceful-degradation seam (ADR-0001). `toHomeView` is a pure function from
// raw `hass` + config to a normalized, already-degraded view model: every field
// whose backing data is absent is `null`/`false`, so the Home Screen renders
// "present → show, absent → hide" without ever faking a control it can't back.

export type EquipmentStatus = 'heating' | 'cooling' | 'idle';
export type SystemMode = 'heat' | 'cool' | 'heat_cool' | 'off' | 'unknown';

/** Active setpoints shown in the Hold pill. Either side may be `null` when the
 *  System Mode only drives one setpoint (Heat-only / Cool-only). */
export interface HoldView {
  heat: number | null;
  cool: number | null;
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
}

const UNAVAILABLE = new Set(['unavailable', 'unknown', 'none', '']);

function num(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function str(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function toMode(state: string): SystemMode {
  switch (state) {
    case 'heat':
      return 'heat';
    case 'cool':
      return 'cool';
    case 'heat_cool':
    case 'auto':
      return 'heat_cool';
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
  return null; // off / unknown ⇒ no pill
}

function weatherAvailable(hass: HomeAssistant, weatherEntity: string | undefined): boolean {
  if (!weatherEntity) return false;
  const entity = hass.states[weatherEntity];
  return !!entity && !UNAVAILABLE.has(entity.state);
}

/** Resume Schedule is ecobee-specific (`ecobee.resume_program`); only offer it
 *  when the bound entity is actually backed by the ecobee integration. */
function canResume(hass: HomeAssistant, entityId: string, mode: SystemMode): boolean {
  return mode !== 'off' && hass.entities?.[entityId]?.platform === 'ecobee';
}

export function toHomeView(hass: HomeAssistant, config: EcoseeCardConfig): HomeView {
  const entity = hass.states[config.entity];
  const unit = hass.config?.unit_system?.temperature ?? '°';
  const name = config.name ?? str(entity?.attributes.friendly_name) ?? config.entity;

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
      weatherAvailable: weatherAvailable(hass, config.weather_entity),
    };
  }

  const attrs = entity.attributes;
  const mode = toMode(entity.state);
  const currentTemp = num(attrs.current_temperature);
  const hold = deriveSetpoints(mode, attrs);
  const equipment = fromHvacAction(str(attrs.hvac_action)) ?? inferEquipment(mode, currentTemp, hold);
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
    weatherAvailable: weatherAvailable(hass, config.weather_entity),
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
