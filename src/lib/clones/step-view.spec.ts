import { describe, expect, it } from 'vitest';
import { DEFAULT_SYNC } from './sync';
import {
	KEEP_OPTIONS,
	addBox,
	changeText,
	changedBy,
	holdersLine,
	keepLine,
	noticeLine,
	notesOnLoad,
	nothingNew,
	pullable,
	partFrom,
	shortText,
	openKeys,
	postPicks,
	sheetRows,
	removeBox,
	removeChoice,
	staysLine,
	syncButton,
	syncSub,
	updateSub
} from './step-view';
import type { MergeRow, StepLine, SyncView } from '$lib/types';
import type { SheetRow } from './step-view';

const line = (l: Partial<StepLine>): StepLine => ({
	id: 2,
	place: 'Sreda 17:30',
	state: 'behind',
	fields: [],
	...l
});

describe('noticeLine', () => {
	it('says each state the way the picked mockup does', () => {
		expect(
			noticeLine(line({ place: 'Intenziuci poletje 2026', state: 'changed', fields: ['Timing'] }))
		).toBe('Intenziuci poletje 2026 changed timing');
		expect(noticeLine(line({ fields: ['Notes', '1 recording'] }))).toBe(
			'Sreda 17:30 is behind yours: notes, 1 recording'
		);
		expect(noticeLine(line({ state: 'both', fields: ['Notes'] }))).toBe(
			'You and Sreda 17:30 both changed notes'
		);
		expect(noticeLine(line({ state: 'held', how: 'removed', fields: ['1 recording'] }))).toBe(
			'Sreda 17:30 removed a recording'
		);
		expect(noticeLine(line({ state: 'held', how: 'added', fields: ['2 sections'] }))).toBe(
			'Sreda 17:30 added 2 sections'
		);
	});

	it('on a club’s page: your own copy is “your copy”, and the page is “this one”', () => {
		expect(noticeLine(line({ place: 'Yours', fields: ['Notes'] }), false)).toBe(
			'Your copy is behind this one: notes'
		);
		expect(noticeLine(line({ fields: ['Notes'] }), false)).toBe(
			'Sreda 17:30 is behind this one: notes'
		);
		expect(noticeLine(line({ place: 'Yours', state: 'changed', fields: ['Timing'] }), false)).toBe(
			'Your copy changed timing'
		);
		expect(noticeLine(line({ place: 'Yours', state: 'both', fields: ['Notes'] }), false)).toBe(
			'This copy and yours both changed notes'
		);
		expect(noticeLine(line({ state: 'both', fields: ['Notes'] }), false)).toBe(
			'This copy and Sreda 17:30 both changed notes'
		);
	});
});

describe('keepLine', () => {
	it('names the options that are on, or says it is off', () => {
		expect(keepLine(DEFAULT_SYNC)).toBe('Keeps in step · names, small removals');
		expect(keepLine({ ...DEFAULT_SYNC, on: false })).toBe('Not kept in step');
		expect(keepLine({ on: true, names: false, small: false, sections: true, media: true })).toBe(
			'Keeps in step · sections and points, recordings and videos'
		);
		expect(keepLine({ on: true, names: false, small: false, sections: false, media: false })).toBe(
			'Keeps in step'
		);
	});

	it('the four options, in the level’s order, with their metas', () => {
		expect(KEEP_OPTIONS.map((o) => [o.key, o.label, o.meta])).toEqual([
			['names', 'Names', null],
			['small', 'Small removals', 'Links, positions, songs'],
			['sections', 'Sections and points', 'Adding or removing them'],
			['media', 'Recordings and videos', 'A removal from yours can’t be undone']
		]);
	});
});

