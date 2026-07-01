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
      'fan_min_on_time_entity',
      'default_comfort_icon',
      'sensors',
      'inactivity_timeout',
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
    expect(byName.humidity_entity).toEqual({ entity: { domain: 'sensor' } });
    expect(byName.air_quality_entity).toEqual({ entity: { domain: 'sensor' } });
    expect(byName.uv_index_entity).toEqual({ entity: { domain: 'sensor' } });
    expect(byName.fan_min_on_time_entity).toEqual({ entity: { domain: 'number' } });
  });

  it('uses a multi-entity picker for the sensors list', () => {
    const sensors = editorSchema().find((field) => field.name === 'sensors')?.selector;
    expect(sensors).toEqual({ entity: { domain: ['sensor', 'climate'], multiple: true } });
  });

  it('uses a number selector for inactivity_timeout and a select for the comfort icon', () => {
    const byName = Object.fromEntries(editorSchema().map((field) => [field.name, field.selector]));
    expect(byName.inactivity_timeout).toMatchObject({ number: { min: 0 } });
    expect(byName.default_comfort_icon).toMatchObject({ select: {} });
    const icon = byName.default_comfort_icon as {
      select: { options: ReadonlyArray<{ value: string }> };
    };
    expect(icon.select.options.map((option) => option.value)).toEqual([
      'home',
      'away',
      'sleep',
      'comfort',
    ]);
  });

  it('gives every field a non-empty label', () => {
    expect(editorSchema().every((field) => field.label.length > 0)).toBe(true);
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

  it('produces a config parseConfig accepts and round-trips (acceptance, issue #14)', () => {
    const formValue = {
      type: 'custom:ecosee-card',
      entity: 'climate.living_room',
      name: 'Living Room',
      weather_entity: 'weather.home',
      humidity_entity: '', // user cleared it
      air_quality_entity: 'sensor.aqi',
      uv_index_entity: 'sensor.uv',
      fan_min_on_time_entity: '',
      default_comfort_icon: 'home',
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
    expect(config.fan_min_on_time_entity).toBeUndefined();
    expect(config.default_comfort_icon).toBe('home');
    expect(config.sensors).toEqual([{ entity: 'sensor.kitchen' }]);
    expect(config.inactivity_timeout).toBe(0);
  });
});
