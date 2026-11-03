import type { SubmitFunction } from '@sveltejs/kit';
import { linkRefusal } from '$lib/picker/view';

/** What a hidden link form is about to send: read by its submit, synchronously. */
export interface LinkSent {
	key: string;
	label: string;
	keep: boolean;
}

export interface LinkSubmitHost {
	/** The pending send; reading it clears it. */
	take(): LinkSent | null;
	/** Counts openings, so an answer after a close is not counted in the next one. */
	opening(): number;
	inFlight: { add(key: string): unknown; delete(key: string): unknown };
	setMessage(message: string | null): void;
	/** A + made its link: the opening's count goes up. */
	added(): void;
	/** A tap made its link: close the picker. */
	close(): void;
	/**
	 * The refusal said the target was archived since ("Archived by Ana"):
	 * the picker offers Pick another, and Restore when `restorable`.
	 */
	archived?(sent: LinkSent, restorable: boolean): void;
}

/** A refusal's `archived` (the server's "Archived by Ana"), or null. */
export function archivedOf(data: unknown): { restorable: boolean } | null {
	const a = data && typeof data === 'object' ? (data as { archived?: unknown }).archived : null;
	if (!a || typeof a !== 'object') return null;
	return { restorable: (a as { restorable?: unknown }).restorable === true };
}

/**
 * The `use:enhance` callback of a picker's hidden link form. A refusal
 * (`fail()`, a 4xx) shows the server's message; a thrown error (a 5xx) has
 * nothing to say to the user, so the banner gets the plain sentence.
 */
export function linkSubmit(h: LinkSubmitHost): SubmitFunction {
	return () => {
		const sent = h.take();
		const at = h.opening();
		if (sent) h.inFlight.add(sent.key);
		h.setMessage(null);
		return async ({ result, update }) => {
			if (sent) h.inFlight.delete(sent.key);
			const here = at === h.opening();
			if (result.type === 'failure' || result.type === 'error') {
				const said = result.type === 'failure' ? result.data : undefined;
				if (here) {
					h.setMessage(linkRefusal((said as { message?: unknown } | undefined)?.message, sent));
					const archived = archivedOf(said);
					if (archived && sent) h.archived?.(sent, archived.restorable);
				}
				return;
			}
			await update();
			if (result.type !== 'success' || !here || !sent) return;
			if (sent.keep) h.added();
			else h.close();
		};
	};
}
