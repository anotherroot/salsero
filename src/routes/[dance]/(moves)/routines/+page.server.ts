import { fail, redirect } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import { createRoutine } from '$lib/server/routines';
import { optionalText, text } from '$lib/server/form';
import { spaceOf } from '$lib/server/group-mode';
import { t } from '$lib/i18n/catalog';
import type { Actions } from './$types';

export const actions: Actions = {
	create: async ({ params, request, locals, url }) => {
		const space = spaceOf(getDb(), params, locals, url);
		const form = await request.formData();
		const name = text(form, 'name');
		const notes = optionalText(form, 'notes');
		// A refusal names its field, so the sheet shows it under that field and
		// keeps everything typed.
		const refuse = (field: 'name' | 'notes', message: string) =>
			fail(400, {
				field,
				message,
				name: String(form.get('name') ?? ''),
				notes: String(form.get('notes') ?? '')
			});
		if (!name) return refuse('name', t().moves.refused.routineName);
		if (notes === undefined) return refuse('notes', t().moves.refused.notes);
		const { routine } = createRoutine(getDb(), space, { name, notes });
		throw redirect(303, `/${space.dance}/routines/${routine.id}`);
	}
	// No `archive` here on purpose. Archiving a routine is a real loss of a thing
	// you built, and a Remove button sitting on every row of the library is one
	// mis-tap away from it. It lives on the routine's own page, behind a confirm,
	// where you have already opened the thing you are about to discard.
};
