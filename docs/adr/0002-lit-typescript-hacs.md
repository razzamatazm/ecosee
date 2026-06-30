# Lit + TypeScript, distributed via HACS

ecosee is built as a LitElement web component written in TypeScript, bundled to a
single ES module, and distributed through HACS. This is the de-facto standard for
Home Assistant custom Lovelace cards (the built-in cards use Lit), giving us native
reactivity against the `hass` object, first-class support for the card config
editor, and the install path users already expect.

## Considered options

- **Vanilla TS web component** — smallest bundle, but we'd reimplement
  templating/reactivity for a rich, multi-overlay UI.
- **React/Preact wrapped in a web component** — familiar, but adds a runtime,
  integrates awkwardly with the `hass` object, and diverges from HA conventions.

Lit was chosen for ecosystem fit and lock-in worth accepting; swapping the
framework later would be a near-total rewrite, hence recording it here.
