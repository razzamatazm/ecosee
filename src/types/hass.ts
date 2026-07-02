// Minimal Home Assistant typings — only what ecosee touches. The full `hass`
// object is large; we type the slice we read and keep attributes loose because a
// generic `climate` entity may carry any subset (ADR-0001 graceful degradation).

export interface HassEntityBase {
  entity_id: string;
  state: string;
  attributes: Record<string, unknown>;
  last_changed?: string;
  last_updated?: string;
}

/** Documented shape of the attributes a `climate` entity *may* expose. All
 *  optional: nothing may assume an ecobee-cloud attribute exists. */
export interface ClimateAttributes {
  current_temperature?: number;
  current_humidity?: number;
  temperature?: number;
  target_temp_low?: number;
  target_temp_high?: number;
  hvac_action?: string;
  hvac_modes?: string[];
  preset_mode?: string;
  preset_modes?: string[];
  fan_mode?: string;
  fan_modes?: string[];
  min_temp?: number;
  max_temp?: number;
  target_temp_step?: number;
  friendly_name?: string;
  supported_features?: number;
}

/** One entry in the entity registry (`hass.entities`). We read only the device
 *  link — enough to auto-pair a temperature sensor with the occupancy
 *  binary_sensor that shares its device (ADR-0010). Everything else the registry
 *  carries is ignored. */
export interface HassEntityRegistryEntry {
  entity_id: string;
  device_id?: string | null;
}

export interface HomeAssistant {
  states: Record<string, HassEntityBase>;
  /** The entity registry, keyed by entity id. The HA frontend passes this on the
   *  `hass` object; typed optional because the seam tests build `hass` by hand and
   *  the Card must degrade when it is absent (ADR-0001). Used only for occupancy
   *  auto-pairing (ADR-0010). */
  entities?: Record<string, HassEntityRegistryEntry>;
  config?: {
    unit_system?: {
      temperature?: string;
    };
  };
  callService(
    domain: string,
    service: string,
    serviceData?: Record<string, unknown>,
    target?: Record<string, unknown>,
    notifyOnError?: boolean,
    /** Request the service's response data (e.g. `weather.get_forecasts`). The
     *  resolved value then carries a `{ response: … }` payload. */
    returnResponse?: boolean,
  ): Promise<unknown>;
}

/** The LovelaceCard contract Home Assistant calls into. */
export interface LovelaceCard extends HTMLElement {
  hass?: HomeAssistant;
  setConfig(config: unknown): void;
  getCardSize?(): number | Promise<number>;
}
