/**
 * A time of day as a minute count, the way `users.reminder_minute` stores it.
 * Client-safe. No dates and no zones: the reminder fires at this wall-clock
 * time wherever the phone is.
 */

/** `HH:MM` (what `<input type="time">` submits) → 0..1439; '' → null; anything else → undefined. */
export function minuteOfDay(value: string): number | null | undefined {
	if (value === '') return null;
	const m = /^(\d{2}):(\d{2})$/.exec(value);
	if (!m) return undefined;
	const [h, min] = [Number(m[1]), Number(m[2])];
	if (h > 23 || min > 59) return undefined;
	return h * 60 + min;
}

/** 0..1439 → `HH:MM`; null → '' (an empty time field). */
export function clockLabel(minute: number | null): string {
	if (minute === null) return '';
	const pad = (n: number) => String(n).padStart(2, '0');
	return `${pad(Math.floor(minute / 60))}:${pad(minute % 60)}`;
}
