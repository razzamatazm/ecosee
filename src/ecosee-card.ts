import { LitElement, html, css, nothing, type TemplateResult, type PropertyValues } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { CARD_TYPE, parseConfig, type EcoseeCardConfig } from './config';
import { toHomeView } from './climate/home-view';
import {
  toTempAdjustModel,
  selectSetpoint,
  type TempAdjustModel,
  type Setpoint,
} from './climate/temperature-adjust';
import { toSystemModeModel } from './climate/system-mode';
import { toComfortSettingModel } from './climate/comfort-setting';
import { toFanModel } from './climate/fan';
import { toMainMenuModel, type MainMenuTarget } from './menu/main-menu';
import { InactivityTimer, inactivityTimeoutMs, standbyReturnMs } from './overlays/inactivity-timer';
import type { SystemSelectTarget } from './overlays/system-overlay';
import { toSensorsModel } from './sensors/sensors';
import {
  toWeatherModel,
  getForecastsCall,
  parseForecastResponse,
  type ForecastEntry,
  type ForecastType,
  type WeatherForecasts,
} from './weather/weather';
import type { ServiceCall } from './climate/service-call';
import { tokens } from './styles/tokens';
import { resolveDeviceSize } from './device-size';
import type { HomeAssistant, LovelaceCard } from './types/hass';
import type { HomeActionDetail } from './screens/home-screen';
import { toStandbyView } from './screens/standby-view';
import './screens/home-screen';
import './screens/standby-screen';
import './overlays/overlay-shell';
import './overlays/temperature-overlay';
import './overlays/system-mode-overlay';
import './overlays/comfort-setting-overlay';
import './overlays/system-overlay';
import './overlays/fan-overlay';
import './overlays/main-menu-overlay';
import './overlays/sensors-overlay';
import './overlays/weather-overlay';
import { EDITOR_TYPE } from './editor/ecosee-card-editor';
import './editor/ecosee-card-editor';

/** An Overlay that can mount over the Home Screen. `system` is the Main Menu's
 *  System sub-screen (the hub holding the System Mode + Comfort Setting selectors);
 *  `system-mode` / `comfort-setting` are the focused pickers it routes to; the rest
 *  are the Main Menu sub-screens — all now have overlays. */
type OverlayKind =
  | 'temperature'
  | 'system-mode'
  | 'comfort-setting'
  | 'system'
  | 'fan'
  | 'sensors'
  | 'weather'
  | 'menu';

/**
 * One Overlay's wiring, gathered in a single place: whether it has anything to show
 * (`available`, which gates opening), an optional side-effect when it opens or
 * closes (the Temperature Adjust seed, the Weather forecast fetch), and how to
 * render its content against the current `hass`. The card drives every Overlay
 * through this descriptor instead of a per-kind branch, so adding one is a single
 * table entry rather than edits in four places.
 */
interface OverlayDescriptor {
  available(hass: HomeAssistant, config: EcoseeCardConfig): boolean;
  onOpen?(hass: HomeAssistant, config: EcoseeCardConfig): void;
  render(hass: HomeAssistant, config: EcoseeCardConfig): TemplateResult | typeof nothing;
}

const VERSION = '0.2.0';

/**
 * `<ecosee-card>` — the host Lovelace element. It owns the `hass` wiring and
 * config, derives the degraded HomeView, and delegates rendering to
 * <ecosee-home-screen>. It also owns the overlay shell: opening an Overlay over
 * the Home Screen, dismissing it, and applying the service calls Overlays emit.
 */
@customElement(CARD_TYPE)
export class EcoseeCard extends LitElement implements LovelaceCard {
  @property({ attribute: false }) hass?: HomeAssistant;
  @state() private _config?: EcoseeCardConfig;
  /** The overlay navigation stack (hub-and-picker, CONTEXT.md). The top is the
   *  visible Overlay; dismissing pops one level, so a picker reached *through* the
   *  Main Menu returns to the menu, while one opened straight from the Home Screen
   *  returns to Home. Empty ⇒ the bare Home Screen. */
  @state() private _nav: OverlayKind[] = [];
  /** Open-time *seed* for the Temperature Adjust overlay (not the live edit
   *  state — the overlay owns that). Captured once on open and held by reference,
   *  not recomputed per render, so the overlay's in-progress edits survive `hass`
   *  updates rather than being reset on every state push. */
  @state() private _tempSeed?: TempAdjustModel;
  /** Which setpoint the next Temperature Adjust open should foreground, set when the
   *  open came from a specific setpoint oval (heat / cool) rather than the current-
   *  temperature number. Consumed and cleared by the temperature descriptor's
   *  `onOpen`; `undefined` lets the model keep its own default (cool in Auto). */
  private _tempSetpoint?: Setpoint;
  /** Forecast data for the Weather overlay, fetched via the `weather.get_forecasts`
   *  service when it opens (modern HA exposes the forecast through a service, not a
   *  static attribute — ADR-0001). `undefined` until the fetch resolves; the seam
   *  degrades page 2 / the intra-day periods while it is absent. Cleared on close
   *  so a re-open refetches. */
  @state() private _weatherForecasts?: WeatherForecasts;

