export const CARD_TYPE = 'ecosee-card';

/** One curated entry in the Sensors sub-screen's list (issue #9): a temperature
 *  entity, optionally with a label override and an occupancy entity. The
 *  occupancy entity is what backs the "Occupied" badge — without it the badge is
 *  hidden (ADR-0001 graceful degradation). The thermostat's own temperature is
 *  auto-included by the seam, so it is not listed here. */
export interface SensorConfig {
  /** A temperature entity (typically a `sensor.*`, but any entity carrying a
   *  numeric temperature in its state or `current_temperature` works). */
  entity: string;
  /** Optional label override; defaults to the entity's friendly name. */
  name?: string;
  /** A binary occupancy entity (e.g. `binary_sensor.*`) that backs the "Occupied"
   *  badge for this sensor. Optional: when omitted, the Card auto-pairs the occupancy
   *  binary_sensor that shares this temperature sensor's device (the ecobee
   *  remote-sensor case — ADR-0010), so ecobee sensors get the badge with no extra
   *  config. Set this only to override that (e.g. a different binary source). If
   *  nothing resolves either way, the badge is simply not shown. */
  occupancy_entity?: string;
}

/** When to show the Home Screen's top-row fan shortcut glyph (issues #45, #73).
 *  `auto` (the default) shows it only when the entity exposes a real *speed*
 *  control beyond On/Auto; `always` shows it whenever the Fan sub-screen is
 *  reachable (an On/Auto-only fan then opens straight to the On/Auto toggle);
 *  `never` hides it. Either way the Fan sub-screen stays reachable via Main Menu →
 *  Fan — this only governs the corner shortcut. */
export type ShowFan = 'auto' | 'always' | 'never';

/** Per-element visibility for the Standby Screen (the dimmed idle display). Each
 *  key defaults to shown; set one to `false` to hide that element. Deliberately
 *  YAML-only — not surfaced in the GUI editor — a knob for tinkerers. Ignored
 *  unless `standby_screen` is on. */
export interface StandbyConfig {
  /** The weather condition glyph beside the outdoor temperature. */
  weather?: boolean;
  /** The outdoor temperature (hiding it removes the whole top row, glyph included). */
  outdoor_temp?: boolean;
  /** The large current temperature. */
  current_temp?: boolean;
  /** The equipment-status edge glow — the outer glowing ring. */
  glow?: boolean;
}

/** YAML-first config (ADR-0002): this schema is the source of truth and
 *  `setConfig` validates it. The GUI editor (issue #14, `src/editor/`) is a thin
 *  form *over* this schema, not a second source — it tracks the keys here. Only
 *  `entity` is required; everything else opts additional Home-Screen affordances in. */
