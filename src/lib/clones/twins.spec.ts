import { describe, expect, it } from 'vitest';
import { withLocale } from '$lib/i18n/current';
import type { FigureRow, MoveRow, TeamRef } from '$lib/types';
import {
	foldMoves,
	foldRows,
	foldSections,
	foldSongs,
	twinPickMeta,
	twinRows,
	twinsChip,
	twinUseMeta
} from './twins';

const fig = (id: number, name: string): FigureRow => ({
	id,
	name,
	label: name,
	from: null,
	startCount: null,
	lengthCounts: null,
	recordings: 0,
	hasSection: true,
	hasLesson: true,
	partner: 'partner',
	style: null
});
const move = (id: number, name: string, figures: FigureRow[]): MoveRow => ({ id, name, figures });
const TUE: TeamRef = { id: 1, name: 'Salsa Tuesdays' };
const RUEDA: TeamRef = { id: 2, name: 'Rueda club' };
const ids = (ms: MoveRow[]) => ms.map((m) => [m.name, m.figures.map((f) => f.id)]);

describe('foldMoves (board C7 p3)', () => {
	// u2: Enchufla (Doble 1, Básica 2). Salsa Tuesdays: Enchufla (Básica 11, twin
	// of 2) and Sombrero (12). Rueda club: Enchufla (Doble 21, twin of 1).
	const mine = [move(100, 'Enchufla', [fig(1, 'Doble'), fig(2, 'Básica')])];
	const groups = [
		{
			team: TUE,
			moves: [move(110, 'Enchufla', [fig(11, 'Básica')]), move(111, 'Sombrero', [fig(12, 'Basic')])]
		},
		{ team: RUEDA, moves: [move(120, 'Enchufla', [fig(21, 'Doble')])] }
	];
	const sets = [
		[1, 21],
		[2, 11]
	];

	it('folds the groups’ twins into your move', () => {
		const out = foldMoves(mine, groups, sets);
		expect(out.mine).toHaveLength(1);
		expect(out.mine[0].also).toEqual(['Salsa Tuesdays', 'Rueda club']);
		expect(ids(out.mine)).toEqual([['Enchufla', [1, 2]]]);
		// Salsa Tuesdays keeps only Sombrero; Rueda club has no section left.
		expect(out.groups.map((g) => g.team.name)).toEqual(['Salsa Tuesdays']);
		expect(ids(out.groups[0].moves)).toEqual([['Sombrero', [12]]]);
		expect(out.groups[0].moves[0].also).toEqual([]);
		expect(out.twinOf.get(1)).toEqual([21]);
		expect(out.twinOf.get(2)).toEqual([11]);
		expect(out.twinOf.has(12)).toBe(false);
	});

	it('a group move with one twinned figure and one not keeps its heading with the one left', () => {
		const out = foldMoves(
			mine,
			[{ team: TUE, moves: [move(110, 'Enchufla', [fig(11, 'Básica'), fig(13, 'Triple')])] }],
			[[2, 11]]
		);
		expect(out.mine[0].also).toEqual([]);
		expect(ids(out.groups[0].moves)).toEqual([['Enchufla', [13]]]);
	});

	it('without your member, the first by group name is shown', () => {
		const out = foldMoves(
			[],
			[
				{ team: TUE, moves: [move(110, 'Enchufla', [fig(11, 'Básica')])] },
				{ team: RUEDA, moves: [move(120, 'Enchufla', [fig(21, 'Doble')])] }
			],
			[[11, 21]]
		);
		expect(out.groups.map((g) => g.team.name)).toEqual(['Rueda club']);
		expect(out.groups[0].moves[0].also).toEqual(['Salsa Tuesdays']);
		expect(out.twinOf.get(21)).toEqual([11]);
	});

	it('folds nothing for a set with one member in the list, or no sets', () => {
		expect(foldMoves(mine, groups, [[1, 999]]).twinOf.size).toBe(0);
		const out = foldMoves(mine, groups, []);
		expect(out.groups).toHaveLength(2);
		expect(out.mine[0].also).toEqual([]);
	});

	it('two of your own as twins: one row, a move left empty goes', () => {
		const out = foldMoves(
			[move(100, 'Enchufla', [fig(1, 'Doble')]), move(101, 'Enchufla doble', [fig(3, 'Basic')])],
			[],
			[[1, 3]]
		);
		expect(ids(out.mine)).toEqual([['Enchufla', [1]]]);
		expect(out.twinOf.get(1)).toEqual([3]);
	});
});

