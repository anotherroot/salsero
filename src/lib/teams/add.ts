/** What the Add sheet and "1 new drill · Add" say. PURE and client-safe. */
import { t } from '$lib/i18n/catalog';
import type { IconName } from '$lib/icons/icons';
import type { AddItem, AddOffer } from '$lib/types';

/** "1 video · 6 sections · 5 figures · 1 routine · 2 drills": what the lesson holds, zeros left out. */
export function holdsLine(counts: AddOffer['counts']): string {
	const w = t();
	const n = w.nouns;
	const parts = [
		[counts.videos, n.videos],
		[counts.sections, n.sections],
		[counts.figures, n.figures],
		[counts.routines, n.routines],
		[counts.drills, n.drills]
	] as const;
	const said = parts.filter(([k]) => k > 0).map(([k, word]) => word(k));
	return said.length > 0 ? said.join(' · ') : w.groups.add.nothing;
}

/** The sheet's two sections: what goes on Today (ticked), and the figures (unticked). */
export function addSections(items: AddItem[]): { today: AddItem[]; figures: AddItem[] } {
	return {
		today: items.filter((i) => i.kind !== 'figure'),
		figures: items.filter((i) => i.kind === 'figure')
	};
}

export const figuresCaption = (): string => t().groups.add.figuresCaption;

/** "1 new drill", "2 new drills", "1 new routine · 2 new drills": what came into an added lesson. */
export function newLine(items: AddItem[]): string {
	const w = t().groups.add;
	const routines = items.filter((i) => i.kind === 'routine').length;
	const drills = items.filter((i) => i.kind === 'drill').length;
	const parts: string[] = [];
	if (routines > 0) parts.push(w.newRoutines(routines));
	if (drills > 0) parts.push(w.newDrills(drills));
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
	return t().groups.add.kind[kind];
}
