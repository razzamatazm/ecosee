import { describe, it, expect } from 'vitest';
import { parseConfig } from '../src/config';
import { editorSchema, toEditorData, normalizeEditorConfig } from '../src/editor/editor';

const base = { type: 'custom:ecosee-card', entity: 'climate.living_room' };

describe('editorSchema — coverage', () => {
  // Guard test: the GUI editor must track the config schema as overlays add keys
  // (issue #14). If a config key is added/removed, this list must change in step,
  // which is the reminder to add/remove its form control.
  it('exposes one field per config key, in schema order', () => {
    expect(editorSchema().map((field) => field.name)).toEqual([
      'entity',
      'name',
      'weather_entity',
      'humidity_entity',
      'air_quality_entity',
      'uv_index_entity',
      'sensors',
      'inactivity_timeout',
      'standby_screen',
    ]);
  });

  it('marks only `entity` required and binds it to the climate domain', () => {
    const fields = editorSchema();
    expect(fields.filter((field) => field.required).map((field) => field.name)).toEqual(['entity']);
    expect(fields.find((field) => field.name === 'entity')?.selector).toEqual({
      entity: { domain: 'climate' },
    });
  });

  it('uses domain-scoped entity pickers for the entity-backed keys', () => {
    const byName = Object.fromEntries(editorSchema().map((field) => [field.name, field.selector]));
    expect(byName.weather_entity).toEqual({ entity: { domain: 'weather' } });
    expect(byName.uv_index_entity).toEqual({ entity: { domain: 'sensor' } });
  });

  it('narrows the sensor-backed pickers to their device class (#56)', () => {
    const byName = Object.fromEntries(editorSchema().map((field) => [field.name, field.selector]));
    expect(byName.humidity_entity).toEqual({
      entity: { domain: 'sensor', device_class: 'humidity' },
    });
    expect(byName.air_quality_entity).toEqual({ entity: { domain: 'sensor', device_class: 'aqi' } });
  });

  it('has no fan minimum-runtime field (removed in #57)', () => {
    expect(editorSchema().some((field) => field.name === 'fan_min_on_time_entity')).toBe(false);
  });

  it('uses a multi-entity picker narrowed to temperature sensors (plus climate) for the sensors list (#56)', () => {
    const sensors = editorSchema().find((field) => field.name === 'sensors')?.selector;
    expect(sensors).toEqual({
      entity: {
        multiple: true,
        filter: [{ domain: 'sensor', device_class: 'temperature' }, { domain: 'climate' }],
      },
    });
  });

  it('uses a number selector for inactivity_timeout', () => {
    const byName = Object.fromEntries(editorSchema().map((field) => [field.name, field.selector]));
    expect(byName.inactivity_timeout).toMatchObject({ number: { min: 0 } });
  });

  it('uses a boolean selector for the opt-in standby_screen toggle (#64)', () => {
    const standby = editorSchema().find((field) => field.name === 'standby_screen');
    expect(standby?.selector).toEqual({ boolean: {} });
    expect(standby?.required).toBeFalsy();
  });

  it('has no comfort-icon field (removed in #58)', () => {
    expect(editorSchema().some((field) => field.name === 'default_comfort_icon')).toBe(false);
  });

  it('gives every field a non-empty label', () => {
    expect(editorSchema().every((field) => field.label.length > 0)).toBe(true);
  });
});

describe('editorSchema — optionality copy (#61)', () => {
  it('marks the required Thermostat and every other field as optional in its helper', () => {
    for (const field of editorSchema()) {
      expect(field.helper, `field ${field.name} needs a helper`).toBeTruthy();
      if (field.required) {
        expect(field.helper?.startsWith('Required.')).toBe(true);
      } else {
        expect(field.helper?.startsWith('Optional.')).toBe(true);
      }
    }
  });

  it('tells users each feature-gated element only appears once its entity is added', () => {
    const byName = Object.fromEntries(editorSchema().map((field) => [field.name, field.helper]));
    for (const name of ['weather_entity', 'air_quality_entity', 'uv_index_entity', 'sensors']) {
      expect(byName[name], `field ${name} should note it is hidden until set`).toMatch(/hidden until/);
    }
  });
});

describe('toEditorData', () => {
  it('maps object-form sensors to their entity ids for the picker', () => {
    const data = toEditorData({
      ...base,
      sensors: [{ entity: 'sensor.hallway', name: 'Hallway' }, 'sensor.kitchen'],
    });
    expect(data.sensors).toEqual(['sensor.hallway', 'sensor.kitchen']);
  });

  it('passes scalar keys through untouched', () => {
    const data = toEditorData({ ...base, name: 'Living Room', inactivity_timeout: 0 });
    expect(data.name).toBe('Living Room');
    expect(data.inactivity_timeout).toBe(0);
    expect(data.entity).toBe('climate.living_room');
  });

  it('omits sensors when none are configured', () => {
    expect('sensors' in toEditorData({ ...base })).toBe(false);
  });
});

