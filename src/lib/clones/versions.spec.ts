import { describe, expect, it } from 'vitest';
import { withLocale } from '$lib/i18n/current';
import { versionList, versionRow } from './versions';
import type { FamilyEntry, FamilyView, PlaceRef, Source } from '$lib/types';

const MINE: PlaceRef = { kind: 'mine' };
const SREDA: PlaceRef = { kind: 'team', teamId: 4, name: 'Sreda 17:30' };

const src = (id: number, label: string, relation: Source['relation'] = 'clone'): Source => ({
	id,
	label,
	relation,
	access: 'edit',
	status: null,
	changed: []
});
const YOURS_SRC = src(15, 'Yours', 'self');
const INT = src(33, 'Intenziuci poletje 2026');
const SRE = src(31, 'Sreda 17:30');
const TWIN_SRC = src(21, 'Yours 2', 'twin');

const entry = (
	id: number,
	place: PlaceRef,
	status: Source['status'],
	changed: string[] = [],
	role: FamilyEntry['role'] = 'owner'
): FamilyEntry => ({
	member: { kind: 'position', id, place, access: 'edit', archived: false, clonedFrom: null },
	role: place.kind === 'mine' ? null : role,
	status,
	changed,
	theirs: [],
	editable: true
});

const FAMILY: FamilyView = {
	entries: [entry(15, MINE, null), entry(31, SREDA, 'newer', ['Notes'])]
};
const FAMILY_WITH_EXTRA: FamilyView = {
	...FAMILY,
	entries: [
		...FAMILY.entries,
		entry(40, { kind: 'team', teamId: 9, name: 'Salsa Tuesdays' }, 'same')
	]
};

describe('versionRow', () => {
	it('no row with one version', () => {
		expect(versionRow({ sources: [YOURS_SRC], current: 15, self: MINE })).toBeNull();
	});

	it('says whose and who else', () => {
		expect(
			versionRow({
				sources: [YOURS_SRC, INT, SRE],
				current: 15,
				self: MINE
			})
		).toEqual({
			title: 'Your version',
			meta: 'Also: Intenziuci poletje 2026, Sreda 17:30',
			count: 3,
			icon: 'solo'
		});
	});

	it('a group’s page names the group', () => {
		const r = versionRow({
			sources: [YOURS_SRC, { ...SRE, relation: 'self' }],
			current: 31,
			self: SREDA
		});
		expect(r?.title).toBe('Sreda 17:30’s version');
		expect(r?.icon).toBe('group');
		expect(r?.meta).toBe('Also: Yours');
	});

	it('a twin’s page reads as yours, with the link icon', () => {
		const r = versionRow({
			sources: [
				{ ...YOURS_SRC, relation: 'twin' },
				{ ...TWIN_SRC, relation: 'self' }
			],
			current: 21,
			self: MINE
		});
		expect(r?.title).toBe('Your version');
		expect(r?.icon).toBe('solo');
	});

	it('the meta is “Also: …” whatever the copies’ status: the notice says what differs', () => {
		const r = versionRow({
			sources: [
				YOURS_SRC,
				{ ...INT, status: 'newer', changed: ['Hold'] },
				{ ...SRE, status: 'differs', changed: ['Notes'] }
			],
			current: 15,
			self: MINE
		});
		expect(r).toEqual({
			title: 'Your version',
			meta: 'Also: Intenziuci poletje 2026, Sreda 17:30',
			count: 3,
			icon: 'solo'
		});
	});
});

