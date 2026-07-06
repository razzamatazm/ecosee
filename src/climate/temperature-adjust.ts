import type { HomeAssistant } from '../types/hass';
import type { EcoseeCardConfig } from '../config';
import type { SystemMode } from './home-view';
import { toMode } from './home-view';
import { num } from './parse';
import type { ServiceCall } from './service-call';

// The editing seam for the Temperature Adjust overlay (the sibling of
// `toHomeView`). `toTempAdjustModel` builds an already-degraded, on-grid editing
// model from raw `hass` + config; the pure reducers below (`nudge`, `setValue`,
// `selectSetpoint`) advance it as the user scrubs; `setTemperatureCall` turns the
// final model into the `climate.set_temperature` payload. All editing logic lives
// here — clamping, step-snapping, single/dual mapping — so it is unit-testable
// without rendering a Lit element.

export type Setpoint = 'heat' | 'cool';

/** The editing step, derived from the display unit: whole degrees in °F, half
 *  degrees in °C. This deliberately mirrors `formatTemp`'s rounding rather than
 *  the entity's `target_temp_step`, so every value the scrubber renders is
 *  distinct — a sub-degree °F step (e.g. 0.5) would show each whole degree twice. */
const STEP_F = 1;
const STEP_C = 0.5;

/** Default minimum heat↔cool separation (deadband) kept in Heat / Cool (Auto),
 *  in the display unit, when `min_gap` is not configured. 3°F ≈ 1.5°C matches the
 *  floor most ACs enforce server-side (e.g. Nest's 1.6667°C). Overridable — and
 *  disable-able with `min_gap: 0` — via config. */
const GAP_F = 3;
const GAP_C = 1.5;

/** One editable setpoint: its current value (already clamped + snapped to the
 *  step grid) and the bounds it must respect. `min`/`max` are `null` when the
 *  entity doesn't expose them — the value is then unclamped on that side rather
 *  than faked to an arbitrary range (ADR-0001 graceful degradation). */
export interface SetpointEdit {
  setpoint: Setpoint;
  value: number;
  min: number | null;
  max: number | null;
  step: number;
}

/** The editable state of the overlay. In single-setpoint modes (Heat / Cool)
 *  exactly one of `heat`/`cool` is present; in Heat / Cool (Auto) both are, and
 *  `active` chooses which one the scrubber and ± buttons edit. */
export interface TempAdjustModel {
  /** False when the bound entity exposes no editable setpoint (Off, unavailable,
   *  or a setpoint-less entity) — the overlay then renders nothing actionable. */
  available: boolean;
  unit: string;
  mode: SystemMode;
  heat: SetpointEdit | null;
  cool: SetpointEdit | null;
  active: Setpoint;
  /** Minimum separation the scrubber keeps between heat and cool in Heat / Cool
   *  (Auto) by pushing the paired setpoint. Ignored outside `heat_cool`. */
  minGap: number;
}

function stepForUnit(unit: string): number {
  return unit.includes('C') ? STEP_C : STEP_F;
}

/** The minimum heat↔cool separation to keep: the configured `min_gap` (in the
 *  display unit), or the unit default when unset. `0` is honored (setpoints may
 *  meet). */
function gapForUnit(unit: string, config: EcoseeCardConfig): number {
  return config.min_gap ?? (unit.includes('C') ? GAP_C : GAP_F);
}

/** Snap a degree value to a tidy precision, killing the floating-point dust that
 *  `Math.round(v / step) * step` leaves behind (e.g. 0.1 * 3 = 0.30000000004). */
