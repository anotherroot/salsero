import { describe, expect, it } from 'vitest';
import type { LastSet } from '$lib/types';
import { footerFor, lastTimeParts, rangeError } from './log-view';

const base = {
	session: null,
	justLogged: false,
	busy: false,
	playing: false,
	backfill: false,
	rated: true
};
const ses = (next: string | null, ended = false) => ({ next, ended });
const last = (o: { daysAgo: number; rating: number | null; note: string | null }): LastSet => ({
	id: 1,
	doneAt: 0,
	durationS: null,
	reps: null,
	...o
});

describe('footerFor follow', () => {
	it('does not fall to follow when a session has no next or has ended', () => {
		expect(
			footerFor({ ...base, session: ses(null), justLogged: true, follow: 'B' }).next
		).toBeNull();
		expect(
			footerFor({ ...base, session: ses('A', true), justLogged: true, follow: 'B' }).next
		).toBeNull();
	});
	it('names where Next goes outside a session, once logged', () => {
		const v = footerFor({ ...base, justLogged: true, follow: 'Clave clapping' });
		expect(v.next).toBe('Next: Clave clapping');
		expect(v.main?.state).toBe('logged');
		expect(footerFor({ ...base, follow: 'Clave clapping' }).next).toBeNull();
		expect(footerFor({ ...base, justLogged: true, follow: null }).next).toBeNull();
	});
	it('lets the session win', () => {
		expect(footerFor({ ...base, session: ses('A'), justLogged: true, follow: 'B' }).next).toBe(
			'Next: A'
		);
	});
});

describe('footerFor', () => {
	it('offers Log set by default', () => {
		expect(footerFor(base)).toEqual({
			skip: false,
			main: { state: 'log', label: 'Log set' },
			hint: null,
			next: null,
			done: false
		});
	});
	it('words a back-fill', () => {
		expect(footerFor({ ...base, backfill: true }).main).toEqual({
			state: 'log',
			label: 'Add set to this day'
		});
	});
	it('shows saving, disabled and logged in that precedence', () => {
		expect(footerFor({ ...base, busy: true }).main).toEqual({ state: 'saving', label: 'Saving…' });
		expect(footerFor({ ...base, busy: true, playing: true, justLogged: true }).main?.state).toBe(
			'saving'
		);
		expect(footerFor({ ...base, playing: true })).toMatchObject({
			main: { state: 'disabled', label: 'Log set' },
			hint: 'Stop the count to log it.'
		});
		expect(footerFor({ ...base, justLogged: true }).main).toEqual({
			state: 'logged',
			label: 'Logged'
		});
	});
	it('offers Skip in a session until something is logged', () => {
		expect(footerFor({ ...base, session: ses('Count drill · 3-2 clave') }).skip).toBe(true);
	});
	it('names the next exercise once logged', () => {
		expect(
			footerFor({ ...base, session: ses('Count drill · 3-2 clave'), justLogged: true })
		).toEqual({
			skip: false,
			main: { state: 'logged', label: 'Logged' },
			hint: null,
			next: 'Next: Count drill · 3-2 clave',
			done: false
		});
	});
	it('is done when the last one is logged', () => {
		expect(footerFor({ ...base, session: ses(null), justLogged: true })).toEqual({
			skip: false,
			main: null,
			hint: null,
			next: null,
			done: true
		});
	});
	it('still offers Log set when Skip ran out the list', () => {
		expect(footerFor({ ...base, session: ses(null, true) })).toEqual({
			skip: false,
			main: { state: 'log', label: 'Log set' },
			hint: null,
			next: null,
			done: true
		});
	});
});

describe('rangeError', () => {
	it('accepts empty and 0..max integers', () => {
		expect(rangeError('', 600)).toBeNull();
		expect(rangeError('600', 600)).toBeNull();
		expect(rangeError('40', 10000)).toBeNull();
	});
	it('refuses everything else', () => {
		for (const bad of ['700', '-1', '2.5', 'e']) expect(rangeError(bad, 600)).toBe('0–600');
	});
});

describe('footerFor, a face is required', () => {
	it('disables Log set with a hint until a face is picked', () => {
		const v = footerFor({ ...base, rated: false });
		expect(v.main).toEqual({ state: 'disabled', label: 'Log set' });
		expect(v.hint).toBe('Pick how it went');
	});
	it('keeps the back-fill wording while disabled', () => {
		expect(footerFor({ ...base, rated: false, backfill: true }).main).toEqual({
			state: 'disabled',
			label: 'Add set to this day'
		});
	});
	it('offers Log set once a face is picked', () => {
		expect(footerFor(base).main?.state).toBe('log');
		expect(footerFor(base).hint).toBeNull();
	});
	it('shows Logged after a log although the face reset', () => {
		expect(footerFor({ ...base, rated: false, justLogged: true }).main?.state).toBe('logged');
	});
});

describe('lastTimeParts', () => {
	it('is null for a first time', () => {
		expect(lastTimeParts(null)).toBeNull();
	});
	it('splits when, rating and note', () => {
		expect(lastTimeParts(last({ daysAgo: 3, rating: 3, note: 'lost the count' }))).toEqual({
			when: 'Last time: 3 days ago',
			rating: 3,
			note: 'lost the count'
		});
		expect(lastTimeParts(last({ daysAgo: 0, rating: null, note: null }))?.when).toBe(
			'Last time: Today'
		);
	});
});
