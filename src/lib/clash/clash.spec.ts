import { describe, expect, it } from 'vitest';
import {
	agoText,
	asSeen,
	changedFields,
	clashTitle,
	clashView,
	fieldLabel,
	goneTitle,
	canPutBack,
	kindOfShape,
	mineOverTheirs,
	routineFingerprint,
	seenAfterSave,
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
		expect(staleRoutine(null)).toBe('This routine changed; it now shows the latest');
	});
	it('names who and when once known', () => {
		expect(clashTitle({ by: 'Ana', at: now - 10 * 60_000 }, now)).toBe(
			'Ana changed this · 10 min ago'
		);
		expect(goneTitle({ by: 'Ana', at: now - 2 * 60 * 60_000 }, now)).toBe(
			'Ana deleted this · 2 h ago'
		);
		expect(staleRoutine('Ana')).toBe('Ana changed this routine; it now shows the latest');
	});
	it('reads an age', () => {
		expect(agoText(now, now)).toBe('just now');
		expect(agoText(now - 25 * 60 * 60_000, now)).toBe('yesterday');
		expect(agoText(now - 3 * 24 * 60 * 60_000, now + 1)).toBe('3 days ago');
	});
	it('names fields', () => {
		expect(fieldLabel('lessonDay')).toBe('Day of the class');
		expect(fieldLabel('figureName')).toBe('Move name');
		expect(fieldLabel('comesBack')).toBe('Comes back');
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
		expect(v.others).toEqual(['Starts in']);
		expect(v.adopt).toEqual([]);
	});

	it('takes theirs for a choice you did not touch, and names one you changed', () => {
		const v = clashView(
			{
				changed: ['partner', 'style', 'startIds'],
				current: { partner: 'solo', style: 'la', startIds: '2' }
			},
			{ partner: 'partner', style: 'cuban', startIds: '1' },
			{ partner: 'partner', style: 'ny', startIds: '1' },
			() => 'other',
			undefined,
			(key) => key !== 'startIds'
		);
		// partner: untouched, so theirs goes back in; style: yours, kept and named;
		// startIds: untouched but cannot be put back, so named.
		expect(v.adopt).toEqual(['partner']);
		expect(v.others).toEqual(['Style', 'Starts in']);
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

describe('seenAfterSave', () => {
	it('takes the answer only for the fields the save wrote', () => {
		expect(
			seenAfterSave({ label: 'A', startMs: 1000, endMs: 5000 }, ['startMs'], {
				label: 'Theirs',
				startMs: 1100,
				endMs: 5000
			})
		).toEqual({ label: 'A', startMs: 1100, endMs: 5000 });
	});
});

describe('mineOverTheirs', () => {
	it('sends only the changed fields, yours, and shows theirs for the rest', () => {
		const r = mineOverTheirs(
			{ changed: ['startMs'], current: { label: 'Theirs', startMs: 1500, endMs: 5000 } },
			{ label: 'A', startMs: 1100, endMs: 5000 },
			{}
		);
		expect(r.send).toEqual({ startMs: 1100 });
		expect(r.show).toEqual({ label: 'Theirs', startMs: 1100, endMs: 5000 });
	});
	it('also sends your edits that waited behind the clash, and Keep theirs sends only those', () => {
		const info = { changed: ['startMs'], current: { label: 'A', startMs: 1500, endMs: 5000 } };
		const screen = { label: 'A', startMs: 1100, endMs: 5200 };
		expect(mineOverTheirs(info, screen, {}, ['startMs', 'endMs']).send).toEqual({
			startMs: 1100,
			endMs: 5200
		});
		const theirs = mineOverTheirs({ ...info, changed: [] }, screen, {}, ['endMs']);
		expect(theirs.send).toEqual({ endMs: 5200 });
		expect(theirs.show).toEqual({ label: 'A', startMs: 1500, endMs: 5200 });
	});

	it('takes a box over the screen', () => {
		const r = mineOverTheirs(
			{ changed: ['label'], current: { label: 'Theirs', startMs: 1, endMs: 2 } },
			{ label: 'A', startMs: 1, endMs: 2 },
			{ label: 'Merged' }
		);
		expect(r.send).toEqual({ label: 'Merged' });
	});
});

describe('field shapes', () => {
	it('never puts a value back into a hidden input or a list of them', () => {
		// One chosen start position renders as ONE hidden input: still not settable.
		expect(canPutBack({ tag: 'input', type: 'hidden' })).toBe(false);
		expect(canPutBack({ tag: 'many' })).toBe(false);
		expect(canPutBack({ tag: 'none' })).toBe(false);
	});
	it('puts one back into a typed field, a select and a choice', () => {
		expect(canPutBack({ tag: 'input', type: 'text' })).toBe(true);
		expect(canPutBack({ tag: 'input', type: 'checkbox' })).toBe(true);
		expect(canPutBack({ tag: 'textarea' })).toBe(true);
		expect(canPutBack({ tag: 'select' })).toBe(true);
		expect(canPutBack({ tag: 'radios' })).toBe(true);
	});
	it('shows text, many lines and dates in boxes, the rest by name', () => {
		expect(kindOfShape({ tag: 'input', type: 'text' })).toBe('text');
		expect(kindOfShape({ tag: 'textarea' })).toBe('multiline');
		expect(kindOfShape({ tag: 'input', type: 'date' })).toBe('date');
		expect(kindOfShape({ tag: 'input', type: 'hidden' })).toBe('other');
		expect(kindOfShape({ tag: 'radios' })).toBe('other');
	});
	it('names an untouched single start position in Also changed, never adopts it', () => {
		const v = clashView(
			{ changed: ['startIds'], current: { startIds: '1,2' } },
			{ startIds: '1' },
			{ startIds: '1' },
			() => 'other',
			undefined,
			() => canPutBack({ tag: 'input', type: 'hidden' })
		);
		expect(v.adopt).toEqual([]);
		expect(v.others).toEqual(['Starts in']);
	});
});
