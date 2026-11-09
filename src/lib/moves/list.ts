/**
 * The Figures list's words under each figure row and over the list: figures sit
 * under their move's heading (board C0). PURE, client-safe.
 */
import type { FigureRow } from '$lib/types';
import { t } from '$lib/i18n/catalog';
import { differLabel } from './sync';

/** The parts of a figure row's meta; `status` ones are what it still lacks. */
export function figureRowParts(
	f: Pick<
		FigureRow,
		'startCount' | 'lengthCounts' | 'recordings' | 'hasSection' | 'hasLesson' | 'differ'
	>
): { text: string; status: boolean; warn?: true }[] {
	const w = t();
	const parts: { text: string; status: boolean; warn?: true }[] = [];
	if (f.startCount !== null)
		parts.push({ text: w.moves.row.startsOn(f.startCount), status: false });
	if (f.lengthCounts !== null) {
		parts.push({ text: w.nouns.counts(f.lengthCounts), status: false });
	}
	if (f.recordings > 0) {
		parts.push({ text: w.nouns.recordings(f.recordings), status: false });
	}
	// A row with copies says so in its Clone chip (`cloneChip`), as a twin's does, not here.
	if (!f.hasSection) parts.push({ text: w.moves.row.noSection, status: true });
	if (!f.hasLesson) parts.push({ text: w.moves.row.noLesson, status: true });
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
 * folded twin is not counted twice. `lead` is the owner word ("Yours", the
 * default); null drops it.
 */
export function movesHeading(
	n: { moves: number; figures: number },
	matching: boolean,
	lead: string | null = t().moves.heading.yours
): string {
	if (matching) return t().moves.heading.matching(n.figures);
	const count = t().nouns.figures(n.figures);
	return lead ? `${lead} · ${count}` : count;
}

/**
 * Under a move's heading, when groups' twins folded into it (board C7 p3):
 * "3 figures · also in Salsa Tuesdays, Rueda club". The figures are the ones
 * the list shows, so a folded twin is counted once.
 */
export function moveMeta(figures: number, also: string[]): string {
	return t().moves.heading.alsoIn(t().nouns.figures(figures), also);
}
