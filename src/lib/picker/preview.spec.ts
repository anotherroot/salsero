import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { MAX_PLAYING, PREVIEW_LOOK, failedNow, slots, stillOnly, tileShows } from './preview';

const picture = { clip: '/loops/9-0-1000.mp4', still: '/loops/9-0-1000-frame.jpg' };
const fine = { reducedMotion: false, saveData: false, deviceMemory: 8, cores: 8, mobile: true };

describe('when tiles move (revision 2026-11-13)', () => {
	it('never with Reduce motion or Data Saver', () => {
		expect(stillOnly(fine)).toBe(false);
		expect(stillOnly({ ...fine, reducedMotion: true })).toBe(true);
		expect(stillOnly({ ...fine, saveData: true })).toBe(true);
	});

	it('never on a weak phone: 2 GB or less, or 4 cores or fewer; unknown is not weak', () => {
		expect(stillOnly({ ...fine, deviceMemory: 2 })).toBe(true);
		expect(stillOnly({ ...fine, cores: 4 })).toBe(true);
		expect(stillOnly({ ...fine, deviceMemory: 4, cores: 6 })).toBe(false);
		expect(stillOnly({ reducedMotion: false, saveData: false, mobile: true })).toBe(false);
	});

	it('a 4-core office PC still plays (the core count speaks only on a phone) (review)', () => {
		expect(stillOnly({ ...fine, cores: 4, mobile: false })).toBe(false);
		expect(stillOnly({ ...fine, deviceMemory: 2, mobile: false })).toBe(true);
	});

	it('at most four have a clip: the first ones on screen, in the list order', () => {
		expect(MAX_PLAYING).toBe(4);
		expect([...slots(['a', 'b', 'c', 'd', 'e', 'f'], false).keys()]).toEqual(['a', 'b', 'c', 'd']);
		expect([...slots(['a', 'b'], false).entries()]).toEqual([
			['a', 'play'],
			['b', 'play']
		]);
	});

	it('while the list scrolls they pause where they are, never unmount and restart (review)', () => {
		expect([...slots(['a', 'b'], true).entries()]).toEqual([
			['a', 'pause'],
			['b', 'pause']
		]);
	});
});

describe('what a tile draws', () => {
	it('the clip over its still while it may play; else the still', () => {
		expect(tileShows(picture, { slot: 'play', failed: null })).toEqual({
			kind: 'clip',
			...picture
		});
		expect(tileShows(picture, { slot: 'pause', failed: null })).toEqual({
			kind: 'clip',
			...picture
		});
		expect(tileShows(picture, { slot: 'off', failed: null })).toEqual({
			kind: 'still',
			still: picture.still
		});
	});

	it('a clip that will not play falls back to the still; a still that will not load, or none, is the empty tile', () => {
		expect(tileShows(picture, { slot: 'play', failed: 'clip' })).toEqual({
			kind: 'still',
			still: picture.still
		});
		expect(tileShows(picture, { slot: 'play', failed: 'still' })).toEqual({ kind: 'empty' });
		expect(tileShows(null, { slot: 'play', failed: null })).toEqual({ kind: 'empty' });
	});

	it('is the tile today; the eye is the fallback (spec "Building for the fallback")', () => {
		expect(PREVIEW_LOOK).toBe('tile');
	});
});

describe('a failure belongs to its picture (review)', () => {
	it('a tile reused for another figure (rows keyed by place while searching) draws the new one', () => {
		const a = { clip: '/loops/1-0-1000.mp4', still: '/loops/1-0-1000-frame.jpg' };
		const b = { clip: '/loops/2-0-1000.mp4', still: '/loops/2-0-1000-frame.jpg' };
		expect(failedNow({ for: a.clip, what: 'clip' }, a)).toBe('clip');
		expect(failedNow({ for: a.clip, what: 'still' }, a)).toBe('still');
		expect(failedNow({ for: a.clip, what: 'clip' }, b)).toBeNull();
		expect(failedNow(null, a)).toBeNull();
		expect(failedNow({ for: a.clip, what: 'clip' }, null)).toBeNull();
	});
});

describe('the picker draws it', () => {
	const picker = readFileSync('src/lib/components/picker/Picker.svelte', 'utf8');
	const button = readFileSync('src/lib/components/picker/PreviewButton.svelte', 'utf8');

	it("a row with a picture gets a PreviewButton of its own, not the row's pick", () => {
		expect(picker).toMatch(/r\.picture !== undefined/);
		expect(picker).toMatch(/<PreviewButton[\s\S]*?onclick=\{\(\) => look\(r, away\)\}/);
	});

	it('a 64 px square, named for its row; the still loads lazily', () => {
		expect(button).toMatch(/t\(\)\.picker\.look\.preview\(label\)/);
		expect(button).toMatch(/size-16/);
		expect(button).toMatch(/loading="lazy"/);
	});

	it('the clip is a muted background loop, there only while the tile may play', () => {
		expect(button).toMatch(/\{#if shows\.kind === 'clip'\}[\s\S]*?<video/);
		const video = button.slice(button.indexOf('<video'), button.indexOf('</video>'));
		for (const a of ['muted', 'loop', 'playsinline', 'autoplay', 'data-ambient'])
			expect(video).toContain(a);
	});
});

describe('the sheet goes with its picker (review)', () => {
	it('a picker that closes (Android Back in the player) forgets its open sheet', () => {
		expect(picker()).toMatch(/if \(!open\) looking = null;/);
	});
	const picker = () => readFileSync('src/lib/components/picker/Picker.svelte', 'utf8');
});
