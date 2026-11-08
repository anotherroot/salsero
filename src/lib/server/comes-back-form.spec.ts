import { describe, expect, it } from 'vitest';
import { readComesBack, readWarmup } from './comes-back-form';
import { FACES } from '$lib/schedule/comes-back';

const form = (o: Record<string, string>) => {
	const f = new FormData();
	for (const [k, v] of Object.entries(o)) f.set(k, v);
	return f;
};
const T = 1000;
const NOW = 5000;

describe('readComesBack', () => {
	it('faces', () => expect(readComesBack(form({ comesBack: 'faces' }), null, NOW)).toEqual(FACES));
	it('until, since now', () =>
		expect(readComesBack(form({ comesBack: 'faces', until: 'on', good: '5' }), null, NOW)).toEqual({
			kind: 'until',
			good: 5,
			since: NOW
		}));
	it('until keeps since while it stayed on', () =>
		expect(
			readComesBack(
				form({ comesBack: 'faces', until: 'on', good: '5' }),
				{ kind: 'until', good: 3, since: T },
				NOW
			)
		).toEqual({ kind: 'until', good: 5, since: T }));
	it('until after another kind restarts since', () =>
		expect(
			readComesBack(
				form({ comesBack: 'faces', until: 'on', good: '3' }),
				{ kind: 'every', days: 2 },
				NOW
			)
		).toEqual({ kind: 'until', good: 3, since: NOW }));
	it('every', () =>
		expect(readComesBack(form({ comesBack: 'every', every: '2' }), null, NOW)).toEqual({
			kind: 'every',
			days: 2
		}));
	it('teacher', () =>
		expect(readComesBack(form({ comesBack: 'teacher' }), null, NOW)).toBe('teacher'));
	it('out of range is invalid', () => {
		expect(readComesBack(form({ comesBack: 'every', every: '4' }), null, NOW)).toBe('invalid');
		expect(readComesBack(form({ comesBack: 'every' }), null, NOW)).toBe('invalid');
		expect(readComesBack(form({ comesBack: 'faces', until: 'on', good: '4' }), null, NOW)).toBe(
			'invalid'
		);
		expect(readComesBack(form({ comesBack: 'nope' }), null, NOW)).toBe('invalid');
	});
	it('no field keeps', () => expect(readComesBack(form({}), null, NOW)).toBeUndefined());
});

describe('readWarmup', () => {
	it('keeps without the marker, even with a box', () => {
		expect(readWarmup(form({}))).toBeUndefined();
		expect(readWarmup(form({ warmup: 'on' }))).toBeUndefined();
	});
	it('reads the box once the marker is sent', () => {
		expect(readWarmup(form({ warmupSent: '1', warmup: 'on' }))).toBe(true);
		expect(readWarmup(form({ warmupSent: '1' }))).toBe(false);
	});
});