  /** Auto-revert countdown (issue #13): collapses any open Overlay back to the
   *  Home Screen after a configurable idle interval, mirroring the device. Armed
   *  while an Overlay is open, reset on interaction within it, cancelled on manual
   *  dismiss / unmount. */
  private readonly _inactivity = new InactivityTimer(() => this._revertToHome());

  /** Whether the Card is showing the Standby Screen (issue #65) instead of the Home
   *  Screen. Top-level view choice, separate from the Overlay stack: only ever true
   *  from the bare Home Screen, cleared on any interaction with the Standby Screen. */
  @state() private _standby = false;

  /** Home → Standby idle countdown (issue #65): a SECOND {@link InactivityTimer},
   *  distinct from `_inactivity`. Armed only while sitting on the bare Home Screen
   *  with the feature enabled, reset on interaction there, stopped while an Overlay
   *  is open or already on Standby; on expiry it switches to the Standby Screen. */
  private readonly _standbyTimer = new InactivityTimer(() => this._enterStandby());

  /** Watches the dashboard slot so the fixed-canvas device can be scaled to fit
   *  (issue #35 / #36). The Home Screen and every Overlay are laid out once at a
   *  fixed base size and sized in cqw; deriving the container size from
   *  `clamp(…, 100%, …)` + `aspect-ratio` instead is what Gecko resolves
   *  late/collapsed, squashing the layout in Firefox/Zen. Measuring the width here
   *  and publishing `--ecosee-scale` (applied as one transform) sidesteps that and
   *  keeps the layout from ever reflowing per-width. */
  private _resizeObserver?: ResizeObserver;

  /** The Overlay currently on top of the stack, if any. */
  private get _overlay(): OverlayKind | undefined {
    return this._nav[this._nav.length - 1];
  }

