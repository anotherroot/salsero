import { describe, expect, it } from 'vitest';
import { lookLine, loopName, parseLoopName, pictureOf } from './loops';

describe('loop names', () => {
	it('name a section and its still', () => {
		expect(loopName({ id: 12, startMs: 1000, endMs: 7000 })).toBe('12-1000-7000.mp4');
		expect(loopName({ id: 12, startMs: 1000, endMs: 7000 }, true)).toBe('12-1000-7000-frame.jpg');
	});

	it('parse back, and refuse what is not one', () => {
		expect(parseLoopName('12-1000-7000.mp4')).toEqual({
			id: 12,
			startMs: 1000,
			endMs: 7000,
			still: false
		});
		expect(parseLoopName('12-1000-7000-frame.jpg')).toMatchObject({ still: true });
		for (const bad of [
			'../12-0-1.mp4',
			'12-1000-1000.mp4',
			'12-0-1.png',
			'12-0.mp4',
			'x-0-1.mp4',
			'12-0-1.jpg',
			'12-0-1-still.mp4',
			'12-0-1-still.jpg'
		])
			expect(parseLoopName(bad)).toBeNull();
	});
});

describe('pictureOf and lookLine', () => {
	it('a section is a clip and a still under /loops/', () => {
		expect(pictureOf({ id: 12, startMs: 1000, endMs: 7000 })).toEqual({
			clip: '/loops/12-1000-7000.mp4',
			still: '/loops/12-1000-7000-frame.jpg'
		});
		expect(pictureOf(null)).toBeNull();
	});

	it('positions, then the length', () => {
		expect(lookLine({ hands: 'Abierta (una mano) → Cerrada', length: 8, picture: null })).toBe(
			'Abierta (una mano) → Cerrada · 8 counts'
		);
		expect(lookLine({ hands: '', length: 8, picture: null })).toBe('8 counts');
		expect(lookLine({ hands: 'Cerrada →', length: null, picture: null })).toBe('Cerrada →');
		expect(lookLine({ hands: '', length: null, picture: null })).toBe('');
	});
});

describe('loop names on the phone', () => {
	it('import nothing: the device worker bundles them, and it has no app environment', async () => {
		const { readFileSync } = await import('node:fs');
		const src = readFileSync('src/lib/video/loop-names.ts', 'utf8');
		expect(src).not.toMatch(/^import /m);
		expect(readFileSync('src/device/media.ts', 'utf8')).toMatch(/from '\$lib\/video\/loop-names'/);
	});
});
