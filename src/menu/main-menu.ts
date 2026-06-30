import type { HomeAssistant } from '../types/hass';
import type { EcoseeCardConfig } from '../config';
import { toSystemModeModel } from '../climate/system-mode';

// The derivation seam for the Main Menu hub (the sibling of `toHomeView` /
// `toSystemModeModel`). `toMainMenuModel` builds the already-degraded list of
// sub-screens the hub can route to: each entry is included only when its backing
// data is present, so the menu never offers a dead row (CONTEXT.md Main Menu;
// ADR-0001 graceful degradation). The routing itself (entry → overlay) is the
// host card's job — this seam only decides *what is reachable*, kept here so it is
// unit-testable without rendering a Lit element.

/** A sub-screen the Main Menu can route to. The hub-and-picker model lists these
 *  four (CONTEXT.md / visual-spec.md); each lands behind its own issue, so a
 *  target only appears once both its backing data and its destination exist. */
export type MainMenuTarget = 'system' | 'fan' | 'sensors' | 'weather';

/** One reachable menu row: the sub-screen to open and the device's label for it. */
export interface MainMenuEntry {
  target: MainMenuTarget;
  label: string;
}

export interface MainMenuModel {
  /** False when no sub-screen is reachable — the menu affordance opens nothing. */
  available: boolean;
  entries: MainMenuEntry[];
}

/** A candidate sub-screen and the predicate that gates it on backing data. New
 *  sub-screens register here as they land: Fan (#8, `fan_modes`), Sensors (#9,
 *  configured sensors), Weather (#5, `weather_entity`). Only sub-screens with a
 *  built destination appear, so the hub never routes to nothing. */
interface SubScreen {
  target: MainMenuTarget;
  label: string;
  available(hass: HomeAssistant, config: EcoseeCardConfig): boolean;
}

const SUBSCREENS: readonly SubScreen[] = [
  {
    target: 'system',
    label: 'System',
    // The System sub-screen routes to the System Mode picker today; it reuses that
    // seam's availability so the two never disagree. When the Comfort Setting
    // picker (#7) lands, this broadens to "modes OR presets".
    available: (hass, config) => toSystemModeModel(hass, config).available,
  },
];

export function toMainMenuModel(hass: HomeAssistant, config: EcoseeCardConfig): MainMenuModel {
  const entries: MainMenuEntry[] = SUBSCREENS.filter((screen) =>
    screen.available(hass, config),
  ).map(({ target, label }) => ({ target, label }));

  return { available: entries.length > 0, entries };
}
