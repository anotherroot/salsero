import { describe, expect, it } from 'vitest';
import { screenFiles, summarise } from './upload-queue';

const file = (name: string, size: number, type = 'video/mp4') => ({ name, size, type });

const GB = 1024 * 1024 * 1024;

describe('screenFiles', () => {
	it('accepts every video inside the limit, in the order they were picked', () => {
		const picked = [file('second.mp4', 10), file('first.mov', 20, 'video/quicktime')];
		const { accepted, rejected } = screenFiles(picked, GB);
		expect(accepted).toEqual(picked);
		expect(rejected).toEqual([]);
	});

	it('names an oversized file with both sizes, and keeps the rest', () => {
		const ok = file('class.mp4', 5 * 1024 * 1024);
		const { accepted, rejected } = screenFiles([file('whole-day.mp4', 2 * GB), ok], GB);
		expect(accepted).toEqual([ok]);
		expect(rejected).toEqual([{ name: 'whole-day.mp4', reason: '2.0 GB — the limit is 1.0 GB' }]);
	});

	it('refuses anything that is not a video', () => {
		const { accepted, rejected } = screenFiles([file('notes.txt', 10, 'text/plain')], GB);
		expect(accepted).toEqual([]);
		expect(rejected).toEqual([{ name: 'notes.txt', reason: 'not a video' }]);
	});
});

describe('summarise', () => {
	it('says nothing when every file went up', () => {
		expect(summarise(3, [])).toBe(null);
	});

	it('says nothing when nothing was picked at all', () => {
		expect(summarise(0, [])).toBe(null);
	});

	it('counts what landed and names what did not', () => {
		expect(summarise(2, [{ name: 'notes.txt', reason: 'not a video' }])).toBe(
			'2 videos added. Skipped notes.txt (not a video).'
		);
	});

	it('counts a single video in the singular', () => {
		expect(summarise(1, [{ name: 'a.txt', reason: 'not a video' }])).toBe(
			'1 video added. Skipped a.txt (not a video).'
		);
	});

	it('drops the count when nothing landed, and lists every failure', () => {
		expect(
			summarise(0, [
				{ name: 'a.txt', reason: 'not a video' },
				{ name: 'b.mp4', reason: 'the connection dropped' }
			])
		).toBe('Skipped a.txt (not a video), b.mp4 (the connection dropped).');
	});
});
