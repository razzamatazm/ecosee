# ecosee — Visual & Interaction Spec

The buildable source of truth for the pixel-perfect ecobee Smart Thermostat Premium
(2022) skin. Authoritative reference photos of the maintainer's own unit live in
[`docs/reference/`](./reference/). See [`CONTEXT.md`](../CONTEXT.md) for vocabulary
and [`docs/adr/`](./adr/) for the architectural decisions this spec assumes.

Design principle throughout: **ecobee skin over generic `climate` data, with graceful
degradation** (ADR-0001). Anything whose data is absent is hidden, never faked.

## Visual language

- **Motif:** flat **squircle** (rounded-square) — big numbers and rounded-square
  bubbles. **No circular dial/ring.**
- **Canvas:** near-black background, cyan/blue accent text and outlines.
- **Selected state:** filled cyan fill. The System Mode picker's selected row uses
  dark text on cyan; the Temperature Adjust scrubber bubble uses a thin light
  numeral over its gradient.
- **Mode/setpoint color language:**
  - **Cool** — blue/cyan, **❄ snowflake** icon.
  - **Heat** — amber/orange, **♨ heat-coil** icon. The active heat bubble uses a warm
    yellow→orange gradient; the active cool bubble a blue gradient.
  - **Idle / neutral** — default cyan on black.
- **Weather glyphs:** green (e.g., the sun icon).
- **Sizing:** preserve the device's square-ish aspect ratio, scale to the card's
  column width, cap max size (no circular dial to preserve, but keep the squircle
  proportions). Units follow Home Assistant's configured system.

## Navigation map

```
Home Screen
├── tap temperature ............ Temperature Adjust (scrubber + setpoint chips)
├── tap weather icon ........... Weather overlay (page 1 current / page 2 forecast)
├── tap Hold pill ✕ ............ Resume Schedule
└── menu ....................... Main Menu (hub)
                                 ├── System  → System Mode picker + Comfort Setting picker
                                 ├── Fan      → On/Auto + min-runtime
                                 └── Sensors  → temperature + occupancy cards
```

Overlays auto-revert to the Home Screen after a configurable inactivity timeout
(default ~10–15s, settable to off) and on ✕/outside-tap.

## Screens

### Home Screen — `reference/home-hold.jpeg`, `home-off.jpeg`, `home-heat-only.jpeg`, `home-cool-only.jpeg`
Top row of glyphs, then the humidity line and large current temperature centered,
then the Hold pill — see also the equipment edge glow below.
- **Large current temperature** (e.g., `75`) — the dominant element. This is
  `current_temperature`, NOT a setpoint.
- **Humidity** `◊ 60%` — `current_humidity` (hidden if absent).
- **System Mode indicator** (top row, center) — the device's mode glyph: `OFF` pill,
  ♨ Heat, ❄ Cool, ❄-leaf Heat / Cool (Auto). From `hvac_mode`; tapping it opens the
  **System Mode picker**. (This is *not* the equipment status — see the edge glow.)
- **Equipment Status edge glow** — a colored glow around the screen edge: blue while
  cooling, amber while heating, none when idle. From `hvac_action` (inferred if
  absent); see `reference/home-cooling.jpeg` / `home-heating.jpeg`.
- **Hold pill** (when on a Hold): the active setpoints (`70 – 75`, heat amber / cool
  blue) + ✕ to **Resume Schedule**. A single-setpoint pill (Heat/Cool only) shows one
  value and is tinted to the mode color. The device's `until 5:28pm` expiry is omitted
  — HA doesn't expose the next transition time (ADR-0003).
- **Weather icon** (top row, left) — opens the Weather overlay; shown only if a
  `weather` entity is configured/detected.
- **Menu affordance** (top row, right) — opens Main Menu.
- **Omitted (no generic data source):** reminder/alert glyph, glowing status orb (the
  distinct center orb; the equipment *edge glow* above is backed by `hvac_action`).

### Temperature Adjust — `reference/temp-adjust-cool.jpeg`, `temp-adjust-heat.jpeg`
- **Vertical value scrubber** down the center, higher values up:
  `77 / 76 / [75] / 74 / 73` top-to-bottom, the selected value in a big squircle
  bubble (blue gradient for cool, warm gradient for heat) with a thin light numeral.
  **Drag the scrubber vertically** to change the value (the primary gesture); the
  neighbors are display-only context.
- **+ / −** buttons stacked on the right (＋ above −) nudge the selected setpoint
  one step; tinted to the active setpoint's color.
- **Setpoint chips** stacked on the left as small circular pucks (glyph over temp):
  cool (❄, blue) above heat (♨, amber); selected = filled, unselected = outlined.
  - **Single setpoint** (Heat/Cool): one chip, one scrubber.
  - **Dual setpoint** (Heat / Cool (Auto)): both chips; tap a chip to choose which
    setpoint the scrubber edits. Maps to `target_temp_low` / `target_temp_high`.
- Applying a change creates a **Hold** (until next transition).

### System Mode picker — `reference/system-mode-picker.jpeg`
- Vertical segmented list with the device's exact labels: **Heat**, **Cool**,
  **Heat / Cool (Auto)**, **Off**. Selected = filled cyan.
- Options come from `hvac_modes`; only show modes the entity supports.

### Comfort Setting picker — (on Main Menu › System, `reference/menu-system.jpeg`)
- Dropdown/list of `preset_modes` (Home / Away / Sleep / custom). Selecting one
  applies it as a Hold. Hidden entirely if the entity has no presets.
- Known presets map to ecobee icons; custom presets get a default icon
  (config-overridable). Equipment status line ("No Equipment Running") shown here too.

### Fan — `reference/fan-mode.jpeg`
- **On / Auto** toggle from `fan_modes`.
- **Minimum runtime** selector (`0 min / hr`) — maps to a `fan_min_on_time` number
  entity; hidden if no such entity. Helper copy mirrors the device.

### Sensors — `reference/sensors.jpeg`
- Horizontal **cards**, each: **name**, **temperature°**, **occupancy** ("Occupied")
  with an occupancy icon, and an expand chevron.
- Populated from a user-curated list of temperature entities (thermostat's own temp
  auto-included first). Occupancy badge shown only when an occupancy entity is
  supplied for that sensor. No "participating in average" UI (HA can't back it).

### Weather — `reference/weather-current.jpeg` (page 1), `weather-forecast.jpeg` (page 2)
- **Page 1 — current:** condition text ("Mostly Clear"), "as of [time]" (only if
  available), big current outdoor temp + condition icon, **Hum.**, **PoP**, and
  intra-day periods (Evening / Overnight / Morning) **only when the weather entity
  provides them**.
- **Page 2 — 4-day forecast:** per day: icon, high, "Night [low]", "PoP %".
- Paginated (`1 of 2` / `2 of 2`), footer "Data provided by [provider]".
- Forecast data comes from the `weather.get_forecasts` service in modern HA, not a
  static attribute. Degrade page 2 / periods if the entity offers no forecast.

## v1 / v2 / excluded

- **v1:** everything above with a **static** background.
- **v2:** dynamic weather/time-of-day background; GUI config editor; optional
  air-quality (`air_quality_entity`) element; optional Hold expiry time if a
  schedule/next-transition source is wired.
- **Excluded:** schedule view; installer/device settings; sensor
  "participating-in-average"; reminders/alerts; status orb.
