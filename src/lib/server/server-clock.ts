/**
 * The one place server code reads the time (`server-clock.spec.ts` keeps it so).
 *
 * Today it is the wall clock. Offline replay (phase 3 of
 * docs/superpowers/specs/2026-11-07-offline-design.md) sets it to when a change
 * was made on the device, so a set logged offline at 10:00 is dated 10:00.
 * Pure modules (`day`, `schedule`) still take `now` as an argument.
 */
export function serverNow(): number {
	return Date.now();
}
