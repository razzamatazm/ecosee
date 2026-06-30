import { LitElement, html, css, nothing, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { CARD_TYPE, parseConfig, type EcoseeCardConfig } from './config';
import { toHomeView } from './climate/home-view';
import { toTempAdjustModel, type TempAdjustModel } from './climate/temperature-adjust';
import { toSystemModeModel } from './climate/system-mode';
import type { ServiceCall } from './climate/service-call';
import { tokens } from './styles/tokens';
import type { HomeAssistant, LovelaceCard } from './types/hass';
import type { HomeAction } from './screens/home-screen';
import './screens/home-screen';
import './overlays/overlay-shell';
import './overlays/temperature-overlay';
import './overlays/system-mode-overlay';

/** The Overlay currently mounted over the Home Screen, if any. More kinds (Fan,
 *  Sensors, Weather) join this union as they land. */
type OverlayKind = 'temperature' | 'system-mode';

const VERSION = '0.1.0';

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
  @state() private _overlay?: OverlayKind;
  /** Open-time *seed* for the Temperature Adjust overlay (not the live edit
   *  state — the overlay owns that). Captured once on open and held by reference,
   *  not recomputed per render, so the overlay's in-progress edits survive `hass`
   *  updates rather than being reset on every state push. */
  @state() private _tempSeed?: TempAdjustModel;

  static override styles = [
    tokens,
    css`
      :host {
        display: block;
      }
      .root {
        position: relative;
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

  override render(): TemplateResult | typeof nothing {
    if (!this._config || !this.hass) return nothing;
    const view = toHomeView(this.hass, this._config);
    return html`
      <div class="root">
        <ecosee-home-screen .view=${view} @ecosee-action=${this._onAction}></ecosee-home-screen>
        ${this._renderOverlay()}
      </div>
    `;
  }

  private _renderOverlay(): TemplateResult | typeof nothing {
    if (!this._overlay || !this._config) return nothing;
    const content = this._renderOverlayContent(this._config);
    if (content === nothing) return nothing;
    return html`
      <ecosee-overlay @ecosee-overlay-dismiss=${this._closeOverlay}>${content}</ecosee-overlay>
    `;
  }

  private _renderOverlayContent(config: EcoseeCardConfig): TemplateResult | typeof nothing {
    if (this._overlay === 'temperature') {
      if (!this._tempSeed) return nothing;
      return html`
        <ecosee-temperature-overlay
          .model=${this._tempSeed}
          .entityId=${config.entity}
          @ecosee-set-temperature=${this._onServiceCall}
        ></ecosee-temperature-overlay>
      `;
    }
    if (this._overlay === 'system-mode') {
      if (!this.hass) return nothing;
      // Computed live (not seeded like the temperature model): the picker holds no
      // in-progress edit, so the selected row should track the entity's reported
      // mode as `hass` updates after a write.
      return html`
        <ecosee-system-mode-overlay
          .model=${toSystemModeModel(this.hass, config)}
          .entityId=${config.entity}
          @ecosee-set-system-mode=${this._onServiceCall}
        ></ecosee-system-mode-overlay>
      `;
    }
    return nothing;
  }

  private _onAction = (event: CustomEvent<{ action: HomeAction }>): void => {
    switch (event.detail.action) {
      case 'resume':
        this._resumeSchedule();
        break;
      case 'temperature':
        this._openTemperature();
        break;
      case 'system-mode':
        this._openSystemMode();
        break;
      case 'menu':
      case 'weather':
        // The remaining Overlays land in later milestones.
        console.debug(`ecosee: "${event.detail.action}" overlay not yet implemented`);
        break;
    }
  };

  private _openTemperature(): void {
    if (!this.hass || !this._config) return;
    const model = toTempAdjustModel(this.hass, this._config);
    if (!model.available) return; // nothing editable ⇒ no overlay
    this._tempSeed = model;
    this._overlay = 'temperature';
  }

  private _openSystemMode(): void {
    if (!this.hass || !this._config) return;
    if (!toSystemModeModel(this.hass, this._config).available) return; // no modes ⇒ no overlay
    this._overlay = 'system-mode';
  }

  private _closeOverlay = (): void => {
    this._overlay = undefined;
    this._tempSeed = undefined;
  };

  /** Apply a service call emitted by an Overlay (temperature setpoint, System
   *  Mode, …). Every Overlay carries its change as a pure `ServiceCall`, so the
   *  host card just forwards it to Home Assistant. */
  private _onServiceCall = (event: CustomEvent<{ call: ServiceCall }>): void => {
    if (!this.hass) return;
    const { domain, service, data } = event.detail.call;
    void this.hass.callService(domain, service, data);
  };

  private _resumeSchedule(): void {
    if (!this.hass || !this._config) return;
    void this.hass.callService('ecobee', 'resume_program', {
      entity_id: this._config.entity,
      resume_all: true,
    });
  }
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
