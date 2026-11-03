/**
 * What Today shows. PURE, client-safe: the bands in order, each row's meta
 * line, the tile's tone, the hero's state and a past day's groups.
 *
 * Done today sits after Not yet due (it used to come first): what the session
 * walks comes first, and what is already finished is the quietest news.
 */
import { frequencyLabel } from '$lib/frequency';
import { lastDoneLabel, plural } from '$lib/format';
import type { DaySet, ExerciseItem, TeamRef } from '$lib/types';
import type { Plan, PlanRow } from '$lib/urgency/urgency';

export type BandKey = 'due' | 'upcoming' | 'doneToday' | 'inactive';

const BAND_LABEL: Record<BandKey, string> = {
	due: 'Due',
	upcoming: 'Not yet due',
	doneToday: 'Done today',
	inactive: 'Inactive'
};
const ORDER: BandKey[] = ['due', 'upcoming', 'doneToday', 'inactive'];

/** A group's rows within a band, under a small heading: "Salsa nadaljevalna · 3". */
export type TeamPart<R> = { team: TeamRef; label: string; rows: R[] };

export type Band<R> = {
	key: BandKey;
	label: string;
	/** Every row in the order shown: the person's own, then each group's. */
	rows: R[];
	own: R[];
	teams: TeamPart<R>[];
};

/**
 * The bands in order, each with the person's own rows first and then a part
 * per group (by the group of the entry's target), groups by name. Within each
 * part the plan's order stands. `rows` is that order flattened, which is the
 * order a session walks.
 */
export function todayBands<R>(
	plan: Record<BandKey, R[]>,
	teamOf: (row: R) => TeamRef | null = () => null
): Band<R>[] {
	return ORDER.filter((key) => plan[key].length > 0).map((key) => {
		const own: R[] = [];
		const parts = new Map<number, TeamPart<R>>();
		for (const row of plan[key]) {
			const team = teamOf(row);
			if (team === null) {
				own.push(row);
				continue;
			}
			let part = parts.get(team.id);
			if (!part) parts.set(team.id, (part = { team, label: '', rows: [] }));
			part.rows.push(row);
		}
		const teams = [...parts.values()]
			.sort((a, b) => a.team.name.localeCompare(b.team.name) || a.team.id - b.team.id)
			.map((t) => ({ ...t, label: `${t.team.name} · ${t.rows.length}` }));
		return {
			key,
			label: `${BAND_LABEL[key]} · ${plan[key].length}`,
			rows: [...own, ...teams.flatMap((t) => t.rows)],
			own,
			teams
		};
	});
}

/** The rows of one band as shown, or none: what the session walks. */
export function shownRows<R>(bands: Band<R>[], key: BandKey): R[] {
	return bands.find((b) => b.key === key)?.rows ?? [];
}

/** An exercise row's group, for `todayBands`. */
export const teamOfRow = (row: { exercise: { team: TeamRef | null } }): TeamRef | null =>
	row.exercise.team;

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

/**
 * A logged exercise's name once its group is purged: "Tue 3 Nov · Salsa
 * nadaljevalna (deleted)". `title` is what the entry practised (a lesson's
 * title, a routine's, a variation's or a drill's name).
 */
export function deletedGroupName(title: string, team: string): string {
	return `${title} · ${team} (deleted)`;
}
