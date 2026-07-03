import { describe, it, expect } from 'vitest';
import { parseConfig } from '../src/config';
import {
  editorSchema,
  composeEditorSchema,
  sensorNameKey,
  sensorEntityKey,
  toEditorData,
  normalizeEditorConfig,
} from '../src/editor/editor';

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
      'show_fan',
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
    expect(byName.air_quality_entity).toEqual({
      entity: { domain: 'sensor', device_class: 'aqi' },
    });
  });

  it('has no fan minimum-runtime field (removed in #57)', () => {
    expect(editorSchema().some((field) => field.name === 'fan_min_on_time_entity')).toBe(false);
  });

  it('anchors the sensors block with a temperature-scoped entity picker (#56)', () => {
    const sensors = editorSchema().find((field) => field.name === 'sensors')?.selector;
    expect(sensors).toEqual({
      entity: {
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

  it('uses a dropdown select for show_fan with auto default first', () => {
    const showFan = editorSchema().find((field) => field.name === 'show_fan');
    expect(showFan?.selector).toEqual({
      select: {
        mode: 'dropdown',
        options: [
          { value: 'auto', label: 'Auto (speeds only)' },
          { value: 'always', label: 'Always' },
          { value: 'never', label: 'Never' },
        ],
      },
    });
    expect(showFan?.required).toBeFalsy();
  });

  it('leaves the per-element standby customization YAML-only (not in the editor)', () => {
    expect(editorSchema().some((field) => field.name === 'standby')).toBe(false);
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
      expect(byName[name], `field ${name} should note it is hidden until set`).toMatch(
        /hidden until/,
      );
    }
  });
});

describe('composeEditorSchema — per-sensor rows', () => {
  it('replaces the sensors anchor with just an add picker when none are configured', () => {
    const schema = composeEditorSchema(base);
    const names = schema.map((field) => field.name);
    // No single `sensors` field renders; the anchor becomes the trailing add picker,
    // and there are no display-name fields yet.
    expect(names).not.toContain('sensors');
    expect(names).toContain(sensorEntityKey(0));
    expect(names.some((name) => name.startsWith(sensorNameKey('')))).toBe(false);
  });

  it('puts each display-name field directly beneath the sensor it names, then a trailing add picker', () => {
    const config = {
      ...base,
      sensors: [{ entity: 'sensor.hallway', name: 'Hallway' }, 'sensor.kitchen'],
    };
    const schema = composeEditorSchema(config);
    const names = schema.map((field) => field.name);
    const sensorsAt = names.indexOf(sensorEntityKey(0));
    // entity picker → its name field → entity picker → its name field → add picker.
    expect(names.slice(sensorsAt, sensorsAt + 5)).toEqual([
      sensorEntityKey(0),
      sensorNameKey('sensor.hallway'),
      sensorEntityKey(1),
      sensorNameKey('sensor.kitchen'),
      sensorEntityKey(2),
    ]);
    const nameField = schema.find((field) => field.name === sensorNameKey('sensor.hallway'));
    expect(nameField?.selector).toEqual({ text: {} });
    expect(nameField?.required).toBeFalsy();
    // The single `sensors` field never renders — it is expanded into the rows above.
    expect(names).not.toContain('sensors');
  });

  it('leaves the base schema (one field per config key) untouched', () => {
    // The dynamic per-sensor fields are additive; editorSchema() stays the pure base.
    const names = editorSchema().map((field) => field.name);
    expect(names).toContain('sensors');
    expect(names.some((name) => name.startsWith(sensorNameKey('')))).toBe(false);
    expect(names.some((name) => name.startsWith('sensor_entity::'))).toBe(false);
  });
});

describe('toEditorData', () => {
  it('spreads sensor entity ids across the per-index picker fields', () => {
    const data = toEditorData({
      ...base,
      sensors: [{ entity: 'sensor.hallway', name: 'Hallway' }, 'sensor.kitchen'],
    });
    expect(data[sensorEntityKey(0)]).toBe('sensor.hallway');
    expect(data[sensorEntityKey(1)]).toBe('sensor.kitchen');
    // No single `sensors` key is rendered; the pickers carry the list now.
    expect('sensors' in data).toBe(false);
  });

  it('surfaces each stored display name under its per-sensor name field', () => {
    const data = toEditorData({
      ...base,
      sensors: [{ entity: 'sensor.hallway', name: 'Hallway' }, 'sensor.kitchen'],
    });
    // The named sensor exposes its name for its GUI field; the bare one does not.
    expect(data[sensorNameKey('sensor.hallway')]).toBe('Hallway');
    expect(sensorNameKey('sensor.kitchen') in data).toBe(false);
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

  it('defaults show_fan to auto for the dropdown when the key is absent', () => {
    expect(toEditorData({ ...base }).show_fan).toBe('auto');
    // A stored value is reflected verbatim.
    expect(toEditorData({ ...base, show_fan: 'always' }).show_fan).toBe('always');
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
    // No picker holds a value → the sensors key is dropped entirely.
    expect('sensors' in normalizeEditorConfig({ ...base }, base)).toBe(false);
    expect(
      normalizeEditorConfig(
        { ...base, [sensorEntityKey(0)]: 'sensor.kitchen', [sensorEntityKey(1)]: 'sensor.den' },
        base,
      ).sensors,
    ).toEqual(['sensor.kitchen', 'sensor.den']);
  });

  it('keeps standby_screen when on but drops it when off or unset (#64)', () => {
    expect(normalizeEditorConfig({ ...base, standby_screen: true }, base).standby_screen).toBe(
      true,
    );
    expect(
      'standby_screen' in normalizeEditorConfig({ ...base, standby_screen: false }, base),
    ).toBe(false);
    expect('standby_screen' in normalizeEditorConfig({ ...base }, base)).toBe(false);
  });

  it('writes a non-default show_fan choice but drops the auto default', () => {
    expect(normalizeEditorConfig({ ...base, show_fan: 'always' }, base).show_fan).toBe('always');
    expect(normalizeEditorConfig({ ...base, show_fan: 'never' }, base).show_fan).toBe('never');
    // `auto` is the default (first option), so it drops back to unset.
    expect('show_fan' in normalizeEditorConfig({ ...base, show_fan: 'auto' }, base)).toBe(false);
    expect('show_fan' in normalizeEditorConfig({ ...base }, base)).toBe(false);
  });

  it('resets show_fan to the auto default by dropping the key', () => {
    // Was 'always', the user picks 'auto' in the dropdown → key removed, not written.
    const prev = { ...base, show_fan: 'always' };
    expect('show_fan' in normalizeEditorConfig({ ...prev, show_fan: 'auto' }, prev)).toBe(false);
  });

  it('preserves the YAML-only standby customization through an unrelated GUI edit', () => {
    const prev = { ...base, standby: { glow: false } };
    // The editor never surfaces `standby`, so an unrelated change must not drop it.
    const next = normalizeEditorConfig({ ...toEditorData(prev), name: 'Den' }, prev);
    expect(next.standby).toEqual({ glow: false });
    expect(next.name).toBe('Den');
  });

  it('preserves a stored display name when the name field is untouched', () => {
    const prev = { ...base, sensors: [{ entity: 'sensor.hallway', name: 'Hallway' }] };
    // If ha-form does not echo the untouched name field, fall back to the stored
    // name rather than silently dropping it.
    const next = normalizeEditorConfig({ ...base, [sensorEntityKey(0)]: 'sensor.hallway' }, prev);
    expect(next.sensors).toEqual([{ entity: 'sensor.hallway', name: 'Hallway' }]);
  });

  it('writes a display name typed in the GUI into object-form', () => {
    const next = normalizeEditorConfig(
      {
        ...base,
        [sensorEntityKey(0)]: 'sensor.hallway',
        [sensorNameKey('sensor.hallway')]: 'Front Hall',
      },
      base,
    );
    expect(next.sensors).toEqual([{ entity: 'sensor.hallway', name: 'Front Hall' }]);
  });

  it('keeps a surviving sensor’s name when another sensor is added', () => {
    // Names are GUI-editable now, so growing the set must not drop existing names
    // (the old "adopt shorthand on any change" behavior is gone).
    const prev = { ...base, sensors: [{ entity: 'sensor.hallway', name: 'Hallway' }] };
    const next = normalizeEditorConfig(
      {
        ...base,
        [sensorEntityKey(0)]: 'sensor.hallway',
        [sensorEntityKey(1)]: 'sensor.kitchen',
        [sensorNameKey('sensor.hallway')]: 'Hallway',
      },
      prev,
    );
    expect(next.sensors).toEqual([{ entity: 'sensor.hallway', name: 'Hallway' }, 'sensor.kitchen']);
  });

  it('clears a display name when its field is emptied (back to shorthand)', () => {
    const prev = { ...base, sensors: [{ entity: 'sensor.hallway', name: 'Hallway' }] };
    const next = normalizeEditorConfig(
      { ...base, [sensorEntityKey(0)]: 'sensor.hallway', [sensorNameKey('sensor.hallway')]: '   ' },
      prev,
    );
    expect(next.sensors).toEqual(['sensor.hallway']);
  });

  it('keeps YAML-only occupancy_entity when a name is set via the GUI', () => {
    const prev = {
      ...base,
      sensors: [{ entity: 'sensor.hallway', occupancy_entity: 'binary_sensor.hall' }],
    };
    const next = normalizeEditorConfig(
      {
        ...base,
        [sensorEntityKey(0)]: 'sensor.hallway',
        [sensorNameKey('sensor.hallway')]: 'Hall',
      },
      prev,
    );
    expect(next.sensors).toEqual([
      { entity: 'sensor.hallway', name: 'Hall', occupancy_entity: 'binary_sensor.hall' },
    ]);
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
      [sensorEntityKey(0)]: 'sensor.kitchen',
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
