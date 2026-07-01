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
indicator, the setpoint pill (when setpoints are active), a weather icon, and a menu
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
entities (not limited to ecobee remote sensors).
_Avoid_: rooms view.

### Thermostat concepts

**System Mode**:
The heat/cool operating mode. The device's own labels are **Heat**, **Cool**,
**Heat / Cool (Auto)**, **Off** — use these in UI copy, not "Auto" alone. A generic
`climate` entity (ADR-0001) may also run in **Dry** or **Fan only**; the Card
recognizes and lists these (with Home Assistant's labels) even though the ecobee
device has neither. Surfaces in Home Assistant as the `climate` entity's `hvac_mode`.
_Avoid_: HVAC mode (in UI copy), operation mode, "Auto" (use "Heat / Cool (Auto)").

**Main Menu**:
The hub reached from the Home Screen that lists sub-screens (System, Fan, Sensors,
Weather, …). The System sub-screen holds both the System Mode and Comfort Setting
selectors; tapping a selector opens a focused **Picker**. Navigation is hub-and-picker,
not a flat set of sibling overlays.
_Avoid_: settings, drawer.

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
