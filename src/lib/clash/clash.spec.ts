import { describe, expect, it } from 'vitest';
import {
	agoText,
	asSeen,
	changedFields,
	clashTitle,
	clashView,
	fieldLabel,
	goneTitle,
	routineFingerprint,
	staleRoutine,
	type FieldKind
} from './clash';

describe('changedFields', () => {
	it('ignores fields equal in both', () => {
		expect(
			changedFields(
				{ title: 'Rueda', notes: 'old', lessonDay: '2026-11-01' },
				{ title: 'Rueda', notes: 'new', lessonDay: '2026-11-01' }
			)
		).toEqual(['notes']);
	});
	it('treats null and empty, and a number and its digits, as the same', () => {
		expect(changedFields({ notes: null, startCount: 1 }, { notes: '', startCount: '1' })).toEqual(
			[]
		);
	});
	it('only looks at what was seen', () => {
		expect(changedFields({ label: 'A' }, { label: 'A', startMs: 5 })).toEqual([]);
		expect(changedFields({ label: 'A' }, {})).toEqual(['label']);
	});
});

describe('asSeen', () => {
	it('takes an object of plain values', () => {
		expect(asSeen({ a: 'x', b: 1, c: null })).toEqual({ a: 'x', b: 1, c: null });
	});
	it('refuses anything else', () => {
		expect(asSeen(null)).toBeNull();
		expect(asSeen([1])).toBeNull();
		expect(asSeen('x')).toBeNull();
		expect(asSeen({ a: { b: 1 } })).toBeNull();
		expect(asSeen({ a: [1] })).toBeNull();
	});
});

describe('routineFingerprint', () => {
	const slots = [
		{ position: 0, childRoutineId: null, figureIds: [1, 2] },
		{ position: 1, childRoutineId: 7, figureIds: [] }
	];
	it('is the same for the same slots, in any order given', () => {
		expect(routineFingerprint(slots)).toBe(routineFingerprint([slots[1], slots[0]]));
	});
	it('changes with the order, a figure, an embed or a note', () => {
		const fp = routineFingerprint(slots);
		expect(
			routineFingerprint([
				{ ...slots[0], position: 1 },
				{ ...slots[1], position: 0 }
			])
		).not.toBe(fp);
		expect(routineFingerprint([{ ...slots[0], figureIds: [2, 1] }, slots[1]])).not.toBe(fp);
		expect(routineFingerprint([slots[0], { ...slots[1], childRoutineId: 8 }])).not.toBe(fp);
		expect(routineFingerprint([{ ...slots[0], note: 'x' }, slots[1]])).not.toBe(fp);
		expect(routineFingerprint([slots[0]])).not.toBe(fp);
		expect(routineFingerprint([])).not.toBe(fp);
	});
});

describe('words', () => {
	const now = 10 * 60 * 60_000;
	it('says nothing of who before History knows', () => {
		expect(clashTitle({ by: null, at: null }, now)).toBe('This changed since you opened it');
		expect(goneTitle({ by: null, at: null }, now)).toBe('This was deleted since you opened it');
		expect(staleRoutine(null)).toBe('This routine changed since you opened it');
	});
	it('names who and when once known', () => {
		expect(clashTitle({ by: 'Ana', at: now - 10 * 60_000 }, now)).toBe(
			'Ana changed this · 10 min ago'
		);
		expect(goneTitle({ by: 'Ana', at: now - 2 * 60 * 60_000 }, now)).toBe(
			'Ana deleted this · 2 h ago'
		);
		expect(staleRoutine('Ana')).toBe('Ana changed this routine');
	});
	it('reads an age', () => {
		expect(agoText(now, now)).toBe('just now');
		expect(agoText(now - 25 * 60 * 60_000, now)).toBe('yesterday');
		expect(agoText(now - 3 * 24 * 60 * 60_000, now + 1)).toBe('3 days ago');
	});
	it('names fields', () => {
		expect(fieldLabel('lessonDay')).toBe('Day of the class');
		expect(fieldLabel('whatever')).toBe('Whatever');
	});
});

describe('clashView', () => {
	const kinds: Record<string, FieldKind> = {
		notes: 'multiline',
		title: 'text',
		startIds: 'other',
		startMs: 'time'
	};
	const kindOf = (k: string) => kinds[k] ?? 'text';

	it('shows theirs above yours for each changed text field, and only names the rest', () => {
		const v = clashView(
			{ changed: ['notes', 'startIds'], current: { notes: 'theirs', startIds: '1,2' } },
			{ notes: 'mine', startIds: '3' },
			{ notes: 'old', startIds: '1' },
			kindOf
		);
		expect(v.fields).toEqual([
			{ key: 'notes', label: 'Notes', kind: 'multiline', theirs: 'theirs', mine: 'mine' }
		]);
		expect(v.others).toEqual(['Starts from']);
	});

	it('starts your box with theirs on a field you did not touch', () => {
		const v = clashView(
			{ changed: ['title'], current: { title: 'New' } },
			{ title: 'Old' },
			{ title: 'Old' },
			kindOf
		);
		expect(v.fields[0].mine).toBe('New');
	});

	it('shows times as times', () => {
		const v = clashView(
			{ changed: ['startMs'], current: { startMs: 1500 } },
			{ startMs: 1400 },
			{ startMs: 1000 },
			kindOf,
			(_, ms) => `${Number(ms) / 1000} s`
		);
		expect(v.fields[0]).toMatchObject({ theirs: '1.5 s', mine: '1.4 s', kind: 'time' });
	});
});
