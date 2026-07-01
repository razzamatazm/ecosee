import { describe, it, expect } from 'vitest';
import {
  toTempAdjustModel,
  nudge,
  setValue,
  selectSetpoint,
  scrubberWindow,
  setTemperatureCall,
} from '../src/climate/temperature-adjust';
import { formatTemp } from '../src/climate/home-view';
import type { EcoseeCardConfig } from '../src/config';
import type { HassEntityBase, HomeAssistant } from '../src/types/hass';

function hass(climate: HassEntityBase, unit = '°F'): HomeAssistant {
  return {
    states: { [climate.entity_id]: climate },
    entities: { [climate.entity_id]: { platform: 'ecobee' } },
    config: { unit_system: { temperature: unit } },
    callService: async () => undefined,
  };
}

const config: EcoseeCardConfig = { type: 'custom:ecosee-card', entity: 'climate.t' };

function climate(state: string, attributes: Record<string, unknown>): HassEntityBase {
  return { entity_id: 'climate.t', state, attributes };
}

// Common rich-entity bounds reused across cases.
const BOUNDS = { min_temp: 45, max_temp: 92, target_temp_step: 1 };

describe('toTempAdjustModel — mode mapping', () => {
  it('single Heat mode exposes one heat setpoint', () => {
    const model = toTempAdjustModel(hass(climate('heat', { temperature: 68, ...BOUNDS })), config);
    expect(model.available).toBe(true);
    expect(model.active).toBe('heat');
    expect(model.cool).toBeNull();
    expect(model.heat).toEqual({ setpoint: 'heat', value: 68, min: 45, max: 92, step: 1 });
  });

  it('single Cool mode exposes one cool setpoint', () => {
    const model = toTempAdjustModel(hass(climate('cool', { temperature: 74, ...BOUNDS })), config);
    expect(model.active).toBe('cool');
    expect(model.heat).toBeNull();
    expect(model.cool?.value).toBe(74);
  });

  it('Heat / Cool (Auto) exposes both setpoints and edits cool by default', () => {
    const model = toTempAdjustModel(
      hass(climate('heat_cool', { target_temp_low: 70, target_temp_high: 75, ...BOUNDS })),
      config,
    );
    expect(model.available).toBe(true);
    expect(model.active).toBe('cool');
    expect(model.heat?.value).toBe(70);
    expect(model.cool?.value).toBe(75);
  });

  it('treats `auto` as Heat / Cool (Auto)', () => {
    const model = toTempAdjustModel(
      hass(climate('auto', { target_temp_low: 70, target_temp_high: 75, ...BOUNDS })),
      config,
    );
    expect(model.mode).toBe('heat_cool');
    expect(model.heat?.value).toBe(70);
  });
});

describe('toTempAdjustModel — not actionable', () => {
  it('is unavailable when the system is Off', () => {
    const model = toTempAdjustModel(hass(climate('off', { temperature: 70, ...BOUNDS })), config);
    expect(model.available).toBe(false);
  });

  it('is unavailable for an unavailable / missing entity', () => {
    expect(toTempAdjustModel(hass(climate('unavailable', {})), config).available).toBe(false);
    expect(
      toTempAdjustModel(hass(climate('x', {})), { ...config, entity: 'climate.none' }).available,
    ).toBe(false);
  });

  it('is unavailable when a single mode has no setpoint to edit', () => {
    const model = toTempAdjustModel(hass(climate('heat', { ...BOUNDS })), config);
    expect(model.available).toBe(false);
  });

  it('reducers are no-ops on an unavailable model', () => {
    const model = toTempAdjustModel(hass(climate('off', {})), config);
    expect(nudge(model, 1)).toBe(model);
    expect(setValue(model, 80)).toBe(model);
    expect(setTemperatureCall(model, 'climate.t')).toBeNull();
  });
});

describe('toTempAdjustModel — graceful degradation of step/min/max', () => {
  it('defaults the step to whole degrees in °F when absent', () => {
    const model = toTempAdjustModel(hass(climate('heat', { temperature: 68 })), config);
    expect(model.heat?.step).toBe(1);
    expect(model.heat?.min).toBeNull();
    expect(model.heat?.max).toBeNull();
  });

  it('defaults the step to half degrees in °C when absent', () => {
    const model = toTempAdjustModel(hass(climate('heat', { temperature: 20 }), '°C'), config);
    expect(model.heat?.step).toBe(0.5);
  });

  it('keeps a whole-degree step in °F even when the entity reports a half step', () => {
    // A °F ecobee reports target_temp_step 0.5; honoring it would step the
    // scrubber in half degrees that formatTemp renders as duplicate integers.
    const model = toTempAdjustModel(
      hass(climate('heat', { temperature: 68, target_temp_step: 0.5 })),
      config,
    );
    expect(model.heat?.step).toBe(1);
  });

  it('keeps a half-degree step in °C even when the entity reports a whole step', () => {
    const model = toTempAdjustModel(
      hass(climate('heat', { temperature: 20, target_temp_step: 1 }), '°C'),
      config,
    );
    expect(model.heat?.step).toBe(0.5);
  });

  it('snaps an off-grid initial value onto the step grid', () => {
    // 71.3 °C with a 0.5 step → nearest grid point 71.5.
    const model = toTempAdjustModel(
      hass(climate('heat', { temperature: 71.3, target_temp_step: 0.5 }), '°C'),
      config,
    );
    expect(model.heat?.value).toBe(71.5);
  });

  it('clamps an out-of-range initial value into [min, max]', () => {
    const model = toTempAdjustModel(hass(climate('heat', { temperature: 200, ...BOUNDS })), config);
    expect(model.heat?.value).toBe(92);
  });
});

