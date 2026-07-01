import { describe, it, expect } from 'vitest';
import { conditionColor } from '../src/icons';

// `conditionColor` is the color sibling of `weatherIcon`: it maps a Home Assistant
// `weather` condition to the natural per-condition color the Weather Overlay tints
// that condition's glyph (issue #31 — a sunny day and a cloudy day must read at a
// glance from color, not shape alone). Each color is an overridable token so a
// dashboard can retheme it, mirroring the `var(--token, #hex)` convention the rest
// of the Skin uses.

describe('conditionColor', () => {
  it('returns an overridable token reference (not a bare hex)', () => {
    const color = conditionColor('sunny');
    expect(color).toMatch(/^var\(--ecosee-weather-[a-z]+, #[0-9a-fA-F]{6}\)$/);
  });

  it('gives sun, cloud and rain visibly distinct colors', () => {
    const sun = conditionColor('sunny');
    const cloud = conditionColor('cloudy');
    const rain = conditionColor('rainy');
    expect(new Set([sun, cloud, rain]).size).toBe(3);
    expect(sun).toContain('--ecosee-weather-sun');
    expect(cloud).toContain('--ecosee-weather-cloud');
    expect(rain).toContain('--ecosee-weather-rain');
  });

  it('groups related conditions onto the same color as their glyph', () => {
    // pouring shares the rain glyph and rain color; hail shares the snow glyph/color.
    expect(conditionColor('pouring')).toBe(conditionColor('rainy'));
    expect(conditionColor('hail')).toBe(conditionColor('snowy'));
    expect(conditionColor('snowy-rainy')).toBe(conditionColor('snowy'));
    expect(conditionColor('lightning-rainy')).toBe(conditionColor('lightning'));
  });

  it('maps clear-night and the storm/snow/fog conditions to their own tints', () => {
    expect(conditionColor('clear-night')).toContain('--ecosee-weather-clear');
    expect(conditionColor('lightning')).toContain('--ecosee-weather-storm');
    expect(conditionColor('snowy')).toContain('--ecosee-weather-snow');
    expect(conditionColor('fog')).toContain('--ecosee-weather-cloud');
  });

  it('falls back to the partly-cloudy tint for partlycloudy and unknown conditions', () => {
    const partly = conditionColor('partlycloudy');
    expect(partly).toContain('--ecosee-weather-partly');
    // An unrecognized / under-specified condition shares the same coherent default
    // as the partly-cloudy glyph it falls back to (ADR-0001 graceful degradation).
    expect(conditionColor('mostly-clear')).toBe(partly);
    expect(conditionColor('')).toBe(partly);
  });
});
