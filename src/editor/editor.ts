import { CARD_TYPE } from '../config';

// The derivation seam for the GUI config editor (issue #14) — the editor's
// counterpart to the overlay seams (`toHomeView`, `toWeatherModel`). It owns the
// schema↔config reconciliation so the Lit element stays a thin shell over Home
// Assistant's `<ha-form>`:
//
//   • `editorSchema()` describes every config key as an `ha-form` field, with a
//     domain-scoped entity picker where the value is an entity id (ADR-0002 —
//     Lit + the HA frontend give us first-class config-editor support, so we lean
//     on `ha-form`'s selectors rather than reimplementing entity pickers).
//   • `toEditorData()` adapts a stored config into the value `ha-form` renders
//     (mapping object-form `sensors` to the entity-id list its multi-picker wants).
//   • `normalizeEditorConfig()` turns a form value back into a config the Card's
//     `parseConfig` accepts: an unset optional key is *dropped*, not emitted as an
//     empty string (the optional-config-key pattern — absent means "feature off",
//     ADR-0001 graceful degradation), while object-form sensor overrides and any
//     key the GUI does not yet surface survive an unrelated edit.
//
// Keeping all of this pure makes it unit-testable without rendering a Lit element
// (the editor element itself is presentational and untested, like the overlays).

/** One clause of an entity selector's `filter` (OR-combined when several are given).
 *  Lets the sensors picker scope to temperature sensors while still allowing a
 *  `climate` entity as a temperature source. */
export interface EntityFilter {
  domain?: string | string[];
  device_class?: string | string[];
}

/** An `ha-form` selector descriptor — the subset of HA's selectors this editor
 *  uses. A bare entity id → a domain- (and optionally device-class-) scoped `entity`
 *  picker; the sensors list → a `multiple` entity picker filtered to temperature
 *  sensors; a free string → `text`; the idle timeout → `number`; an opt-in toggle →
 *  `boolean`. */
export type EditorSelector =
  | {
      entity: {
        domain?: string | string[];
        device_class?: string | string[];
        multiple?: boolean;
        filter?: EntityFilter[];
      };
    }
  | { text: Record<string, never> }
  | { number: { min?: number; mode?: 'box'; unit_of_measurement?: string } }
  | { boolean: Record<string, never> };

/** One `ha-form` field. `name`/`selector`/`required` are what `ha-form` consumes;
 *  `label`/`helper` ride along for the element's `computeLabel`/`computeHelper`
 *  callbacks (`ha-form` hands the schema entry back to them and ignores the rest). */
export interface EditorField {
  /** The config key this control edits. */
  name: string;
  /** Device-vocabulary label (CONTEXT.md) shown above the control. */
  label: string;
  /** Optional helper line beneath the control. */
  helper?: string;
  /** Only the primary `entity` is required. */
  required?: boolean;
  selector: EditorSelector;
}

/** The form, in display order, tracking the config schema (issue #14). Most keys in
 *  `EcoseeCardConfig` (bar `type`, which HA owns) have exactly one field here,
 *  mirroring `parseConfig`; a new config key must be added alongside its overlay. A
 *  few keys `parseConfig` still accepts for backward compatibility are intentionally
 *  not surfaced (the fan minimum-runtime entity, removed in #57; the comfort-icon
 *  override, removed in #58) — an existing config that sets one keeps loading and its
 *  value survives a GUI edit untouched. */
