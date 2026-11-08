/**
 * The Figures list's words under each figure row and over the list: figures sit
 * under their move's heading (board C0). PURE, client-safe.
 */
import type { FigureRow } from '$lib/types';
import { plural } from '$lib/format';
import { differLabel } from './sync';

/** The parts of a figure row's meta; `status` ones are what it still lacks. */
export function figureRowParts(
	f: Pick<
		FigureRow,
		'startCount' | 'lengthCounts' | 'recordings' | 'hasSection' | 'hasLesson' | 'differ'
	>
): { text: string; status: boolean; warn?: true }[] {
	const parts: { text: string; status: boolean; warn?: true }[] = [];
	if (f.startCount !== null) parts.push({ text: `Starts on ${f.startCount}`, status: false });
	if (f.lengthCounts !== null) {
		parts.push({ text: plural(f.lengthCounts, 'count', 'counts'), status: false });
	}
	if (f.recordings > 0) {
		parts.push({ text: plural(f.recordings, 'recording', 'recordings'), status: false });
	}
	if (!f.hasSection) parts.push({ text: 'No section', status: true });
	if (!f.hasLesson) parts.push({ text: 'No lesson', status: true });
	const differs = differLabel(f.differ);
	if (differs) parts.push({ text: differs, status: false, warn: true });
	return parts;
}

/** "Starts on 1 · 16 counts · 2 recordings", with "No section" / "No lesson" last. */
export function figureRowMeta(f: Parameters<typeof figureRowParts>[0]): string {
	return figureRowParts(f)
		.map((p) => p.text)
		.join(' · ');
}

/**
 * The label above the list: "Yours · 14 figures", or "3 figures match" while a
 * search or a chip narrows it. Counted after twins fold (`clones/twins.ts`), so a
 * folded twin is not counted twice. `lead` is the owner word ("Yours"); null drops it.
 */
export function movesHeading(
	n: { moves: number; figures: number },
	matching: boolean,
	lead: string | null = 'Yours'
): string {
	if (matching) return plural(n.figures, 'figure matches', 'figures match');
	const count = plural(n.figures, 'figure', 'figures');
	return lead ? `${lead} · ${count}` : count;
}

/**
 * Under a move's heading, when groups' twins folded into it (board C7 p3):
 * "3 figures · also in Salsa Tuesdays, Rueda club". The figures are the ones
 * the list shows, so a folded twin is counted once.
 */
export function moveMeta(figures: number, also: string[]): string {
	return `${plural(figures, 'figure', 'figures')} · also in ${also.join(', ')}`;
}
