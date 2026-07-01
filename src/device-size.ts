/**
 * The Card renders a fixed square "device" whose every dimension scales in
 * container-query units (cqw). For those to resolve, the square needs a query
 * container with a *definite* size. Deriving that size from `clamp(…, 100%, …)`
 * plus `aspect-ratio` (a percentage + an aspect-derived block size) is exactly
 * what Gecko resolves late/collapsed, so text starts tiny and the layout
 * squashes and overlaps in Firefox/Zen (issue #35). Instead we measure the slot
 * width once via a ResizeObserver and hand the square an explicit *pixel* edge
 * length — the ordinary, reliably-resolved container-query setup in every engine.
 *
 * This is the sizing math, pulled out so it is unit-testable without a real
 * layout (happy-dom reports zero-size elements, so the observer path can't run
 * in tests).
 *
 * @param slotWidth  the Card's available inline size, in px (0 when unknown).
 * @param minSize    legible floor — the square never renders narrower.
 * @param maxSize    ceiling — the square never renders wider (the device does
 *                   not grow unbounded to fill a very wide dashboard column).
 * @returns the square's on-screen edge length in px, or 0 when the slot width is
 *          not yet known (callers then leave the CSS fallback in place).
 */
export function resolveDeviceSize(slotWidth: number, minSize: number, maxSize: number): number {
  if (!Number.isFinite(slotWidth) || slotWidth <= 0) return 0;
  const floor = Number.isFinite(minSize) && minSize > 0 ? minSize : 0;
  const ceil = Number.isFinite(maxSize) && maxSize > 0 ? maxSize : slotWidth;
  // Clamp the slot width between the floor and ceiling. If the two bounds cross
  // (misconfigured min > max), the floor wins, matching CSS clamp().
  return Math.max(floor, Math.min(slotWidth, ceil));
}
