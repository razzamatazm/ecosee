export const CARD_TYPE = 'ecosee-card';

/** YAML-first config (ADR-0002). The GUI editor is a later fast-follow, so the
 *  schema is the source of truth and `setConfig` validates it. Only `entity` is
 *  required; everything else opts additional Home-Screen affordances in. */
export interface EcoseeCardConfig {
  type: string;
  /** The primary `climate` entity the Card is bound to. Required. */
  entity: string;
  /** Optional label override; defaults to the entity's friendly name. */
  name?: string;
  /** A `weather` entity that enables the weather icon + (later) overlay. */
  weather_entity?: string;
  /** Override humidity source when the climate entity has no `current_humidity`. */
  humidity_entity?: string;
  /** Glyph for custom Comfort Settings (presets without a built-in mapping). One of
   *  the Skin's icon names — `home` / `away` / `sleep` / `comfort`; anything else
   *  falls back to `comfort`. The named ecobee Comfort Settings keep their own icon. */
  default_comfort_icon?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/** Validate raw YAML into an EcoseeCardConfig, throwing user-facing errors that
 *  Home Assistant surfaces in the card's error state. */
export function parseConfig(raw: unknown): EcoseeCardConfig {
  if (!isRecord(raw)) {
    throw new Error('ecosee: invalid configuration.');
  }
  const entity = raw.entity;
  if (typeof entity !== 'string' || entity.length === 0) {
    throw new Error('ecosee: `entity` is required (a `climate.*` entity).');
  }
  if (!entity.startsWith('climate.')) {
    throw new Error(`ecosee: \`entity\` must be a climate entity, got "${entity}".`);
  }
  const optionalString = (key: keyof EcoseeCardConfig): string | undefined => {
    const value = raw[key];
    if (value === undefined) return undefined;
    if (typeof value !== 'string') {
      throw new Error(`ecosee: \`${key}\` must be a string entity id.`);
    }
    return value;
  };

  return {
    type: typeof raw.type === 'string' ? raw.type : `custom:${CARD_TYPE}`,
    entity,
    name: optionalString('name'),
    weather_entity: optionalString('weather_entity'),
    humidity_entity: optionalString('humidity_entity'),
    default_comfort_icon: optionalString('default_comfort_icon'),
  };
}
