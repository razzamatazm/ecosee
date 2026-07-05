import { LitElement, html, css, nothing, type TemplateResult } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import type { EquipmentStatus } from '../climate/home-view';
import { icons } from '../icons';
import type { TabBarModel, TabIcon, TabTarget } from '../menu/tab-bar';
import { renderShape, shapeStyles } from '../styles/shape';
import { emitOverlayDismiss } from './overlay-dismiss';

/** Section-tab glyphs. The gear (Main Menu affordance) doubles as the System
 *  (settings) tab, keeping one cog glyph for both. */
const TAB_ICONS: Record<TabIcon, typeof icons.menu> = {
  gear: icons.menu,
  sensor: icons.sensor,
  fan: icons.fan,
};

/**
 * `<ecosee-overlay>` — the overlay shell. A content-agnostic squircle that mounts
 * over the Home Screen (same tokens, so it covers the Home Screen exactly),
 * carries the ✕ close affordance, and dismisses on ✕ or an outside (backdrop)
 * tap. Active Overlay content is slotted in. This is the infrastructure every
 * later Overlay (System Mode, Fan, Sensors, Weather) reuses — the Temperature
 * Adjust overlay is just its first occupant.
 *
 * Because the shell's opaque canvas covers the Home Screen while an Overlay is open,
 * it also carries the equipment edge glow (blue cooling / amber heating, keyed to the
 * `equipment` property) so the "system is running" cue persists on every Overlay,
 * not just Home / Standby (ADR-0011).
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
      /* Bottom space a section body must leave clear so its content never hides
         behind the tab bar. The shell owns this number (it owns the bar's geometry:
         bottom 7u + height 8u ≈ 15u, plus margin); section overlays read it via
         var(--ecosee-tabbar-inset) rather than re-deriving it. 0 when no bar. */
      --ecosee-tabbar-inset: 0px;
    }
    .shell.tabbed {
      --ecosee-tabbar-inset: calc(17 * var(--ecosee-u, 4.6px));
    }

    /* Equipment-status edge glow, keyed to hvac_action — the SAME crisp squircle-edge
       line the Home Screen draws (ADR-0011 supersedes ADR-0009's "Overlay shell has
       none" clause): blue cooling / amber heating, nothing idle. The glow markup and
       the reveal/color chain mirror the Home Screen (home-screen.ts) so the surfaces
       never drift; unlike the Standby Screen the overlay is a bright active surface, so
       it uses the Home Screen's full-strength glow (no standby dimming). Without this
       the shell's opaque canvas covers the Home Screen's glow the moment any overlay
       opens, so the "system is running" cue vanished while adjusting the temperature. */
    .shape .glow {
      display: none;
    }
    .shape .glow path {
      fill: none;
      stroke: currentColor;
    }
    .shell.cooling .glow {
      display: block;
      color: var(--ecosee-cool, #49b6ea);
    }
    .shell.heating .glow {
      display: block;
      color: var(--ecosee-heat, #f3a13c);
    }

    /* The glow conveys equipment state by color alone, so announce it to assistive
       tech (WCAG), matching the Home Screen and Standby Screen. */
    .sr-only {
      position: absolute;
      width: 1px;
      height: 1px;
      overflow: hidden;
      clip: rect(0 0 0 0);
      white-space: nowrap;
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

    /* Inset from the top-LEFT corner, matching the device (its ✕ / back control
       sits top-left on every sub-screen). The superellipse curves inward there, so
       a tight corner offset (was 6u) put the ✕ right on the bevel and cramped
       against the edge — uncomfortable to reach on a touch dashboard. 9u pulls it
       into the flat of the surface with a comfortable margin while staying clear of
       centered overlay content below. */
    .close {
      appearance: none;
      background: none;
      border: none;
      position: absolute;
      top: calc(9 * var(--ecosee-u, 4.6px));
      left: calc(9 * var(--ecosee-u, 4.6px));
      width: calc(9 * var(--ecosee-u, 4.6px));
      height: calc(9 * var(--ecosee-u, 4.6px));
      padding: calc(1.4 * var(--ecosee-u, 4.6px));
      color: var(--ecosee-muted, #6f96a3);
      cursor: pointer;
      z-index: 2;
    }

    /* The device's persistent bottom navigation, shown across the Main Menu section
       screens (System / Sensors / Fan). Shell chrome like the ✕: absolutely placed,
       sized in the fixed unit (the shell is not a query container), above the content.
       The full-width nav stays pointer-transparent so its empty flanks fall through to
       the dismiss backdrop (outside-tap-to-dismiss); only the buttons opt back in. */
    .tabbar {
      position: absolute;
      left: 0;
      right: 0;
      bottom: calc(7 * var(--ecosee-u, 4.6px));
      display: flex;
      align-items: center;
      justify-content: center;
      gap: calc(8 * var(--ecosee-u, 4.6px));
      z-index: 2;
      pointer-events: none;
    }
    .tab {
      appearance: none;
      background: none;
      border: none;
      margin: 0;
      padding: 0;
      width: calc(8 * var(--ecosee-u, 4.6px));
      height: calc(8 * var(--ecosee-u, 4.6px));
      display: inline-flex;
      align-items: center;
      justify-content: center;
      pointer-events: auto;
      /* Inactive tabs are muted; the active section and the temp badge are accent —
         the device's "you are here" cue. */
      color: var(--ecosee-muted, #6f96a3);
      cursor: pointer;
    }
    .tab.active {
      color: var(--ecosee-accent, #62cfe9);
    }
    /* Left badge: the current temperature in a cyan ring, tapping it returns to the
       thermostat (Home). Falls back to the wall-display glyph when temp is unknown. */
    .tab.temp {
      border: calc(0.5 * var(--ecosee-u, 4.6px)) solid var(--ecosee-accent, #62cfe9);
      border-radius: 50%;
      color: var(--ecosee-accent, #62cfe9);
      font-family: inherit;
      font-weight: 600;
      font-size: calc(3.3 * var(--ecosee-u, 4.6px));
    }
    .tab.temp.glyph {
      padding: calc(1.4 * var(--ecosee-u, 4.6px));
    }
    .tab svg {
      width: 100%;
      height: 100%;
    }
  `,
  ];

  /** The bottom navigation model, supplied by the card for the Main Menu section
   *  screens and absent (⇒ no bar) elsewhere (Temperature, the pickers, Weather). */
  @property({ attribute: false }) tabs?: TabBarModel;

  /** Equipment Status (`'cooling'` / `'heating'` / `'idle'`), or `null` when not
   *  expressible. Supplied by the card straight from the Home Screen's `hvac_action`
   *  derivation so the overlay agrees with Home; it reveals the edge glow (blue
   *  cooling / amber heating, nothing idle) so the "system is running" cue persists
   *  while any overlay is open (ADR-0011). */
  @property({ attribute: false }) equipment?: EquipmentStatus | null;

  private _dismiss = (): void => {
    emitOverlayDismiss(this);
  };

  /** Announce a tab tap; the card routes it (a section opens that screen, the temp
   *  badge returns Home). Bubbling + composed so it clears the shadow boundary and
   *  reaches the card's single overlay listener, like the other overlay events. */
  private _selectTab(target: TabTarget): void {
    this.dispatchEvent(
      new CustomEvent('ecosee-tab-select', { detail: { target }, bubbles: true, composed: true }),
    );
  }

  override render(): TemplateResult {
    const classes = ['shell', this.tabs?.available ? 'tabbed' : '', this.equipment ?? '']
      .filter(Boolean)
      .join(' ');
    return html`
      <div class=${classes}>
        ${renderShape({ glow: true })}
        ${
          this.equipment
            ? html`<span class="sr-only">${this._equipLabel(this.equipment)}</span>`
            : nothing
        }
        <div class="backdrop" @click=${this._dismiss}></div>
        <button class="close" aria-label="Close" @click=${this._dismiss}>${icons.close}</button>
        <div class="content"><slot></slot></div>
        ${this._renderTabBar()}
      </div>
    `;
  }

  /** Screen-reader label for the equipment glow, mirroring the Home Screen and Standby
   *  Screen so every surface announces the same words for the same `hvac_action`. */
  private _equipLabel(equipment: EquipmentStatus): string {
    if (equipment === 'cooling') return 'Cooling';
    if (equipment === 'heating') return 'Heating';
    return 'Idle';
  }

  private _renderTabBar(): TemplateResult | typeof nothing {
    const tabs = this.tabs;
    if (!tabs?.available) return nothing;
    return html`
      <nav class="tabbar" aria-label="Menu sections">
        <button
          class="tab temp ${tabs.temp === null ? 'glyph' : ''}"
          aria-label="Thermostat"
          @click=${() => this._selectTab('thermostat')}
        >
          ${tabs.temp === null ? icons.thermostat : tabs.temp}
        </button>
        ${tabs.items.map(
          (item) => html`
            <button
              class="tab ${item.active ? 'active' : ''}"
              aria-label=${item.label}
              aria-current=${item.active ? 'page' : 'false'}
              @click=${() => this._selectTab(item.target)}
            >
              ${TAB_ICONS[item.icon]}
            </button>
          `,
        )}
      </nav>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'ecosee-overlay': EcoseeOverlay;
  }
}
