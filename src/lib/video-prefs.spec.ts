import { describe, expect, it } from 'vitest';
import { parseVideoPrefs } from './video-prefs';

describe('parseVideoPrefs', () => {
	it('reads back what was saved', () => {
		expect(parseVideoPrefs('{"mirror":true,"rate":0.5}')).toEqual({ mirror: true, rate: 0.5 });
	});
	it.each([null, '', 'junk', '{"mirror":"yes","rate":3}'])('falls back for %s', (raw) => {
		expect(parseVideoPrefs(raw)).toEqual({ mirror: false, rate: 1 });
	});
});
