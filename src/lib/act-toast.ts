/**
 * What a page does with an `act()` result, shared by Settings and My count:
 * the refusal toast's message, and the "… removed · Undo" toast. Lives beside
 * `act` in `$lib/act.ts`. Client-safe.
 */
import type { IconName } from '$lib/icons/icons';
import type { ActionResult } from '@sveltejs/kit';
import { t } from '$lib/i18n/catalog';

export type ToastState = {
	id: number;
	message: string;
	action?: string;
	icon?: IconName;
	tone?: 'done';
	undo?: () => void;
};

/** The message a refused result shows (`fallback` when the server sent none), or null for a success. */
export function refusalMessage(result: ActionResult, fallback: string): string | null {
	if (result.type === 'success') return null;
	const message =
		result.type === 'failure'
			? (result.data as { message?: string } | undefined)?.message
			: undefined;
	return message ?? fallback;
}

/** A toast with an Undo that clears itself first, then runs `restore`. */
export function undoToast(
	id: number,
	message: string,
	clear: () => void,
	restore: () => unknown
): ToastState {
	return {
		id,
		message,
		action: t().common.undo,
		undo: async () => {
			clear();
			await restore();
		}
	};
}
