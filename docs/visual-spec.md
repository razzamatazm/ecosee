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
                                 ├── System  → System sub-screen (hub)
                                 │            ├── System Mode selector → System Mode picker
                                 │            └── Comfort Setting selector → Comfort Setting picker
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

### Main Menu — `reference/menu-system.jpeg`
The hub reached from the Home Screen menu affordance, presented as an Overlay.
- **"Main Menu" title** near the top, then the reachable sub-screens as a single
  cyan-outlined vertical list (hairline dividers), each row a label with a forward
  chevron: **System**, **Fan**, **Sensors**, **Weather**.
- **Hub-and-picker**, not flat siblings: selecting a row opens that sub-screen's
  Overlay (System → the System sub-screen; the others as they land). A view reached
  through the hub returns to the hub on ✕/outside-tap; the hub itself returns to the
  Home Screen. Navigation nests: Main Menu → System sub-screen → a picker.
- **Graceful degradation:** a sub-screen is listed only when its backing data is
  present (e.g. System hidden without `hvac_modes` *and* `preset_modes`, Fan without
  `fan_modes`, Sensors when none are configured, Weather without a `weather`
  entity). With nothing reachable, the menu affordance opens nothing.

### Main Menu › System sub-screen — `reference/menu-system.jpeg`
The hub reached from the Main Menu's **System** row, presented as an Overlay. The
intermediate screen that holds the two system selectors — it routes, it does not
edit.
- **"Main Menu" title** with a **"System" subtitle** near the top.
- Two **selectors** side by side (wrapping to stacked rows when a value is too wide,
  e.g. "Heat / Cool (Auto)"): **System Mode** and **Comfort Setting**, each a label
  over a cyan-outlined pill showing the active value with a ▾ caret. Tapping a
  selector opens its **picker** (pushed onto the stack, so ✕/outside-tap returns
  here).
- **Equipment Status line** beneath the selectors: **No Equipment Running** (idle),
  **Heating**, or **Cooling**. From `hvac_action` (inferred if absent); hidden when
  neither is available.
- **Graceful degradation:** a selector is shown only when its data is present — the
  System Mode selector needs `hvac_modes`, the Comfort Setting selector needs
  `preset_modes`. The sub-screen is reachable from the Main Menu when *either* is
  present.

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
- Options come from `hvac_modes`; only show modes the entity supports. A generic
  entity may also offer **Dry** / **Fan only** (HA labels); these list after Auto
  and before Off, though the ecobee device has neither.

### Comfort Setting picker — (reached from Main Menu › System)
- A vertical segmented list (same cyan-outlined motif as the System Mode picker) of
  the entity's `preset_modes` (Home / Away / Sleep / custom), in the entity's own
  order. Each row pairs a **glyph** with the Comfort Setting's name. The active
  Comfort Setting's row is filled cyan with dark text.
- Selecting one applies it as a **Hold** (`climate.set_preset_mode`) and the
  highlight follows the entity's reported `preset_mode`. Tapping the active row is a
  no-op.
- **Icons:** the named ecobee Comfort Settings map to Skin glyphs — **Home** (house),
  **Away** (suitcase), **Sleep** (moon), matched case-insensitively and shown with
  their canonical labels. Custom presets pass their name through verbatim and get the
  default **comfort** glyph (a sparkle), overridable per-card via the
  `default_comfort_icon` config key (one of `home` / `away` / `sleep` / `comfort`).
- **Graceful degradation:** hidden entirely when the entity exposes no `preset_modes`
  (ADR-0001) — the Comfort Setting selector then drops out of the System sub-screen.

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
