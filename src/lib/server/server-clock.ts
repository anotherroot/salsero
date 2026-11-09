/**
 * The one place server code reads the time (`server-clock.spec.ts` keeps it so).
 *
 * The wall clock, except while an offline change is replayed (phase 3 of
 * docs/superpowers/specs/2026-11-07-offline-design.md): then it reads when the
 * change was made on the device, so a set logged offline at 10:00 is dated
 * 10:00. Pure modules (`day`, `schedule`) still take `now` as an argument.
 */
import { replaying } from './replay-context';

export function serverNow(): number {
	return replaying()?.madeAt ?? Date.now();
}
