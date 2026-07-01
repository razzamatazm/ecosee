import { describe, it, expect } from 'vitest';
import { toSystemModeModel, setHvacModeCall, systemModeGlyph } from '../src/climate/system-mode';
import { icons } from '../src/icons';
import type { EcoseeCardConfig } from '../src/config';
import type { HassEntityBase, HomeAssistant } from '../src/types/hass';

function hass(climate: HassEntityBase): HomeAssistant {
  return {
    states: { [climate.entity_id]: climate },
    config: { unit_system: { temperature: '°F' } },
    callService: async () => undefined,
  };
}

const config: EcoseeCardConfig = { type: 'custom:ecosee-card', entity: 'climate.t' };

function climate(state: string, attributes: Record<string, unknown>): HassEntityBase {
  return { entity_id: 'climate.t', state, attributes };
}

/** A fully-featured ecobee: all four System Modes, currently in Auto. */
const FULL = climate('heat_cool', {
  hvac_modes: ['off', 'heat', 'cool', 'heat_cool'],
});

describe('toSystemModeModel — option list', () => {
  it('lists supported modes in the device order with the exact device labels', () => {
    const model = toSystemModeModel(hass(FULL), config);
    expect(model.available).toBe(true);
    expect(model.options.map((o) => o.label)).toEqual([
      'Heat',
      'Cool',
      'Heat / Cool (Auto)',
      'Off',
    ]);
  });

  it('marks the entity’s current mode as selected (and only that one)', () => {
    const model = toSystemModeModel(hass(FULL), config);
    expect(model.options.filter((o) => o.selected).map((o) => o.mode)).toEqual(['heat_cool']);
  });

  it('shows only the modes the entity supports', () => {
    const model = toSystemModeModel(hass(climate('heat', { hvac_modes: ['off', 'heat'] })), config);
    expect(model.options.map((o) => o.mode)).toEqual(['heat', 'off']);
    expect(model.options.find((o) => o.mode === 'heat')?.selected).toBe(true);
  });

  it('lists Dry and Fan only (with HA labels) between Auto and Off', () => {
    const model = toSystemModeModel(
      hass(climate('dry', { hvac_modes: ['off', 'heat', 'cool', 'heat_cool', 'dry', 'fan_only'] })),
      config,
    );
    expect(model.options.map((o) => [o.mode, o.label])).toEqual([
      ['heat', 'Heat'],
      ['cool', 'Cool'],
      ['heat_cool', 'Heat / Cool (Auto)'],
      ['dry', 'Dry'],
      ['fan_only', 'Fan only'],
      ['off', 'Off'],
    ]);
    expect(model.options.find((o) => o.selected)?.mode).toBe('dry');
  });
});

describe('toSystemModeModel — Heat / Cool (Auto) spelling', () => {
  it('maps a legacy `auto` mode to the Heat / Cool (Auto) label and writes back `auto`', () => {
    const model = toSystemModeModel(hass(climate('auto', { hvac_modes: ['off', 'auto'] })), config);
    const auto = model.options.find((o) => o.mode === 'heat_cool');
    expect(auto?.label).toBe('Heat / Cool (Auto)');
    expect(auto?.hvacMode).toBe('auto');
    expect(auto?.selected).toBe(true);
  });

  it('maps a modern `heat_cool` mode to the Heat / Cool (Auto) label and writes back `heat_cool`', () => {
    const model = toSystemModeModel(
      hass(climate('cool', { hvac_modes: ['heat_cool', 'cool'] })),
      config,
    );
    expect(model.options.find((o) => o.mode === 'heat_cool')?.hvacMode).toBe('heat_cool');
  });

  it('collapses an entity exposing both spellings into one Heat / Cool (Auto) row, preferring heat_cool', () => {
    const model = toSystemModeModel(
      hass(climate('off', { hvac_modes: ['off', 'auto', 'heat_cool'] })),
      config,
    );
    const autos = model.options.filter((o) => o.mode === 'heat_cool');
    expect(autos).toHaveLength(1);
    expect(autos[0].hvacMode).toBe('heat_cool');
  });
});

