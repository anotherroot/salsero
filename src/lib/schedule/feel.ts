/** The four faces a person gives a practice. Stored in `sets.rating` (1–5). */
import { t } from '$lib/i18n/catalog';

export type Feel = 'hard' | 'getting' | 'gotit' | 'easy';

export const FEELS: readonly Feel[] = ['hard', 'getting', 'gotit', 'easy'];

/** A face's name in the current language: "Still hard" … "Easy". */
export function feelWord(feel: Feel): string {
	return t().format.feel[feel];
}

/** What a face writes. */
export const RATING_OF: Record<Feel, 1 | 2 | 4 | 5> = { hard: 1, getting: 2, gotit: 4, easy: 5 };

/** What a stored rating reads as: old star ratings read sensibly, null is none. */
export function feelOf(rating: number | null): Feel | null {
	if (rating === null || !Number.isFinite(rating)) return null;
	if (rating <= 1) return 'hard';
	if (rating === 2) return 'getting';
	if (rating <= 4) return 'gotit';
	return 'easy';
}
