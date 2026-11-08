/** Coming up's group headings. PURE. */
import { classDayLabel } from '$lib/format';
import { t } from '$lib/i18n/catalog';
import type { ComingGroup } from './coming-up';

/** "Sun 8 Nov" (with the year when it is not this year) and "in 3 days"; "Next in line" and "Paused" have neither. */
export function comingHeading(
	group: Pick<ComingGroup<unknown>, 'key' | 'day' | 'away'>,
	today: string
): { title: string; away: string | null } {
	const w = t().today.coming;
	if (group.day === null)
		return { title: group.key === 'paused' ? w.paused : w.waiting, away: null };
	// "Sun 8 Nov" ("ned, 8. nov."): a day label, as a class's day is written.
	return { title: classDayLabel(group.day, today), away: group.away };
}
