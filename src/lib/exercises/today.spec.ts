import { describe, expect, it } from 'vitest';
import type { Plan, PlanRow } from '$lib/urgency/urgency';
import type { DaySet, ExerciseItem } from '$lib/types';
import {
	deletedGroupName,
	heroFor,
	pastGroups,
	rowMeta,
	shownRows,
	teamOfRow,
	tileTone,
	todayBands
} from './today';
import { nextInSession } from './session';

function row(
	id: number,
	name: string,
	o: Partial<PlanRow<ExerciseItem>> & { everyDays?: number; source?: ExerciseItem['source'] } = {}
): PlanRow<ExerciseItem> {
	const { everyDays = 3, source = 'custom', ...rest } = o;
	return {
		exercise: {
			id,
			name,
			source,
			figureId: null,
			lessonId: null,
			routineId: null,
			partner: null,
			practiceMode: 'none',
			songId: null,
			countBpm: null,
			practiceJson: null,
			everyDays,
			active: true,
			archived: false,
			notes: null,
			createdAt: 0,
			team: null
		} as ExerciseItem,
		urgency: null,
		overdue: false,
		lastDoneAt: null,
		lastDoneDaysAgo: null,
		setsToday: 0,
		...rest
	};
}

const many = (n: number, o: Parameters<typeof row>[2] = {}) =>
	Array.from({ length: n }, (_, i) => row(i + 1, `E${i + 1}`, o));

function p(o: {
	due?: number;
	upcoming?: number;
	inactive?: number;
	done?: number[];
}): Plan<ExerciseItem> {
	return {
		due: many(o.due ?? 0),
		upcoming: many(o.upcoming ?? 0),
		inactive: many(o.inactive ?? 0),
		doneToday: (o.done ?? []).map((n, i) => row(i + 1, `D${i + 1}`, { setsToday: n }))
	};
}

describe('todayBands', () => {
	it('orders Due, Not yet due, Done today, Inactive and drops empty bands', () => {
		const [a, d1, d2, i1] = many(4);
		const b = todayBands({ doneToday: [d1, d2], due: [a], upcoming: [], inactive: [i1] });
		expect(b.map((x) => x.key)).toEqual(['due', 'doneToday', 'inactive']);
		expect(b.map((x) => x.label)).toEqual(['Due · 1', 'Done today · 2', 'Inactive · 1']);
	});
	it('puts Not yet due before Done today', () => {
		const [a, b] = many(2);
		const r = todayBands({ doneToday: [a], due: [], upcoming: [b], inactive: [] });
		expect(r.map((x) => x.label)).toEqual(['Not yet due · 1', 'Done today · 1']);
	});

	describe('with group rows', () => {
		const salsa = { id: 2, name: 'Salsa nadaljevalna' };
		const bachata = { id: 1, name: 'Bachata team' };
		const inTeam = (r: ReturnType<typeof row>, team: typeof salsa) => ({
			...r,
			exercise: { ...r.exercise, team }
		});
		// The plan's own order mixes them; urgency knows nothing of groups.
		const g1 = inTeam(row(1, 'Group drill'), salsa);
		const own1 = row(2, 'Mine');
		const g2 = inTeam(row(3, 'Other group'), bachata);
		const g3 = inTeam(row(4, 'Group routine'), salsa);
		const own2 = row(5, 'Also mine');
		const due = [g1, own1, g2, g3, own2];

		// Catches: group rows mixed in with the person's own, or groups in id order.
		it('gives each band its own rows first, then a part per group by name', () => {
			const [b] = todayBands({ due, upcoming: [], doneToday: [], inactive: [] }, teamOfRow);
			expect(b.label).toBe('Due · 5');
			expect(b.own.map((r) => r.exercise.id)).toEqual([2, 5]);
			expect(b.teams.map((t) => t.label)).toEqual(['Bachata team · 1', 'Salsa nadaljevalna · 2']);
			expect(b.teams[1].rows.map((r) => r.exercise.id)).toEqual([1, 4]);
			expect(b.rows.map((r) => r.exercise.id)).toEqual([2, 5, 3, 1, 4]);
		});

		// Catches: the session walking the plan's order instead of what is on screen.
		it('lets the session walk the rows in the order shown', () => {
			const bands = todayBands(
				{ due, upcoming: [row(6, 'Later')], doneToday: [], inactive: [] },
				teamOfRow
			);
			const walk: number[] = [];
			let current: number | null = null;
			const skipped = new Set<number>();
			for (;;) {
				const next: PlanRow<ExerciseItem> | null = nextInSession(
					shownRows(bands, 'due'),
					shownRows(bands, 'upcoming'),
					skipped,
					current
				);
				if (!next) break;
				walk.push(next.exercise.id);
				skipped.add(next.exercise.id);
				current = next.exercise.id;
			}
			expect(walk).toEqual([2, 5, 3, 1, 4, 6]);
		});
	});
});

