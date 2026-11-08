import { describe, expect, it } from 'vitest';
import { withLocale } from './i18n/current';
import { screenFiles, summarise, summaryTitle, uploadCard } from './upload-queue';

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

describe('uploadCard', () => {
	it('says which file of how many is going up', () => {
		expect(
			uploadCard({ progress: 0.468, position: { index: 2, count: 3 }, retrying: false })
		).toEqual({
			title: 'Uploading 2 of 3… 46%',
			helper: 'Keep this page open — a reload starts over',
			tone: 'accent',
			icon: 'upload',
			percent: 46
		});
		expect(uploadCard({ progress: 0.2, position: null, retrying: false }).title).toBe(
			'Uploading… 20%'
		);
	});
	it('turns to a warning while retrying', () => {
		expect(uploadCard({ progress: 0.468, position: null, retrying: true })).toEqual({
			title: 'Connection dropped — retrying',
			helper: 'Picks up from what the server already has · 46%',
			tone: 'warn',
			icon: 'refresh',
			percent: 46
		});
	});
	it('never reads 100 before it is done, and clamps', () => {
		expect(uploadCard({ progress: 0.999, position: null, retrying: false }).percent).toBe(99);
		expect(uploadCard({ progress: 2, position: null, retrying: false }).percent).toBe(100);
		expect(uploadCard({ progress: -1, position: null, retrying: false }).percent).toBe(0);
	});
});

describe('summaryTitle', () => {
	it('is silent on success and names the loss otherwise', () => {
		expect(summaryTitle(2, 0)).toBeNull();
		expect(summaryTitle(1, 2)).toBe('Some files were skipped');
		expect(summaryTitle(0, 1)).toBe('That file wasn’t added');
		expect(summaryTitle(0, 3)).toBe('No videos were added');
	});
});

describe('in Slovenian', () => {
	const sl = <T>(fn: () => T) => withLocale('sl', fn);

	it('names why a file was skipped, and what was added', () => {
		expect(sl(() => screenFiles([file('notes.txt', 10, 'text/plain')], GB).rejected)).toEqual([
			{ name: 'notes.txt', reason: 'ni video' }
		]);
		expect(sl(() => screenFiles([file('day.mp4', 2 * GB)], GB).rejected)).toEqual([
			{ name: 'day.mp4', reason: '2,0 GB — največ je 1,0 GB' }
		]);
		expect(sl(() => summarise(2, [{ name: 'a.txt', reason: 'ni video' }]))).toBe(
			'Dodano: 2 videa. Izpuščeno: a.txt (ni video).'
		);
		expect(sl(() => summarise(5, [{ name: 'a.txt', reason: 'ni video' }]))).toBe(
			'Dodano: 5 videov. Izpuščeno: a.txt (ni video).'
		);
		expect(sl(() => summaryTitle(0, 1))).toBe('Datoteka ni bila dodana');
		expect(sl(() => summaryTitle(1, 2))).toBe('Nekatere datoteke so bile izpuščene');
		expect(sl(() => summaryTitle(0, 3))).toBe('Noben video ni bil dodan');
	});

	it('draws the upload card', () => {
		expect(
			sl(() => uploadCard({ progress: 0.4, position: { index: 2, count: 3 }, retrying: false }))
		).toEqual({
			title: 'Nalaganje (2 od 3)\u00a0… 40\u00a0%',
			helper: 'Pustite to stran odprto — če jo osvežite, se nalaganje začne znova',
			tone: 'accent',
			icon: 'upload',
			percent: 40
		});
		expect(sl(() => uploadCard({ progress: 0.468, position: null, retrying: true }))).toMatchObject(
			{
				title: 'Povezava se je prekinila — ponovni poskus',
				helper: 'Nadaljuje od tega, kar strežnik že ima · 46\u00a0%'
			}
		);
	});
});
