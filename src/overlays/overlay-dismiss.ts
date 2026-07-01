/** The event an Overlay emits to ask the host card to close it (pop one nav level).
 *  Bubbling + composed so it escapes the emitter's shadow root, crosses the
 *  <ecosee-overlay> shell, and reaches the card's single listener. The shell's ✕ and
 *  backdrop emit it directly; the value pickers emit it after a selection to
 *  auto-close (issues #38, #39). */
export const OVERLAY_DISMISS_EVENT = 'ecosee-overlay-dismiss';

/** Emit the shared dismiss event from an Overlay (or the shell itself). */
export function emitOverlayDismiss(source: EventTarget): void {
  source.dispatchEvent(new CustomEvent(OVERLAY_DISMISS_EVENT, { bubbles: true, composed: true }));
}

/** How long a just-tapped picker row holds its moved highlight before the overlay
 *  auto-closes. Long enough that the optimistic selection is visibly registered
 *  (issue #38: "show pressed/pending state"), short enough to read as instant —
 *  mirroring the device's tap-then-return. */
export const PICKER_CONFIRM_MS = 150;

/** (Re)schedule a picker's auto-close: cancel any beat already running, then hold the
 *  optimistic highlight for the confirm beat before emitting the dismiss so the card
 *  pops back to the previous screen (issues #38, #39). Cancelling first means a fast
 *  correction tap restarts the beat rather than closing on the earlier value — the
 *  picker closes a beat after your *last* pick. Returns the new handle so the element
 *  can cancel it if it is torn down first. */
export function reschedulePickerClose(
  source: EventTarget,
  current: ReturnType<typeof setTimeout> | undefined,
): ReturnType<typeof setTimeout> {
  if (current !== undefined) clearTimeout(current);
  return setTimeout(() => emitOverlayDismiss(source), PICKER_CONFIRM_MS);
}

declare global {
  interface HTMLElementEventMap {
    'ecosee-overlay-dismiss': CustomEvent<void>;
  }
}
