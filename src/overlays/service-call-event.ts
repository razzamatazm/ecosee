import type { ServiceCall } from '../climate/service-call';

/** The single event every editing Overlay emits to ask the host card to apply a
 *  thermostat change. One name, one payload (`{ call }`), one handler on the card —
 *  replacing the per-overlay `ecosee-set-temperature` / `-system-mode` /
 *  `-comfort-setting` / `-fan` events, which were four names for one behaviour.
 *  Bubbling + composed so it escapes each Overlay's shadow root, crosses the
 *  <ecosee-overlay> shell, and reaches the card's single listener. */
export const SERVICE_CALL_EVENT = 'ecosee-service-call';

export interface ServiceCallEventDetail {
  call: ServiceCall;
}

export type ServiceCallEvent = CustomEvent<ServiceCallEventDetail>;

/** Emit the unified service-call event from an Overlay element. */
export function emitServiceCall(source: EventTarget, call: ServiceCall): void {
  source.dispatchEvent(
    new CustomEvent(SERVICE_CALL_EVENT, {
      detail: { call },
      bubbles: true,
      composed: true,
    }),
  );
}

declare global {
  interface HTMLElementEventMap {
    'ecosee-service-call': ServiceCallEvent;
  }
}
