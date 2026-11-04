/** PURE, client-safe: what a lesson's page shows. */
import { frequencyLabel } from '$lib/frequency';
import { PARTNER_LABEL } from '$lib/labels';
import type {
	LessonExerciseRow,
	LessonFigureRow,
	LessonRoutineRow,
	ViaSection,
	VideoSection
} from '$lib/types';
import { spotTime } from '$lib/video/spots';

/** `Figures · 3`, bare at zero. */
export function sectionHeading(label: string, n: number): string {
	return n === 0 ? label : `${label} · ${n}`;
}

/** The badge on a row that is on the lesson through sections. */
export function viaBadge(via: ViaSection[]): string | null {
	if (via.length === 0) return null;
	return via.length === 1 ? 'via section' : `via ${via.length} sections`;
}

/** `1:12.0–1:30.4, 3:05.0–3:22.8`. */
export function viaRanges(via: ViaSection[]): string {
	return via.map((v) => `${spotTime(v.startMs)}–${spotTime(v.endMs)}`).join(', ');
}

export function figureMeta(f: Pick<LessonFigureRow, 'partner' | 'viaSections'>): string {
	return f.viaSections.length > 0 ? viaRanges(f.viaSections) : PARTNER_LABEL[f.partner];
}

/** A link card on a group's lesson that opens the person's own copy says so. */
export function yoursMeta(meta: string | null, mineId: number | null): string | null {
	if (mineId === null) return meta;
	return meta === null || meta === '' ? 'Yours' : `Yours · ${meta}`;
}

export function routineMeta(r: Pick<LessonRoutineRow, 'everyDays'>): string | null {
	return r.everyDays === null ? null : frequencyLabel(r.everyDays);
}

export function exerciseMeta(e: Pick<LessonExerciseRow, 'viaSections' | 'everyDays'>): string {
	return e.viaSections.length > 0 ? viaRanges(e.viaSections) : frequencyLabel(e.everyDays);
}

/** The review exercise's line, with `inactive` picked out. */
export function reviewMeta(e: {
	everyDays: number;
	active: boolean;
}): { text: string; strong: boolean }[] {
	const parts = [{ text: frequencyLabel(e.everyDays), strong: false }];
	if (!e.active) parts.push({ text: 'inactive', strong: true });
	parts.push({ text: 'review exercise', strong: false });
	return parts;
}

export function unlinkViaBody(label: string, via: ViaSection[]): string {
	const noun = via.length === 1 ? 'section' : 'sections';
	return `${label} is on this lesson through ${noun} ${viaRanges(via)}. Unlink it from the lesson and the ${noun}?`;
}

export function deleteVideoBody(sections: number): string {
	const tail = 'Lesson videos aren’t backed up, so this can’t be undone.';
	if (sections === 0) return tail;
	return `Its ${sections} ${sections === 1 ? 'section goes' : 'sections go'} with it. ${tail}`;
}

/**
 * What blocks deleting a video, worded as the server's `SpotLinkedError` says
 * it. Mirrors `linksBlocking` in `src/lib/server/spot-links.ts`: every link's
 * label, ` (archived)` when archived, de-duplicated, sorted with `localeCompare`.
 */
export function deleteBlock(sections: Pick<VideoSection, 'links'>[]): string | null {
	const labels = sections
		.flatMap((s) => s.links)
		.map((c) => (c.archived ? `${c.label} (archived)` : c.label));
	if (labels.length === 0) return null;
	const sorted = [...new Set(labels)].sort((a, b) => a.localeCompare(b));
	return `Linked to ${sorted.join(', ')} — unlink it first.`;
}
