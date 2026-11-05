/** Coming up's group headings. PURE. */
import { dayMonth, weekdayShort } from '$lib/format';
import type { ComingGroup } from './coming-up';

/** "Sun 8 Nov" (with the year when it is not this year) and "in 3 days"; "Waiting" and "Paused" have neither. */
export function comingHeading(
	group: Pick<ComingGroup<unknown>, 'key' | 'day' | 'away'>,
	today: string
): { title: string; away: string | null } {
	if (group.day === null)
		return { title: group.key === 'paused' ? 'Paused' : 'Waiting', away: null };
	const year = group.day.slice(0, 4) === today.slice(0, 4) ? '' : ` ${group.day.slice(0, 4)}`;
	return { title: `${weekdayShort(group.day)} ${dayMonth(group.day)}${year}`, away: group.away };
}
