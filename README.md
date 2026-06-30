# ecosee

A Home Assistant custom Lovelace card that renders a pixel-perfect **ecobee Smart
Thermostat Premium (2022)** skin over **any** `climate` entity — showing full
ecobee fidelity when rich data is present and degrading gracefully when it is not.

> It is a generic thermostat card _wearing an ecobee skin_. Point it at a HomeKit
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
entity: climate.living_room # required — the bound climate entity
name: Living Room # optional — defaults to the friendly name
weather_entity: weather.home # optional — enables the weather icon
humidity_entity: sensor.hallway_humidity # optional — humidity fallback
inactivity_timeout: 12 # optional — seconds before an overlay reverts; 0 = off
sensors: # optional — the Main Menu › Sensors sub-screen
  - sensor.kitchen_temperature # shorthand: a temperature entity id
  - entity: sensor.hallway_temperature
    name: Hallway # optional label override
    occupancy_entity: binary_sensor.hallway_occupancy # optional → badge
```

| Option               | Required | Description                                                                                |
| -------------------- | -------- | ------------------------------------------------------------------------------------------ |
| `entity`             | yes      | A `climate.*` entity. The Card binds to exactly one.                                       |
| `name`               | no       | Label override.                                                                            |
| `weather_entity`     | no       | A `weather` entity; shows the weather icon (overlay comes later).                          |
| `humidity_entity`    | no       | Humidity source when the climate entity exposes no humidity.                               |
| `sensors`            | no       | Curated temperature entities for the **Sensors** sub-screen (below).                       |
| `inactivity_timeout` | no       | Seconds an open overlay waits (idle) before reverting to Home; `0` disables. Default `12`. |

#### `sensors` — the Sensors sub-screen

A list curating which temperature readings appear under **Main Menu › Sensors**.
The thermostat's own temperature is auto-included first, so this lists the _extra_
sensors. Each item is either a bare entity-id string or an object:

| Field              | Required | Description                                                         |
| ------------------ | -------- | ------------------------------------------------------------------- |
| `entity`           | yes      | A temperature entity (value in its state or `current_temperature`). |
| `name`             | no       | Label override; defaults to the entity's friendly name.             |
| `occupancy_entity` | no       | A binary occupancy entity backing the **"Occupied"** badge.         |

The sub-screen is hidden unless at least one configured sensor is usable; sensors
that are missing, `unavailable`, or non-numeric are dropped, and the occupancy
badge appears only when an `occupancy_entity` is supplied (graceful degradation).

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
