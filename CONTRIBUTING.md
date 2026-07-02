# Contributing to ecosee

## Development

```bash
npm run dev          # live preview harness at /dev/ (the demo, with sample data)
npm test             # unit tests
npm run test:browser # rendering checks in real headless Firefox (npx playwright install firefox first)
npm run typecheck
npm run lint
npm run build        # single ES module -> dist/ecosee.js
npm run demo         # static build of the preview harness for GitHub Pages
```

The preview harness under `dev/` renders the card against hand-built sample
states, so you can work on the UI without a running Home Assistant. It is the same
thing published as the live demo.

## Releasing

Releases are automated and version driven. Bump `version` in `package.json` and
merge to `main`; the Release workflow builds the bundle and publishes a GitHub
Release named `v<version>` with `dist/ecosee.js` attached. HACS resolves the card
to that latest release and downloads the asset, so publishing a release keeps the
repository HACS compliant. A push to `main` that does not change the version is a
no-op.
