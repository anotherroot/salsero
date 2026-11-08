import { describe, expect, it } from 'vitest';
import { withLocale } from '$lib/i18n/current';
import { noonOf } from '$lib/day/day';
import { byteSize } from '$lib/format';
import type { LessonVideoRow, RecordingRow } from '$lib/types';
import { lessonVideoCaption, recordingCaption } from './caption';

const TZ = 'Europe/Ljubljana';
const rec = (o: Partial<RecordingRow>): RecordingRow => ({
	id: 1,
	file: 'a.mp4',
	kind: 'video',
	sizeBytes: 1_000_000,
	sourceUrl: null,
	createdAt: 0,
	...o
});
const vid = (o: Partial<LessonVideoRow>): LessonVideoRow => ({
	id: 1,
	file: 'a.mp4',
	mime: 'video/mp4',
	sizeBytes: 1_000_000,
	sourceUrl: null,
	createdAt: 0,
	...o
});

describe('captions', () => {
	it('titles a recording by its day', () => {
		expect(
			recordingCaption(
				rec({ kind: 'video', createdAt: noonOf('2026-10-26', TZ), sizeBytes: 12_500_000 }),
				TZ
			)
		).toEqual({ title: 'Recording · 26 Oct', meta: byteSize(12_500_000) });
		expect(
			recordingCaption(rec({ kind: 'audio', createdAt: noonOf('2026-10-26', TZ) }), TZ).title
		).toBe('Audio · 26 Oct');
	});
	it('numbers a lesson video from one', () => {
		expect(lessonVideoCaption(0, vid({ sizeBytes: 740_000_000 }))).toEqual({
			title: 'Video 1',
			meta: byteSize(740_000_000)
		});
	});
});

describe('captions in Slovenian', () => {
	it('names a recording, an audio and a lesson video', () => {
		const at = noonOf('2026-10-26', TZ);
		withLocale('sl', () => {
			expect(recordingCaption(rec({ kind: 'video', createdAt: at }), TZ).title).toBe(
				'Posnetek · 26. okt.'
			);
			expect(recordingCaption(rec({ kind: 'audio', createdAt: at }), TZ).title).toBe(
				'Zvok · 26. okt.'
			);
			expect(lessonVideoCaption(1, vid({})).title).toBe('Video 2');
		});
	});
});
