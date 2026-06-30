# ecosee

A Home Assistant custom Lovelace card that renders a pixel-perfect **ecobee Smart
Thermostat Premium (2022)** skin over **any** `climate` entity — showing full
ecobee fidelity when rich data is present and degrading gracefully when it is not.

> It is a generic thermostat card *wearing an ecobee skin*. Point it at a HomeKit
> ecobee, a Nest, or a generic thermostat: features whose backing data is absent
> are hidden, never faked. See [`CONTEXT.md`](./CONTEXT.md) and
> [`docs/adr/`](./docs/adr/) for the why.

## Status

Milestone 1 — project skeleton + the **Home Screen** (current temperature,
humidity, equipment status, Hold pill + Resume, weather icon, menu affordance).
Overlays (temperature adjust, System Mode, Comfort Setting, Fan, Weather, Sensors)
and the GUI config editor are next.

## Install (HACS)

1. HACS → Frontend → ⋮ → **Custom repositories** → add this repo as a
   **Lovelace** (Dashboard) repository.
2. Install **ecosee**, then add the resource if HACS doesn't do it automatically:
   `/hacsfiles/ecosee/ecosee.js` as a **JavaScript Module**.
3. Add the card to a dashboard (YAML below).

## Configuration

YAML-first (a GUI editor is a later fast-follow). Only `entity` is required.

```yaml
type: custom:ecosee-card
entity: climate.living_room      # required — the bound climate entity
name: Living Room                # optional — defaults to the entity's friendly name
weather_entity: weather.home     # optional — enables the weather icon
humidity_entity: sensor.hallway_humidity  # optional — fallback when the climate
                                 #            entity has no current_humidity
```

| Option            | Required | Description                                                        |
| ----------------- | -------- | ------------------------------------------------------------------ |
| `entity`          | yes      | A `climate.*` entity. The Card binds to exactly one.               |
| `name`            | no       | Label override.                                                    |
| `weather_entity`  | no       | A `weather` entity; shows the weather icon (overlay comes later).  |
| `humidity_entity` | no       | Humidity source when the climate entity exposes no humidity.       |

### Graceful degradation

Each Home-Screen element is shown only when its data exists: humidity, the
equipment indicator (`hvac_action`, softly inferred from setpoints when absent),
the weather icon (only with a `weather_entity`), and **Resume Schedule** (only on
ecobee-backed entities, via `ecobee.resume_program`). A non-ecobee entity still
yields a coherent card.

## Development

```bash
npm install
npm run dev        # preview harness with fixtures + a width slider (dev/)
npm run test       # unit tests for the degradation logic
npm run typecheck
npm run lint
npm run build      # single ES module → dist/ecosee.js
```

The preview harness (`dev/`) renders the card against hand-built `hass` fixtures —
a rich ecobee, a bare generic thermostat, and an unavailable entity — so the UI
can be built without a running Home Assistant.

## License

MIT
