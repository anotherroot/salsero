import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { MOVE_ROWS, sheetUrl, sideWords, verbOf, videoFrom } from './look-view';

describe('the preview sheet', () => {
	it("says the picker's own verb", () => {
		expect(verbOf('link')).toBe('Link this');
		expect(verbOf('act')).toBe('Add this');
		expect(verbOf('field')).toBe('Pick this');
	});

	it("asks for the figure with the section its row's picture was cut from; a move by itself", () => {
		const picture = { clip: '/loops/9-1000-7000.mp4', still: '/loops/9-1000-7000-frame.jpg' };
		expect(sheetUrl({ kind: 'figure', id: 4 }, picture)).toBe('/api/figures/4/look?spot=9');
		expect(sheetUrl({ kind: 'figure', id: 4 }, null)).toBe('/api/figures/4/look');
		expect(sheetUrl({ kind: 'move', id: 3 }, picture)).toBe('/api/moves/3/look');
	});

	it("names where the video is from: the lesson and its day, or the person's recording", () => {
		expect(
			videoFrom({ kind: 'lesson', title: '15 salsa cubana moves', lessonDay: '2026-09-26' })
		).toMatch(/^15 salsa cubana moves · .*26/);
		expect(videoFrom({ kind: 'recording' })).toBe('Your recording');
	});

	it("joins a side as the rows do, and shows a few of a move's variations", () => {
		expect(sideWords(['Abierta', 'Cerrada'])).toBe('Abierta or Cerrada');
		expect(MOVE_ROWS).toBe(6);
	});
});

describe('the sheet keeps the rules', () => {
	const video = readFileSync('src/lib/components/picker/LookVideo.svelte', 'utf8');
	it('its video is muted, loops its section, and takes part in one sound at a time (not ambient)', () => {
		expect(video).toMatch(/muted/);
		expect(video).toMatch(/playsinline/);
		// The section's own video (bound, `quietWhile`) takes part; only the fallback clip is ambient.
		const main = video.slice(video.indexOf('<video'), video.indexOf('</video>'));
		expect(main).toContain('bind:this={video}');
		expect(main).not.toMatch(/data-ambient/);
		expect(video).toMatch(/quietWhile\(/);
	});

	it('when the video cannot play, the loop plays as a muted background clip over its still', () => {
		const fallback = video.slice(video.lastIndexOf('<video'), video.lastIndexOf('</video>'));
		for (const a of [
			'src={picture.clip}',
			'poster={picture.still}',
			'muted',
			'loop',
			'data-ambient'
		])
			expect(fallback).toContain(a);
	});
});
