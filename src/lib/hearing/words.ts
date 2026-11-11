/**
 * A target's name on screen: its counts where it is named by them, else the
 * reader's words. Read at call time, like every catalog word.
 */
import { t } from '$lib/i18n/catalog';
import { TARGET_DIGITS, ownCounts, type TargetId } from './targets';

export function targetLabel(id: TargetId, own: readonly number[] = []): string {
	const words = t().hearing.targets;
	if (id === 'own') {
		const counts = ownCounts(own);
		return counts.length ? counts.join(' ') : words.own;
	}
	return TARGET_DIGITS[id] ?? words[id as keyof typeof words];
}
