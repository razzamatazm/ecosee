import type { SVGTemplateResult } from 'lit';
import type { HomeAssistant } from '../types/hass';
import type { EcoseeCardConfig } from '../config';
import type { SystemMode } from './home-view';
import { toMode, UNAVAILABLE } from './home-view';
import type { ServiceCall } from './service-call';
import { icons } from '../icons';

// The derivation seam for the System Mode picker (the sibling of `toHomeView` /
// `toTempAdjustModel`). `toSystemModeModel` builds an already-degraded list of
// selectable System Modes from raw `hass` + config — only the modes the entity
// supports, in a stable order, with their labels — and `setHvacModeCall` turns a
// chosen option into the `climate.set_hvac_mode` payload. All the
// vocabulary-reconciliation logic lives here (CONTEXT.md: the domain's core
// challenge), so it is unit-testable without rendering a Lit element. The picker
// itself owns no edit state: selection is a single discrete write, and the
// highlight follows the entity's reported `hvac_mode`.

/** A selectable mode — a normalized view over Home Assistant's `hvac_mode` (both
 *  `heat_cool` and the legacy `auto` collapse to `heat_cool`). The ecobee device
 *  exposes only Heat / Cool / Heat / Cool (Auto) / Off; a generic `climate`
 *  entity may also offer `dry` / `fan_only` (ADR-0001), which the picker lists
 *  with Home Assistant's labels. */
export type DeviceMode = Exclude<SystemMode, 'unknown'>;

/** One selectable row: its normalized mode (for display + selection), the raw
 *  `hvac_mode` string to write back (so we only ever write a value the entity
 *  actually lists), the row label, and whether it is the current mode. */
export interface SystemModeOption {
  mode: DeviceMode;
  hvacMode: string;
  label: string;
  selected: boolean;
}

export interface SystemModeModel {
  /** False when the entity lists no selectable modes — the picker opens nothing. */
  available: boolean;
  options: SystemModeOption[];
}

/** Row order, top to bottom: the device's four (reference/system-mode-picker.jpeg)
 *  first, then the generic-only `dry` / `fan_only` ahead of Off (kept last). */
const ROW_ORDER: readonly DeviceMode[] = ['heat', 'cool', 'heat_cool', 'dry', 'fan_only', 'off'];

/** Row labels. The device's exact labels (CONTEXT.md System Mode) — note
 *  "Heat / Cool (Auto)", never "Auto" alone — plus Home Assistant's labels for
 *  the generic-only `dry` / `fan_only` modes. */
const LABELS: Record<DeviceMode, string> = {
  heat: 'Heat',
  cool: 'Cool',
  heat_cool: 'Heat / Cool (Auto)',
  dry: 'Dry',
  fan_only: 'Fan only',
  off: 'Off',
};

function deviceMode(hvacMode: string): DeviceMode | null {
  const mode = toMode(hvacMode);
  return mode === 'unknown' ? null : mode;
}

export function toSystemModeModel(hass: HomeAssistant, config: EcoseeCardConfig): SystemModeModel {
  const entity = hass.states[config.entity];
  if (!entity || UNAVAILABLE.has(entity.state)) return { available: false, options: [] };

  const hvacModes = entity.attributes.hvac_modes;
  if (!Array.isArray(hvacModes) || hvacModes.length === 0) return { available: false, options: [] };

  // Map each supported HA mode onto its device mode, keeping the raw string to
  // write back. When an entity lists both spellings, prefer the modern
  // `heat_cool` over the legacy `auto` so the picker shows a single
  // Heat / Cool (Auto) row.
  const raw = new Map<DeviceMode, string>();
  for (const hvacMode of hvacModes) {
    if (typeof hvacMode !== 'string') continue;
    const mode = deviceMode(hvacMode);
    if (mode === null) continue;
    if (!raw.has(mode) || (mode === 'heat_cool' && hvacMode === 'heat_cool')) {
      raw.set(mode, hvacMode);
    }
  }

  const current = toMode(entity.state);
  const options: SystemModeOption[] = ROW_ORDER.filter((mode) => raw.has(mode)).map((mode) => ({
    mode,
    hvacMode: raw.get(mode)!,
    label: LABELS[mode],
    selected: mode === current,
  }));

  return { available: options.length > 0, options };
}

/** Build the `climate.set_hvac_mode` call that switches the entity to the chosen
 *  mode. Takes the raw `hvac_mode` string (an entity-supported value). */
export function setHvacModeCall(hvacMode: string, entityId: string): ServiceCall {
  return {
    domain: 'climate',
    service: 'set_hvac_mode',
    data: { entity_id: entityId, hvac_mode: hvacMode },
  };
}

/** The centered System Mode indicator glyph the Home Screen renders for a mode
 *  (issue #59). Every mode resolves to a glyph drawn in the same visual language —
 *  single-color line art, `currentColor` stroke, 1.8 weight, round caps/joins,
 *  filling the viewBox — so the generic-only Dry and Fan only read consistently
 *  alongside Heat, Cool and Heat / Cool (Auto). Off is shown as a text mark rather
 *  than a glyph, so it never reaches here (it shares the `heat_cool` default
 *  harmlessly). */
export function systemModeGlyph(mode: DeviceMode): SVGTemplateResult {
  switch (mode) {
    case 'heat':
      return icons.heat;
    case 'cool':
      return icons.snowflake;
    case 'dry':
      return icons.drop;
    case 'fan_only':
      return icons.fan;
    case 'heat_cool':
    case 'off':
    default:
      return icons.auto;
  }
}
