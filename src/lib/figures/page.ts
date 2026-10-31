/**
 * What a figure's page derives for display. PURE and client-safe.
 */
import { frequencyLabel } from '$lib/frequency';
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
