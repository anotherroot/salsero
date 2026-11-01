/** Captions for the recordings and lesson videos in the log popup. PURE, client-safe. */
import { localDay } from '$lib/day/day';
import { byteSize, dayMonth } from '$lib/format';
import type { LessonVideoRow, RecordingRow } from '$lib/types';

export function recordingCaption(
	r: RecordingRow,
	timezone: string
): { title: string; meta: string } {
	const what = r.kind === 'audio' ? 'Audio' : 'Recording';
	return {
		title: `${what} · ${dayMonth(localDay(r.createdAt, timezone))}`,
		meta: byteSize(r.sizeBytes)
	};
}

export function lessonVideoCaption(
	index: number,
	v: LessonVideoRow
): { title: string; meta: string } {
	return { title: `Video ${index + 1}`, meta: byteSize(v.sizeBytes) };
}