describe('the Sync sheet’s words', () => {
	it('the button counts the ticked copies', () => {
		expect(syncButton(3)).toBe('Sync 3 copies');
		expect(syncButton(1)).toBe('Sync 1 copy');
	});

	it('the subtitle', () => {
		expect(syncSub(3, 3)).toBe('3 differences across 3 copies');
		expect(syncSub(1, 2)).toBe('1 difference across 2 copies');
	});

	it('a tile names its holders; a label who changed it', () => {
		expect(holdersLine(['Yours', 'Sreda 17:30'])).toBe('Yours · Sreda 17:30');
		expect(changedBy(['Intenziuci poletje 2026'], 'field')).toBe(
			'Intenziuci poletje 2026 changed it'
		);
		expect(changedBy(['Yours'], 'field')).toBe('you changed it');
		expect(changedBy(['Yours'], 'add')).toBe('you added it');
		expect(changedBy(['Sreda 17:30'], 'remove')).toBe('Sreda 17:30 removed it');
		expect(changedBy(['Yours', 'Sreda 17:30'], 'field')).toBe(
			'you and Sreda 17:30 both changed it'
		);
		expect(changedBy([], 'field')).toBeNull();
	});

	it('an absent value is a removal, never a plain value', () => {
		expect(removeChoice(['Intenziuci poletje 2026', 'Sreda 17:30'])).toBe(
			'Remove from Intenziuci poletje 2026 and Sreda 17:30'
		);
		expect(removeChoice(['Yours'])).toBe('Remove from yours');
	});

	it('the boxes for a piece one copy added or removed', () => {
		expect(addBox(['Intenziuci poletje 2026', 'Sreda 17:30'])).toBe(
			'Add to Intenziuci poletje 2026 and Sreda 17:30 too'
		);
		expect(addBox(['Yours', 'A', 'B'])).toBe('Add to yours, A and B too');
		expect(removeBox(['Yours'])).toBe('Remove from yours too');
	});
});

describe('Update mine’s words', () => {
	it('a change as the mockup reads it', () => {
		expect(changeText('Starts on 1 · 8 counts', 'Starts on 1 · 16 counts')).toBe('8 → 16 counts');
		expect(
			changeText(
				'…line up to them on the other side.',
				'…line up to them on the other side. Lead with the frame, not the arm.'
			)
		).toBe('added “Lead with the frame, not the arm.”');
		expect(changeText(null, 'Hips first')).toBe('added “Hips first”');
		expect(changeText('Hips first', null)).toBe('removed');
		expect(changeText('Leader', 'Follower')).toBe('Leader → Follower');
	});

	it('a long value is cut short', () => {
		const long = 'x'.repeat(100);
		expect(changeText('a', long)).toBe(`a → ${'x'.repeat(39)}…`);
	});

	it('the subtitle and what stays', () => {
		expect(updateSub(2)).toBe('The club changed 2 things since you took it');
		expect(updateSub(1)).toBe('The club changed 1 thing since you took it');
		expect(staysLine(['Partner'])).toBe('Your own change to the partner stays.');
		expect(staysLine(['Notes', '1 recording'])).toBe(
			'Your own changes to the notes and 1 recording stay.'
		);
	});
});

