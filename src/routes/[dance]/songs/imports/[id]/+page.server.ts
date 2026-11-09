import { fail, redirect } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import { requireImportAccess } from '$lib/server/scope';
import { addFromImport, dismissImport, itemsOf, pickItems } from '$lib/server/song-imports';
import { readPicks } from '$lib/server/import-form';
import { ownerOfRow, roomForOwner } from '$lib/server/storage';
import { oneOf } from '$lib/server/form';
import { DANCES } from '$lib/dances/dances';
import { t } from '$lib/i18n/catalog';
import type { Actions, PageServerLoad } from './$types';

/**
 * The pick list of a pasted playlist (option A2). The import's own space: a
 * group's list is its editors', picked from Mine too. A list no longer
 * waiting (added, dismissed, still reading, failed) sends back to Music.
 */
export const load: PageServerLoad = ({ params, locals }) => {
	const db = getDb();
	const { imp } = requireImportAccess(db, locals, params, params.id, { finished: true });
	// Added from another tab, dismissed, or not read yet: Music shows where it stands.
	if (imp.status !== 'ready' || imp.addedAt !== null || imp.dismissedAt !== null)
		redirect(303, `/${params.dance}/songs`);
	return {
		imp: { id: imp.id, kind: imp.kind, name: imp.name, truncated: imp.truncated === 1 },
		items: pickItems(db, imp)
	};
};

export const actions: Actions = {
	add: async ({ params, request, locals }) => {
		const db = getDb();
		// A list added or dismissed meanwhile (another tab, another editor) is refused in words.
		const { imp, space } = requireImportAccess(db, locals, params, params.id, { finished: true });
		if (imp.addedAt !== null || imp.dismissedAt !== null)
			return fail(409, { message: t().songs.imports.gone });
		const form = await request.formData();
		const styles = DANCES[space.dance].styles;
		const styleForAll = oneOf(form, 'styleForAll', styles) ?? styles[0];
		const picks = readPicks(String(form.get('picks') ?? ''), itemsOf(imp), styles, styleForAll);
		if (picks === null) return fail(400, { message: t().songs.pick.badPicks });
		if (picks.length === 0) return fail(400, { message: t().songs.pick.refused });
		// Sizes are unknown until the worker has them: refused only at or over the limit, as a pasted song is.
		const room = roomForOwner(db, ownerOfRow(imp), 1, Number.POSITIVE_INFINITY);
		if (!room.ok) return fail(413, { message: room.message });
		const done = addFromImport(db, space, imp.id, picks);
		if (!done.ok) return fail(409, { message: t().songs.imports.gone });
		redirect(303, `/${params.dance}/songs`);
	},

	dismiss: ({ params, locals }) => {
		const db = getDb();
		// Already gone (added or dismissed elsewhere): Music shows where it stands.
		const { imp } = requireImportAccess(db, locals, params, params.id, { finished: true });
		dismissImport(db, imp.id);
		redirect(303, `/${params.dance}/songs`);
	}
};
