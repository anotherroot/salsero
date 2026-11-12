import { describe, expect, it } from 'vitest';
import type { ElsewherePlace, ElsewhereRow } from '$lib/types';
import { isHeading, type PickRow } from './model';
import { elsewhereFrom, elsewhereGroups, elsewhereOf, elsewhereRow, hereGroups } from './elsewhere';

const row = (over: Partial<ElsewhereRow>): ElsewhereRow => ({
	kind: 'figure',
	id: 1,
	label: 'Cradle entry · Basic',
	heading: 'Cradle entry',
	short: 'Basic',
	alsoIn: [],
	restore: null,
	sameName: null,
	...over
});

const places: ElsewherePlace[] = [
	{
		place: { kind: 'mine' },
		readOnly: false,
		rows: [row({ id: 1, alsoIn: ['Sreda 17:30', 'Rueda club'] })]
	},
	{
		place: { kind: 'team', teamId: 4, name: 'Sreda 17:30' },
		readOnly: false,
		rows: [row({ kind: 'drill', id: 7, label: 'Cradle arms', heading: null, short: null })]
	},
	{
		place: { kind: 'team', teamId: 5, name: 'Tuesday class' },
		readOnly: true,
		rows: [
			row({
				id: 9,
				label: 'Cradle exit · Double',
				heading: 'Cradle exit',
				short: 'Double',
				sameName: 3
			})
		]
	}
];

describe('elsewhereGroups', () => {
	it('one group per place: yours, a group, a group you only read', () => {
		const gs = elsewhereGroups(places);
		expect(gs.map((g) => [g.title, g.icon, g.tone])).toEqual([
			['Yours', 'solo', undefined],
			['Sreda 17:30', 'group', undefined],
			['Tuesday class · you only read it', 'lock', 'warn']
		]);
	});

	it('a figure sits under its move; others are plain rows', () => {
		const [mine, sreda] = elsewhereGroups(places);
		const h = mine.entries[0];
		expect(isHeading(h) && h.heading).toBe('Cradle entry');
		const r = (isHeading(h) ? h.rows[0] : h) as PickRow;
		expect(r).toMatchObject({
			key: 'elsewhere:figure:1',
			value: 1,
			label: 'Cradle entry · Basic',
			short: 'Basic',
			meta: 'also in Sreda 17:30, Rueda club'
		});
		expect(sreda.entries[0]).toMatchObject({ key: 'elsewhere:drill:7', label: 'Cradle arms' });
	});

	it('a name the group already has is said, in the warn colour', () => {
		const h = elsewhereGroups(places)[2].entries[0];
		const r = (isHeading(h) ? h.rows[0] : h) as PickRow;
		expect(r).toMatchObject({ meta: 'This group has its own', warn: true });
	});

	it('keys come back as kind and id', () => {
		expect(elsewhereRow('elsewhere:drill:7')).toEqual({ kind: 'drill', id: 7 });
		expect(elsewhereRow('figure:7')).toBeNull();
		expect(elsewhereRow('elsewhere:song:7')).toBeNull();
	});
});

describe('hereGroups', () => {
	it('the group’s own rows go under its name while other places show', () => {
		const one = [{ title: 'Figures', entries: [] }];
		expect(hereGroups(one, 'Intenziuci').map((g) => g.title)).toEqual(['Intenziuci']);
		const two = [
			{ title: 'Drills', entries: [] },
			{ title: 'Figures', entries: [] }
		];
		expect(hereGroups(two, 'Intenziuci').map((g) => g.title)).toEqual([
			'Intenziuci · Drills',
			'Intenziuci · Figures'
		]);
	});
});

describe('elsewhereOf and elsewhereFrom', () => {
	it('a key’s row and the group it was found in (null for yours)', () => {
		expect(elsewhereOf(places, 'elsewhere:drill:7')?.label).toBe('Cradle arms');
		expect(elsewhereFrom(places, 'elsewhere:drill:7')).toBe('Sreda 17:30');
		expect(elsewhereFrom(places, 'elsewhere:figure:1')).toBeNull();
		expect(elsewhereOf(places, 'elsewhere:figure:99')).toBeNull();
	});
});

describe('picker preview: a figure from another place carries its look', () => {
	it('the positions line first, the picture, what the sheet opens', () => {
		const look = {
			hands: 'Cradle →',
			length: 4,
			picture: { strip: '/loops/3-0-1000.jpg', still: '/loops/3-0-1000-still.jpg' }
		};
		const [g] = elsewhereGroups([
			{
				place: { kind: 'mine' },
				readOnly: false,
				rows: [row({ id: 1, alsoIn: ['Sreda 17:30'], look })]
			}
		]);
		const r = g.entries.flatMap((e) => (isHeading(e) ? e.rows : [e]))[0];
		expect(r).toMatchObject({
			meta: 'Cradle → · 4 counts · also in Sreda 17:30',
			picture: look.picture,
			look: { kind: 'figure', id: 1 }
		});
	});
});
