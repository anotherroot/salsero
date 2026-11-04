import { fail } from '@sveltejs/kit';
import { appsLines, gbToBytes } from '$lib/admin-view';
import { DANCE_SLUGS, type DanceSlug } from '$lib/dances/dances';
import { localDay } from '$lib/day/day';
import { listAppsSeen } from '$lib/server/app-seen';
import { getDb } from '$lib/server/db';
import { int } from '$lib/server/form';
import { createInvite, inviteQr } from '$lib/server/invites';
import { requireAdmin } from '$lib/server/scope';
import { teamLimit, teamsMade } from '$lib/server/teams';
import {
	freeDisk,
	limitsTotal,
	listOpenRequests,
	listPeople,
	listTeamsForAdmin,
	resolveRequest,
	setGroupLimit,
	setStorageLimit,
	setTeamLimit
} from '$lib/server/storage';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, parent }) => {
	requireAdmin(locals);
	const { lastDance } = await parent();
	const tz = locals.user!.timezone;
	const db = getDb();
	const now = Date.now();
	const today = localDay(now, tz);
	const seen = listAppsSeen(db);
	return {
		dance: lastDance,
		// Numbers and names only: never a lesson title or anything a person made.
		limitsTotalBytes: limitsTotal(db),
		freeBytes: await freeDisk(),
		groups: listTeamsForAdmin(db),
		requests: listOpenRequests(db).map((r) => ({ ...r, day: localDay(r.createdAt, tz) })),
		people: listPeople(db).map((p) => ({
			...p,
			day: localDay(p.createdAt, tz),
			groupsMade: Object.fromEntries(DANCE_SLUGS.map((d) => [d, teamsMade(db, p.id, d)])) as Record<
				DanceSlug,
				number
			>,
			groupLimit: teamLimit(db, p.id),
			apps: appsLines(
				seen.filter((s) => s.userId === p.id).map((s) => ({ ...s, day: localDay(s.seenAt, tz) })),
				today
			)
		}))
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
	},

	/** One group's limit: a preset, a typed GB, or back to the computed one. */
	setTeamLimit: async ({ locals, request }) => {
		requireAdmin(locals);
		const form = await request.formData();
		const teamId = int(form, 'teamId');
		const limit = form.get('computed') !== null ? null : limitFrom(form);
		if (limit === undefined) return fail(400, { message: BAD_LIMIT });
		if (teamId === undefined || !setTeamLimit(getDb(), teamId, limit)) {
			return fail(404, { message: 'That group is gone.' });
		}
		return { ok: true };
	},

	/** How many groups one person may make; empty = the default. */
	setGroupLimit: async ({ locals, request }) => {
		requireAdmin(locals);
		const form = await request.formData();
		const userId = String(form.get('userId') ?? '');
		const raw = String(form.get('n') ?? '').trim();
		const n = form.get('default') !== null || raw === '' ? null : Number(raw);
		if (n !== null && !(Number.isInteger(n) && n >= 0 && n <= 1000)) {
			return fail(400, { message: 'Give a whole number of groups, 0 or more.' });
		}
		if (!userId || !setGroupLimit(getDb(), userId, n)) {
			return fail(404, { message: 'That person is gone.' });
		}
		return { ok: true };
	}
};
