/**
 * What a figure's page derives for display. PURE and client-safe.
 */
import { frequencyLabel } from '$lib/frequency';
import { longDayLabel } from '$lib/format';
import type { MetaPart } from '$lib/exercises/today';
import { plural } from '$lib/moves/plural';
import type { RoutineUse } from '$lib/routines/coverage';
import type { Plan, PlanExercise } from '$lib/urgency/urgency';

/** "Slot 3 of 6", "Slots 2 and 5 of 8", "Slots 1, 4 and 6 of 9". */
export function routineUseMeta(u: Pick<RoutineUse, 'slots' | 'slotCount'>): string {
	const { slots, slotCount } = u;
	if (slots.length === 1) return `Slot ${slots[0]} of ${slotCount}`;
	const head = slots.slice(0, -1).join(', ');
	return `Slots ${head} and ${slots[slots.length - 1]} of ${slotCount}`;
}

/**
 * The one line the figure page shows for its exercise: the frequency and where
 * it stands today. Derived from a Plan, never stored.
 */
export function practiceLine(p: Plan<PlanExercise>): { title: string; meta: MetaPart } | null {
	const done = p.doneToday[0];
	if (done) {
		return {
			title: frequencyLabel(done.exercise.everyDays),
			meta: { text: 'Done today', tone: 'done' }
		};
	}
	const parked = p.inactive[0];
	if (parked) {
		return {
			title: frequencyLabel(parked.exercise.everyDays),
			meta: { text: "Inactive · not on Today's list", tone: null }
		};
	}
	const due = p.due[0];
	if (due) {
		const title = frequencyLabel(due.exercise.everyDays);
		if (due.lastDoneDaysAgo === null)
			return { title, meta: { text: 'Never done', tone: 'status' } };
		const over = due.lastDoneDaysAgo - due.exercise.everyDays;
		const text = over >= 1 ? `${plural(over, 'day', 'days')} overdue` : 'Due today';
		return { title, meta: { text, tone: 'status' } };
	}
	const next = p.upcoming[0];
	if (next) {
		const n = next.lastDoneDaysAgo ?? 0;
		const text = n === 0 ? 'Done today' : n === 1 ? 'Done yesterday' : `Done ${n} days ago`;
		return { title: frequencyLabel(next.exercise.everyDays), meta: { text, tone: null } };
	}
	return null;
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
				button: 'Archive and remove figure',
				caption: `${figure} goes with it: ${variation} is its last variation. ${kept}`
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
		position: `${index + 1} of ${count} ${count === 1 ? 'variation' : 'variations'}`
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
			? 'Move and remove figure'
			: i.chosen
				? `Move to ${i.chosen.name}`
				: 'Make it its own figure',
		danger: i.last,
		clash:
			clashes && i.chosen
				? `${i.chosen.name} already has a ${i.joinName.trim()}. Pick another name.`
				: null,
		blocked: i.chosen !== null && (wanted === '' || clashes)
	};
}
