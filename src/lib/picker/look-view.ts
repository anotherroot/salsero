/**
 * The preview sheet's words and its request (picker preview, S1). PURE and
 * client-safe; the sheet is `components/picker/LookSheet.svelte`.
 */
import { dateLabel } from '$lib/format';
import { t } from '$lib/i18n/catalog';
import { parseLoopName } from '$lib/video/loops';
import type { FigureSheet, Picture } from '$lib/types';

/** A move's sheet shows this many of its variations, then "and N more". */
export const MOVE_ROWS = 6;

/** The sheet's main button: what a tap on the row does in this picker. */
export function verbOf(kind: 'link' | 'act' | 'field'): string {
	const w = t().picker.look;
	return kind === 'link' ? w.linkThis : kind === 'act' ? w.addThis : w.pickThis;
}

/** The sheet's data: a figure with the section its row's picture was cut from, or a move. */
export function sheetUrl(look: { kind: 'figure' | 'move'; id: number }, picture: Picture): string {
	if (look.kind === 'move') return `/api/moves/${look.id}/look`;
	const spot = picture ? parseLoopName(picture.clip.slice('/loops/'.length)) : null;
	return `/api/figures/${look.id}/look${spot ? `?spot=${spot.id}` : ''}`;
}

/** Under the video: the lesson and its day, or the person's own recording. */
export function videoFrom(from: NonNullable<FigureSheet['video']>['from']): string {
	return from.kind === 'lesson'
		? `${from.title} · ${dateLabel(from.lessonDay)}`
		: t().picker.look.yourRecording;
}

/** A side's positions, joined as a row joins them: "Abierta or Cerrada". */
export const sideWords = (names: string[]): string => names.join(` ${t().figure.or} `);
