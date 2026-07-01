import type { HomeAssistant } from '../types/hass';
import type { EcoseeCardConfig } from '../config';
import type { ServiceCall } from '../climate/service-call';
import { UNAVAILABLE } from '../climate/home-view';
import { num } from '../climate/parse';

// The derivation seam for the Weather Overlay (the sibling of `toHomeView` /
// `toSystemModeModel`). `toWeatherModel` builds an already-degraded view of the
// configured `weather_entity` — current conditions from the entity's own
// attributes, and the multi-day forecast / intra-day periods from forecast data
// the host fetches separately. In modern Home Assistant the forecast comes from
// the `weather.get_forecasts` SERVICE, not a static attribute (ADR-0001), so the
// forecast arrives here as an argument rather than being read off `hass`; when it
// is absent (an entity that offers no forecast), page 2 and the periods degrade to
// empty rather than render broken. All the vocabulary reconciliation (HA condition
// strings → friendly labels, hour-of-day → named period) lives here so it is
// unit-testable without rendering a Lit element. The Overlay itself is read-only:
// there is no edit state and no service write — only pagination, owned by the view.

/** A single forecast entry as `weather.get_forecasts` returns it. Every field is
 *  optional: a generic provider may omit any of them (ADR-0001). */
export interface ForecastEntry {
  datetime?: string;
  condition?: string;
  /** Daily high (daily forecast) or the period temperature (hourly forecast). */
  temperature?: number;
  /** Daily low — rendered as the forecast column's "Lo [low]". */
  templow?: number;
  /** Probability of precipitation, 0–100 — rendered as the ☂ + % chance-of-precip. */
  precipitation_probability?: number;
}

/** The forecast bundle the host fetches and threads into the seam. Either kind may
 *  be missing when the entity does not support that forecast `type`. */
export interface WeatherForecasts {
  /** Per-day entries — back page 2 (the 4-day forecast) and today's chance-of-precip. */
  daily?: ForecastEntry[];
  /** Per-hour entries — bucketed into the named intra-day periods on page 1. */
  hourly?: ForecastEntry[];
}

/** The forecast `type` argument `weather.get_forecasts` accepts (this Card uses
 *  daily for page 2 and hourly for the intra-day periods). */
export type ForecastType = 'daily' | 'hourly';

/** One intra-day period on page 1 (Evening / Overnight / Morning …). */
export interface WeatherPeriod {
  label: string;
  /** Raw HA condition string (the view maps it to a glyph); `''` when absent. */
  condition: string;
  temp: number | null;
}

/** One day on page 2's 4-day forecast. `datetime` is kept raw so the view formats
 *  the weekday label (locale/timezone formatting is a presentational concern). */
export interface WeatherDay {
  datetime: string;
  condition: string;
  high: number | null;
  low: number | null;
  pop: number | null;
}

/** Page 1 — current conditions. Each field is independently degradable: a field
 *  whose backing data is absent is `null`/empty so the view hides it. */
export interface WeatherCurrent {
  /** Raw HA condition string (the view maps it to a glyph); `''` when absent. */
  condition: string;
  /** Friendly text for the condition, e.g. "Partly Cloudy". */
  conditionLabel: string;
  temp: number | null;
  humidity: number | null;
  /** Today's probability of precipitation; `null` ⇒ the ☂ + % stat is hidden. */
  pop: number | null;
  /** Raw entity timestamp for the "as of [time]" line; `null` ⇒ hidden. */
  asOf: string | null;
  /** Intra-day periods; empty ⇒ the periods row is hidden (no hourly forecast). */
  periods: WeatherPeriod[];
}

export interface WeatherModel {
  /** False when no usable `weather_entity` is configured — the Overlay (and the
   *  Home Screen weather icon, and the Main Menu Weather row) shows nothing. */
  available: boolean;
  unit: string;
  /** The provider credit for the footer ("Data provided by …"); `null` ⇒ hidden. */
  attribution: string | null;
  current: WeatherCurrent;
  /** The four days *after* today for page 2 (today owns page 1); empty ⇒ page 2
   *  degrades away (no forecast, or only today is known). */
  forecast: WeatherDay[];
}

/** Friendly labels for Home Assistant's standard `weather` conditions. An
 *  unrecognized string (a provider-specific condition) falls back to a title-cased
 *  form of the raw value, so the Overlay never shows a bare slug. */
const CONDITION_LABELS: Record<string, string> = {
  'clear-night': 'Clear',
  cloudy: 'Cloudy',
  exceptional: 'Exceptional',
  fog: 'Fog',
  hail: 'Hail',
  lightning: 'Lightning',
  'lightning-rainy': 'Thunderstorms',
  partlycloudy: 'Partly Cloudy',
  pouring: 'Pouring',
  rainy: 'Rainy',
  snowy: 'Snowy',
  'snowy-rainy': 'Sleet',
  sunny: 'Sunny',
  windy: 'Windy',
  'windy-variant': 'Windy',
};

/** How many days page 2 shows, and how many named periods page 1 shows. */
const FORECAST_DAYS = 4;
const PERIOD_COUNT = 3;

