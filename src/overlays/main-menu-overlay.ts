import { LitElement, html, css, nothing, type TemplateResult } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import type { MainMenuModel, MainMenuTarget } from '../menu/main-menu';
import { icons } from '../icons';

/**
 * `<ecosee-main-menu-overlay>` — the Main Menu hub's content (slotted into
 * <ecosee-overlay>). Laid out as the device is (see docs/reference/menu-system.jpeg):
 * the "Main Menu" title near the top, then the reachable sub-screens as a single
 * cyan-outlined vertical list with hairline dividers, each row a label with a
 * forward chevron. This is hub-and-picker navigation (CONTEXT.md Main Menu): the
 * hub only *routes* — selecting a row emits `ecosee-menu-select` and the host card
 * opens that sub-screen's overlay; the hub itself owns no edit state.
 *
 * Purely presentational: it renders the already-degraded MainMenuModel (entries
 * whose backing data is absent are dropped upstream by `toMainMenuModel`) and
 * leaves dismissal to the shell (✕ / outside-tap).
 */
@customElement('ecosee-main-menu-overlay')
export class EcoseeMainMenuOverlay extends LitElement {
  /** The reachable sub-screens, derived by the host card from `hass` + config. */
  @property({ attribute: false }) model?: MainMenuModel;

  static override styles = css`
    :host {
      display: block;
      width: 100%;
      height: 100%;
    }

    /* Title near the top with the list beneath (visual-spec.md / menu-system.jpeg),
       not a vertically-centered cluster. Sized container so rows scale with cqw. */
    .menu {
      container-type: size;
      box-sizing: border-box;
      width: 100%;
      height: 100%;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: flex-start;
      gap: 7cqw;
      padding: 15cqw 10cqw 10cqw;
    }

    .title {
      margin: 0;
      font-size: 9cqw;
      font-weight: 600;
      letter-spacing: 0.02em;
      color: var(--ecosee-accent, #62cfe9);
    }

    /* The cyan-outlined list. overflow:hidden clips row backgrounds to the rounded
       corners. The list opts back into pointer events (the shell makes slotted
       content transparent so empty areas dismiss). */
    .list {
      width: 72cqw;
      border: 0.6cqw solid var(--ecosee-accent, #62cfe9);
      border-radius: 6cqw;
      overflow: hidden;
      pointer-events: auto;
    }

    .item {
      appearance: none;
      background: none;
      margin: 0;
      box-sizing: border-box;
      width: 100%;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 3cqw;
      padding: 5.5cqw 5cqw;
      font: inherit;
      font-size: 7.5cqw;
      font-weight: 500;
      color: var(--ecosee-accent, #62cfe9);
      text-align: left;
      cursor: pointer;
      /* Hairline divider between rows; the first row has the list's own border.
         Derived from the accent token (at low alpha) so the Skin stays themeable. */
      border: none;
      border-top: 0.4cqw solid color-mix(in srgb, var(--ecosee-accent, #62cfe9) 30%, transparent);
    }
    .item:first-child {
      border-top: none;
    }
    .item:focus-visible {
      outline: 0.5cqw solid var(--ecosee-accent, #62cfe9);
      outline-offset: -1.5cqw;
    }

    /* Cyan like the row label and the device's selectors (menu-system.jpeg) — the
       accent is the Skin's interactive-list color (cf. system-mode-overlay). */
    .chevron {
      width: 6cqw;
      height: 6cqw;
      flex: none;
      color: var(--ecosee-accent, #62cfe9);
    }
  `;

  private _select(target: MainMenuTarget): void {
    this.dispatchEvent(
      new CustomEvent('ecosee-menu-select', {
        detail: { target },
        bubbles: true,
        composed: true,
      }),
    );
  }

  override render(): TemplateResult | typeof nothing {
    const model = this.model;
    if (!model || !model.available) return nothing;
    return html`
      <div class="menu">
        <h2 class="title">Main Menu</h2>
        <div class="list" role="menu" aria-label="Main Menu">
          ${model.entries.map(
            (entry) => html`
              <button class="item" role="menuitem" @click=${() => this._select(entry.target)}>
                <span class="label">${entry.label}</span>
                <span class="chevron">${icons.chevron}</span>
              </button>
            `,
          )}
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'ecosee-main-menu-overlay': EcoseeMainMenuOverlay;
  }
}