describe('versionList', () => {
	it('lists this one, the copies with their status, and a twin', () => {
		const lines = versionList({
			sources: [YOURS_SRC, SRE, TWIN_SRC],
			current: 15,
			family: FAMILY
		});
		expect(lines.map((l) => [l.label, l.meta, l.chip?.text ?? null, l.current, l.icon])).toEqual([
			['Yours', 'This one', null, true, 'solo'],
			['Sreda 17:30', 'Owner · newer than yours: notes', 'Newer', false, 'group'],
			['Yours 2', 'Marked the same', null, false, 'link']
		]);
		expect(lines.map((l) => l.twin)).toEqual([false, false, true]);
	});

	it('keeps a copy that is not a source', () => {
		const last = versionList({
			sources: [YOURS_SRC, SRE],
			current: 15,
			family: FAMILY_WITH_EXTRA
		}).at(-1);
		expect(last?.label).toBe('Salsa Tuesdays');
		expect(last?.id).toBe(40);
		expect(last?.meta).toBe('Owner · in step');
	});

	it('without a family view, says the status from the source', () => {
		const lines = versionList({
			sources: [YOURS_SRC, { ...SRE, status: 'behind', changed: ['Notes'] }],
			current: 15,
			family: null
		});
		expect(lines[0].meta).toBe('This one');
		expect(lines[1].meta).toBe('Behind yours: notes');
		expect(lines[1].chip?.text).toBe('Behind');
	});

	it('on a group’s page, a copy is measured against this one', () => {
		const lines = versionList({
			sources: [YOURS_SRC, { ...SRE, relation: 'self' }],
			current: 31,
			family: {
				entries: [entry(31, SREDA, null), entry(15, MINE, 'same')]
			}
		});
		expect(lines.map((l) => l.meta)).toEqual(['In step', 'This one']);
		expect(lines[1].current).toBe(true);
	});
});

describe('versionList without a family view', () => {
	it('on a group’s page, measures against this one, not yours', () => {
		const lines = versionList({
			sources: [
				{ ...SRE, relation: 'self' },
				{ ...INT, status: 'newer', changed: ['Notes'] }
			],
			current: 31,
			self: SREDA,
			family: null
		});
		expect(lines[1].meta).toBe('Newer than this one: notes');
	});
});

describe('in Slovenian', () => {
	const sl = <T>(fn: () => T): T => withLocale('sl', fn);

	it('the row: »Vaša kopija«, a group’s copy by its name, never a possessive', () => {
		expect(
			sl(() => versionRow({ sources: [YOURS_SRC, INT, SRE], current: 15, self: MINE }))
		).toEqual({
			title: 'Vaša kopija',
			meta: 'Tudi: Intenziuci poletje 2026, Sreda 17:30',
			count: 3,
			icon: 'solo'
		});
		const r = sl(() =>
			versionRow({ sources: [YOURS_SRC, { ...SRE, relation: 'self' }], current: 31, self: SREDA })
		);
		expect(r?.title).toBe('Kopija · Sreda 17:30');
		// The server's 'Yours' is drawn in the reader's language.
		expect(r?.meta).toBe('Tudi: Vaša kopija');
	});

	it('the list: labels, lines and chips', () => {
		const lines = sl(() =>
			versionList({ sources: [YOURS_SRC, SRE, TWIN_SRC], current: 15, family: FAMILY })
		);
		expect(lines.map((l) => [l.label, l.meta, l.chip?.text ?? null, l.icon])).toEqual([
			['Vaša kopija', 'Ta kopija', null, 'solo'],
			['Sreda 17:30', 'Vodja · novejša od vaše kopije: notes', 'Novejša', 'group'],
			['Vaša kopija 2', 'Označeno kot enako', null, 'link']
		]);
		const extra = sl(() =>
			versionList({ sources: [YOURS_SRC, SRE], current: 15, family: FAMILY_WITH_EXTRA })
		).at(-1);
		expect([extra?.label, extra?.meta]).toEqual(['Salsa Tuesdays', 'Vodja · usklajena']);
		const group = sl(() =>
			versionList({
				sources: [YOURS_SRC, { ...SRE, relation: 'self' }],
				current: 31,
				family: { entries: [entry(31, SREDA, null), entry(15, MINE, 'same')] }
			})
		);
		expect(group.map((l) => [l.label, l.meta])).toEqual([
			['Vaša kopija', 'Usklajena'],
			['Sreda 17:30', 'Ta kopija']
		]);
	});
});