describe('nudge', () => {
  const heat = () =>
    toTempAdjustModel(hass(climate('heat', { temperature: 68, ...BOUNDS })), config);

  it('steps up and down by one step', () => {
    expect(nudge(heat(), 1).heat?.value).toBe(69);
    expect(nudge(heat(), -1).heat?.value).toBe(67);
  });

  it('respects a fractional step', () => {
    const model = toTempAdjustModel(
      hass(climate('heat', { temperature: 71.5, target_temp_step: 0.5 }), '°C'),
      config,
    );
    expect(nudge(model, 1).heat?.value).toBe(72);
  });

  it('clamps at max and min', () => {
    const atMax = toTempAdjustModel(hass(climate('heat', { temperature: 92, ...BOUNDS })), config);
    expect(nudge(atMax, 1).heat?.value).toBe(92);
    const atMin = toTempAdjustModel(hass(climate('heat', { temperature: 45, ...BOUNDS })), config);
    expect(nudge(atMin, -1).heat?.value).toBe(45);
  });

  it('does not let the heat setpoint cross above cool in Auto', () => {
    const auto = toTempAdjustModel(
      hass(climate('heat_cool', { target_temp_low: 74, target_temp_high: 75, ...BOUNDS })),
      config,
    );
    const editingHeat = selectSetpoint(auto, 'heat');
    const bumped = nudge(nudge(editingHeat, 1), 1); // 74 → 75, then capped
    expect(bumped.heat?.value).toBe(75);
    expect(bumped.cool?.value).toBe(75);
  });
});

describe('setValue', () => {
  it('snaps a scrubbed value onto the grid and clamps it', () => {
    const model = toTempAdjustModel(hass(climate('cool', { temperature: 74, ...BOUNDS })), config);
    expect(setValue(model, 77).cool?.value).toBe(77);
    expect(setValue(model, 100).cool?.value).toBe(92);
  });

  it('floors the cool setpoint at heat in Auto (no crossing)', () => {
    const auto = toTempAdjustModel(
      hass(climate('heat_cool', { target_temp_low: 70, target_temp_high: 75, ...BOUNDS })),
      config,
    );
    // active is cool by default; dragging it below heat (70) floors at 70.
    expect(setValue(auto, 66).cool?.value).toBe(70);
  });
});

describe('selectSetpoint', () => {
  it('switches the edited setpoint in Auto', () => {
    const auto = toTempAdjustModel(
      hass(climate('heat_cool', { target_temp_low: 70, target_temp_high: 75, ...BOUNDS })),
      config,
    );
    expect(auto.active).toBe('cool');
    expect(selectSetpoint(auto, 'heat').active).toBe('heat');
  });

  it('is a no-op when the chosen setpoint is absent (single mode)', () => {
    const single = toTempAdjustModel(hass(climate('heat', { temperature: 68, ...BOUNDS })), config);
    expect(selectSetpoint(single, 'cool')).toBe(single);
  });
});

describe('scrubberWindow', () => {
  it('returns neighbors on each side of the current value', () => {
    const model = toTempAdjustModel(hass(climate('cool', { temperature: 75, ...BOUNDS })), config);
    expect(scrubberWindow(model.cool!, 2)).toEqual([73, 74, 75, 76, 77]);
  });

  it('trims neighbors that fall outside the bounds', () => {
    const model = toTempAdjustModel(hass(climate('cool', { temperature: 92, ...BOUNDS })), config);
    expect(scrubberWindow(model.cool!, 2)).toEqual([90, 91, 92]);
  });

  it('°F: consecutive values differ by 1 so every rendered integer is unique', () => {
    // A °F entity reporting a 0.5 step used to yield 75, 75, 74, 74… — two half
    // steps rendering the same whole degree. The step is now unit-aware (1°F).
    const model = toTempAdjustModel(
      hass(climate('cool', { temperature: 75, min_temp: 45, max_temp: 92, target_temp_step: 0.5 })),
      config,
    );
    const values = scrubberWindow(model.cool!, 2);
    for (let i = 1; i < values.length; i++) {
      expect(values[i] - values[i - 1]).toBe(1);
    }
    const rendered = values.map((v) => formatTemp(v, model.unit));
    expect(rendered).toEqual(['73', '74', '75', '76', '77']);
    expect(new Set(rendered).size).toBe(rendered.length); // no duplicates
  });

  it('°C: consecutive values differ by 0.5 with the halves shown', () => {
    const model = toTempAdjustModel(
      hass(climate('cool', { temperature: 21, min_temp: 10, max_temp: 32 }), '°C'),
      config,
    );
    const values = scrubberWindow(model.cool!, 2);
    for (let i = 1; i < values.length; i++) {
      expect(values[i] - values[i - 1]).toBe(0.5);
    }
    const rendered = values.map((v) => formatTemp(v, model.unit));
    expect(rendered).toEqual(['20', '20.5', '21', '21.5', '22']);
    expect(new Set(rendered).size).toBe(rendered.length);
  });
});

describe('setTemperatureCall', () => {
  it('writes a single setpoint via `temperature`', () => {
    const model = toTempAdjustModel(hass(climate('heat', { temperature: 68, ...BOUNDS })), config);
    expect(setTemperatureCall(nudge(model, 1), 'climate.t')).toEqual({
      domain: 'climate',
      service: 'set_temperature',
      data: { entity_id: 'climate.t', temperature: 69 },
    });
  });

  it('writes dual setpoints via `target_temp_low` / `target_temp_high`', () => {
    const model = toTempAdjustModel(
      hass(climate('heat_cool', { target_temp_low: 70, target_temp_high: 75, ...BOUNDS })),
      config,
    );
    expect(setTemperatureCall(model, 'climate.t')?.data).toEqual({
      entity_id: 'climate.t',
      target_temp_low: 70,
      target_temp_high: 75,
    });
  });
});