  /** Every Overlay's wiring in one table (see {@link OverlayDescriptor}). Keyed by
   *  kind, so each Overlay's availability, open/close side-effects, and render live
   *  together — replacing the former per-kind `if`-chain plus the bespoke opener
   *  methods. The render templates carry no event handlers: editing Overlays emit
   *  the unified `ecosee-service-call` and the hubs emit their navigation events,
   *  all caught once on the <ecosee-overlay> shell in `_renderOverlay`. */
  private readonly _overlays: Record<OverlayKind, OverlayDescriptor> = {
    temperature: {
      available: (hass, config) => toTempAdjustModel(hass, config).available,
      // Seed the editing model once on open and hold it by reference, so the
      // overlay's in-progress edits survive `hass` pushes (see `_tempSeed`). When
      // the open came from a specific setpoint oval, foreground that setpoint so the
      // scrubber edits the one the user tapped (a no-op if it isn't editable).
      onOpen: (hass, config) => {
        const model = toTempAdjustModel(hass, config);
        this._tempSeed = this._tempSetpoint ? selectSetpoint(model, this._tempSetpoint) : model;
        this._tempSetpoint = undefined;
      },
      render: (_hass, config) =>
        this._tempSeed
          ? html`
              <ecosee-temperature-overlay
                .model=${this._tempSeed}
                .entityId=${config.entity}
              ></ecosee-temperature-overlay>
            `
          : nothing,
    },
    'system-mode': {
      available: (hass, config) => toSystemModeModel(hass, config).available,
      // Computed live (not seeded): the picker holds no in-progress edit, so the
      // highlight tracks the entity's reported mode as `hass` updates after a write.
      render: (hass, config) => html`
        <ecosee-system-mode-overlay
          .model=${toSystemModeModel(hass, config)}
          .entityId=${config.entity}
        ></ecosee-system-mode-overlay>
      `,
    },
    'comfort-setting': {
      available: (hass, config) => toComfortSettingModel(hass, config).available,
      render: (hass, config) => html`
        <ecosee-comfort-setting-overlay
          .model=${toComfortSettingModel(hass, config)}
          .entityId=${config.entity}
        ></ecosee-comfort-setting-overlay>
      `,
    },
    system: {
      // The System sub-screen hub backs either selector; it drops whichever lacks
      // data (graceful degradation, ADR-0001).
      available: (hass, config) =>
        toSystemModeModel(hass, config).available || toComfortSettingModel(hass, config).available,
      render: (hass, config) => html`
        <ecosee-system-overlay
          .systemMode=${toSystemModeModel(hass, config)}
          .comfort=${toComfortSettingModel(hass, config)}
          .equipment=${toHomeView(hass, config).equipment}
        ></ecosee-system-overlay>
      `,
    },
    fan: {
      available: (hass, config) => toFanModel(hass, config).available,
      render: (hass, config) => html`
        <ecosee-fan-overlay
          .model=${toFanModel(hass, config)}
          .entityId=${config.entity}
        ></ecosee-fan-overlay>
      `,
    },
    sensors: {
      available: (hass, config) => toSensorsModel(hass, config).available,
      render: (hass, config) => html`
        <ecosee-sensors-overlay .model=${toSensorsModel(hass, config)}></ecosee-sensors-overlay>
      `,
    },
    weather: {
      available: (hass, config) => toWeatherModel(hass, config).available,
      // Current conditions are live from `hass`; the forecast (page 2 / intra-day
      // periods) is fetched async via `weather.get_forecasts` and threaded in, the
      // model degrading while it is still absent (ADR-0001).
      onOpen: () => {
        void this._loadForecasts();
      },
      render: (hass, config) => html`
        <ecosee-weather-overlay
          .model=${toWeatherModel(hass, config, this._weatherForecasts)}
        ></ecosee-weather-overlay>
      `,
    },
    menu: {
      available: (hass, config) => toMainMenuModel(hass, config).available,
      render: (hass, config) => html`
        <ecosee-main-menu-overlay
          .model=${toMainMenuModel(hass, config)}
        ></ecosee-main-menu-overlay>
      `,
    },
  };

  static override styles = [
    tokens,
    css`
      :host {
        display: block;
      }
      /* Fixed-canvas device (issue #35 / #36). .root holds the whole Card laid out
         once at --ecosee-base-size; the ResizeObserver measures the slot and sets
         --ecosee-scale, and we scale .root as a single unit. transform is a purely
         visual scale — the internal layout never reflows — so Home Screen and every
         Overlay render identically in every browser at any width. .sizer collapses
         the Card's layout footprint to the on-screen (scaled) size, since a
         transform alone leaves the un-scaled box reserving space. */
      .sizer {
        width: var(--ecosee-rendered-size, var(--ecosee-base-size, 460px));
        height: var(--ecosee-rendered-size, var(--ecosee-base-size, 460px));
        max-width: 100%;
        margin: 0 auto;
        overflow: hidden;
      }
      .root {
        position: relative;
        width: var(--ecosee-base-size, 460px);
        height: var(--ecosee-base-size, 460px);
        transform: scale(var(--ecosee-scale, 1));
        transform-origin: top left;
      }
    `,
  ];

  setConfig(config: unknown): void {
    this._config = parseConfig(config);
  }

  getCardSize(): number {
    return 4;
  }

  static getStubConfig(): Partial<EcoseeCardConfig> {
    return { entity: '' };
  }

  /** The GUI config editor HA mounts when a user edits the Card from the dashboard
   *  (issue #14). Paired with `getStubConfig`, it makes the Card configurable
   *  without hand-writing YAML; the schema↔config reconciliation lives in
   *  `./editor`. */
  static getConfigElement(): HTMLElement {
    return document.createElement(EDITOR_TYPE);
  }

  override connectedCallback(): void {
    super.connectedCallback();
    // Track the slot width and pin the device's pixel size (issue #35). The
    // observer fires once on observe, covering the initial size. Guarded for SSR
    // / test environments (happy-dom) that don't implement ResizeObserver.
    if (typeof ResizeObserver !== 'undefined') {
      this._resizeObserver = new ResizeObserver(() => this._syncDeviceScale());
      this._resizeObserver.observe(this);
    }
    this._syncDeviceScale();
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    // Drop pending countdowns so neither can revert / switch (set state on) a
    // detached card.
    this._inactivity.stop();
    this._standbyTimer.stop();
    this._resizeObserver?.disconnect();
    this._resizeObserver = undefined;
  }

