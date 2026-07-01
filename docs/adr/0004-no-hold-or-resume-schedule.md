# No Hold or Resume Schedule

The physical ecobee frames a manual change as a **Hold** and offers a **Resume
Schedule** action to clear it and hand control back to the program. ecosee does not
surface either. Home Assistant can't reliably drive the underlying behavior: it has
no portable notion of an active hold, no next-transition time to show as an expiry,
and no cross-integration way to resume a schedule — the ecobee `resume_program`
service is integration-specific, absent on HomeKit-paired ecobees, Nest, and generic
thermostats. Detecting the backing integration to conditionally offer Resume made the
Card lie about a control it usually couldn't back.

Instead, the Card only **writes**: `climate.set_temperature` for setpoints and
`climate.set_preset_mode` for Comfort Settings. The Home Screen shows the active
heat/cool setpoints as a plain **setpoint display** (the setpoint pill) with no
Resume ✕ and no Hold framing. What happens to the schedule after a write is Home
Assistant's business, not something the Card claims to manage.

## Consequences

- The setpoint pill is display-only; there is no ✕, no `resume` Home Screen action,
  and no `ecobee.resume_program` call. The entity-registry / `platform` detection
  that gated Resume is gone.
- The Card is intentionally *less* faithful than the device here, to avoid faking a
  control it can't back — the same trade-off as ADR-0003, extended from the duration
  prompt to Hold/Resume as a whole. This supersedes ADR-0003.
- "Setpoints" is the surfaced vocabulary; "Hold" and "Resume Schedule" are retired
  from the UI, the code, and the domain docs.
- If HA ever grows a portable, integration-agnostic hold/resume concept, this ADR
  should be revisited.
