import { fail } from '@sveltejs/kit';
import { gbToBytes } from '$lib/admin-view';
import { localDay } from '$lib/day/day';
import { getDb } from '$lib/server/db';
import { int } from '$lib/server/form';
import { createInvite, inviteQr } from '$lib/server/invites';
import { requireAdmin } from '$lib/server/scope';
import { listOpenRequests, listPeople, resolveRequest, setStorageLimit } from '$lib/server/storage';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, parent }) => {
	requireAdmin(locals);
	const { lastDance } = await parent();
	const tz = locals.user!.timezone;
	const db = getDb();
	return {
		dance: lastDance,
		requests: listOpenRequests(db).map((r) => ({ ...r, day: localDay(r.createdAt, tz) })),
		people: listPeople(db).map((p) => ({ ...p, day: localDay(p.createdAt, tz) }))
	};
};

/**
 * The limit in GB. A preset button the admin pressed (`preset`) is explicit and
 * wins over whatever is typed; with no preset, the typed `gb` is used (Enter in
 * the field sends only `gb`, since the form's first submit is an unnamed one).
 * undefined when it is not a positive number.
 */
function limitFrom(form: FormData): number | undefined {
	const raw = String(form.get('preset') || form.get('gb') || '').trim();
	if (raw === '') return undefined;
	return gbToBytes(Number(raw));
}

const BAD_LIMIT = 'Give a limit in GB, more than zero.';

export const actions: Actions = {
	/** Makes a new code (and ends the previous unused one); the code is only in this response. */
	invite: async ({ locals, url }) => {
		requireAdmin(locals);
		const { code, expiresAt } = createInvite(getDb(), locals.user!.id, Date.now());
		const link = `${url.origin}/join?code=${code}`;
		return { url: link, qr: inviteQr(link), expiresAt };
	},

	/** Give a waiting request a new limit (a preset or a typed GB). */
	grant: async ({ locals, request }) => {
		requireAdmin(locals);
		const form = await request.formData();
		const id = int(form, 'id');
		const limit = limitFrom(form);
		if (id === undefined) return fail(400, { message: 'Pick a request.' });
		if (limit === undefined) return fail(400, { message: BAD_LIMIT });
		if (!resolveRequest(getDb(), id, 'granted', limit, Date.now())) {
			return fail(404, { message: 'That request is already closed.' });
		}
		return { ok: true };
	},

	/** Close a request and leave the limit as it is. */
	decline: async ({ locals, request }) => {
		requireAdmin(locals);
		const id = int(await request.formData(), 'id');
		if (id === undefined) return fail(400, { message: 'Pick a request.' });
		if (!resolveRequest(getDb(), id, 'declined', null, Date.now())) {
			return fail(404, { message: 'That request is already closed.' });
		}
		return { ok: true };
	},

	/** One person's limit: a preset, a typed GB, or no limit. */
	setLimit: async ({ locals, request }) => {
		requireAdmin(locals);
		const form = await request.formData();
		const userId = String(form.get('userId') ?? '');
		const limit = form.get('none') !== null ? null : limitFrom(form);
		if (limit === undefined) return fail(400, { message: BAD_LIMIT });
		if (!userId || !setStorageLimit(getDb(), userId, limit)) {
			return fail(404, { message: 'That person is gone.' });
		}
		return { ok: true };
	}
};
