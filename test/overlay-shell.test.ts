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
    const css = EcoseeOverlay.styles.cssText;
    // The .content rule must set pointer-events: none; otherwise the wrapper (which
    // sits above the backdrop) swallows empty-area taps and outside-tap never fires.
    const contentRule = css.match(/\.content\s*\{[^}]*\}/)?.[0] ?? '';
    expect(contentRule).toMatch(/pointer-events:\s*none/);
  });
});
