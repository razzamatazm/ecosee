import { LitElement, html, nothing, css, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { CARD_TYPE } from '../config';
import type { HomeAssistant } from '../types/hass';
import { editorSchema, toEditorData, normalizeEditorConfig, type EditorField } from './editor';

/** The editor element's tag — `<ecosee-card>` + `-editor`, the HA naming
 *  convention `getConfigElement` resolves to. */
export const EDITOR_TYPE = `${CARD_TYPE}-editor`;

/**
 * `<ecosee-card-editor>` — the GUI config editor Home Assistant mounts when a user
 * edits the Card from the dashboard (returned by `EcoseeCard.getConfigElement`,
 * issue #14). It is a thin presentational shell over the HA frontend's `<ha-form>`
 * (provided at runtime, not bundled — ADR-0002): all schema↔config reconciliation
 * lives in the `./editor` seam, so this element only wires `hass`/data in and
 * `config-changed` out.
 *
 * `<ha-form>` renders each field's selector (the domain-scoped entity pickers, the
 * number box, the comfort-icon select). On every change it emits `value-changed`
 * with the full form value; the seam normalizes that into a config `parseConfig`
 * accepts — dropping cleared optional keys (ADR-0001) — which we forward as the
 * standard `config-changed` event HA listens for.
 */
@customElement(EDITOR_TYPE)
export class EcoseeCardEditor extends LitElement {
  @property({ attribute: false }) hass?: HomeAssistant;
  /** The raw config HA hands us (may be partial mid-edit, e.g. the empty-entity
   *  stub); kept loose — validation is `parseConfig`'s job when the Card applies it. */
  @state() private _config?: Record<string, unknown>;

  private readonly _schema = editorSchema();

  static override styles = css`
    :host {
      display: block;
    }
    .intro {
      margin: 0 0 16px;
      color: var(--secondary-text-color);
      font-size: 0.9em;
      line-height: 1.4;
    }
  `;

  setConfig(config: Record<string, unknown>): void {
    this._config = config;
  }

  override render(): TemplateResult | typeof nothing {
    if (!this._config) return nothing;
    return html`
      <p class="intro">
        Only the Thermostat is required. Every other field is optional — each optional element
        appears on the Card only once you add its entity, so leaving a field blank simply hides that
        piece.
      </p>
      <ha-form
        .hass=${this.hass}
        .data=${toEditorData(this._config)}
        .schema=${this._schema}
        .computeLabel=${this._computeLabel}
        .computeHelper=${this._computeHelper}
        @value-changed=${this._valueChanged}
      ></ha-form>
    `;
  }

  // `ha-form` hands each schema entry back to these callbacks; ours carry the
  // device-vocabulary label/helper (CONTEXT.md) alongside the selector.
  private readonly _computeLabel = (field: EditorField): string => field.label;
  private readonly _computeHelper = (field: EditorField): string | undefined => field.helper;

  private readonly _valueChanged = (
    event: CustomEvent<{ value: Record<string, unknown> }>,
  ): void => {
    const next = normalizeEditorConfig(event.detail.value, this._config ?? {});
    this._config = next;
    this.dispatchEvent(
      new CustomEvent('config-changed', {
        detail: { config: next },
        bubbles: true,
        composed: true,
      }),
    );
  };
}

declare global {
  interface HTMLElementTagNameMap {
    'ecosee-card-editor': EcoseeCardEditor;
  }
}
