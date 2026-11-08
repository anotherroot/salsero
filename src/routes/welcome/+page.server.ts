import { eq } from 'drizzle-orm';
import { error, fail, redirect } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import { users } from '$lib/server/db/schema';
import { cleanName } from '$lib/names';
import { t } from '$lib/i18n/catalog';
import { safeNext } from '$lib/safe-next';
import type { Actions, PageServerLoad } from './$types';

/**
 * Asks a signed-in person without a name for one (hooks.server.ts sends them
 * here). A named person who opens it is sent on, so the page is never a place
 * to get stuck.
 */
export const load: PageServerLoad = async ({ locals, url }) => {
	if (!locals.user) throw error(401);
	const next = safeNext(url.searchParams.get('next'));
	if (locals.user.firstName) throw redirect(303, next);
	return { next, dance: locals.user.dance };
};

export const actions: Actions = {
	default: async ({ locals, request, url }) => {
		if (!locals.user) throw error(401);
		const form = await request.formData();
		const firstName = cleanName(form.get('firstName'));
		const lastName = cleanName(form.get('lastName'));
		const raw = {
			firstName: String(form.get('firstName') ?? '').trim(),
			lastName: String(form.get('lastName') ?? '').trim()
		};
		if (!firstName) {
			return fail(400, {
				...raw,
				field: 'firstName' as const,
				message: t().entry.name.firstRefusal
			});
		}
		if (!lastName) {
			return fail(400, {
				...raw,
				field: 'lastName' as const,
				message: t().entry.name.lastRefusal
			});
		}
		getDb().update(users).set({ firstName, lastName }).where(eq(users.id, locals.user.id)).run();
		throw redirect(303, safeNext(String(form.get('next') ?? url.searchParams.get('next') ?? '/')));
	}
};
