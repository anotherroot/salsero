/**
 * What Today shows. PURE, client-safe: the bands in order, each row's meta
 * line, the tile's tone, the hero's state and a past day's groups.
 *
 * Done today sits after Not yet due (it used to come first): what the session
 * walks comes first, and what is already finished is the quietest news.
 */
import { frequencyLabel } from '$lib/frequency';
import { lastDoneLabel, plural } from '$lib/format';
import type { DaySet, ExerciseItem } from '$lib/types';
import type { Plan, PlanRow } from '$lib/urgency/urgency';

export type BandKey = 'due' | 'upcoming' | 'doneToday' | 'inactive';

const BAND_LABEL: Record<BandKey, string> = {
	due: 'Due',
	upcoming: 'Not yet due',
	doneToday: 'Done today',
	inactive: 'Inactive'
};
const ORDER: BandKey[] = ['due', 'upcoming', 'doneToday', 'inactive'];

export function todayBands<R>(plan: Record<BandKey, R[]>): {
	key: BandKey;
	label: string;
	rows: R[];
}[] {
	return ORDER.filter((key) => plan[key].length > 0).map((key) => ({
		key,
		label: `${BAND_LABEL[key]} · ${plan[key].length}`,
		rows: plan[key]
	}));
}

export type MetaPart = { text: string; tone: 'status' | 'done' | null };

export function rowMeta(
	row: PlanRow<ExerciseItem>,
	band: BandKey,
	lessonDay: string | null
): MetaPart[] {
	if (band === 'doneToday') {
		const n = row.setsToday;
		return [
			{ text: `${n} ${n === 1 ? 'set' : 'sets'} today`, tone: 'done' },
			{
				text: lessonDay ? `${lessonDay} class` : frequencyLabel(row.exercise.everyDays),
				tone: null
			}
		];
	}
	const last: MetaPart = {
		text: lastDoneLabel(row.lastDoneDaysAgo),
		tone: band === 'due' ? 'status' : null
	};
	if (lessonDay) return [{ text: `${lessonDay} class`, tone: null }, last];
	return [last, { text: frequencyLabel(row.exercise.everyDays), tone: null }];
}

export type TileTone = 'accent' | 'quiet' | 'done';

export function tileTone(band: BandKey, upNext: boolean): TileTone {
	if (band === 'doneToday') return 'done';
	return band === 'due' || upNext ? 'accent' : 'quiet';
}

export type Hero = {
	kind: 'start' | 'resume' | 'idle' | 'done';
	title: string;
	meta: string;
} | null;

export function heroFor(
	plan: Plan<ExerciseItem>,
	session: { on: boolean; next: string | null; logged: number }
): Hero {
	const due = plan.due.length;
	const upcoming = plan.upcoming.length;
	const done = plan.doneToday.length;
	const inactive = plan.inactive.length;
	if (due + upcoming + done + inactive === 0) return null;

	if (session.on && session.next !== null) {
		return {
			kind: 'resume',
			title: 'Resume session',
			meta: `Next: ${session.next}${session.logged > 0 ? ` · ${session.logged} logged` : ''}`
		};
	}
	if (due + upcoming > 0) {
		const parts: string[] = [];
		if (due > 0) parts.push(`${due} due`);
		if (upcoming > 0) parts.push(`${upcoming} not yet due`);
		return { kind: 'start', title: 'Start session', meta: parts.join(' · ') };
	}
	if (done > 0) {
		const sets = plan.doneToday.reduce((n, r) => n + r.setsToday, 0);
		return {
			kind: 'done',
			title: 'All done for today',
			meta: `${plural(done, 'exercise', 'exercises')} · ${plural(sets, 'set', 'sets')}`
		};
	}
	return {
		kind: 'idle',
		title: 'Start session',
		meta: `No active exercises · ${inactive} inactive`
	};
}

/** A past day's sets, grouped by exercise in the order they were first done. */
export function pastGroups(
	daySets: DaySet[]
): { exerciseId: number; name: string; sets: DaySet[] }[] {
	const groups: { exerciseId: number; name: string; sets: DaySet[] }[] = [];
	for (const s of [...daySets].reverse()) {
		let g = groups.find((x) => x.exerciseId === s.exerciseId);
		if (!g) groups.push((g = { exerciseId: s.exerciseId, name: s.exerciseName, sets: [] }));
		g.sets.push(s);
	}
	return groups;
}