describe('sheetRows', () => {
	const f = (key: string, show: string, label = 'Timing') => ({ key, label, value: show, show });
	const view = (rows: MergeRow[], mode: 'sync' | 'update' = 'sync'): SyncView => ({
		title: 'Sync Corner step · Basic',
		rows,
		targets:
			mode === 'sync'
				? [
						{ id: 1, label: 'Yours', role: 'this one', seen: 'a', ticked: true },
						{ id: 2, label: 'Intenziuci poletje 2026', role: 'owner', seen: 'b', ticked: true }
					]
				: [{ id: 1, label: 'Yours', role: 'this one', seen: 'a', ticked: true }],
		mode,
		members: [
			{ id: 1, label: 'Yours', seen: 'a' },
			{ id: 2, label: 'Intenziuci poletje 2026', seen: 'b' },
			{ id: 3, label: 'Sreda 17:30', seen: 'c' }
		]
	});
	const TIMING: MergeRow = {
		key: 'timing',
		label: 'Timing',
		kind: 'field',
		pick: 'h16',
		values: [
			{ hash: 'h8', field: f('timing', 'Starts on 1 · 8 counts'), holders: [1, 3], changed: false },
			{ hash: 'h16', field: f('timing', 'Starts on 1 · 16 counts'), holders: [2], changed: true }
		]
	};
	const REC: MergeRow = {
		key: 'rec:g1',
		label: 'Recording · 7 Nov',
		kind: 'add',
		pick: 'hr',
		values: [
			{ hash: 'hr', field: f('rec:g1', '7 Nov', 'Recording · 7 Nov'), holders: [1], changed: true },
			{ hash: null, field: null, holders: [2, 3], changed: false }
		]
	};
	const SECTION: MergeRow = {
		key: 'spot:g2',
		label: 'Section · Turn',
		kind: 'field',
		pick: undefined,
		values: [
			{
				hash: 'a',
				field: f('spot:g2', 'Turn 0:10', 'Section · Turn'),
				holders: [1],
				changed: true
			},
			{
				hash: 'b',
				field: f('spot:g2', 'Turn 0:12', 'Section · Turn'),
				holders: [2],
				changed: true
			},
			{ hash: null, field: null, holders: [3], changed: false }
		]
	};

	it('a field row: a tile per value, its holders named, who changed it', () => {
		const [r] = sheetRows(view([TIMING]));
		expect(r).toMatchObject({
			kind: 'pick',
			key: 'timing',
			label: 'Timing',
			by: 'Intenziuci poletje 2026 changed it',
			tiles: [
				{ hash: 'h8', who: 'Yours · Sreda 17:30', text: 'Starts on 1 · 8 counts', absent: false },
				{
					hash: 'h16',
					who: 'Intenziuci poletje 2026',
					text: 'Starts on 1 · 16 counts',
					absent: false
				}
			]
		});
	});

	it('an open row with an absent value words it as a removal', () => {
		const [r] = sheetRows(view([SECTION]));
		expect(r.kind === 'pick' && r.tiles.at(-1)).toEqual({
			hash: null,
			who: 'Sreda 17:30',
			text: 'Remove from yours and Intenziuci poletje 2026',
			full: 'Remove from yours and Intenziuci poletje 2026',
			absent: true
		});
		expect(r).toMatchObject({ by: 'you and Intenziuci poletje 2026 both changed it' });
	});

	it('an add row is a box: ticked lands the piece, unticked lands nothing', () => {
		const [r] = sheetRows(view([REC]));
		expect(r).toEqual({
			kind: 'box',
			key: 'rec:g1',
			label: 'Recording · 7 Nov',
			by: 'you added it',
			text: 'Add to Intenziuci poletje 2026 and Sreda 17:30 too',
			on: 'hr',
			off: null
		});
		const gone: MergeRow = {
			...REC,
			kind: 'remove',
			pick: 'hr',
			values: [
				{ ...REC.values[0], changed: false, holders: [1, 3] },
				{ ...REC.values[1], changed: true, holders: [2] }
			]
		};
		expect(sheetRows(view([gone]))[0]).toMatchObject({
			kind: 'box',
			by: 'Intenziuci poletje 2026 removed it',
			text: 'Remove from yours and Sreda 17:30 too',
			on: null,
			off: 'hr'
		});
	});

	it('Update mine: a change that lands is a line; the reader’s own change stays', () => {
		const notes: MergeRow = {
			key: 'notes',
			label: 'Notes',
			kind: 'field',
			pick: 'mine',
			values: [
				{ hash: 'mine', field: f('notes', 'Mine', 'Notes'), holders: [1], changed: true },
				{ hash: 'club', field: f('notes', 'Club', 'Notes'), holders: [2, 3], changed: false }
			]
		};
		const timing: MergeRow = {
			...TIMING,
			values: [
				{ ...TIMING.values[0], holders: [1] },
				{ ...TIMING.values[1], holders: [2, 3] }
			]
		};
		expect(sheetRows(view([timing, notes], 'update'))).toEqual([
			{ kind: 'change', key: 'timing', label: 'Timing', text: '8 → 16 counts' },
			{ kind: 'stays', key: 'notes', label: 'Notes' }
		]);
	});

	it('Update mine: an open row is still a pick; a box still a box', () => {
		const rows = sheetRows(view([SECTION, REC], 'update'));
		expect(rows.map((r) => r.kind)).toEqual(['pick', 'box']);
	});

	it('the picks to post: one per row, every row (nothing lands unseen)', () => {
		expect(postPicks([TIMING, REC, SECTION], { 'spot:g2': 'b' })).toEqual({
			timing: 'h16',
			'rec:g1': 'hr',
			'spot:g2': 'b'
		});
		expect(openKeys([TIMING, REC, SECTION], {})).toEqual(['spot:g2']);
		expect(openKeys([TIMING, REC, SECTION], { 'spot:g2': null })).toEqual([]);
	});
});

