/** The words on a move's page (board C0 p2). PURE, client-safe. */
import { plural } from '$lib/format';

/** "Move · 3 figures". */
export function moveSubtitle(n: number): string {
	return `Move · ${plural(n, 'figure', 'figures')}`;
}

/** "Routine · Doble and Básica" (the figures it uses), or "Lesson". */
export function usedInMeta(kind: 'routine' | 'lesson', figureNames: string[]): string {
	if (kind === 'lesson') return 'Lesson';
	const names =
		figureNames.length <= 1
			? figureNames.join('')
			: `${figureNames.slice(0, -1).join(', ')} and ${figureNames[figureNames.length - 1]}`;
	return names ? `Routine · ${names}` : 'Routine';
}