function tidy(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Snap to the nearest step on the grid anchored at 0, then clamp into
 *  [min, max]. Snapping first keeps the displayed value on-grid; clamping last
 *  guarantees the result never leaves the entity's range, even at an off-grid
 *  bound. A non-positive step degrades to "no snapping". */
function snapClamp(value: number, min: number | null, max: number | null, step: number): number {
  let v = step > 0 ? tidy(Math.round(value / step) * step) : value;
  if (min !== null && v < min) v = min;
  if (max !== null && v > max) v = max;
  return v;
}

function makeEdit(
  setpoint: Setpoint,
  value: number,
  min: number | null,
  max: number | null,
  step: number,
): SetpointEdit {
  return { setpoint, value: snapClamp(value, min, max, step), min, max, step };
}

function unavailable(unit: string, mode: SystemMode, active: Setpoint): TempAdjustModel {
  return { available: false, unit, mode, heat: null, cool: null, active, minGap: 0 };
}

export function toTempAdjustModel(hass: HomeAssistant, config: EcoseeCardConfig): TempAdjustModel {
  const unit = hass.config?.unit_system?.temperature ?? '°';
  const entity = hass.states[config.entity];
  const mode = entity ? toMode(entity.state) : 'unknown';

  if (!entity || (mode !== 'heat' && mode !== 'cool' && mode !== 'heat_cool')) {
    return unavailable(unit, mode, 'heat');
  }

  const attrs = entity.attributes;
  const step = stepForUnit(unit);
  const minGap = gapForUnit(unit, config);
  const min = num(attrs.min_temp);
  const max = num(attrs.max_temp);

  if (mode === 'heat_cool') {
    const low = num(attrs.target_temp_low);
    const high = num(attrs.target_temp_high);
    if (low === null && high === null) return unavailable(unit, mode, 'cool');
    const heat = low !== null ? makeEdit('heat', low, min, max, step) : null;
    const cool = high !== null ? makeEdit('cool', high, min, max, step) : null;
    // Default to editing the cool setpoint when it exists (it is the one the
    // device foregrounds); fall back to heat for a heat-only Heat / Cool (Auto)
    // entity.
    return { available: true, unit, mode, heat, cool, active: cool ? 'cool' : 'heat', minGap };
  }

  const single = num(attrs.temperature);
  if (single === null) return unavailable(unit, mode, mode === 'heat' ? 'heat' : 'cool');
  if (mode === 'heat') {
    return {
      available: true,
      unit,
      mode,
      heat: makeEdit('heat', single, min, max, step),
      cool: null,
      active: 'heat',
      minGap,
    };
  }
  return {
    available: true,
    unit,
    mode,
    heat: null,
    cool: makeEdit('cool', single, min, max, step),
    active: 'cool',
    minGap,
  };
}

function activeEdit(model: TempAdjustModel): SetpointEdit | null {
  return model[model.active];
}

/** Apply a scrubbed value to the active setpoint.
 *
 *  Single modes are a plain snap+clamp. In Heat / Cool (Auto) the two setpoints
 *  must stay at least `model.minGap` apart (the device's deadband). Rather than
 *  stalling the active handle when it reaches that boundary — which reads as "the
 *  temperature won't change" — we *push* the paired setpoint to keep the gap,
 *  matching how ecobee / Nest thermostats behave. The paired setpoint only ever
 *  moves away from the active one (heat down, cool up), never closer, and it
 *  stops at its own min/max — at which point the active handle is floored/capped
 *  so the gap still holds. `setTemperatureCall` emits both together, so the
 *  device receives a valid range and never has to reject-and-revert. */
function withValue(model: TempAdjustModel, value: number): TempAdjustModel {
  const edit = activeEdit(model);
  if (!edit) return model;

  const other =
    model.mode === 'heat_cool' ? model[edit.setpoint === 'cool' ? 'heat' : 'cool'] : null;
  if (!other) {
    const next: SetpointEdit = { ...edit, value: snapClamp(value, edit.min, edit.max, edit.step) };
    return { ...model, [edit.setpoint]: next };
  }

  const gap = model.minGap;
  let active = snapClamp(value, edit.min, edit.max, edit.step);
  let pushed = other.value;

  if (edit.setpoint === 'cool') {
    // cool − heat ≥ gap: as cool closes in, push heat down to hold the gap.
    if (active - other.value < gap) {
      let target = active - gap;
      if (other.min !== null && target < other.min) {
        // Heat has bottomed out — floor cool so the gap still holds.
        target = other.min;
        active = snapClamp(other.min + gap, edit.min, edit.max, edit.step);
      }
      pushed = snapClamp(target, other.min, other.max, other.step);
    }
  } else {
    // cool − heat ≥ gap: as heat closes in, push cool up to hold the gap.
    if (other.value - active < gap) {
      let target = active + gap;
      if (other.max !== null && target > other.max) {
        // Cool has topped out — cap heat so the gap still holds.
        target = other.max;
        active = snapClamp(other.max - gap, edit.min, edit.max, edit.step);
      }
      pushed = snapClamp(target, other.min, other.max, other.step);
    }
  }

  return {
    ...model,
    [edit.setpoint]: { ...edit, value: active },
    [other.setpoint]: { ...other, value: pushed },
  };
}

/** Step the active setpoint up (+1) or down (−1) by one `step`. */
export function nudge(model: TempAdjustModel, direction: 1 | -1): TempAdjustModel {
  const edit = activeEdit(model);
  if (!edit) return model;
  return withValue(model, edit.value + direction * edit.step);
}

/** Jump the active setpoint to a scrubbed value (clamped + snapped). */
export function setValue(model: TempAdjustModel, value: number): TempAdjustModel {
  if (!activeEdit(model)) return model;
  return withValue(model, value);
}

/** Map a vertical drag on the scrubber to a scrubbed value (snapped + clamped
 *  like `setValue`). Screen Y grows downward, and the scrubber is *inverted*
 *  (#53): a positive `deltaY` (the finger moved DOWN from where it pressed)
 *  *raises* the active setpoint and a negative one (finger moved UP) lowers it —
 *  the reverse of the earlier "higher values up" drag. `startValue` is the active
 *  value at press; every `pxPerStep` screen pixels map to one step, and a
 *  non-positive `pxPerStep` degrades to "no movement". */
export function scrub(
  model: TempAdjustModel,
  startValue: number,
  deltaY: number,
  pxPerStep: number,
): TempAdjustModel {
  const edit = activeEdit(model);
  if (!edit) return model;
  const steps = pxPerStep > 0 ? Math.round(deltaY / pxPerStep) : 0;
  return withValue(model, startValue + steps * edit.step);
}

/** Choose which setpoint the scrubber edits. A no-op unless that setpoint exists
 *  (i.e. only meaningful in Heat / Cool (Auto)). */
export function selectSetpoint(model: TempAdjustModel, setpoint: Setpoint): TempAdjustModel {
  if (model[setpoint] === null) return model;
  return { ...model, active: setpoint };
}

/** The values to render on the scrubber for the active setpoint, ascending and
 *  within bounds: `radius` neighbors on each side of the current value, trimmed
 *  where they would exceed `min`/`max`. */
export function scrubberWindow(edit: SetpointEdit, radius: number): number[] {
  const values: number[] = [];
  for (let i = -radius; i <= radius; i++) {
    const v = tidy(edit.value + i * edit.step);
    if (edit.min !== null && v < edit.min) continue;
    if (edit.max !== null && v > edit.max) continue;
    values.push(v);
  }
  return values;
}

/** Build the `climate.set_temperature` call that writes the edited setpoint(s):
 *  `temperature` for a single setpoint, `target_temp_low`/`high` for dual.
 *  `null` when there is nothing to apply. */
export function setTemperatureCall(model: TempAdjustModel, entityId: string): ServiceCall | null {
  if (!model.available) return null;
  const data: Record<string, unknown> = { entity_id: entityId };
  if (model.mode === 'heat_cool') {
    if (model.heat) data.target_temp_low = model.heat.value;
    if (model.cool) data.target_temp_high = model.cool.value;
  } else {
    const edit = model.heat ?? model.cool;
    if (!edit) return null;
    data.temperature = edit.value;
  }
  return { domain: 'climate', service: 'set_temperature', data };
}
