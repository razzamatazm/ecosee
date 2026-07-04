import { describe, it, expect } from 'vitest';
import { toTabBarModel } from '../src/menu/tab-bar';

const ALL = { system: true, sensors: true, fan: true };

describe('toTabBarModel', () => {
  it('lists reachable sections in device order (sensors, fan, System-gear) after the badge', () => {
    const model = toTabBarModel('system', '72', ALL);
    expect(model.available).toBe(true);
    expect(model.items.map((i) => [i.target, i.icon])).toEqual([
      ['sensors', 'sensor'],
      ['fan', 'fan'],
      ['system', 'gear'],
    ]);
  });

  it('marks the active section (and only it)', () => {
    const model = toTabBarModel('sensors', '70', ALL);
    expect(model.items.filter((i) => i.active).map((i) => i.target)).toEqual(['sensors']);
  });

  it('drops sections whose data is absent (graceful degradation)', () => {
    const model = toTabBarModel('system', '68', { system: true, sensors: false, fan: false });
    expect(model.items.map((i) => i.target)).toEqual(['system']);
    expect(model.available).toBe(true);
  });

  it('is unavailable when the active screen is not a section (a picker / temperature)', () => {
    expect(toTabBarModel('system-mode', '72', ALL).available).toBe(false);
    expect(toTabBarModel('temperature', '72', ALL).available).toBe(false);
    expect(toTabBarModel('weather', '72', ALL).available).toBe(false);
  });

  it('is unavailable when no section is reachable, even on a section screen', () => {
    const model = toTabBarModel('system', '72', { system: false, sensors: false, fan: false });
    expect(model.available).toBe(false);
    expect(model.items).toEqual([]);
  });

  it('passes the preformatted badge temperature through (null when unknown)', () => {
    expect(toTabBarModel('fan', '73', ALL).temp).toBe('73');
    expect(toTabBarModel('fan', null, ALL).temp).toBeNull();
  });
});
