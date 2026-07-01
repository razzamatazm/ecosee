import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  InactivityTimer,
  inactivityTimeoutMs,
  DEFAULT_INACTIVITY_TIMEOUT_S,
} from '../src/overlays/inactivity-timer';
import type { EcoseeCardConfig } from '../src/config';

const base: EcoseeCardConfig = { type: 'custom:ecosee-card', entity: 'climate.t' };

describe('inactivityTimeoutMs — config → delay', () => {
  it('defaults to 25s when unset', () => {
    expect(DEFAULT_INACTIVITY_TIMEOUT_S).toBe(25);
    expect(inactivityTimeoutMs(base)).toBe(DEFAULT_INACTIVITY_TIMEOUT_S * 1000);
    expect(inactivityTimeoutMs(base)).toBe(25_000);
  });

  it('treats 0 as disabled (null)', () => {
    expect(inactivityTimeoutMs({ ...base, inactivity_timeout: 0 })).toBeNull();
  });

  it('converts a positive seconds value to milliseconds', () => {
    expect(inactivityTimeoutMs({ ...base, inactivity_timeout: 30 })).toBe(30_000);
    expect(inactivityTimeoutMs({ ...base, inactivity_timeout: 5 })).toBe(5_000);
  });
});

describe('InactivityTimer', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('fires the expiry callback once the delay elapses', () => {
    const onExpire = vi.fn();
    new InactivityTimer(onExpire).start(12_000);
    vi.advanceTimersByTime(11_999);
    expect(onExpire).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(onExpire).toHaveBeenCalledTimes(1);
  });

  it('reset() restarts the countdown so expiry is measured from the reset', () => {
    const onExpire = vi.fn();
    const timer = new InactivityTimer(onExpire);
    timer.start(1_000);
    vi.advanceTimersByTime(900);
    timer.reset();
    // 900ms more (1800 total) — but only 900 since the reset, so not yet.
    vi.advanceTimersByTime(900);
    expect(onExpire).not.toHaveBeenCalled();
    vi.advanceTimersByTime(100); // 1000 since reset
    expect(onExpire).toHaveBeenCalledTimes(1);
  });

  it('stop() cancels a pending countdown', () => {
    const onExpire = vi.fn();
    const timer = new InactivityTimer(onExpire);
    timer.start(1_000);
    vi.advanceTimersByTime(500);
    timer.stop();
    vi.advanceTimersByTime(10_000);
    expect(onExpire).not.toHaveBeenCalled();
  });

  it('start() replaces a pending countdown rather than stacking timers', () => {
    const onExpire = vi.fn();
    const timer = new InactivityTimer(onExpire);
    timer.start(1_000);
    vi.advanceTimersByTime(500);
    timer.start(1_000); // restart from now
    vi.advanceTimersByTime(999);
    expect(onExpire).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(onExpire).toHaveBeenCalledTimes(1);
  });

  it('start(null) disables auto-revert and clears any pending countdown', () => {
    const onExpire = vi.fn();
    const timer = new InactivityTimer(onExpire);
    timer.start(1_000);
    timer.start(null);
    vi.advanceTimersByTime(10_000);
    expect(onExpire).not.toHaveBeenCalled();
  });

  it('reset() is a no-op while disabled', () => {
    const onExpire = vi.fn();
    const timer = new InactivityTimer(onExpire);
    timer.start(null);
    timer.reset();
    vi.advanceTimersByTime(10_000);
    expect(onExpire).not.toHaveBeenCalled();
  });
});