  protected override firstUpdated(): void {
    // clientWidth is only meaningful once the host is laid out; the observe-time
    // callback can land before that, so re-measure after the first render.
    this._syncDeviceScale();
  }

  protected override updated(changed: PropertyValues): void {
    // Drive the auto-revert countdown off navigation, not off background `hass`
    // pushes: a state update is not user interaction, so it must not extend (nor,
    // by re-arming, reset) the idle timer.
    if (changed.has('_nav') || changed.has('_config')) this._syncInactivityTimer();
    // Same principle for the Home → Standby countdown (issue #65): it is driven by
    // navigation / the standby toggle / config, never by background `hass` pushes.
    if (changed.has('_nav') || changed.has('_config') || changed.has('_standby')) {
      this._syncStandbyTimer();
    }
  }

  /** Measure the dashboard slot and set the transform scale that fits the
   *  fixed-canvas device into it (issue #35 / #36). The device is laid out once at
   *  `--ecosee-base-size`; we clamp the slot width between the min/max tokens to
   *  the on-screen size, publish it as `--ecosee-rendered-size` (the .sizer
   *  footprint) and the ratio as `--ecosee-scale` (applied to .root). An unmeasured
   *  Card (0 width, e.g. detached or in tests) leaves the CSS defaults — scale 1,
   *  base-size footprint — in place. */
  private _syncDeviceScale(): void {
    const width = this.clientWidth;
    const styles = getComputedStyle(this);
    const base = parseFloat(styles.getPropertyValue('--ecosee-base-size')) || 460;
    const min = parseFloat(styles.getPropertyValue('--ecosee-min-size')) || 220;
    const max = parseFloat(styles.getPropertyValue('--ecosee-max-size')) || 460;
    const rendered = resolveDeviceSize(width, min, max);
    const scale = rendered > 0 && base > 0 ? rendered / base : 0;
    // The .sizer collapses to the rendered size but the host stays full-slot
    // width (block), so publishing these can't feed back into the observer.
    const nextScale = scale > 0 ? String(scale) : '';
    const nextSize = rendered > 0 ? `${rendered}px` : '';
    if (
      this.style.getPropertyValue('--ecosee-scale') === nextScale &&
      this.style.getPropertyValue('--ecosee-rendered-size') === nextSize
    ) {
      return;
    }
    this._setOrClear('--ecosee-scale', nextScale);
    this._setOrClear('--ecosee-rendered-size', nextSize);
  }

  private _setOrClear(prop: string, value: string): void {
    if (value) {
      this.style.setProperty(prop, value);
    } else {
      this.style.removeProperty(prop);
    }
  }

  /** Arm the auto-revert countdown while an Overlay is open — re-arming on each
   *  navigation step, which doubles as an interaction reset — and cancel it once
   *  back on the bare Home Screen. */
  private _syncInactivityTimer(): void {
    if (this._nav.length > 0 && this._config) {
      this._inactivity.start(inactivityTimeoutMs(this._config));
    } else {
      this._inactivity.stop();
    }
  }

  /** Arm the Home → Standby countdown (issue #65) only while sitting on the bare
   *  Home Screen with the feature enabled — re-arming on each navigation step /
   *  toggle, which doubles as an interaction reset. Stopped when an Overlay opens
   *  (the countdown does not run there) or once already on Standby. If the feature
   *  is turned off while Standby is showing, drop back to the Home Screen. */
  private _syncStandbyTimer(): void {
    const ms = this._config ? standbyReturnMs(this._config) : null;
    if (ms !== null && this._nav.length === 0 && !this._standby) {
      this._standbyTimer.start(ms);
      return;
    }
    this._standbyTimer.stop();
    if (ms === null && this._standby) this._standby = false;
  }

  override render(): TemplateResult | typeof nothing {
    if (!this._config || !this.hass) return nothing;
    // Top-level view choice (issue #65): Standby replaces the whole Home Screen (and
    // is only ever reached from the bare Home Screen, so no Overlay is live here). Any
    // interaction on it returns to Home and re-arms the idle countdown.
    if (this._standby) {
      return html`
        <div class="sizer">
          <div
            class="root"
            @pointerdown=${this._onStandbyActivity}
            @click=${this._onStandbyActivity}
            @mouseover=${this._onStandbyActivity}
          >
            <ecosee-standby-screen
              .view=${toStandbyView(this.hass, this._config)}
            ></ecosee-standby-screen>
          </div>
        </div>
      `;
    }
    const view = toHomeView(this.hass, this._config);
    return html`
      <div class="sizer">
        <div class="root">
          <ecosee-home-screen
            .view=${view}
            @ecosee-action=${this._onAction}
            @pointerdown=${this._onHomeActivity}
            @mouseover=${this._onHomeActivity}
          ></ecosee-home-screen>
          ${this._renderOverlay()}
        </div>
      </div>
    `;
  }