describe('twinRows (pickers)', () => {
	const rows = [
		{ id: 1, label: 'Enchufla · Doble' },
		{ id: 11, label: 'Enchufla · Básica', team: TUE },
		{ id: 21, label: 'Enchufla · Doble', team: RUEDA },
		{ id: 2, label: 'Enchufla · Básica' },
		{ id: 5, label: 'Setenta · Basic' }
	];
	it('one row per set: yours when you have one, else the first by group name', () => {
		const out = twinRows(
			rows,
			[
				[1, 21],
				[11, 2]
			],
			new Set([1, 2, 5])
		);
		expect(out.map((r) => [r.id, r.twins])).toEqual([
			[1, [21]],
			[2, [11]],
			[5, []]
		]);
		const theirs = twinRows(rows, [[11, 21]], new Set([1, 2, 5]));
		expect(theirs.map((r) => r.id)).toEqual([1, 21, 2, 5]);
		expect(theirs.find((r) => r.id === 21)!.twins).toEqual([11]);
	});

	it('no sets: the rows as they are, with no twins', () => {
		expect(twinRows(rows, [], new Set()).every((r) => r.twins.length === 0)).toBe(true);
	});
});

describe('the twin meta', () => {
	it('names who is used', () => {
		expect(twinUseMeta(['Salsa Tuesdays’ Básica'], true)).toBe(
			'Yours, twin of Salsa Tuesdays’ Básica · yours is used'
		);
		expect(twinUseMeta(['Salsa Tuesdays', 'Rueda club’s Doble'], false)).toBe(
			'Salsa Tuesdays’, twin of Rueda club’s Doble · Salsa Tuesdays’ is used'
		);
	});

	it('is built from the rows behind', () => {
		expect(
			twinPickMeta({ figure: 'Enchufla' }, [
				{ id: 11, figure: 'Enchufla', name: 'Básica', team: TUE }
			])
		).toBe('Yours, twin of Salsa Tuesdays’ Básica · yours is used');
		expect(
			twinPickMeta({ figure: 'Enchufla', team: TUE }, [
				{ id: 21, figure: 'Enchufla', name: 'Doble', team: RUEDA }
			])
		).toBe('Salsa Tuesdays’, twin of Rueda club’s Doble · Salsa Tuesdays’ is used');
		expect(
			twinPickMeta({ figure: 'Enchufla' }, [
				{ id: 3, figure: 'Setenta', name: 'Basic', team: null }
			])
		).toBe('Yours, twin of your Setenta · Basic · yours is used');
	});

	it('in Slovenian: no possessive, each place after a colon', () => {
		const sl = <T>(fn: () => T): T => withLocale('sl', fn);
		expect(sl(twinsChip)).toBe('Dvojčka');
		expect(twinsChip()).toBe('Twins');
		expect(
			sl(() =>
				twinPickMeta({ figure: 'Enchufla' }, [
					{ id: 11, figure: 'Enchufla', name: 'Básica', team: TUE }
				])
			)
		).toBe('Vaša · enaka kot: Básica (skupina: Salsa Tuesdays) · uporablja se vaša');
		expect(
			sl(() =>
				twinPickMeta({ figure: 'Enchufla', team: TUE }, [
					{ id: 21, figure: 'Enchufla', name: 'Doble', team: RUEDA }
				])
			)
		).toBe('Skupina: Salsa Tuesdays · enaka kot: Doble (skupina: Rueda club) · uporablja se ta');
		expect(
			sl(() =>
				twinPickMeta({ figure: 'Enchufla' }, [
					{ id: 3, figure: 'Setenta', name: 'Basic', team: null }
				])
			)
		).toBe('Vaša · enaka kot: Setenta · Basic (vaša) · uporablja se vaša');
	});
});

