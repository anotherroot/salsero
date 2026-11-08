import type { SubmitFunction } from '@sveltejs/kit';
import { RATING_OF, type Feel } from '$lib/schedule/feel';
import { t } from '$lib/i18n/catalog';
import type { DoneResult } from '$lib/types';

/** What the Done sheet's save reads and writes: the sheet's own state, through getters and setters. */
export interface DoneForm {
	/** The face just tapped, for the submit it starts. */
	tapped: Feel | null;
	/** The lit face. */
	feel: Feel | null;
	/** The face whose save is out: every face disabled, that one lit with a spinner. */
	busy: Feel | null;
	refusal: string | null;
	/** Read at the tap; null posts no durationS. */
	readonly seconds: number | null;
	onsaved(r: DoneResult): void;
}

const messageOf = (data: unknown): string => {
	const m = (data as { message?: unknown } | undefined)?.message;
	return typeof m === 'string' ? m : t().exercise.log.didNotSave;
};

/** The face tap's save: the Done sheet's guarded form's submit callback. */
export function doneSubmit(f: DoneForm): SubmitFunction {
	return ({ formData }) => {
		// A tap names the face; the unsaved dialog's Save sends the lit one, if any.
		const face = f.tapped ?? f.feel;
		if (face !== null) {
			formData.set('rating', String(RATING_OF[face]));
			f.feel = face;
		}
		const seconds = f.seconds;
		if (seconds !== null) formData.set('durationS', String(Math.round(seconds)));
		f.busy = face;
		f.refusal = null;
		return async ({ result, update }) => {
			if (result.type === 'success') {
				try {
					// While the sheet is still open: the page and the day count the save
					// (the row is done) before the caller leaves.
					await update({ reset: false });
				} catch {
					// The save landed; only the refresh failed, and leaving loads the
					// page again. Thrown on, it would skip onsaved and leave the unsaved
					// dialog waiting for an answer that never comes.
				}
				try {
					f.onsaved(result.data as unknown as DoneResult);
				} finally {
					f.busy = null;
					f.tapped = null;
				}
				return;
			}
			f.busy = null;
			f.tapped = null;
			if (result.type === 'redirect') {
				await update();
				return;
			}
			// From the submit's own result: a past day's form posts to Today's
			// route, whose refusal never reaches this page's `form`.
			f.refusal = result.type === 'failure' ? messageOf(result.data) : t().exercise.log.didNotSave;
		};
	};
}
