import { describe, expect, it } from 'vitest';
import { fitWithin, isShot, shotFile, SHOT_LONG_SIDE } from './shot';

describe('the screenshot', () => {
	it('takes only a JPEG data URL from the app', () => {
		expect(isShot('data:image/jpeg;base64,/9j/4AAQ')).toBe(true);
		expect(isShot('data:image/jpeg;base64,')).toBe(false);
		expect(isShot('data:image/png;base64,iVBOR')).toBe(false);
		expect(isShot('listen')).toBe(false);
		expect(isShot(42)).toBe(false);
	});

	it('shrinks to the long side, keeping the shape, never growing', () => {
		expect(fitWithin(1080, 2400)).toEqual({ width: 576, height: SHOT_LONG_SIDE });
		expect(fitWithin(2560, 1440)).toEqual({ width: SHOT_LONG_SIDE, height: 720 });
		expect(fitWithin(390, 844)).toEqual({ width: 390, height: 844 });
	});

	it('turns the data URL into the JPEG file the form sends', async () => {
		const file = shotFile('data:image/jpeg;base64,' + btoa('\xff\xd8\xff\xe0abc'));
		expect(file.type).toBe('image/jpeg');
		expect([...new Uint8Array(await file.arrayBuffer())].slice(0, 3)).toEqual([0xff, 0xd8, 0xff]);
	});
});