describe('foldRows and foldSections (routines, lessons, songs)', () => {
	const row = (id: number, team?: TeamRef) => ({ id, team: team ?? null });

	it('foldRows is the flat-list fold: yours is shown, the rest sit behind it', () => {
		const rows = [row(11, TUE), row(1), row(21, RUEDA), row(5)];
		const out = foldRows(rows, [[1, 11, 21]], new Set([1, 5]));
		expect(out.map((r) => [r.id, r.twins])).toEqual([
			[1, [11, 21]],
			[5, []]
		]);
	});

	it('foldRows with none of your own shows the first group by name', () => {
		const out = foldRows([row(21, RUEDA), row(11, TUE)], [[11, 21]], new Set());
		expect(out.map((r) => [r.id, r.twins])).toEqual([[21, [11]]]);
	});

	it('foldRows folds nothing for a set with one member in the list', () => {
		const out = foldRows([row(1), row(2)], [[1, 99]], new Set([1, 2]));
		expect(out.map((r) => r.twins)).toEqual([[], []]);
	});

	it('foldSections folds across your list and the groups, dropping a group left empty', () => {
		const out = foldSections(
			[row(1), row(2)],
			[
				{ team: TUE, rows: [row(11), row(12)] },
				{ team: RUEDA, rows: [row(21)] }
			],
			[
				[1, 11],
				[21, 12]
			]
		);
		expect(out.mine.map((r) => r.id)).toEqual([1, 2]);
		// 21 and 12 are both groups' members: the first by group name (Rueda club) is shown.
		expect(out.groups.map((g) => [g.team.name, g.rows.map((r) => r.id)])).toEqual([
			['Rueda club', [21]]
		]);
		expect([...out.twinOf]).toEqual([
			[1, [11]],
			[21, [12]]
		]);
	});

	it('foldSongs: your twin still downloading never hides the class’s ready one', () => {
		const song = (id: number, status: string) => ({ id, status });
		const out = foldSongs(
			[song(1, 'waiting_download'), song(2, 'ready')],
			[{ team: TUE, rows: [song(11, 'ready'), song(12, 'ready')] }],
			[
				[1, 11],
				[2, 12]
			]
		);
		// 1 sits under "Being added" as itself; 11 stays in its group, unfolded.
		expect(out.mine.map((r) => r.id)).toEqual([1, 2]);
		expect(out.groups.map((g) => g.rows.map((r) => r.id))).toEqual([[11]]);
		expect([...out.twinOf]).toEqual([[2, [12]]]);
	});

	it('foldSongs folds a set once your twin is ready', () => {
		const song = (id: number, status: string) => ({ id, status });
		const out = foldSongs(
			[song(1, 'ready')],
			[{ team: TUE, rows: [song(11, 'ready')] }],
			[[1, 11]]
		);
		expect(out.mine.map((r) => r.id)).toEqual([1]);
		expect(out.groups).toEqual([]);
		expect([...out.twinOf]).toEqual([[1, [11]]]);
	});
});

describe('twinPickMeta for rows with no move above them', () => {
	it('names a routine twin by its place and name alone', () => {
		const note = { id: 11, figure: null, name: 'Warmup', team: TUE };
		expect(twinPickMeta({ figure: null, team: null }, [note])).toBe(
			'Yours, twin of Salsa Tuesdays’ Warmup · yours is used'
		);
	});
});