function str(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function titleCase(raw: string): string {
  return raw
    .split(/[-_\s]+/)
    .filter((word) => word.length > 0)
    .map((word) => word[0].toUpperCase() + word.slice(1))
    .join(' ');
}

function conditionLabel(condition: string): string {
  if (condition === '') return '';
  return CONDITION_LABELS[condition] ?? titleCase(condition);
}

/** Bucket an hour-of-day (0–23, local) into the device's named intra-day periods.
 *  Boundaries are chosen so that from a ~5pm "now" the next three periods read
 *  Evening → Overnight → Morning, matching docs/reference/weather-current.jpeg. */
export function periodLabel(hour: number): string {
  if (hour >= 5 && hour < 12) return 'Morning';
  if (hour >= 12 && hour < 17) return 'Afternoon';
  if (hour >= 17 && hour < 21) return 'Evening';
  return 'Overnight';
}

/** The hour-of-day of a forecast entry, in the runtime's local timezone (which
 *  for an on-wall thermostat is the home's). Returns `null` for an unparseable or
 *  missing datetime. */
function localHour(datetime: string | undefined): number | null {
  if (!datetime) return null;
  const date = new Date(datetime);
  return Number.isNaN(date.getTime()) ? null : date.getHours();
}

/** Collapse the hourly forecast into the next `PERIOD_COUNT` distinct named
 *  periods, taking the first entry of each as that period's representative (the
 *  device shows one condition + temp per upcoming period). */
function toPeriods(hourly: ForecastEntry[] | undefined): WeatherPeriod[] {
  if (!hourly) return [];
  const periods: WeatherPeriod[] = [];
  let runningLabel: string | null = null;
  for (const entry of hourly) {
    const hour = localHour(entry.datetime);
    if (hour === null) continue;
    const label = periodLabel(hour);
    if (label === runningLabel) continue; // still inside the current period
    runningLabel = label;
    periods.push({ label, condition: str(entry.condition) ?? '', temp: num(entry.temperature) });
    if (periods.length === PERIOD_COUNT) break;
  }
  return periods;
}

function toForecast(daily: ForecastEntry[] | undefined): WeatherDay[] {
  if (!daily) return [];
  // The device's forecast page starts *tomorrow* — today already owns page 1
  // (its conditions + PoP), so page 2 shows the next four days
  // (docs/reference/weather-forecast.jpeg: page 1 is dated Jun 29, page 2 is
  // Tue–Fri / Jun 30–Jul 3). HA's daily forecast conventionally has `[0]` = today,
  // so skip it.
  return daily.slice(1, 1 + FORECAST_DAYS).map((entry) => ({
    datetime: str(entry.datetime) ?? '',
    condition: str(entry.condition) ?? '',
    high: num(entry.temperature),
    low: num(entry.templow),
    pop: num(entry.precipitation_probability),
  }));
}

function unavailableModel(unit: string): WeatherModel {
  return {
    available: false,
    unit,
    attribution: null,
    current: {
      condition: '',
      conditionLabel: '',
      temp: null,
      humidity: null,
      pop: null,
      asOf: null,
      periods: [],
    },
    forecast: [],
  };
}

export function toWeatherModel(
  hass: HomeAssistant,
  config: EcoseeCardConfig,
  forecasts?: WeatherForecasts,
): WeatherModel {
  const fallbackUnit = hass.config?.unit_system?.temperature ?? '°';
  const weatherEntity = config.weather_entity;
  const entity = weatherEntity ? hass.states[weatherEntity] : undefined;
  if (!entity || UNAVAILABLE.has(entity.state)) return unavailableModel(fallbackUnit);

  const attrs = entity.attributes;
  const condition = entity.state;
  const forecast = toForecast(forecasts?.daily);
  // Today's PoP rides on the current page; take it from the first daily entry.
  const pop = num(forecasts?.daily?.[0]?.precipitation_probability);

  return {
    available: true,
    // A weather entity reports its own unit; prefer it so forecast/current temps
    // and the label agree even when it differs from the climate unit system.
    unit: str(attrs.temperature_unit) ?? fallbackUnit,
    attribution: str(attrs.attribution) ?? null,
    current: {
      condition,
      conditionLabel: conditionLabel(condition),
      temp: num(attrs.temperature),
      humidity: num(attrs.humidity),
      pop,
      asOf: entity.last_updated ?? entity.last_changed ?? null,
      periods: toPeriods(forecasts?.hourly),
    },
    forecast,
  };
}

/** Build the `weather.get_forecasts` call for a forecast `type`. The host invokes
 *  it with `return_response` and feeds the result through `parseForecastResponse`;
 *  kept here (pure data) so the request shape is unit-testable. */
export function getForecastsCall(entityId: string, type: ForecastType): ServiceCall {
  return {
    domain: 'weather',
    service: 'get_forecasts',
    data: { type, entity_id: entityId },
  };
}

/** Pull the forecast array for `entityId` out of a `weather.get_forecasts`
 *  response (`{ response: { <entity_id>: { forecast: [...] } } }`), defending
 *  against every missing layer so an entity that returns nothing degrades to an
 *  empty forecast rather than throwing. */
export function parseForecastResponse(response: unknown, entityId: string): ForecastEntry[] {
  const responses = record(response)?.response;
  const entity = record(responses)?.[entityId];
  const forecast = record(entity)?.forecast;
  return Array.isArray(forecast) ? (forecast as ForecastEntry[]) : [];
}

function record(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null
    ? (value as Record<string, unknown>)
    : undefined;
}
