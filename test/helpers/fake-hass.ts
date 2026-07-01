import type { HassEntityBase, HomeAssistant } from '../../src/types/hass';

/** One recorded `hass.callService(...)` invocation — the apply path's output,
 *  captured so wiring tests can assert what the card actually sent. */
export interface RecordedCall {
  domain: string;
  service: string;
  data?: Record<string, unknown>;
  returnResponse?: boolean;
}

export interface FakeHass {
  /** The `hass` object to hand to the card / a view-model. */
  hass: HomeAssistant;
  /** Every service call the card has made, in order. */
  calls: RecordedCall[];
}

export interface FakeHassOptions {
  /** Entities to expose under `hass.states`, keyed by their `entity_id`. */
  entities?: HassEntityBase[];
  /** The system temperature unit (default `°F`). */
  unit?: string;
  /** Canned value returned by `callService` — used for the `return_response`
   *  forecast fetch (`weather.get_forecasts`). */
  response?: unknown;
}

/**
 * Build a fake `hass` with a recording `callService`, the single helper the tests
 * share instead of hand-rolling the same four-key envelope in every file. The
 * returned `calls` array is the apply-path test surface: open an Overlay, drive a
 * control, and assert the call the card forwarded to Home Assistant.
 */
export function fakeHass(options: FakeHassOptions = {}): FakeHass {
  const { entities = [], unit = '°F', response } = options;

  const states: Record<string, HassEntityBase> = {};
  for (const entity of entities) states[entity.entity_id] = entity;

  const calls: RecordedCall[] = [];
  const hass: HomeAssistant = {
    states,
    config: { unit_system: { temperature: unit } },
    callService: async (domain, service, data, _target, _notifyOnError, returnResponse) => {
      calls.push({ domain, service, data, returnResponse });
      return response;
    },
  };

  return { hass, calls };
}

/** Build a `climate` entity (the bound thermostat) for a fake `hass`. */
export function climateEntity(
  state: string,
  attributes: Record<string, unknown> = {},
  entityId = 'climate.t',
): HassEntityBase {
  return { entity_id: entityId, state, attributes };
}
