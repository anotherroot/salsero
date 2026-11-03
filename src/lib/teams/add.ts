/** What the Add sheet and "1 new drill · Add" say. PURE and client-safe. */
import { plural } from '$lib/format';
import type { IconName } from '$lib/icons/icons';
import type { AddItem, AddOffer } from '$lib/types';

/** "1 video · 6 sections · 5 figures · 1 routine · 2 drills": what the lesson holds, zeros left out. */
export function holdsLine(counts: AddOffer['counts']): string {
	const parts = [
		[counts.videos, 'video', 'videos'],
		[counts.sections, 'section', 'sections'],
		[counts.figures, 'figure', 'figures'],
		[counts.routines, 'routine', 'routines'],
		[counts.drills, 'drill', 'drills']
	] as const;
	const said = parts.filter(([n]) => n > 0).map(([n, one, many]) => plural(n, one, many));
	return said.length > 0 ? said.join(' · ') : 'Nothing in it yet';
}

/** The sheet's two sections: what goes on Today (ticked), and the figures (unticked). */
export function addSections(items: AddItem[]): { today: AddItem[]; figures: AddItem[] } {
	return {
		today: items.filter((i) => i.kind !== 'figure'),
		figures: items.filter((i) => i.kind === 'figure')
	};
}

export const FIGURES_CAPTION =
	'Unticked figures still show in your Moves, under the group. Costs none of your space.';

/** "1 new drill", "2 new drills", "1 new routine · 2 new drills": what came into an added lesson. */
export function newLine(items: AddItem[]): string {
	const routines = items.filter((i) => i.kind === 'routine').length;
	const drills = items.filter((i) => i.kind === 'drill').length;
	const parts: string[] = [];
	if (routines > 0) parts.push(`${routines} new ${routines === 1 ? 'routine' : 'routines'}`);
	if (drills > 0) parts.push(`${drills} new ${drills === 1 ? 'drill' : 'drills'}`);
	return parts.join(' · ');
}

/** The tile an Add sheet row wears, as Today's row of the same kind does. */
export function addItemIcon(kind: AddItem['kind']): IconName {
	return kind === 'lesson'
		? 'lessons'
		: kind === 'routine'
			? 'route'
			: kind === 'figure'
				? 'people'
				: 'metronome';
}

/** What a row's kind is called, under its name. */
export function addItemKind(kind: AddItem['kind']): string {
	return kind === 'lesson'
		? 'Lesson review'
		: kind === 'routine'
			? 'Routine'
			: kind === 'figure'
				? 'Figure'
				: 'Drill';
}