export interface EcoseeCardConfig {
  type: string;
  /** The primary `climate` entity the Card is bound to. Required. */
  entity: string;
  /** Optional label override; defaults to the entity's friendly name. */
  name?: string;
  /** A `weather` entity that enables the weather icon + (later) overlay. */
  weather_entity?: string;
  /** Override humidity source when the climate entity has no `current_humidity`. */
  humidity_entity?: string;
  /** Glyph for custom Comfort Settings (presets without a built-in mapping). One of
   *  the Skin's icon names — `home` / `away` / `sleep` / `comfort`; anything else
   *  falls back to `comfort`. The named ecobee Comfort Settings keep their own icon. */
  default_comfort_icon?: string;
  /** A `number` entity backing the Fan minimum-runtime selector (ecobee's
   *  `fan_min_on_time`). The selector is hidden when this is unset/unavailable. */
  fan_min_on_time_entity?: string;
  /** An entity carrying a US-EPA air-quality index — its numeric state, or an
   *  `air_quality_index` attribute. Surfaces the optional air-quality element on the
   *  Home Screen; the element is hidden when this is unset/unavailable (issue #10). */
  air_quality_entity?: string;
  /** An entity carrying a UV index — its numeric state, or a `uv_index` attribute.
   *  Surfaces the optional UV-index gauge on the Home Screen; the gauge is hidden
   *  when this is unset/unavailable (ADR-0001 graceful degradation). */
  uv_index_entity?: string;
  /** Curated temperature sensors for the Sensors sub-screen (issue #9). Each item
   *  may be a bare entity-id string (shorthand) or a `SensorConfig` object. The
   *  thermostat's own temperature is auto-included first, so this lists *extra*
   *  sensors only; absent/empty hides the Sensors sub-screen entirely. */
  sensors?: SensorConfig[];
  /** Seconds of inactivity before any open Overlay auto-reverts to the Home Screen,
   *  mirroring the device's auto-return (issue #13). `0` disables auto-revert; an
   *  unset key uses the device-default (25s). See `inactivityTimeoutMs`. */
  inactivity_timeout?: number;
  /** Opt-in Standby Screen (issue #64). Off by default: absent/`false` means the Card
   *  behaves exactly as today (no standby). The switching behavior that reads this
   *  flag is a separate issue (#65) — this key is only the on/off setting. */
  standby_screen?: boolean;
  /** Per-element visibility for the Standby Screen (YAML-only — a tinkerer knob, not
   *  surfaced in the GUI editor). Each element defaults to shown; see StandbyConfig. */
  standby?: StandbyConfig;
  /** When to show the Home Screen's fan shortcut glyph (`auto` / `always` / `never`).
   *  Absent ⇒ `auto` — the glyph appears only for a fan with real speed controls
   *  (the default before this key existed). See ShowFan. */
  show_fan?: ShowFan;
  /** Minimum separation (deadband) between the heat and cool setpoints in Heat /
   *  Cool (Auto), in the display unit. Most ACs enforce a minimum gap server-side
   *  (commonly 3°F ≈ 1.5°C); pushing the setpoints closer than that gets rejected
   *  and the entity reverts — which looks like "the temperature won't change". The
   *  scrubber keeps this gap by *pushing* the paired setpoint instead of stalling.
   *  Absent ⇒ the unit default (3°F / 1.5°C). `0` lets the two setpoints meet. */
  min_gap?: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/** Validate raw YAML into an EcoseeCardConfig, throwing user-facing errors that
 *  Home Assistant surfaces in the card's error state. */
export function parseConfig(raw: unknown): EcoseeCardConfig {
  if (!isRecord(raw)) {
    throw new Error('ecosee: invalid configuration.');
  }
  const entity = raw.entity;
  if (typeof entity !== 'string' || entity.length === 0) {
    throw new Error('ecosee: `entity` is required (a `climate.*` entity).');
  }
  if (!entity.startsWith('climate.')) {
    throw new Error(`ecosee: \`entity\` must be a climate entity, got "${entity}".`);
  }
  const optionalString = (
    key:
      | 'name'
      | 'weather_entity'
      | 'humidity_entity'
      | 'default_comfort_icon'
      | 'fan_min_on_time_entity'
      | 'air_quality_entity'
      | 'uv_index_entity',
  ): string | undefined => {
    const value = raw[key];
    if (value === undefined) return undefined;
    if (typeof value !== 'string') {
      throw new Error(`ecosee: \`${key}\` must be a string entity id.`);
    }
    return value;
  };

  return {
    type: typeof raw.type === 'string' ? raw.type : `custom:${CARD_TYPE}`,
    entity,
    name: optionalString('name'),
    weather_entity: optionalString('weather_entity'),
    humidity_entity: optionalString('humidity_entity'),
    default_comfort_icon: optionalString('default_comfort_icon'),
    fan_min_on_time_entity: optionalString('fan_min_on_time_entity'),
    air_quality_entity: optionalString('air_quality_entity'),
    uv_index_entity: optionalString('uv_index_entity'),
    sensors: parseSensors(raw.sensors),
    inactivity_timeout: parseInactivityTimeout(raw.inactivity_timeout),
    standby_screen: parseStandbyScreen(raw.standby_screen),
    standby: parseStandby(raw.standby),
    show_fan: parseShowFan(raw.show_fan),
    min_gap: parseMinGap(raw.min_gap),
  };
}

/** Parse the optional `min_gap` (minimum heat/cool separation, in the display
 *  unit). Returns `undefined` when absent so the seam applies the unit default
 *  (3°F / 1.5°C); `0` is a legal "let them meet". Throws a user-facing error for
 *  anything other than a non-negative number. */
function parseMinGap(raw: unknown): number | undefined {
  if (raw === undefined) return undefined;
  if (typeof raw !== 'number' || Number.isNaN(raw) || raw < 0) {
    throw new Error('ecosee: `min_gap` must be a non-negative number of degrees.');
  }
  return raw;
}

/** The legal `show_fan` values; `auto` (the default) is first. */
const SHOW_FAN_VALUES: readonly ShowFan[] = ['auto', 'always', 'never'];

/** Parse the optional `show_fan` control. Returns `undefined` when absent so the
 *  seam applies the `auto` default (glyph only for a real speed control). Throws a
 *  user-facing error for anything outside the small enum. */
function parseShowFan(raw: unknown): ShowFan | undefined {
  if (raw === undefined) return undefined;
  if (typeof raw !== 'string' || !SHOW_FAN_VALUES.includes(raw as ShowFan)) {
    throw new Error("ecosee: `show_fan` must be one of 'auto', 'always', 'never'.");
  }
  return raw as ShowFan;
}

/** Parse the optional `standby` per-element visibility object. Returns `undefined`
 *  when absent (every element shown). Each present key must be a boolean; unset keys
 *  stay `undefined` so the seam treats them as shown. Throws a user-facing error for
 *  a non-object value or a non-boolean toggle. */
function parseStandby(raw: unknown): StandbyConfig | undefined {
  if (raw === undefined) return undefined;
  if (!isRecord(raw)) {
    throw new Error('ecosee: `standby` must be an object of on/off toggles.');
  }
  const bool = (key: keyof StandbyConfig): boolean | undefined => {
    const value = raw[key];
    if (value === undefined) return undefined;
    if (typeof value !== 'boolean') {
      throw new Error(`ecosee: \`standby.${key}\` must be a boolean.`);
    }
    return value;
  };
  return {
    weather: bool('weather'),
    outdoor_temp: bool('outdoor_temp'),
    current_temp: bool('current_temp'),
    glow: bool('glow'),
  };
}

/** Parse the optional `standby_screen` toggle (issue #64). Returns `undefined` when
 *  absent so the feature stays off by default (graceful degradation); a boolean is
 *  taken verbatim. Throws a user-facing error for any non-boolean value. */
function parseStandbyScreen(raw: unknown): boolean | undefined {
  if (raw === undefined) return undefined;
  if (typeof raw !== 'boolean') {
    throw new Error('ecosee: `standby_screen` must be a boolean.');
  }
  return raw;
}

/** Parse the optional `inactivity_timeout` (seconds before an open Overlay
 *  auto-reverts to the Home Screen). Returns `undefined` when absent so the seam
 *  can apply the device-default; `0` is the canonical "off". Throws a user-facing
 *  error for anything other than a non-negative number. */
function parseInactivityTimeout(raw: unknown): number | undefined {
  if (raw === undefined) return undefined;
  if (typeof raw !== 'number' || Number.isNaN(raw) || raw < 0) {
    throw new Error('ecosee: `inactivity_timeout` must be a non-negative number of seconds.');
  }
  return raw;
}

/** Parse the optional `sensors:` list. Each item is either a bare entity-id
 *  string (shorthand) or a `{ entity, name?, occupancy_entity? }` object. Returns
 *  `undefined` when the key is absent so the rest of the Card can treat "no
 *  sensors configured" uniformly. Throws user-facing errors for malformed input. */
function parseSensors(raw: unknown): SensorConfig[] | undefined {
  if (raw === undefined) return undefined;
  if (!Array.isArray(raw)) {
    throw new Error('ecosee: `sensors` must be a list of sensor entities.');
  }
  return raw.map((item, index) => parseSensor(item, index));
}

function parseSensor(item: unknown, index: number): SensorConfig {
  if (typeof item === 'string') {
    if (item.length === 0) {
      throw new Error(`ecosee: \`sensors[${index}]\` must be a non-empty entity id.`);
    }
    return { entity: item };
  }
  if (!isRecord(item)) {
    throw new Error(`ecosee: \`sensors[${index}]\` must be an entity id or an object.`);
  }
  const entity = item.entity;
  if (typeof entity !== 'string' || entity.length === 0) {
    throw new Error(`ecosee: \`sensors[${index}].entity\` is required (a sensor entity id).`);
  }
  const optional = (key: 'name' | 'occupancy_entity'): string | undefined => {
    const value = item[key];
    if (value === undefined) return undefined;
    if (typeof value !== 'string') {
      throw new Error(`ecosee: \`sensors[${index}].${key}\` must be a string entity id.`);
    }
    return value;
  };
  return { entity, name: optional('name'), occupancy_entity: optional('occupancy_entity') };
}
