// @vitest-environment happy-dom
import { describe, it, expect, afterEach } from 'vitest';
import '../src/overlays/overlay-shell';
import { EcoseeOverlay } from '../src/overlays/overlay-shell';

// The shell owns dismissal (✕ / outside-tap). These assert the two dismiss triggers
// fire the shared event, plus the CSS contract that makes an *empty-area* tap reach
// the backdrop (issue #40): the .content wrapper must be pointer-transparent so a tap
// on non-control space falls through to .backdrop instead of being swallowed.

async function mountShell(): Promise<EcoseeOverlay> {
  const shell = document.createElement('ecosee-overlay') as EcoseeOverlay;
  shell.innerHTML = '<div>content</div>';
  document.body.appendChild(shell);
  await shell.updateComplete;
  return shell;
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('overlay shell — dismissal', () => {
  it('emits ecosee-overlay-dismiss when the backdrop (outside area) is clicked', async () => {
    const shell = await mountShell();
    let dismisses = 0;
    shell.addEventListener('ecosee-overlay-dismiss', () => (dismisses += 1));

    (shell.shadowRoot!.querySelector('.backdrop') as HTMLElement).click();
    expect(dismisses).toBe(1);
  });

  it('emits ecosee-overlay-dismiss when the ✕ is clicked', async () => {
    const shell = await mountShell();
    let dismisses = 0;
    shell.addEventListener('ecosee-overlay-dismiss', () => (dismisses += 1));

    (shell.shadowRoot!.querySelector('.close') as HTMLElement).click();
    expect(dismisses).toBe(1);
  });
});

describe('overlay shell — outside-tap contract (issue #40)', () => {
  it('keeps the .content wrapper pointer-transparent so empty taps reach the backdrop', () => {
    // `styles` is now an array (the shared shape module + the shell's own block),
    // so join every CSSResult's text before matching (issue #76).
    const css = [EcoseeOverlay.styles].flat().map((s) => s.cssText).join('\n');
    // The .content rule must set pointer-events: none; otherwise the wrapper (which
    // sits above the backdrop) swallows empty-area taps and outside-tap never fires.
    const contentRule = css.match(/\.content\s*\{[^}]*\}/)?.[0] ?? '';
    expect(contentRule).toMatch(/pointer-events:\s*none/);
  });
});

// Equipment edge glow (ADR-0011): the shell carries the same glow the Home Screen does,
// so the "system is running" cue persists while an Overlay covers the Home Screen. These
// assert the reveal-class + label plumbing in happy-dom; the actual paint (blue/amber,
// full strength) is proven in test/browser/overlay-glow.test.ts (real Firefox).
describe('overlay shell — equipment glow (ADR-0011)', () => {
  it('renders the glow group and reveals it via the equipment class + sr-only label while cooling', async () => {
    const shell = await mountShell();
    shell.equipment = 'cooling';
    await shell.updateComplete;
    const root = shell.shadowRoot!;
    expect(root.querySelector('svg.shape .glow')).not.toBeNull();
    expect(root.querySelector('.shell.cooling')).not.toBeNull();
    expect(root.querySelector('.sr-only')?.textContent).toBe('Cooling');
  });

  it('reveals the heating class + label while heating', async () => {
    const shell = await mountShell();
    shell.equipment = 'heating';
    await shell.updateComplete;
    const root = shell.shadowRoot!;
    expect(root.querySelector('.shell.heating')).not.toBeNull();
    expect(root.querySelector('.sr-only')?.textContent).toBe('Heating');
  });

  it('applies no cooling/heating reveal class while idle, and no label when equipment is absent', async () => {
    const shell = await mountShell();
    shell.equipment = 'idle';
    await shell.updateComplete;
    // 'idle' is not a reveal class (glow stays hidden) but is still announced, matching
    // the Home and Standby screens.
    expect(shell.shadowRoot!.querySelector('.shell.cooling, .shell.heating')).toBeNull();
    expect(shell.shadowRoot!.querySelector('.sr-only')?.textContent).toBe('Idle');

    shell.equipment = null;
    await shell.updateComplete;
    expect(shell.shadowRoot!.querySelector('.sr-only')).toBeNull();
  });
});
