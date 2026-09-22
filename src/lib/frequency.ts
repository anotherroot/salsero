/**
 * Target frequencies an exercise can be given. "Priority" in this app IS
 * frequency: a daily exercise climbs the list seven times faster than a
 * weekly one. See `src/lib/urgency/`.
 */
export const FREQUENCIES = [
	{ days: 1, label: 'Daily' },
	{ days: 2, label: 'Every 2 days' },
	{ days: 3, label: 'Every 3 days' },
	{ days: 7, label: 'Weekly' },
	{ days: 14, label: 'Every 2 weeks' }
] as const;

export const DEFAULT_EVERY_DAYS = 3;

export function frequencyLabel(days: number): string {
	return FREQUENCIES.find((f) => f.days === days)?.label ?? `Every ${days} days`;
}

export function isFrequency(days: number): boolean {
	return FREQUENCIES.some((f) => f.days === days);
}