describe('rowMeta', () => {
	it('never done, due', () => {
		expect(rowMeta(row(1, 'a'), 'due', null)).toEqual([
			{ text: 'Never done', tone: 'status' },
			{ text: 'Every 3 days', tone: null }
		]);
	});
	it('upcoming', () => {
		expect(rowMeta(row(1, 'a', { lastDoneDaysAgo: 1, everyDays: 7 }), 'upcoming', null)).toEqual([
			{ text: 'Yesterday', tone: null },
			{ text: 'Weekly', tone: null }
		]);
	});
	it('done today', () => {
		expect(rowMeta(row(1, 'a', { setsToday: 1, everyDays: 1 }), 'doneToday', null)).toEqual([
			{ text: '1 set today', tone: 'done' },
			{ text: 'Daily', tone: null }
		]);
		expect(rowMeta(row(1, 'a', { setsToday: 2 }), 'doneToday', null)[0].text).toBe('2 sets today');
	});
	it('lessons show their class day', () => {
		expect(
			rowMeta(row(1, 'a', { source: 'lesson', lastDoneDaysAgo: 1 }), 'upcoming', 'Wed 28 Oct')
		).toEqual([
			{ text: 'Wed 28 Oct class', tone: null },
			{ text: 'Yesterday', tone: null }
		]);
		expect(
			rowMeta(row(1, 'a', { source: 'lesson', setsToday: 1 }), 'doneToday', 'Tue 27 Oct')
		).toEqual([
			{ text: '1 set today', tone: 'done' },
			{ text: 'Tue 27 Oct class', tone: null }
		]);
	});
	it('inactive', () => {
		expect(rowMeta(row(1, 'a', { lastDoneDaysAgo: 12 }), 'inactive', null)[0]).toEqual({
			text: '12 days ago',
			tone: null
		});
	});
});

describe('tileTone', () => {
	it('follows the band, and the up-next row is accent', () => {
		expect(tileTone('due', false)).toBe('accent');
		expect(tileTone('upcoming', false)).toBe('quiet');
		expect(tileTone('inactive', false)).toBe('quiet');
		expect(tileTone('doneToday', false)).toBe('done');
		expect(tileTone('upcoming', true)).toBe('accent');
	});
});

describe('heroFor', () => {
	const off = { on: false, next: null, logged: 0 };
	it('start', () => {
		expect(heroFor(p({ due: 3, upcoming: 4 }), off)).toEqual({
			kind: 'start',
			title: 'Start session',
			meta: '3 due · 4 not yet due'
		});
		expect(heroFor(p({ upcoming: 4 }), off)?.meta).toBe('4 not yet due');
	});
	it('resume', () => {
		expect(heroFor(p({ due: 2 }), { on: true, next: 'Enchufla · Doble', logged: 2 })).toEqual({
			kind: 'resume',
			title: 'Resume session',
			meta: 'Next: Enchufla · Doble · 2 logged'
		});
		expect(heroFor(p({ due: 2 }), { on: true, next: 'Enchufla · Doble', logged: 0 })?.meta).toBe(
			'Next: Enchufla · Doble'
		);
	});
	it('a session with nothing next starts again', () => {
		expect(heroFor(p({ upcoming: 1 }), { on: true, next: null, logged: 3 })?.kind).toBe('start');
	});
	it('done', () => {
		expect(heroFor(p({ done: [2, 1, 2, 1, 1] }), { on: true, next: null, logged: 5 })).toEqual({
			kind: 'done',
			title: 'All done for today',
			meta: '5 exercises · 7 sets'
		});
		expect(heroFor(p({ done: [1] }), off)?.meta).toBe('1 exercise · 1 set');
	});
	it('idle and empty', () => {
		expect(heroFor(p({ inactive: 3 }), off)).toEqual({
			kind: 'idle',
			title: 'Start session',
			meta: 'No active exercises · 3 inactive'
		});
		expect(heroFor(p({}), off)).toBeNull();
	});
});

describe('pastGroups', () => {
	const set = (id: number, exerciseId: number, t: string): DaySet => ({
		id,
		exerciseId,
		exerciseName: `E${exerciseId}`,
		doneAt: Date.parse(`2026-10-30T${t}:00Z`),
		durationS: null,
		reps: null,
		rating: null,
		note: null
	});
	it('groups by exercise, first done first, oldest set first', () => {
		const g = pastGroups([set(3, 1, '20:10'), set(1, 1, '19:42'), set(2, 2, '18:05')]);
		expect(g.map((x) => x.exerciseId)).toEqual([2, 1]);
		expect(g[1].sets.map((s) => s.id)).toEqual([1, 3]);
	});
});

describe('deletedGroupName', () => {
	// The spec's words: a log keeps its name once its group is purged.
	it('names what was practised and its group, marked deleted', () => {
		expect(deletedGroupName('Tue 3 Nov', 'Salsa nadaljevalna')).toBe(
			'Tue 3 Nov · Salsa nadaljevalna (deleted)'
		);
	});
});
