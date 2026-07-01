import { describe, it, expect } from 'vitest';
import { resolveDeviceSize } from '../src/device-size';

// Issue #35: the square device needs an explicit pixel edge length so its
// container queries resolve reliably in Gecko, instead of a percentage +
// aspect-ratio chain that Firefox/Zen resolves late. resolveDeviceSize is the
// clamp the ResizeObserver feeds into --ecosee-resolved-size.

describe('resolveDeviceSize', () => {
  it('returns the slot width when it sits between the bounds', () => {
    expect(resolveDeviceSize(380, 220, 460)).toBe(380);
  });

  it('clamps up to the legible floor when the slot is too narrow', () => {
    expect(resolveDeviceSize(160, 220, 460)).toBe(220);
  });

  it('clamps down to the ceiling when the slot is too wide', () => {
    expect(resolveDeviceSize(1000, 220, 460)).toBe(460);
  });

  it('returns 0 for an unknown slot width so the CSS fallback stays in place', () => {
    // happy-dom / pre-layout: clientWidth is 0 — callers must not pin a size.
    expect(resolveDeviceSize(0, 220, 460)).toBe(0);
    expect(resolveDeviceSize(Number.NaN, 220, 460)).toBe(0);
    expect(resolveDeviceSize(-50, 220, 460)).toBe(0);
  });

  it('falls back to the floor when min > max (misconfigured bounds)', () => {
    // Mirrors CSS clamp(): when the bounds cross, the minimum wins.
    expect(resolveDeviceSize(300, 500, 200)).toBe(500);
  });

  it('ignores non-finite bounds rather than producing NaN', () => {
    expect(resolveDeviceSize(380, Number.NaN, Number.NaN)).toBe(380);
  });
});
