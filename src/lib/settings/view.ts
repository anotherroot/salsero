/**
 * What the Settings screen decides before it posts. PURE and client-safe.
 */
import { daysBetween, localDay, timeOfDay } from '$lib/day/day';
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

/** The website's version line in Settings → About: `Version 1805`. */
export function siteVersionLabel(version: number): string {
	return t().settings.about.version(String(version));
}

/**
 * The installed Android app's version: `Version 1.9 (10)` when it is the current
 * release (the only one whose name the server knows), else `Version 8`.
 */
export function appVersionLabel(
	installed: number,
	latest: { versionCode: number; versionName: string } | null
): string {
	const name =
		latest && latest.versionCode === installed
			? `${latest.versionName} (${installed})`
			: String(installed);
	return t().settings.about.version(name);
}

/**
 * When a build came out, in the person's zone: `Published 10 Nov 2026, 19:26`,
 * or the day alone (`withTime` false: the app, released once a day at most).
 */
export function publishedLine(at: number, timeZone: string, withTime: boolean): string {
	const day = dateLabel(localDay(at, timeZone));
	return t().settings.about.published(withTime ? `${day}, ${timeOfDay(at, timeZone)}` : day);
}
