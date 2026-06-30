/** A `hass.callService` descriptor. Pure data so the apply path of every editing
 *  seam (Temperature Adjust, System Mode, …) is unit-testable without invoking
 *  Home Assistant. */
export interface ServiceCall {
  domain: string;
  service: string;
  data: Record<string, unknown>;
}
