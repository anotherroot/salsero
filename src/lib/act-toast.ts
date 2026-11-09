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

/**
 * Whether a refused result is the service worker's offline refusal (a write
 * that could not reach the server, `$lib/offline/needs-connection`). The root
 * layout has said so already, in the person's language: a page shows no
 * refusal of its own for it, but still treats it as refused.
 */
export function offlineRefusal(result: ActionResult): boolean {
	return (
		result.type === 'failure' &&
		(result.data as { offline?: unknown } | undefined)?.offline === true
	);
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
