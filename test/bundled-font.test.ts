// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from 'vitest';

import { ensureBundledFont, BUNDLED_FAMILY } from '../src/styles/bundled-font';
import { tokens } from '../src/styles/tokens';
import '../src/ecosee-card';

// ADR-0007: the Card carries Montserrat inside the bundle and registers it at
// runtime, so every HACS install renders the Gotham-alike with healthy metrics
// and zero configuration. Real rendering with the face is guarded in headless
// Firefox (test/browser/gecko-parity.test.ts); this file pins the registration
// contract.

beforeEach(() => {
  document.getElementById('ecosee-bundled-font')?.remove();
  document.body.innerHTML = '';
});

describe('ensureBundledFont', () => {
  it('registers six healthy-metric faces under the private family, once', () => {
    ensureBundledFont();
    ensureBundledFont();
    const styles = document.querySelectorAll('#ecosee-bundled-font');
    expect(styles.length).toBe(1);
    const css = styles[0].textContent ?? '';
    expect(css.match(/@font-face/g)?.length).toBe(6);
    for (const weight of [200, 300, 400, 500, 600, 700]) {
      expect(css).toContain(`font-weight: ${weight}`);
    }
    // Six sources. In the shipped bundle each is a data: URI (vite `?inline`
    // inlines at build time — vitest's dev transform leaves a dev-server URL,
    // so the literal can't be pinned here); that the faces really register and
    // load in an engine is guarded by test/browser/gecko-parity.test.ts.
    expect(css.match(/src: url\(/g)?.length).toBe(6);
    expect(css).toContain(`font-family: '${BUNDLED_FAMILY}'`);
  });

  it('is inert without a document head', () => {
    expect(() => ensureBundledFont(undefined)).not.toThrow();
  });
});

describe('the Card wires the bundled face in', () => {
  it('injects the faces when a card connects', () => {
    const card = document.createElement('ecosee-card');
    document.body.appendChild(card);
    expect(document.getElementById('ecosee-bundled-font')).toBeTruthy();
  });

  it('places the private family in the token stack after the dashboard-provided candidates', () => {
    const stack = /--ecosee-font:\s*([^;]+);/.exec(tokens.cssText)?.[1] ?? '';
    const provided = stack.indexOf("'Montserrat'");
    const bundled = stack.indexOf(`'${BUNDLED_FAMILY}'`);
    expect(provided).toBeGreaterThan(-1);
    expect(bundled).toBeGreaterThan(provided);
  });
});
