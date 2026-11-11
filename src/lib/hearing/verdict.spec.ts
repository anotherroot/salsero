import { describe, expect, it } from 'vitest';
import { verdictOf } from './verdict';

const CLAVE = [2, 3, 5, 6.5, 8];
const beat = (pos: number, ms: number | null) => ({ pos, offset: ms === null ? null : ms / 1000 });

describe('verdictOf', () => {
	it('names the hit you are late on', () => {
		const beats = [beat(2, 10), beat(3, -10), beat(5, 5), beat(6.5, 70), beat(6.5, 80), beat(8, 0)];
		expect(verdictOf(beats, CLAVE)).toEqual({ kind: 'late', pos: 6.5, ms: 75 });
	});

	it('names an early hit the same way', () => {
		expect(verdictOf([beat(2, -90), beat(3, 0)], CLAVE)).toEqual({ kind: 'early', pos: 2, ms: 90 });
	});

	it('names the hit missed most when the timing is fine', () => {
		const beats = [beat(2, null), beat(2, null), beat(2, 10), beat(3, 20), beat(5, null)];
		expect(verdictOf(beats, CLAVE)).toEqual({ kind: 'missed', pos: 2, misses: 2, of: 3 });
	});

	it('says all on time', () => {
		expect(verdictOf([beat(2, 10), beat(3, -20), beat(8, 15)], CLAVE)).toEqual({ kind: 'onTime' });
	});
});
