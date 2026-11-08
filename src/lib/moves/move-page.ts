/** The words on a move's page (board C0 p2). PURE, client-safe. */
import { t } from '$lib/i18n/catalog';

/** "Move · 3 figures". */
export function moveSubtitle(n: number): string {
	return t().moves.move.subtitle(t().nouns.figures(n));
}

/** "Routine · Doble and Básica" (the figures it uses), or "Lesson". */
export function usedInMeta(kind: 'routine' | 'lesson', figureNames: string[]): string {
	const w = t().moves.move;
	if (kind === 'lesson') return w.lesson;
	const names = w.and(figureNames);
	return names ? `${w.routine} · ${names}` : w.routine;
}