describe('toSystemModeModel — graceful degradation', () => {
  it('omits an unrecognized hvac_mode string', () => {
    const model = toSystemModeModel(
      hass(climate('heat', { hvac_modes: ['off', 'heat', 'something_odd'] })),
      config,
    );
    expect(model.options.map((o) => o.mode)).toEqual(['heat', 'off']);
  });

  it('is unavailable when the entity exposes no hvac_modes', () => {
    expect(toSystemModeModel(hass(climate('heat', {})), config).available).toBe(false);
    expect(toSystemModeModel(hass(climate('heat', { hvac_modes: [] })), config).available).toBe(
      false,
    );
  });

  it('is unavailable for a missing or unavailable entity', () => {
    expect(toSystemModeModel(hass(climate('unavailable', {})), config).available).toBe(false);
    expect(toSystemModeModel(hass(FULL), { ...config, entity: 'climate.none' }).available).toBe(
      false,
    );
  });
});

describe('setHvacModeCall', () => {
  it('builds the climate.set_hvac_mode call for the chosen mode', () => {
    expect(setHvacModeCall('heat_cool', 'climate.t')).toEqual({
      domain: 'climate',
      service: 'set_hvac_mode',
      data: { entity_id: 'climate.t', hvac_mode: 'heat_cool' },
    });
  });
});

/** Concatenate the static SVG source of a Lit template, recursing into nested
 *  templates (each glyph body lives one template deep inside its `<svg>` wrapper). */
function flattenTemplate(node: unknown): string {
  if (node && typeof node === 'object' && 'strings' in node && 'values' in node) {
    const t = node as { strings: readonly string[]; values: readonly unknown[] };
    return t.strings.reduce(
      (acc, s, i) => acc + s + (i < t.values.length ? flattenTemplate(t.values[i]) : ''),
      '',
    );
  }
  return typeof node === 'string' ? node : '';
}

// The mode -> indicator-glyph mapping the Home Screen renders. Fan-only and Dry
// must select glyphs drawn in the same visual language as Heat / Cool / Auto so
// every System Mode reads consistently (issue #59).
describe('systemModeGlyph', () => {
  it('selects the matching glyph for each System Mode', () => {
    expect(systemModeGlyph('heat')).toBe(icons.heat);
    expect(systemModeGlyph('cool')).toBe(icons.snowflake);
    expect(systemModeGlyph('heat_cool')).toBe(icons.auto);
    expect(systemModeGlyph('dry')).toBe(icons.drop);
    expect(systemModeGlyph('fan_only')).toBe(icons.fan);
  });

  it('gives Dry and Fan only their own glyphs, distinct from the other modes', () => {
    const dry = systemModeGlyph('dry');
    const fan = systemModeGlyph('fan_only');
    const others = [
      systemModeGlyph('heat'),
      systemModeGlyph('cool'),
      systemModeGlyph('heat_cool'),
    ];
    expect(others).not.toContain(dry);
    expect(others).not.toContain(fan);
    expect(dry).not.toBe(fan);
  });

  it('draws Dry and Fan only in the same stroke language as Heat / Cool / Auto', () => {
    // The shared mode-glyph language: single-color line art, `currentColor` stroke,
    // 1.8 weight, round caps and joins (issue #59). Each glyph nests its body one
    // template deep inside the `<svg>` wrapper, so flatten the static SVG source to
    // assert the two generic-only glyphs carry the same stroke attributes.
    const family = ['fill="none"', 'stroke-width="1.8"', 'stroke-linecap="round"', 'stroke-linejoin="round"'];
    for (const glyph of [icons.drop, icons.fan]) {
      const markup = flattenTemplate(glyph);
      for (const token of family) expect(markup).toContain(token);
    }
  });
});
