import type { HomeAssistant } from '../types/hass';
import type { EcoseeCardConfig } from '../config';
import { UNAVAILABLE } from './home-view';
import type { ServiceCall } from './service-call';

// The derivation seam for the Comfort Setting picker (the sibling of
// `toSystemModeModel`). `toComfortSettingModel` builds an already-degraded list of
// selectable Comfort Settings from raw `hass` + config — the entity's
// `preset_modes`, in the entity's own order, each with a display label, a Skin
// glyph, and whether it is the active one — and `setPresetModeCall` turns a chosen
// option into the `climate.set_preset_mode` payload. Selecting a Comfort Setting
// applies the preset via `climate.set_preset_mode`. All the
// vocabulary-reconciliation lives here (CONTEXT.md: the
// domain's core challenge), so it is unit-testable without rendering a Lit element.
// Like the System Mode picker, the picker owns no edit state: selection is a single
// discrete write and the highlight follows the entity's reported `preset_mode`.

/** Which Skin glyph a Comfort Setting row shows. The three named ecobee Comfort
 *  Settings (Home / Away / Sleep) carry their own icons; any other (custom) preset
 *  uses the default `comfort` glyph, overridable per-card via
 *  `config.default_comfort_icon` (ADR-0001: custom data still yields a coherent
 *  Card). */
export type ComfortIcon = 'home' | 'away' | 'sleep' | 'comfort';

/** One selectable row: the raw `preset_mode` string to write back (so we only ever
 *  write a value the entity actually lists), the display label, its glyph, and
 *  whether it is the active Comfort Setting. */
export interface ComfortSettingOption {
  preset: string;
  label: string;
  icon: ComfortIcon;
  selected: boolean;
}

export interface ComfortSettingModel {
  /** False when the entity lists no presets — the picker opens nothing. */
  available: boolean;
  options: ComfortSettingOption[];
}

/** Canonical device labels + glyphs for the three named ecobee Comfort Settings,
 *  keyed by their lowercased name so a generic entity's `home` and an ecobee's
 *  `Home` both resolve (CONTEXT.md Comfort Setting). Any other preset is a
 *  user-defined name, passed through verbatim with the default glyph. */
const KNOWN: Record<string, { label: string; icon: ComfortIcon }> = {
  home: { label: 'Home', icon: 'home' },
  away: { label: 'Away', icon: 'away' },
  sleep: { label: 'Sleep', icon: 'sleep' },
};

const COMFORT_ICONS: ReadonlySet<string> = new Set<ComfortIcon>([
  'home',
  'away',
  'sleep',
  'comfort',
]);

/** The glyph used for custom presets: the card-configured override when it names a
 *  known Skin glyph, otherwise the generic `comfort` default. */
function defaultIcon(config: EcoseeCardConfig): ComfortIcon {
  const override = config.default_comfort_icon;
  return override && COMFORT_ICONS.has(override) ? (override as ComfortIcon) : 'comfort';
}

export function toComfortSettingModel(
  hass: HomeAssistant,
  config: EcoseeCardConfig,
): ComfortSettingModel {
  const entity = hass.states[config.entity];
  if (!entity || UNAVAILABLE.has(entity.state)) return { available: false, options: [] };

  const presets = entity.attributes.preset_modes;
  if (!Array.isArray(presets) || presets.length === 0) return { available: false, options: [] };

  const current =
    typeof entity.attributes.preset_mode === 'string' ? entity.attributes.preset_mode : null;
  const fallback = defaultIcon(config);

  const options: ComfortSettingOption[] = [];
  for (const preset of presets) {
    if (typeof preset !== 'string' || preset === '') continue;
    const known = KNOWN[preset.toLowerCase()];
    options.push({
      preset,
      label: known?.label ?? preset,
      icon: known?.icon ?? fallback,
      selected: preset === current,
    });
  }

  return { available: options.length > 0, options };
}

/** Build the `climate.set_preset_mode` call that applies the chosen Comfort Setting.
 *  Takes the raw `preset_mode` string (an entity-supported value). */
export function setPresetModeCall(preset: string, entityId: string): ServiceCall {
  return {
    domain: 'climate',
    service: 'set_preset_mode',
    data: { entity_id: entityId, preset_mode: preset },
  };
}