  private _renderOverlay(): TemplateResult | typeof nothing {
    if (!this._overlay || !this._config || !this.hass) return nothing;
    const content = this._overlays[this._overlay].render(this.hass, this._config);
    if (content === nothing) return nothing;
    // One listening point for every Overlay. Editing Overlays emit the unified
    // `ecosee-service-call` and the hubs emit their navigation events — all bubbling
    // + composed, so they reach the shell here. The pointer/key listeners postpone
    // auto-revert (issue #13) on any interaction with the slotted content (even
    // inside a child Overlay's shadow DOM). `pointermove` matters too: the
    // Temperature scrubber captures the pointer on `pointerdown` and then scrubs via
    // `pointermove` alone, so a slow drag would otherwise let the timer expire.
    return html`
      <ecosee-overlay
        @ecosee-overlay-dismiss=${this._closeOverlay}
        @ecosee-service-call=${this._onServiceCall}
        @ecosee-menu-select=${this._onMenuSelect}
        @ecosee-system-select=${this._onSystemSelect}
        @pointerdown=${this._onOverlayActivity}
        @pointermove=${this._onOverlayActivity}
        @keydown=${this._onOverlayActivity}
        >${content}</ecosee-overlay
      >
    `;
  }

  private _onAction = (event: CustomEvent<HomeActionDetail>): void => {
    switch (event.detail.action) {
      case 'temperature':
        // A tap on a setpoint oval carries which setpoint to foreground; a tap on
        // the current-temperature number carries none (the model keeps its default).
        this._tempSetpoint = event.detail.setpoint;
        this._open('temperature', 'home');
        break;
      case 'system-mode':
        this._open('system-mode', 'home');
        break;
      case 'fan':
        // Top-row shortcut into the Fan sub-screen (issue #45); opened from Home, so
        // dismissing returns Home. The availability gate in `_open` matches the same
        // predicate that gated the affordance, so a shown shortcut always opens.
        this._open('fan', 'home');
        break;
      case 'menu':
        this._open('menu', 'home');
        break;
      case 'weather':
        this._open('weather', 'home');
        break;
    }
  };

  /** Open an Overlay: gate on its availability, run its open side-effect, then place
   *  it on the nav stack. `'home'` replaces the bare Home Screen (so dismissing
   *  returns to Home); `'push'` stacks it on the current Overlay (so a sub-screen
   *  reached through the Main Menu returns to the menu). Hub-and-picker, CONTEXT.md. */
  private _open(kind: OverlayKind, mode: 'home' | 'push'): void {
    if (!this.hass || !this._config) return;
    const overlay = this._overlays[kind];
    if (!overlay.available(this.hass, this._config)) return; // nothing to show ⇒ no Overlay
    overlay.onOpen?.(this.hass, this._config);
    this._nav = mode === 'home' ? [kind] : [...this._nav, kind];
  }

  /** Fetch the Weather overlay's forecast via `weather.get_forecasts` (daily for
   *  page 2, hourly for the intra-day periods) and stash it for the seam. Each
   *  type is fetched independently so an entity that supports only some of them
   *  still gets what it can; failures degrade to an empty forecast. */
  private async _loadForecasts(): Promise<void> {
    const weatherEntity = this._config?.weather_entity;
    if (!this.hass || !weatherEntity) return;
    const [daily, hourly] = await Promise.all([
      this._getForecast(weatherEntity, 'daily'),
      this._getForecast(weatherEntity, 'hourly'),
    ]);
    // Guard a slow fetch resolving after the overlay was dismissed (or reopened).
    if (this._nav.includes('weather')) this._weatherForecasts = { daily, hourly };
  }

  private async _getForecast(entityId: string, type: ForecastType): Promise<ForecastEntry[]> {
    if (!this.hass) return [];
    try {
      const { domain, service, data } = getForecastsCall(entityId, type);
      const response = await this.hass.callService(domain, service, data, undefined, false, true);
      return parseForecastResponse(response, entityId);
    } catch {
      // The entity doesn't support this forecast type (or the call failed) — degrade.
      return [];
    }
  }

