import { fail } from '@sveltejs/kit';
import { appsLines, gbToBytes } from '$lib/admin-view';
import { inviteLink } from '$lib/dances/hosts';
import { localDay } from '$lib/day/day';
import { t } from '$lib/i18n/catalog';
import { parseLocale } from '$lib/i18n/locale';
import { readDecimal } from '$lib/i18n/number';
import { listAppsSeen } from '$lib/server/app-seen';
import { getDb } from '$lib/server/db';
import { int } from '$lib/server/form';
import { localeOf, setLocale } from '$lib/server/locale';
import { danceHosts } from '$lib/server/hosts';
import { createInvite, inviteQr } from '$lib/server/invites';
import { requireAdmin } from '$lib/server/scope';
import { teamLimit, teamsMade } from '$lib/server/teams';
import {
	adminReaches,
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

import { serverNow } from '$lib/server/server-clock';
export const load: PageServerLoad = async ({ locals }) => {
	requireAdmin(locals);
	const tz = locals.user!.timezone;
	// The admin of one dance: its people, groups and requests only (the dance split).
	const dance = locals.user!.dance;
	const db = getDb();
	const now = serverNow();
	const today = localDay(now, tz);
	const seen = listAppsSeen(db);
	return {
		dance,
		// Numbers and names only: never a lesson title or anything a person made.
		limitsTotalBytes: limitsTotal(db),
		freeBytes: await freeDisk(),
		groups: listTeamsForAdmin(db, dance),
		requests: listOpenRequests(db, dance).map((r) => ({ ...r, day: localDay(r.createdAt, tz) })),
		people: listPeople(db, dance).map((p) => ({
			...p,
			day: localDay(p.createdAt, tz),
			groupsMade: teamsMade(db, p.id, dance),
			groupLimit: teamLimit(db, p.id),
			locale: localeOf(db, p.id) ?? 'en',
			apps: appsLines(
				seen.filter((s) => s.userId === p.id).map((s) => ({ ...s, day: localDay(s.seenAt, tz) })),
				today,
				dance
			)
		}))
	};
};

/**
 * The limit in GB. A preset button the admin pressed (`preset`) is explicit and
 * wins over whatever is typed; with no preset, the typed `gb` is used (Enter in
 * the field sends only `gb`, since the form's first submit is an unnamed one).
 * A typed number takes a decimal comma or point ("1,5", "1.5": `readDecimal`).
 * undefined when it is not a positive number.
 */
function limitFrom(form: FormData): number | undefined {
	const raw = String(form.get('preset') || form.get('gb') || '').trim();
	if (raw === '') return undefined;
	const gb = readDecimal(raw);
	return gb === null ? undefined : gbToBytes(gb);
}

export const actions: Actions = {
	/**
	 * Makes a new code (and ends the previous unused one) in the chosen language;
	 * the code is only in this response. No language (a page opened before the
	 * choice) is English, as every invite was then.
	 */
	invite: async ({ locals, url, request }) => {
		requireAdmin(locals);
		const raw = (await request.formData()).get('locale');
		const locale = raw === null ? 'en' : parseLocale(raw);
		if (!locale) return fail(400, { message: t().admin.badLanguage });
		const { code, expiresAt } = createInvite(
			getDb(),
			locals.user!.id,
			locals.user!.dance,
			serverNow(),
			locale
		);
		const link = inviteLink({
			hosts: danceHosts(),
			dance: locals.user!.dance,
			protocol: url.protocol,
			host: url.host,
			code
		});
		return { url: link, qr: inviteQr(link), expiresAt };
	},

	/** Give a waiting request a new limit (a preset or a typed GB). */
	grant: async ({ locals, request }) => {
		requireAdmin(locals);
		const form = await request.formData();
		const id = int(form, 'id');
		const limit = limitFrom(form);
		if (id === undefined) return fail(400, { message: t().admin.refused.pickRequest });
		if (limit === undefined) return fail(400, { message: t().admin.refused.badLimit });
		const reach = adminReaches(getDb(), locals.user!.dance, { requestId: id });
		if (!reach || !resolveRequest(getDb(), id, 'granted', limit, serverNow())) {
			return fail(404, { message: t().admin.refused.requestClosed });
		}
		return { ok: true };
	},

	/** Close a request and leave the limit as it is. */
	decline: async ({ locals, request }) => {
		requireAdmin(locals);
		const id = int(await request.formData(), 'id');
		if (id === undefined) return fail(400, { message: t().admin.refused.pickRequest });
		const reach = adminReaches(getDb(), locals.user!.dance, { requestId: id });
		if (!reach || !resolveRequest(getDb(), id, 'declined', null, serverNow())) {
			return fail(404, { message: t().admin.refused.requestClosed });
		}
		return { ok: true };
	},

	/** One person's limit: a preset, a typed GB, or no limit. */
	setLimit: async ({ locals, request }) => {
		requireAdmin(locals);
		const form = await request.formData();
		const userId = String(form.get('userId') ?? '');
		const limit = form.get('none') !== null ? null : limitFrom(form);
		if (limit === undefined) return fail(400, { message: t().admin.refused.badLimit });
		const reach = !!userId && adminReaches(getDb(), locals.user!.dance, { userId });
		if (!reach || !setStorageLimit(getDb(), userId, limit)) {
			return fail(404, { message: t().admin.refused.personGone });
		}
		return { ok: true };
	},

	/** One group's limit: a preset, a typed GB, or back to the computed one. */
	setTeamLimit: async ({ locals, request }) => {
		requireAdmin(locals);
		const form = await request.formData();
		const teamId = int(form, 'teamId');
		const limit = form.get('computed') !== null ? null : limitFrom(form);
		if (limit === undefined) return fail(400, { message: t().admin.refused.badLimit });
		if (
			teamId === undefined ||
			!adminReaches(getDb(), locals.user!.dance, { teamId }) ||
			!setTeamLimit(getDb(), teamId, limit)
		) {
			return fail(404, { message: t().admin.refused.groupGone });
		}
		return { ok: true };
	},

	/** One person's language. */
	setLocale: async ({ locals, request }) => {
		requireAdmin(locals);
		const form = await request.formData();
		const userId = String(form.get('userId') ?? '');
		const locale = parseLocale(form.get('locale'));
		if (!locale) return fail(400, { message: t().admin.badLanguage });
		const reach = !!userId && adminReaches(getDb(), locals.user!.dance, { userId });
		if (!reach) return fail(404, { message: t().admin.refused.personGone });
		setLocale(getDb(), userId, locale);
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
			return fail(400, { message: t().admin.refused.badGroupLimit });
		}
		const reach = !!userId && adminReaches(getDb(), locals.user!.dance, { userId });
		if (!reach || !setGroupLimit(getDb(), userId, n)) {
			return fail(404, { message: t().admin.refused.personGone });
		}
		return { ok: true };
	}
};
