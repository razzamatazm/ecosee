# Generic climate card with an ecobee Premium skin

ecosee renders an ecobee Smart Thermostat Premium look, but it drives off **any**
Home Assistant `climate` entity rather than requiring the official ecobee
integration. We chose this because the maintainer's own rich data (comfort
settings, weather, equipment status) comes from a grandfathered ecobee API key that
ecobee no longer issues — so the wider audience (HomeKit-paired ecobees, Nest,
generic thermostats) lacks that data. The card therefore treats the ecobee visuals
as a **skin** over generic data and applies **graceful degradation**: any feature
whose backing data is absent on the bound entity (presets/Comfort Settings, weather
entity, `hvac_action`, remote sensors) is hidden or simplified rather than shown
broken.

## Consequences

- Every overlay must define an "absent data" behavior; nothing may assume
  ecobee-cloud attributes exist.
- The name "ecobee card" is potentially surprising to someone whose entity is a
  Nest — this ADR is the explanation.
- Weather and Sensors are driven by separately-configurable entities, not assumed
  to come from the climate entity.
