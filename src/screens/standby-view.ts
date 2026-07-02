import type { HomeAssistant } from '../types/hass';
import type { EcoseeCardConfig } from '../config';
import { toHomeView } from '../climate/home-view';
import { toWeatherModel } from '../weather/weather';
import type { StandbyView } from './standby-screen';

/**
 * Build the already-degraded {@link StandbyView} from `hass` + config (issue #65).
 * Purely a composition of the seams that already exist: the dominant current temp
 * and unit come from the Home Screen's {@link toHomeView}; the outdoor temp and
 * condition from the Weather Overlay's {@link toWeatherModel} (current conditions
 * only — the Standby Screen shows no forecast). No parsing is duplicated here, so a
 * field is present on the Standby Screen exactly when the Home Screen / Weather
 * Overlay would show it (ADR-0001 graceful degradation). Kept a pure function,
 * separate from the presentational component, so it is unit-testable on its own.
 */
export function toStandbyView(hass: HomeAssistant, config: EcoseeCardConfig): StandbyView {
  const home = toHomeView(hass, config);
  const weather = toWeatherModel(hass, config);
  return {
    available: home.available,
    currentTemp: home.currentTemp,
    unit: home.unit,
    // Outdoor temp is net-new to the base view — it lived only in the Weather
    // Overlay. Reuse its current-conditions temp rather than re-reading the entity.
    outdoorTemp: weather.current.temp,
    // `toHomeView` already normalizes the condition to `string | null` (null when no
    // usable weather entity), which is exactly what the Standby Screen glyph wants.
    weatherCondition: home.weatherCondition,
    // Reuse the Home Screen's already-derived equipment status (hvac_action, inferred
    // when absent) so Standby's edge glow lights on exactly the same states — no
    // second derivation to drift (ADR-0009).
    equipment: home.equipment,
  };
}
