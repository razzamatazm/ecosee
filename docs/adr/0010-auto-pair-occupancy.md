# Auto-pair a sensor's occupancy binary_sensor from its device

**Status: Accepted.** Origin: owner request (auto-pair occupancy for linked ecobee
sensors). Amends the visual-spec Sensors "Reading line" section and the CONTEXT.md
Sensors Screen entry. Builds on [ADR-0001](./0001-generic-climate-card-with-ecobee-skin.md)
(graceful degradation) — the badge stays hidden whenever nothing confidently resolves.

## Context

The Sensors sub-screen shows an **"Occupied" / "Unoccupied"** badge per curated
temperature sensor, backed by a per-sensor `occupancy_entity` (a binary sensor). Two
problems made that badge rarely appear in practice:

- It had to be wired **by hand** — the temperature sensor and its occupancy sensor are
  two separate entities, and the user had to name both.
- `occupancy_entity` is **YAML-only**: the GUI editor surfaces the temperature picker
  and a display-name field, but no occupancy field (`src/editor/editor.ts` carries the
  key over from the stored config but never renders it). So a GUI-only user could never
  get the badge at all.

Yet the primary target — an ecobee — already publishes both halves. The HA ecobee
integration registers **each remote sensor as one device**, carrying a
`sensor.*_temperature` and a `binary_sensor.*_occupancy` (device_class `occupancy`).
The pairing information the user was retyping is already in the entity registry.

The owner's framing was telling: "can we link the device itself instead?" — the device
*is* the natural join key.

## Decision

When a curated sensor has **no** explicit `occupancy_entity`, the Sensors seam
(`toSensorsModel` → `occupancy` → `autoPairOccupancy` in `src/sensors/sensors.ts`)
resolves one from the **entity registry** (`hass.entities`):

- Look up the temperature entity's `device_id`.
- Among entities on that **same device**, pick the first `binary_sensor.*` whose live
  `device_class` is `occupancy`.
- Use it exactly as an explicit `occupancy_entity` would be used (on → Occupied).

Deliberate boundaries:

- **Fallback, never override.** An explicit `occupancy_entity` always wins, even if it
  is broken/unavailable — explicit config is authoritative intent, so we do not silently
  swap in a device sibling behind the user's back.
- **Device-registry based, not name-based.** Pairing on the shared device + a real
  `device_class: occupancy` is predictable and avoids false matches (a `binary_sensor`
  for a door/window on the same device is not paired). Name-string heuristics
  (`sensor.office_temperature` → `binary_sensor.office_occupancy`) were rejected as
  fragile across renames, localization, and custom naming.
- **`occupancy` class only.** The badge literally means *occupied*; momentary `motion`
  sensors carry different semantics, so they are not auto-paired. A user who wants a
  motion source can still set `occupancy_entity` explicitly.
- **Configured sensors only.** The thermostat's own card keeps its existing invariant
  (`occupied: null`, no badge) — this ADR does not change it. Extending auto-pair to the
  bound `climate` entity's device is a possible follow-up, not part of this change.
- **On by default, no opt-out flag.** Auto-pair only *adds* a badge where there was
  none, only on a confident device-class match, and degrades silently otherwise. A flag
  would be speculative; if an unwanted badge is ever reported we add an opt-out then.

## Consequences

- **ecobee sensors get the occupancy badge with zero extra config**, including for
  GUI-only users — this closes the YAML-only gap for the common case without adding an
  occupancy field to the editor (the editor is untouched).
- The `HomeAssistant` type gains an optional `entities` map (`HassEntityRegistryEntry`,
  device link only). It is optional so the seam tests keep building `hass` by hand and
  the Card degrades to no-badge when the registry is absent (older HA / hand-built
  `hass`) — same tri-state contract as before.
- `test/sensors.test.ts` gains an "auto-paired occupancy" block: pairs a same-device
  occupancy sensor, explicit `occupancy_entity` wins over a pairable sibling, and null
  for a non-occupancy class, a different device, a device-less sensor, a missing
  registry, and an unavailable auto-paired entity.
- Behavior is additive: a sensor with no device sibling, or on an HA without the
  registry, renders exactly as it does today.
