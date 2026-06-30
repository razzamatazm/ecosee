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
- **Weather glyphs:** green — but only the **condition** glyphs inside the Weather
  Overlay. The Home Screen's weather **affordance** is cyan like the other top-row
  glyphs (the device colors it the same as the mode/menu icons, not green).
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
  `current_temperature`, NOT a setpoint. Rendered in **thin cyan** glyphs (not pale
  white) with a faint top-bright sheen (`--ecosee-temp-grad`) and proportional
  lining figures, matching the device's number.
- **Humidity** `◊ 60%` — `current_humidity` (hidden if absent). The glyph is the
  device's small **water droplet** (the `◊` is shorthand), cyan.
- **System Mode indicator** (top row, center) — the device's mode glyph: `OFF` pill,
  ♨ Heat, ❄ Cool, ❄-leaf Heat / Cool (Auto). From `hvac_mode`; tapping it opens the
  **System Mode picker**. (This is *not* the equipment status — see the edge glow.)
- **Equipment Status edge glow** — a colored glow around the screen edge: blue while
  cooling, amber while heating, none when idle. From `hvac_action` (inferred if
  absent); see `reference/home-cooling.jpeg` / `home-heating.jpeg`. A crisp thin
  outline tracing the squircle edge with a gentle falloff inward, not a diffuse halo.
- **Hold pill** (when on a Hold): a **horizontal** pill (as the reference photos
  show — the setpoints read left-to-right, not rotated) with the active setpoints in
  **bold** (`70 – 75`, heat amber / cool blue) + ✕ to **Resume Schedule**. A
  single-setpoint pill (Heat/Cool only) shows one value and is tinted to the mode
  color. The device's `until 5:28pm` expiry is omitted — HA doesn't expose the next
  transition time (ADR-0003).
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
- **"Fan Mode" title** near the top, then the controls beneath (top-anchored, as on
  the device — not a vertically-centered cluster).
- **On / Auto** segmented pill toggle from `fan_modes`, listed **Auto** then **On**
  (the device order). The active mode's segment is **filled cyan with dark text**
  (the squircle selected motif); the rest are cyan on black. Selecting a segment
  writes `climate.set_fan_mode`; tapping the active one is a no-op. A generic
  `climate` entity exposing extra fan speeds (e.g. Low / Medium / High) lists those
  after Auto / On with Home Assistant's (title-cased) labels — graceful degradation,
  the ecobee device has only the two.
- **Minimum runtime** selector — a cyan-outlined dropdown pill (`0 min / hr` with a
  ⌄ caret) backed by a configured `fan_min_on_time` **`number`** entity
  (`fan_min_on_time_entity` in config). The option grid is derived from the number
  entity's `min`/`max`/`step` (defaulting to the ecobee 0–55 by 5); choosing a value
  writes `number.set_value`. **Hidden entirely** when no such entity is
  configured/available (ADR-0001) — the On / Auto toggle still shows.
- **Helper copy** mirrors the device: a dynamic summary line ("Your fan currently
  has no minimum runtime." at 0, otherwise "…runs at least N minutes per hour.") and
  the static instruction "You can change your fan's minimum hourly runtime by
  tapping the setting below."

### Sensors — `reference/sensors.jpeg`
- Reached through the hub (Main Menu › Sensors), so the header is the breadcrumb
  **"Main Menu"** with **"Sensors"** beneath it.
- A vertical stack of horizontal **cards**, each a cyan-outlined squircle with: a
  sensor glyph on the left, the **name** (bold), a **`73° | Occupied`** reading
  line, and a circled **expand chevron** on the right. The thermostat's own card
  gets the wall-display glyph; curated sensors get the remote-sensor glyph.
- **Reading line:** the current **temperature°** (degree sign only, no unit letter,
  matching the device); when an occupancy entity is configured, a ` | ` divider and
  the occupancy badge follow — **"Occupied"** when it reports `on`, **"Unoccupied"**
  otherwise. With no occupancy entity (or an unavailable one), the badge is omitted
  and the line is just the temperature (ADR-0001 graceful degradation).
- **Populated** from a user-curated `sensors:` list (see the README config table);
  the thermostat's own temperature is auto-included **first**. A sensor card is
  dropped when its entity is missing / `unavailable` / non-numeric; the thermostat
  card is dropped if it has no `current_temperature`.
- **Read-only** — no "participating in average" UI (HA can't back it); the expand
  chevron is a fidelity affordance with no per-sensor detail screen.
- **Graceful degradation / gating:** the Sensors sub-screen is listed (and the
  overlay shown) only when **at least one configured sensor** yields a usable card.
  The thermostat's own temperature alone does **not** surface it, so an empty or
  absent `sensors:` list hides the menu entry entirely.

### Weather — `reference/weather-current.jpeg` (page 1), `weather-forecast.jpeg` (page 2)
The Overlay reached from the Home Screen weather icon and from Main Menu › Weather,
backed by the configured `weather_entity`. Two pages, each with the pager and the
provider footer. **Condition glyphs are green** (`--ecosee-weather`); the PoP
umbrella and Hum. droplet, the temperatures, the day names and the pager are cyan
on black (the umbrella/droplet read as cyan, not green).
- **Page 1 — current:** the **condition text** as the title ("Mostly Clear" /
  "Partly Cloudy") with **"[date] as of [time]"** beneath it (only when the entity
  carries a timestamp); a large green **condition glyph** beside the big cyan
  **current outdoor temp**; then a **PoP** ☂ / **Hum.** ◊ line and the next three
  **intra-day periods** (Evening / Overnight / Morning) — each a glyph + temp over
  a label.
- **Page 2 — 4-day forecast:** title "4 Day Forecast"; the four days **after
  today** (today already owns page 1), each a column with a short **day name**
  (Tue / Wed / …), a green glyph, the cyan **high**, **"Night [low]"**, and
  **"PoP %"**.
- **Pager:** `1 of 2` / `2 of 2` centered above the footer, a chevron on each side;
  the arrows wrap (both stay live on both pages, as on the device). When the entity
  offers no forecast the pager collapses to a single page (page 1 only).
- **Footer:** "Data provided by [provider]" from the entity's `attribution`
  attribute (rendered verbatim when it already credits a provider); hidden when
  absent.
- **Data sources & graceful degradation (ADR-0001):**
  - Current temp / condition / Hum. come from the weather entity's own attributes
    (`temperature`, `state`, `humidity`); each is hidden when absent. The
    temperature unit follows the weather entity's `temperature_unit` when present.
  - The forecast comes from the **`weather.get_forecasts` service** (modern HA),
    not a static attribute: the Card fetches **daily** (the four days after today
    for page 2, plus today's PoP from the first entry) and **hourly** (the
    intra-day periods) when the Overlay opens. An entity that offers no forecast
    simply **drops page 2 and the PoP / periods** rather than rendering them
    broken.
  - Weather is **read-only** — no service write, no Hold; the only interaction is
    paging (local view state). Dismissal is the shell's (✕ / outside-tap).

## v1 / v2 / excluded

- **v1:** everything above with a **static** background.
- **v2:** dynamic weather/time-of-day background; GUI config editor; optional
  air-quality (`air_quality_entity`) element; optional Hold expiry time if a
  schedule/next-transition source is wired.
- **Excluded:** schedule view; installer/device settings; sensor
  "participating-in-average"; reminders/alerts; status orb.
