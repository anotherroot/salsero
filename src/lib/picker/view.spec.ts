import { describe, expect, it } from 'vitest';
import { withLocale } from '$lib/i18n/current';
import { shown, type PickHeading, type PickRow } from './model';
import {
	createLead,
	doneLabel,
	emptyText,
	lineGroups,
	linkRefusal,
	pickerBody,
	pickerTall,
	rowTrail
} from './view';

const row = (key: string, extra: Partial<PickRow> = {}): PickRow => ({
	key,
	value: 1,
	label: key,
	...extra
});

describe('picker view rules', () => {
	it('says what a row ends in', () => {
		const none = new Set<string>();
		expect(rowTrail('link', row('figure:1'), null, none)).toBe('add');
		expect(rowTrail('link', row('figure:1'), null, new Set(['figure:1']))).toBe('pending');
		expect(rowTrail('link', row('figure:1', { linked: true }), null, new Set(['figure:1']))).toBe(
			'linked'
		);
		expect(rowTrail('link', row('figure:1', { linked: false }), null, none)).toBe('add');
		expect(rowTrail('field', row('group:4'), 'group:4', none)).toBe('chosen');
		expect(rowTrail('field', row('group:5'), 'group:4', none)).toBe('none');
		expect(rowTrail('act', row('exercise:3'), null, new Set(['exercise:3']))).toBe('none');
	});
	it('ticks every chosen row of a many-value field', () => {
		const none = new Set<string>();
		const chosen = new Set(['position:1', 'position:3']);
		expect(rowTrail('field', row('position:1'), chosen, none)).toBe('chosen');
		expect(rowTrail('field', row('position:3'), chosen, none)).toBe('chosen');
		expect(rowTrail('field', row('position:2'), chosen, none)).toBe('none');
		expect(rowTrail('field', row('position:1'), new Set(), none)).toBe('none');
		expect(rowTrail('act', row('position:1'), chosen, none)).toBe('none');
	});
	it('leads the create row with the typed text', () => {
		expect(createLead('')).toBe('Not in the list?');
		expect(createLead('dob')).toBe('Not in the list? Create “dob” as');
		expect(createLead('Montaña')).toBe('Not in the list? Create “Montaña” as');
	});
	it('counts what + linked', () => expect(doneLabel(2)).toBe('Done · 2 linked'));
	it('counts what a field picker holds', () => {
		expect(doneLabel(3, 'field')).toBe('Done · 3');
		expect(doneLabel(0, 'field')).toBe('Done · 0');
		expect(doneLabel(2, 'link')).toBe('Done · 2 linked');
	});
	it('says nothing matches, or the picker’s own sentence', () => {
		expect(emptyText('Montaña', 'There are no figures yet.')).toBe('Nothing matches “Montaña”.');
		expect(emptyText('', 'There are no figures yet.')).toBe('There are no figures yet.');
	});
	it('picks the body', () => {
		expect(pickerBody({ loading: true, failed: false, lines: 0 })).toBe('loading');
		expect(pickerBody({ loading: false, failed: true, lines: 4 })).toBe('failed');
		expect(pickerBody({ loading: false, failed: false, lines: 4 })).toBe('list');
		expect(pickerBody({ loading: false, failed: false, lines: 0 })).toBe('empty');
	});
	it('is tall when it opens on rows, short on nothing', () => {
		const g = [{ title: 'Figures', entries: [row('figure:1')] }];
		expect(pickerTall({ loading: true, failed: false, groups: [] })).toBe(true);
		expect(pickerTall({ loading: false, failed: false, groups: g })).toBe(true);
		expect(pickerTall({ loading: false, failed: false, groups: [] })).toBe(false);
		expect(pickerTall({ loading: false, failed: true, groups: g })).toBe(false);
	});
	it('puts each group’s lines in its own card, the last one without a hairline', () => {
		const h = (heading: string, ids: number[]): PickHeading => ({
			heading,
			collapse: true,
			rows: ids.map((id, i) =>
				row(`figure:${id}`, {
					value: id,
					label: `${heading} · ${['Basic', 'Doble'][i]}`,
					short: ['Basic', 'Doble'][i]
				})
			)
		});
		const groups = [{ title: 'Figures', entries: [h('Enchufla', [1, 2]), h('Sombrero', [3, 4])] }];
		const out = lineGroups(shown(groups, 'dob'));
		expect(out.map((g) => g.title)).toEqual(['Figures']);
		expect(out[0].lines.map((l) => l.line.text)).toEqual([
			'Enchufla',
			'Doble',
			'Sombrero',
			'Doble'
		]);
		expect(out[0].lines.map((l) => l.last)).toEqual([false, false, false, true]);
	});
});

describe('linkRefusal', () => {
	it('is the server’s message when there is one', () => {
		expect(linkRefusal('Already linked.', { label: 'Enchufla · Doble' })).toBe('Already linked.');
	});
	it('names the row when the server said nothing', () => {
		expect(linkRefusal(undefined, { label: 'Enchufla · Doble' })).toBe(
			'Enchufla · Doble was not linked. Try it again.'
		);
		expect(linkRefusal('', { label: 'Enchufla · Doble' })).toBe(
			'Enchufla · Doble was not linked. Try it again.'
		);
		expect(linkRefusal(404, { label: 'Clave' })).toBe('Clave was not linked. Try it again.');
	});
	it('says it plainly when it knows neither', () => {
		expect(linkRefusal(null, null)).toBe('Try it again.');
	});
});

describe('the picker’s own words in Slovenian', () => {
	const sl = <T>(fn: () => T) => withLocale('sl', fn);
	it('quotes what was typed with » «', () => {
		expect(sl(() => emptyText('xy', '…'))).toBe('Nič ne ustreza »xy«.');
		expect(sl(() => emptyText('', 'Figur še ni.'))).toBe('Figur še ni.');
		expect(sl(() => createLead('xy'))).toBe('Ni na seznamu? Ustvari »xy« kot');
		expect(sl(() => createLead(''))).toBe('Ni na seznamu?');
	});
	it('counts Done after a colon, and a field’s plainly', () => {
		expect(sl(() => doneLabel(3))).toBe('Končano · povezano: 3');
		expect(sl(() => doneLabel(3, 'field'))).toBe('Končano · 3');
	});
	it('names the row after a colon when the server said nothing', () => {
		expect(sl(() => linkRefusal(undefined, { label: 'Enchufla · Doble' }))).toBe(
			'Povezava ni uspela: Enchufla · Doble. Poskusite znova.'
		);
		expect(sl(() => linkRefusal(null, null))).toBe('Poskusite znova.');
		expect(sl(() => linkRefusal('Že povezano.', null))).toBe('Že povezano.');
	});
});