export function editorSchema(): EditorField[] {
  return [
    {
      name: 'entity',
      label: 'Thermostat',
      helper: 'Required. The climate entity this Card is bound to.',
      required: true,
      selector: { entity: { domain: 'climate' } },
    },
    {
      name: 'name',
      label: 'Name',
      helper: "Optional. Overrides the thermostat's friendly name.",
      selector: { text: {} },
    },
    {
      name: 'weather_entity',
      label: 'Weather entity',
      helper: 'Optional. Adds the weather icon and Weather sub-screen; hidden until an entity is set.',
      selector: { entity: { domain: 'weather' } },
    },
    {
      name: 'humidity_entity',
      label: 'Humidity entity',
      helper: 'Optional. Humidity source used only when the thermostat reports none.',
      selector: { entity: { domain: 'sensor', device_class: 'humidity' } },
    },
    {
      name: 'air_quality_entity',
      label: 'Air quality entity',
      helper:
        'Optional. Adds the air-quality element (a US-EPA air-quality index); hidden until an entity is set.',
      selector: { entity: { domain: 'sensor', device_class: 'aqi' } },
    },
    {
      name: 'uv_index_entity',
      label: 'UV index entity',
      helper: 'Optional. Adds the UV-index gauge; hidden until an entity is set.',
      selector: { entity: { domain: 'sensor' } },
    },
    {
      name: 'sensors',
      label: 'Sensors',
      helper:
        'Optional. Extra temperature entities for the Sensors sub-screen, hidden until you add one. Per-sensor name and occupancy overrides remain YAML-only.',
      selector: {
        entity: {
          multiple: true,
          filter: [{ domain: 'sensor', device_class: 'temperature' }, { domain: 'climate' }],
        },
      },
    },
    {
      name: 'inactivity_timeout',
      label: 'Inactivity timeout',
      helper:
        'Optional. Seconds an open overlay waits before reverting to the Home Screen. 0 disables; unset uses 25s.',
      selector: { number: { min: 0, mode: 'box', unit_of_measurement: 'seconds' } },
    },
    {
      name: 'standby_screen',
      label: 'Standby Screen',
      helper: 'Optional. Enables the Standby Screen. Off by default.',
      selector: { boolean: {} },
    },
  ];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/** The entity ids behind a `sensors` value, accepting either shorthand strings or
 *  `{ entity }` objects (so a stored object-form list maps cleanly to the picker). */
function sensorEntityIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (typeof item === 'string') return item ? [item] : [];
    if (isRecord(item) && typeof item.entity === 'string') return [item.entity];
    return [];
  });
}

/** Adapt a stored config into the value `<ha-form>` renders: the multi-entity
 *  `sensors` picker wants a flat `string[]`, so collapse object-form entries to
 *  their entity ids for display. Everything else passes through unchanged. */
export function toEditorData(config: Record<string, unknown>): Record<string, unknown> {
  const data: Record<string, unknown> = { ...config };
  if (config.sensors !== undefined) data.sensors = sensorEntityIds(config.sensors);
  return data;
}

function sameSequence(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

/** Fold the form's `sensors` value (a `string[]` from the picker) back into the
 *  config. An empty set drops the key (Sensors sub-screen hidden). When the list
 *  matches `prev` exactly (same ids, same order), keep `prev` verbatim so
 *  object-form name/occupancy overrides survive an unrelated edit; any actual
 *  change through the picker — add, remove, or reorder — adopts the shorthand list
 *  (object-form overrides are YAML-only, as the field's helper notes). */
function applySensors(next: Record<string, unknown>, raw: unknown, prev: unknown): void {
  const list = sensorEntityIds(raw);
  if (list.length === 0) {
    delete next.sensors;
    return;
  }
  if (prev !== undefined && sameSequence(list, sensorEntityIds(prev))) {
    next.sensors = prev;
    return;
  }
  next.sensors = list;
}

/** Turn an `<ha-form>` value into a config `parseConfig` accepts. Starts from the
 *  previously-stored config so keys the editor does not surface (and unchanged
 *  object-form `sensors`) survive, then for each schema field either sets the new
 *  value or *drops* the key when it is empty — so an optional feature stays absent
 *  rather than configured-but-empty (ADR-0001). The required `entity` is always
 *  kept (even empty); `parseConfig` is what rejects an empty one. */
export function normalizeEditorConfig(
  value: Record<string, unknown>,
  prev: Record<string, unknown> = {},
): Record<string, unknown> {
  const next: Record<string, unknown> = { ...prev };
  next.type = typeof prev.type === 'string' ? prev.type : `custom:${CARD_TYPE}`;

  for (const field of editorSchema()) {
    const raw = value[field.name];

    if ('entity' in field.selector && field.selector.entity.multiple) {
      applySensors(next, raw, prev[field.name]);
      continue;
    }
    if (field.required) {
      next[field.name] = typeof raw === 'string' ? raw : '';
      continue;
    }
    if ('number' in field.selector) {
      if (typeof raw === 'number' && Number.isFinite(raw)) next[field.name] = raw;
      else delete next[field.name];
      continue;
    }
    if ('boolean' in field.selector) {
      // An opt-in toggle stays absent when off (graceful default), so only `true`
      // is written back; `false`/unset drops the key.
      if (raw === true) next[field.name] = true;
      else delete next[field.name];
      continue;
    }
    // String-ish: a single entity picker or free text.
    if (typeof raw === 'string' && raw !== '') next[field.name] = raw;
    else delete next[field.name];
  }

  return next;
}
