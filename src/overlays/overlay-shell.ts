import { LitElement, html, css, type TemplateResult } from 'lit';
import { customElement } from 'lit/decorators.js';
import { icons } from '../icons';
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
  static override styles = css`
    :host {
      position: absolute;
      inset: 0;
      display: flex;
      justify-content: center;
      align-items: flex-start;
      z-index: 1;
    }

    /* Mirrors <ecosee-home-screen>'s squircle sizing so the overlay lands
       squarely on top of it. An inline-size query container (not container-type:
       size), so cqw resolves off the definite width and Gecko doesn't collapse
       the aspect-ratio height the way it did under size containment (issue #35).
       Opaque background fully masks the Home Screen. */
    .shell {
      container-type: inline-size;
      position: relative;
      box-sizing: border-box;
      width: clamp(var(--ecosee-min-size, 220px), 100%, var(--ecosee-max-size, 460px));
      aspect-ratio: var(--ecosee-aspect, 1 / 1);
      background: var(--ecosee-bg, #0a0d10);
      border-radius: var(--ecosee-radius, 15%);
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
      top: 6cqw;
      right: 6cqw;
      width: 9cqw;
      height: 9cqw;
      padding: 1.4cqw;
      color: var(--ecosee-muted, #6f96a3);
      cursor: pointer;
      z-index: 2;
    }
  `;

  private _dismiss = (): void => {
    emitOverlayDismiss(this);
  };

  override render(): TemplateResult {
    return html`
      <div class="shell">
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
