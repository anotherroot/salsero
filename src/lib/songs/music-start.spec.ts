import { describe, expect, it } from 'vitest';
import { musicStart, playFrom, startSource } from './music-start';

describe('the music start', () => {
	it('prefers yours, then the found one, then 0:00', () => {
		expect(musicStart({ startS: 4, startFoundS: 18 })).toBe(4);
		expect(musicStart({ startS: null, startFoundS: 18 })).toBe(18);
		expect(musicStart({ startS: null, startFoundS: null })).toBe(0);
		expect(musicStart({ startS: 0, startFoundS: 18 })).toBe(0);
	});

	it('says whose it is', () => {
		expect(startSource({ startS: 0, startFoundS: 18 })).toBe('yours');
		expect(startSource({ startS: null, startFoundS: 18 })).toBe('found');
		expect(startSource({ startS: null, startFoundS: null })).toBe('unmeasured');
	});

	it('starts Play there only from 0:00 and only inside the song', () => {
		expect(playFrom(0, 18.2, 200)).toBe(18.2);
		expect(playFrom(0.01, 18.2, 200)).toBe(18.2);
		expect(playFrom(30, 18.2, 200)).toBeNull();
		expect(playFrom(0, 0, 200)).toBeNull();
		expect(playFrom(0, 250, 200)).toBeNull();
		expect(playFrom(0, 18.2, Number.NaN)).toBe(18.2);
	});
});
