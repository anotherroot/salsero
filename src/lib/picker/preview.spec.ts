import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { PREVIEW_LOOK, failedNow, stillOnly, tileShows } from './preview';

const picture = { strip: '/loops/9-0-1000.jpg', still: '/loops/9-0-1000-still.jpg' };

describe('the picture on a row', () => {
	it('moves only on screen, with motion allowed and data not saved', () => {
		expect(stillOnly({ reducedMotion: false, saveData: false })).toBe(false);
		expect(stillOnly({ reducedMotion: true, saveData: false })).toBe(true);
		expect(stillOnly({ reducedMotion: false, saveData: true })).toBe(true);
	});

	it('draws the strip while moving, else the still; none or a failed load is the empty tile', () => {
		expect(tileShows(picture, { still: false, failed: false })).toEqual({
			kind: 'strip',
			src: picture.strip
		});
		expect(tileShows(picture, { still: true, failed: false })).toEqual({
			kind: 'still',
			src: picture.still
		});
		expect(tileShows(picture, { still: false, failed: true })).toEqual({ kind: 'empty' });
		expect(tileShows(null, { still: false, failed: false })).toEqual({ kind: 'empty' });
	});

	it('is the tile today; the eye is the fallback (spec "Building for the fallback")', () => {
		expect(PREVIEW_LOOK).toBe('tile');
	});
});

describe('the picker draws it', () => {
	const picker = readFileSync('src/lib/components/picker/Picker.svelte', 'utf8');
	const button = readFileSync('src/lib/components/picker/PreviewButton.svelte', 'utf8');

	it("a row with a picture gets a PreviewButton of its own, not the row's pick", () => {
		expect(picker).toMatch(/r\.picture !== undefined/);
		expect(picker).toMatch(/<PreviewButton[\s\S]*?onclick=\{\(\) => look\(r, away\)\}/);
	});

	it('the button is named for its row, loads lazily, and the strip steps through 12 frames', () => {
		expect(button).toMatch(/t\(\)\.picker\.look\.preview\(label\)/);
		expect(button).toMatch(/loading="lazy"/);
		expect(button).toMatch(/steps\(12\)/);
	});
});

describe('the sheet goes with its picker (review)', () => {
	it('a picker that closes (Android Back in the player) forgets its open sheet', () => {
		const picker = readFileSync('src/lib/components/picker/Picker.svelte', 'utf8');
		expect(picker).toMatch(/if \(!open\) looking = null;/);
	});
});

describe('a failed picture is that picture only (review)', () => {
	it('a tile reused for another figure (rows keyed by place while searching) draws the new one', () => {
		const a = { strip: '/loops/1-0-1000.jpg', still: '/loops/1-0-1000-still.jpg' };
		const b = { strip: '/loops/2-0-1000.jpg', still: '/loops/2-0-1000-still.jpg' };
		expect(failedNow(a.strip, a)).toBe(true);
		expect(failedNow(a.strip, b)).toBe(false);
		expect(failedNow(null, a)).toBe(false);
		expect(failedNow(a.strip, null)).toBe(false);
	});

	it('the button keeps which picture failed, not a bare flag', () => {
		const button = readFileSync('src/lib/components/picker/PreviewButton.svelte', 'utf8');
		expect(button).toMatch(/failedNow\(failedFor, picture\)/);
	});
});
