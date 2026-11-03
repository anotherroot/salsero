/**
 * The Figures list's words under each figure row and over the list: figures sit
 * under their move's heading (board C0). PURE, client-safe.
 */
import type { FigureRow } from '$lib/types';
import { plural } from '$lib/format';

/** The parts of a figure row's meta; `status` ones are what it still lacks. */
export function figureRowParts(
	f: Pick<FigureRow, 'startCount' | 'lengthCounts' | 'recordings' | 'hasSection' | 'hasLesson'>
): { text: string; status: boolean }[] {
	const parts: { text: string; status: boolean }[] = [];
	if (f.startCount !== null) parts.push({ text: `Starts on ${f.startCount}`, status: false });
	if (f.lengthCounts !== null) {
		parts.push({ text: plural(f.lengthCounts, 'count', 'counts'), status: false });
	}
	if (f.recordings > 0) {
		parts.push({ text: plural(f.recordings, 'recording', 'recordings'), status: false });
	}
	if (!f.hasSection) parts.push({ text: 'No section', status: true });
	if (!f.hasLesson) parts.push({ text: 'No lesson', status: true });
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
 * search or a chip narrows it. `lead` is the owner word ("Yours"); null drops it.
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
