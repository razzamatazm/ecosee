import { LitElement, html, css, type TemplateResult } from 'lit';
import { customElement } from 'lit/decorators.js';
import { icons } from '../icons';
import { renderShape, shapeStyles } from '../styles/shape';
import { emitOverlayDismiss } from './overlay-dismiss';

/**
 * `<ecosee-overlay>` — the overlay shell. A content-agnostic squircle that mounts
 * over the Home Screen (same tokens, so it covers the Home Screen exactly),
 * carries the ✕ close affordance, and dismisses on ✕ or an outside (backdrop)
 * tap. Active Overlay content is slotted in. This is the infrastructure every
 * later Overlay (System Mode, Fan, Sensors, Weather) reuses — the Temperature
 * Adjust overlay is just its first occupant.
 *
 * Outside-tap contract: the slotted content fills the whole shell, so a dedicated
 * `.backdrop` layer sits *behind* it and slotted content is `pointer-events: none`
 * by default. Empty areas of the content therefore fall through to the backdrop
 * (→ dismiss), while each Overlay opts its interactive controls back in with
 * `pointer-events: auto`. The ✕ sits above both.
 *
 * Emits `ecosee-overlay-dismiss` (bubbling, composed) when the user asks to leave.
 */
@customElement('ecosee-overlay')
export class EcoseeOverlay extends LitElement {
  static override styles = [
    // The shared superellipse surface (issue #76): every Overlay rides this one shell,
    // so drawing the shared `.shape` here gives the Temperature Adjust, Main Menu and
    // every other Overlay the same silhouette + opaque canvas as the Home Screen and
    // Standby Screen — the Card's outer shape no longer changes between screens.
    shapeStyles,
    css`
    :host {
      position: absolute;
      inset: 0;
      display: flex;
      justify-content: center;
      align-items: flex-start;
      z-index: 1;
    }

    /* The same fixed layout canvas as <ecosee-home-screen>'s .screen, so the
       overlay lands squarely on top of it; the whole Card (Home Screen + Overlay)
       is scaled as one unit by <ecosee-card> (issue #35 / #36). The shell's own
       chrome (the ✕) is sized in the fixed unit calc(N * --ecosee-u), not cqw —
       the shell is not a query container, and slotted overlay bodies each carry
       their own (that context can't cross the shadow boundary anyway). The opaque
       near-black canvas and the outer silhouette come from the shared .shape SVG
       (issue #76) — no background or border-radius here, so the superellipse (not a
       rounded rect) fully masks the Home Screen, with overflow: hidden clipping the
       corners outside the curve. */
    .shell {
      position: relative;
      box-sizing: border-box;
      width: var(--ecosee-base-size, 460px);
      height: var(--ecosee-base-size, 460px);
      color: var(--ecosee-fg, #d4eff9);
      font-family: var(--ecosee-font, system-ui, sans-serif);
      overflow: hidden;
      user-select: none;
    }

    /* Behind the content; catches taps on any non-control area to dismiss. */
    .backdrop {
      position: absolute;
      inset: 0;
      z-index: 0;
      cursor: pointer;
    }

    /* Sits above the backdrop but stays pointer-transparent so empty taps fall
       through to .backdrop (→ dismiss); each Overlay's controls opt back in with
       pointer-events: auto. Without this the wrapper itself would swallow
       empty-area taps and outside-tap dismissal would never fire (issue #40). */
    .content {
      position: absolute;
      inset: 0;
      z-index: 1;
      pointer-events: none;
    }
    ::slotted(*) {
      display: block;
      width: 100%;
      height: 100%;
      /* Non-control regions fall through to .backdrop; Overlays re-enable their
         own controls with pointer-events: auto. */
      pointer-events: none;
    }

    .close {
      appearance: none;
      background: none;
      border: none;
      position: absolute;
      top: calc(6 * var(--ecosee-u, 4.6px));
      right: calc(6 * var(--ecosee-u, 4.6px));
      width: calc(9 * var(--ecosee-u, 4.6px));
      height: calc(9 * var(--ecosee-u, 4.6px));
      padding: calc(1.4 * var(--ecosee-u, 4.6px));
      color: var(--ecosee-muted, #6f96a3);
      cursor: pointer;
      z-index: 2;
    }
  `,
  ];

  private _dismiss = (): void => {
    emitOverlayDismiss(this);
  };

  override render(): TemplateResult {
    return html`
      <div class="shell">
        ${renderShape()}
        <div class="backdrop" @click=${this._dismiss}></div>
        <button class="close" aria-label="Close" @click=${this._dismiss}>${icons.close}</button>
        <div class="content"><slot></slot></div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'ecosee-overlay': EcoseeOverlay;
  }
}
