import type { EcoseeCardConfig } from '../config';

/** The device drops an open screen back to Home after idle; we default to a 25s
 *  grace period (issue #60, up from the original 12s of #13). Overridable via
 *  `inactivity_timeout`. */
export const DEFAULT_INACTIVITY_TIMEOUT_S = 25;

/**
 * Resolve the auto-revert delay (in milliseconds) from config, or `null` when
 * auto-revert is disabled. The pure seam over the config key: `inactivity_timeout`
 * is human-facing **seconds** — `0` disables, and an unset key falls back to the
 * device-default {@link DEFAULT_INACTIVITY_TIMEOUT_S}. Returning `null` (rather
 * than `0`) lets {@link InactivityTimer} treat "disabled" distinctly from "fire
 * immediately".
 */
export function inactivityTimeoutMs(config: EcoseeCardConfig): number | null {
  const seconds = config.inactivity_timeout ?? DEFAULT_INACTIVITY_TIMEOUT_S;
  return seconds > 0 ? seconds * 1000 : null;
}

/**
 * A one-shot inactivity countdown around `setTimeout`. The host arms it when an
 * Overlay opens ({@link start}), nudges it forward on each interaction
 * ({@link reset}), and cancels it on manual dismiss / unmount ({@link stop}); on
 * expiry it invokes `onExpire` once, which the host wires to collapse back to the
 * Home Screen. Kept free of any DOM/Lit dependency so the timer behavior is unit
 * testable with fake timers.
 */
export class InactivityTimer {
  private _handle?: ReturnType<typeof setTimeout>;
  /** The active delay, remembered so {@link reset} can re-arm the same duration;
   *  `null` means auto-revert is currently disabled. */
  private _ms: number | null = null;

  constructor(private readonly _onExpire: () => void) {}

  /** Begin (or restart) the countdown for `ms`. A `null`/non-positive `ms`
   *  disables auto-revert, clearing any pending countdown without re-arming. */
  start(ms: number | null): void {
    this._ms = ms;
    this._arm();
  }

  /** Interaction occurred — restart the countdown from now for the same duration.
   *  A no-op while disabled. */
  reset(): void {
    this._arm();
  }

  /** Cancel the countdown and leave it disarmed (manual dismiss / unmount). */
  stop(): void {
    this._ms = null;
    this._clear();
  }

  private _arm(): void {
    this._clear();
    if (this._ms === null || this._ms <= 0) return;
    this._handle = setTimeout(() => {
      this._handle = undefined;
      this._onExpire();
    }, this._ms);
  }

  private _clear(): void {
    if (this._handle !== undefined) {
      clearTimeout(this._handle);
      this._handle = undefined;
    }
  }
}
