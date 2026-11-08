/**
 * The song page's Edit saves as you go (spec 2026-11-08, "Saving: as you
 * go"): each change is one action, and its toast's Undo posts `restore` with
 * what the field held before. Undo is one more save, with `seen`, so a clash
 * shows as any refused save does. Client glue over `act`; no DOM.
 */
import { act, type Field } from '$lib/act';
import { refusalMessage, undoToast, type ToastState } from '$lib/act-toast';
import { t } from '$lib/i18n/catalog';
import { serial } from '$lib/serial';
import type { ActionResult } from '@sveltejs/kit';

/** What a field held before a change: what Undo puts back. */
export type UndoOf = {
	field: 'count' | 'countSections' | 'sections' | 'sample' | 'start';
	value: unknown;
};

let next = 0;

/**
 * One change at a time: a quick second change (› twice, a chip then Count off)
 * waits for the first to land, so it sends the `seen` and the Undo value of the
 * song as the first left it, not a clash with the editor's own change.
 */
const inTurn = serial();

/** Post one Edit action; on success the toast says `message`, with Undo when `undo` is given. */
export async function editAct(opts: {
	name: string;
	fields?: Record<string, Field>;
	/** The song as the editor saw it, read when sent (a group's song, or one with copies). */
	seen: () => string;
	message: string;
	/** What Undo puts back, read when this change's turn comes (after the one before it landed). */
	undo: UndoOf | null | (() => UndoOf | null);
	toast: (toast: ToastState | null) => void;
}): Promise<ActionResult> {
	return inTurn(() => send(opts));
}

async function send(opts: Parameters<typeof editAct>[0]): Promise<ActionResult> {
	const undo = typeof opts.undo === 'function' ? opts.undo() : opts.undo;
	const seen = opts.seen();
	const result = await act(opts.name, { ...opts.fields, ...(seen ? { seen } : {}) });
	const id = ++next;
	if (result.type !== 'success') {
		opts.toast({ id, message: refusalMessage(result, t().songs.page.refused.badValue) ?? '' });
		return result;
	}
	opts.toast(
		undo
			? undoToast(
					id,
					opts.message,
					() => opts.toast(null),
					() =>
						editAct({
							name: 'restore',
							fields: { field: undo.field, value: JSON.stringify(undo.value) },
							seen: opts.seen,
							message: '',
							undo: null,
							toast: (toast) => {
								// A restored field needs no toast of its own; a refusal does.
								if (toast?.message) opts.toast(toast);
							}
						})
				)
			: { id, message: opts.message }
	);
	return result;
}
