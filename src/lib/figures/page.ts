/**
 * What a figure's page derives for display. PURE and client-safe.
 */
import { longDayLabel } from '$lib/format';
import { possessive } from '$lib/clones/view';
import type { MetaPart } from '$lib/exercises/today';
import { isLengthCounts, MAX_LENGTH_COUNTS } from '$lib/graph/timing';
import type { RoutineUse } from '$lib/routines/coverage';
import type { ScheduleState } from '$lib/schedule/schedule';
import { dueWords } from '$lib/schedule/words';

/** "Slot 3 of 6", "Slots 2 and 5 of 8", "Slots 1, 4 and 6 of 9". */
export function routineUseMeta(u: Pick<RoutineUse, 'slots' | 'slotCount'>): string {
	const { slots, slotCount } = u;
	if (slots.length === 1) return `Slot ${slots[0]} of ${slotCount}`;
	const head = slots.slice(0, -1).join(', ');
	return `Slots ${head} and ${slots[slots.length - 1]} of ${slotCount}`;
}

/**
 * The one line the figure page shows for its exercise: where it stands in its
 * schedule ("New", "Done today", "Due Sunday", "2 days late"). Derived from the
 * sets, never stored.
 */
export function practiceLine(
	state: ScheduleState | null,
	today: string,
	neverDone: boolean
): MetaPart | null {
	if (!state) return null;
	if (!neverDone && state.lastDay === today) return { text: 'Done today', tone: 'done' };
	return dueWords(state, today, neverDone)[0];
}

/**
 * The facts card's timing: "Starts on 1 · 16 counts", and in a lighter weight
 * " · 2 eights" (whole eights past one) or " · one 8-count".
 */
export function timingLine(start: number, length: number): { main: string; extra: string } {
	const extra =
		length === 8
			? ' · one 8-count'
			: length % 8 === 0 && length > 8
				? ` · ${length / 8} eights`
				: '';
	return { main: `Starts on ${start} · ${length} counts`, extra };
}

/**
 * The Archive sheet's title and button, and the caption under the page's
 * Archive button. The last variation takes its figure with it.
 */
export function archiveCopy(
	figure: string,
	variation: string,
	last: boolean
): { title: string; button: string; caption: string } {
	const kept = 'Its recordings and practice history are kept.';
	return last
		? {
				title: `Archive ${variation}?`,
				button: 'Archive and remove move',
				caption: `${figure} goes with it: ${variation} is its last figure. ${kept}`
			}
		: {
				title: `Archive ${variation}?`,
				button: `Archive ${variation}`,
				caption: `${variation} leaves ${figure}. ${kept}`
			};
}

/** A recording's day: "Wednesday, 28 October", with ", 2025" when it is not this year. */
export function recordingDay(day: string, today: string): string {
	const year = day.slice(0, 4);
	return year === today.slice(0, 4) ? longDayLabel(day) : `${longDayLabel(day)}, ${year}`;
}

/**
 * Where a variation sits among its siblings: ‹ and › wrap, and with one
 * variation there is nowhere to step. An unknown id counts as the first.
 */
export function variationNav(
	siblings: { id: number }[],
	currentId: number
): { index: number; count: number; prev: number | null; next: number | null; position: string } {
	const count = siblings.length;
	const index = Math.max(
		0,
		siblings.findIndex((s) => s.id === currentId)
	);
	const step = (by: number) => (count > 1 ? siblings[(index + by + count) % count].id : null);
	return {
		index,
		count,
		prev: step(-1),
		next: step(1),
		position: `${index + 1} of ${count} ${count === 1 ? 'figure' : 'figures'}`
	};
}

/**
 * What Move to… shows for the destination typed so far: the button's words, a
 * live name clash (compared trimmed and case-insensitive, as the server does)
 * and whether the button is disabled.
 */
export function moveState(i: {
	last: boolean;
	chosen: { name: string; variations: string[] } | null;
	joinName: string;
}): { cta: string; danger: boolean; clash: string | null; blocked: boolean } {
	const wanted = i.joinName.trim().toLowerCase();
	const clashes =
		i.chosen !== null && i.chosen.variations.some((v) => v.trim().toLowerCase() === wanted);
	return {
		cta: i.last
			? 'Move and remove move'
			: i.chosen
				? `Move to ${i.chosen.name}`
				: 'Make it its own move',
		danger: i.last,
		clash:
			clashes && i.chosen
				? `${i.chosen.name} already has a ${i.joinName.trim()}. Pick another name.`
				: null,
		blocked: i.chosen !== null && (wanted === '' || clashes)
	};
}

/**
 * The Counts field's live check: a whole number from 1 to 64, else the message
 * under the field. It never blocks Save; the server decides.
 */
export function lengthError(value: string): string | null {
	const v = value.trim();
	return /^\d+$/.test(v) && isLengthCounts(Number(v))
		? null
		: `1 to ${MAX_LENGTH_COUNTS} counts. One 8-count is 8.`;
}

/** The delete question's body: which recording, and the saved sections that go with it. */
export function deleteRecordingBody(day: string, size: string, sections: number): string {
	const goes =
		sections === 0
			? ''
			: sections === 1
				? 'Its 1 saved section goes with it. '
				: `Its ${sections} saved sections go with it. `;
	return `${day} · ${size}. ${goes}This can’t be undone.`;
}

/** The figure page's band subtitle: "Figure · starts on 1 · 16 counts", or "Figure". */
export function figureSubtitle(
	f: {
		startCount: number | null;
		lengthCounts: number | null;
	},
	team?: string
): string {
	const lead = team ? `${possessive(team)} figure` : 'Figure';
	if (f.startCount === null || f.lengthCounts === null) return lead;
	return `${lead} · starts on ${f.startCount} · ${f.lengthCounts} counts`;
}
