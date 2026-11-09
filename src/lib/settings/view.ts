/**
 * What the Settings screen decides before it posts. PURE and client-safe.
 */
import { daysBetween } from '$lib/day/day';
import { dateLabel } from '$lib/format';
import { t } from '$lib/i18n/catalog';

/** The time the reminder starts on when it is switched on with none saved. */
export const DEFAULT_REMINDER = '19:30';

/**
 * What the reminder control posts: `''` turns it off, a valid `HH:MM` sets it,
 * and `null` posts nothing (the time field was cleared while on; the field
 * shows the saved time again).
 */
export function reminderToSave(on: boolean, time: string): string | null {
	if (!on) return '';
	return /^\d{2}:\d{2}$/.test(time) ? time : null;
}

/** `Paired 28 Oct 2026 · last used today`. Days are `YYYY-MM-DD` in the user's zone. */
export function deviceMeta(paired: string, lastUsed: string | null, today: string): string {
	const w = t();
	const base = w.settings.devices.paired(dateLabel(paired));
	if (lastUsed === null) return base;
	const ago = daysBetween(lastUsed, today);
	const when = ago <= 0 ? w.format.today : ago === 1 ? w.format.yesterday : dateLabel(lastUsed);
	return w.settings.devices.lastUsed(base, when);
}

/** A connected AI app's line in Settings: when it was connected, and when it was last used. */
export function appMeta(connected: string, lastUsed: string | null, today: string): string {
	const w = t();
	const base = w.settings.connector.apps.connected(dateLabel(connected));
	if (lastUsed === null) return base;
	const ago = daysBetween(lastUsed, today);
	const when = ago <= 0 ? w.format.today : ago === 1 ? w.format.yesterday : dateLabel(lastUsed);
	return w.settings.connector.apps.lastUsed(base, when);
}