describe('normalizeEditorConfig — optional-config-key hygiene', () => {
  it('keeps type and the required entity (even while empty)', () => {
    const next = normalizeEditorConfig({ entity: '' }, {});
    expect(next.type).toBe('custom:ecosee-card');
    expect(next.entity).toBe('');
    // An empty entity is still surfaced; parseConfig is what rejects it (the editor
    // never fabricates validity).
    expect(() => parseConfig(next)).toThrow(/`entity` is required/);
  });

  it('drops a cleared optional string key rather than emitting an empty value', () => {
    const next = normalizeEditorConfig({ ...base, weather_entity: '' }, base);
    expect('weather_entity' in next).toBe(false);
    expect(parseConfig(next).weather_entity).toBeUndefined();
  });

  it('keeps a non-empty optional string key', () => {
    const next = normalizeEditorConfig({ ...base, weather_entity: 'weather.home' }, base);
    expect(next.weather_entity).toBe('weather.home');
  });

  it('keeps inactivity_timeout 0 (auto-revert off) but drops an unset timeout', () => {
    expect(normalizeEditorConfig({ ...base, inactivity_timeout: 0 }, base).inactivity_timeout).toBe(
      0,
    );
    expect('inactivity_timeout' in normalizeEditorConfig({ ...base }, base)).toBe(false);
  });

  it('drops an empty sensors list and keeps a shorthand list', () => {
    expect('sensors' in normalizeEditorConfig({ ...base, sensors: [] }, base)).toBe(false);
    expect(
      normalizeEditorConfig({ ...base, sensors: ['sensor.kitchen', 'sensor.den'] }, base).sensors,
    ).toEqual(['sensor.kitchen', 'sensor.den']);
  });

  it('keeps standby_screen when on but drops it when off or unset (#64)', () => {
    expect(normalizeEditorConfig({ ...base, standby_screen: true }, base).standby_screen).toBe(true);
    expect('standby_screen' in normalizeEditorConfig({ ...base, standby_screen: false }, base)).toBe(
      false,
    );
    expect('standby_screen' in normalizeEditorConfig({ ...base }, base)).toBe(false);
  });

  it('preserves object-form sensor overrides when the entity set is unchanged', () => {
    const prev = { ...base, sensors: [{ entity: 'sensor.hallway', name: 'Hallway' }] };
    // ha-form shows/echoes the picker's string value for the same set.
    const next = normalizeEditorConfig({ ...base, sensors: ['sensor.hallway'] }, prev);
    expect(next.sensors).toEqual([{ entity: 'sensor.hallway', name: 'Hallway' }]);
  });

  it('adopts the shorthand list when the entity set changes', () => {
    const prev = { ...base, sensors: [{ entity: 'sensor.hallway', name: 'Hallway' }] };
    const next = normalizeEditorConfig(
      { ...base, sensors: ['sensor.hallway', 'sensor.kitchen'] },
      prev,
    );
    expect(next.sensors).toEqual(['sensor.hallway', 'sensor.kitchen']);
  });

  it('preserves keys the GUI does not yet surface (forward compatibility)', () => {
    const prev = { ...base, future_key: 'keep-me' };
    expect(normalizeEditorConfig({ ...base }, prev).future_key).toBe('keep-me');
  });

  it('preserves a stored fan_min_on_time_entity through an edit (removed from editor, #57)', () => {
    const prev = { ...base, fan_min_on_time_entity: 'number.fan_min_on_time' };
    expect(normalizeEditorConfig({ ...base }, prev).fan_min_on_time_entity).toBe(
      'number.fan_min_on_time',
    );
  });

  it('preserves a stored default_comfort_icon through an edit (removed from editor, #58)', () => {
    const prev = { ...base, default_comfort_icon: 'sleep' };
    expect(normalizeEditorConfig({ ...base }, prev).default_comfort_icon).toBe('sleep');
  });

  it('produces a config parseConfig accepts and round-trips (acceptance, issue #14)', () => {
    const formValue = {
      type: 'custom:ecosee-card',
      entity: 'climate.living_room',
      name: 'Living Room',
      weather_entity: 'weather.home',
      humidity_entity: '', // user cleared it
      air_quality_entity: 'sensor.aqi',
      uv_index_entity: 'sensor.uv',
      sensors: ['sensor.kitchen'],
      inactivity_timeout: 0,
    };
    const config = parseConfig(normalizeEditorConfig(formValue, {}));
    expect(config.entity).toBe('climate.living_room');
    expect(config.name).toBe('Living Room');
    expect(config.weather_entity).toBe('weather.home');
    expect(config.humidity_entity).toBeUndefined();
    expect(config.air_quality_entity).toBe('sensor.aqi');
    expect(config.uv_index_entity).toBe('sensor.uv');
    expect(config.sensors).toEqual([{ entity: 'sensor.kitchen' }]);
    expect(config.inactivity_timeout).toBe(0);
  });
});
