/**
 * A target's name on screen: its counts where it is named by them, else the
 * reader's words. Read at call time, like every catalog word.
 */
import { t } from '$lib/i18n/catalog';
import { TARGET_DIGITS, type TargetId } from './targets';

export function targetLabel(id: TargetId): string {
	const words = t().hearing.targets;
	return TARGET_DIGITS[id] ?? words[id as keyof typeof words];
}
