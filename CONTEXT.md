# ecosee

A Home Assistant custom Lovelace card that emulates the on-wall UI of the ecobee
Smart Thermostat Premium (2022). It is a **generic thermostat card wearing an
ecobee Premium skin**: it drives off any Home Assistant `climate` entity, shows
full ecobee fidelity when rich data is present, and degrades gracefully when it
is not. The domain's core challenge is reconciling ecobee's on-device vocabulary
with Home Assistant's `climate` vocabulary.

## Language

### Product

**Card**:
The custom Lovelace element the user adds to a dashboard. One Card is bound to one
primary `climate` entity.
_Avoid_: widget, component, tile.

**Skin**:
The pixel-perfect ecobee Premium visual layer applied on top of generic Home
Assistant thermostat data. The Skin is the look; the data underneath is generic.
_Avoid_: theme, style, template.

**Graceful Degradation**:
The rule that any Skin feature whose backing data is absent on the bound entity is
hidden or simplified rather than shown broken. A non-ecobee `climate` entity still
yields a coherent Card.
_Avoid_: fallback, compatibility mode.

### Screens

**Home Screen**:
The default Card view: large **current** temperature, humidity, an Equipment Status
indicator, the setpoint ovals (when setpoints are active), a weather icon, a fan
affordance (a shortcut into the Fan Overlay, shown only when the entity exposes fan
control — this is a Card addition, not on the physical device), and a menu
affordance. The
Premium uses a flat **squircle** motif (big number + rounded-square bubbles), NOT a
circular dial/ring — do not add a ring.
_Avoid_: main view, dashboard, face, dial, ring.

**Overlay**:
A transient view invoked from the Home Screen that temporarily replaces it and then
reverts (temperature adjust, System Mode, Comfort Setting, Fan, Weather, Sensors).
Mirrors how the physical device's screens are reached and auto-return.
_Avoid_: modal, popup, page, dialog.

**Weather Screen**:
The Overlay reached by tapping the weather icon, showing current conditions and
forecast. Backed by a Home Assistant `weather` entity (the ecobee integration's own
weather entity, or any configured one).
_Avoid_: forecast view.

**Sensors Screen**:
The Overlay listing temperature readings from configured Home Assistant sensor
entities (not limited to ecobee remote sensors). Each card may carry an
**"Occupied"/"Unoccupied"** badge; its occupancy source is the sensor's explicit
`occupancy_entity` or, failing that, the occupancy `binary_sensor` auto-paired from
the same device (ADR-0010).
_Avoid_: rooms view.

**Standby Screen**:
The dimmed idle display the Card shows when left untouched: a minimal white-on-black
layout with outdoor temperature, current temperature and the time, mirroring the
physical unit's on-wall idle look. Opt-in via config; the Card auto-returns to the
Home Screen on interaction.
_Avoid_: screensaver, idle face, lock screen, dim mode.

### Thermostat concepts

**System Mode**:
The heat/cool operating mode. The device's own labels are **Heat**, **Cool**,
**Heat / Cool (Auto)**, **Off** — use these in UI copy, not "Auto" alone. The one
exception is the System screen's compact **summary pill**, which shows the device's
terse form (**Auto** for Heat / Cool) so it fits beside the Comfort Setting pill;
the picker list still uses the full label. A generic `climate` entity (ADR-0001) may
also run in **Dry** or **Fan only**; the Card recognizes and lists these (with Home
Assistant's labels) even though the ecobee device has neither. Surfaces in Home
Assistant as the `climate` entity's `hvac_mode`.
_Avoid_: HVAC mode (in UI copy), operation mode, "Auto" alone as the mode name
(except the compact summary pill noted above).

**Main Menu**:
The section screens reached from the Home Screen's gear — **System**, **Sensors**,
**Fan** — navigated by a persistent **Tab Bar** at the bottom. The gear lands
directly on the first reachable section (no intermediate list); the Tab Bar switches
between the sibling sections and its left temperature badge returns to the thermostat
(Home). The System section holds both the System Mode and Comfort Setting selectors;
tapping a selector opens a focused **Picker** pushed on top (dismissing it returns to
the section). Weather is reached from the Home Screen's own affordance, not the Tab
Bar — as on the device, whose bottom bar carries thermostat/sensors/fan/settings but
not weather (the voice/mic tab has no Home Assistant meaning and is dropped).
_Avoid_: settings, drawer, drill-down list (the earlier hub list is gone — only the
selector→Picker step remains a drill-in).

**Tab Bar**:
The device's persistent bottom navigation across the Main Menu sections. Rendered as
shell chrome (like the ✕) on the System / Sensors / Fan screens only, never on the
pickers, Temperature, or Weather. Left to right: a temperature **badge** (returns
Home), then one icon tab per reachable section — sensors, fan, and the gear (which is
the System/settings tab, kept rightmost). A tab shows only when its section is
reachable for the bound entity (graceful degradation, ADR-0001).
_Avoid_: navbar, footer, toolbar.

**Comfort Setting**:
An ecobee named climate preset — Home, Away, Sleep, plus user-defined ones — each
carrying its own target temperatures. Surfaces in Home Assistant as a `climate`
`preset_mode`.
_Avoid_: preset (in UI copy), climate (the ecobee term, too ambiguous here), profile, scene.

**Setpoint**:
A target temperature the system drives toward. Single in Heat/Cool/Off; dual
(a low/heat setpoint and a high/cool setpoint) in Auto. Surfaces as
`target_temperature` or `target_temp_low`/`target_temp_high`.
_Avoid_: target temp (in code), threshold.

**Equipment Status**:
What the HVAC equipment is actively doing right now (heating, cooling, fan, idle).
Derived from `hvac_action` when present, otherwise inferred.
_Avoid_: running state, action.