describe('tilesFrom: long values that share their start', () => {
	it('show from the line where they part, the whole a tap away', () => {
		const head = 'Hold back of hand with top two fingers.\n2 breath in\n3 left step back\n';
		const a = `${head}4 line up to them on the other side`;
		const b = `${head}4 line up to them on the other side. Lead with the frame, not the arm.`;
		expect(partFrom([a, b])).toBe(head.length);
		expect(shortText(a, head.length)).toBe('…4 line up to them on the other side');
	});

	it('values that part early, or are short, show whole', () => {
		expect(partFrom(['Starts on 1 · 8 counts', 'Starts on 1 · 16 counts'])).toBe(0);
		expect(partFrom(['x'.repeat(80) + 'a', 'y' + 'x'.repeat(80)])).toBe(0);
		expect(partFrom(['only one'])).toBe(0);
	});

	it('a long shared line with no break before the parting cuts at a word', () => {
		const shared = 'word '.repeat(20);
		const at = partFrom([`${shared}one`, `${shared}two`]);
		expect(at).toBeGreaterThan(0);
		expect(shortText(`${shared}one`, at)).toMatch(/^…(word )+one$/);
	});
});

describe('Update mine with nothing to pull', () => {
	it('says so, and nothing is pullable when only the reader’s own change differs', () => {
		expect(nothingNew('Sreda 17:30')).toBe('Nothing new from Sreda 17:30');
		expect(pullable([{ kind: 'stays', key: 'notes', label: 'Notes' }])).toBe(false);
		expect(pullable([])).toBe(false);
		expect(pullable([{ kind: 'change', key: 'timing', label: 'Timing', text: '8 → 16' }])).toBe(
			true
		);
		const box = { kind: 'box', key: 'k', label: 'L', by: null, text: 't', on: 'h', off: null };
		expect(pullable([box as SheetRow])).toBe(true);
	});
});

describe('notesOnLoad: what the sheet still says when it loads again', () => {
	const after = {
		refused: 'Changed since you opened Sync.',
		stale: true,
		missed: ['Sreda 17:30: no room']
	};
	it('a fresh open says nothing', () => {
		expect(notesOnLoad(after, 'open')).toEqual({ refused: null, stale: false, missed: [] });
	});
	it('Load again clears the refusal it answered', () => {
		expect(notesOnLoad(after, 'again')).toEqual({ refused: null, stale: false, missed: [] });
	});
	it('the reload after a partial Sync keeps the copies it did not land on', () => {
		expect(notesOnLoad({ ...after, refused: null, stale: false }, 'after-sync')).toEqual({
			refused: null,
			stale: false,
			missed: ['Sreda 17:30: no room']
		});
	});
});