  /** Route a Main Menu selection to its sub-screen, pushed onto the stack so the
   *  sub-screen's dismissal returns to the menu (hub-and-picker). The targets double
   *  as overlay kinds, so opening each one runs its descriptor (e.g. the System hub's
   *  availability gate, or Weather's forecast fetch). */
  private _onMenuSelect = (event: CustomEvent<{ target: MainMenuTarget }>): void => {
    this._open(event.detail.target, 'push');
  };

  /** Route a System sub-screen selector to its focused picker, pushed onto the stack
   *  so the picker's dismissal returns to the System sub-screen (hub-and-picker). The
   *  selector targets double as overlay kinds. */
  private _onSystemSelect = (event: CustomEvent<{ target: SystemSelectTarget }>): void => {
    this._open(event.detail.target, 'push');
  };

  /** Dismiss (✕ / outside-tap): pop one level and drop per-open state so a later
   *  open starts fresh. From a top-level Overlay that is Home; from a menu-reached
   *  picker that is the menu. */
  private _closeOverlay = (): void => {
    this._nav = this._nav.slice(0, -1);
    // Drop per-open state so a later open starts fresh. The seeds are per-Overlay
    // and never co-present, so clearing all is equivalent to clearing just the one
    // dismissed — and is the same cleanup auto-revert reuses.
    this._clearOverlaySeeds();
  };

  /** Auto-revert (issue #13): collapse any open Overlay all the way back to the
   *  bare Home Screen and drop per-open state, exactly as a manual dismiss leaves
   *  it. Driven by the inactivity timer on expiry. */
  private _revertToHome(): void {
    if (this._nav.length === 0) return;
    this._nav = [];
    this._clearOverlaySeeds();
  }

  /** Clear per-open Overlay state so a later open starts fresh: the Temperature
   *  Adjust seed and the Weather forecast. */
  private _clearOverlaySeeds(): void {
    this._tempSeed = undefined;
    this._tempSetpoint = undefined;
    this._weatherForecasts = undefined;
  }

  /** Any interaction within an open Overlay (tap, drag start, key) postpones
   *  auto-revert — the device keeps a screen up while you are using it. */
  private _onOverlayActivity = (): void => {
    this._inactivity.reset();
  };

  /** Any interaction on the bare Home Screen (tap / click / mouseover) restarts the
   *  Home → Standby countdown (issue #65). A no-op while an Overlay is open, since
   *  the countdown is stopped then and {@link InactivityTimer.reset} does nothing
   *  while disabled. */
  private _onHomeActivity = (): void => {
    this._standbyTimer.reset();
  };

  /** Any interaction on the Standby Screen (tap / click / mouseover) returns to the
   *  Home Screen (issue #65); clearing `_standby` re-arms a fresh 60s countdown via
   *  {@link _syncStandbyTimer}. */
  private _onStandbyActivity = (): void => {
    this._standby = false;
  };

  /** The Home → Standby countdown expired: switch to the Standby Screen (issue #65).
   *  Guarded so a countdown that somehow outlived a nav change can't switch while an
   *  Overlay is open. */
  private _enterStandby(): void {
    if (this._nav.length > 0) return;
    this._standby = true;
  }

  /** Apply a service call emitted by an Overlay (temperature setpoint, System
   *  Mode, …). Every Overlay carries its change as a pure `ServiceCall`, so the
   *  host card just forwards it to Home Assistant. */
  private _onServiceCall = (event: CustomEvent<{ call: ServiceCall }>): void => {
    if (!this.hass) return;
    const { domain, service, data } = event.detail.call;
    void this.hass.callService(domain, service, data);
  };
}

declare global {
  interface HTMLElementTagNameMap {
    [CARD_TYPE]: EcoseeCard;
  }
  interface Window {
    customCards?: Array<{
      type: string;
      name: string;
      description: string;
      preview?: boolean;
    }>;
  }
}

// Register with Home Assistant's card picker.
window.customCards = window.customCards ?? [];
window.customCards.push({
  type: CARD_TYPE,
  name: 'ecosee',
  description: 'An ecobee Smart Thermostat Premium skin over any climate entity.',
  preview: true,
});

console.info(
  `%c ecosee %c v${VERSION} `,
  'color:#0a0d10;background:#62cfe9;border-radius:3px 0 0 3px;padding:1px 4px',
  'color:#62cfe9;background:#0a0d10;border-radius:0 3px 3px 0;padding:1px 4px',
);
