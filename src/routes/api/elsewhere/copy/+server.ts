import { error, json } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { t } from '$lib/i18n/catalog';
import { getDb } from '$lib/server/db';
import { positions } from '$lib/server/db/schema';
import { elsewhereGroup } from '$lib/server/elsewhere';
import { copyLinkRequest, useOnly } from '$lib/server/link-elsewhere';
import { runCopyLink } from '$lib/server/copy-link-form';
import { positionSummary } from '$lib/server/positions';
import type { DanceSlug } from '$lib/dances/dances';
import type { RequestHandler } from './$types';

/**
 * Copy and use (link from other places, in a group's field pickers: a
 * figure's Starts in and Ends in, a routine's slots): copy a row from the
 * person's own app or another group into the group `into`, as a clone, and
 * answer its id there (`{ into, kind, id, use, restore? }`); the page then
 * uses it as any of the group's rows. A position answers its summary too, for
 * the picker it was picked in. The server's alone (network): a copy writes
 * many rows and files. Flat: the account's dance is the dance; a group the
 * person does not edit is a 404. `{ restore }` (409) when the family's member
 * in the group is archived, for Restore and use.
 */
export const POST: RequestHandler = async ({ request, locals }) => {
	const user = locals.user!;
	const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
	const into = body?.into;
	const teamId = typeof into === 'number' && Number.isSafeInteger(into) && into > 0 ? into : 0;
	const db = getDb();
	const group = teamId ? elsewhereGroup(db, user.id, user.dance as DanceSlug, teamId) : null;
	if (!group) throw error(404, t().refusals.notFound);
	const req = copyLinkRequest(body);
	if (!req) throw error(400, t().clones.copyHere.failedUse);
	const res = await runCopyLink(db, group, req, useOnly);
	if (!res.ok) {
		if ('restore' in res) return json({ restore: res.restore }, { status: 409 });
		if (res.reason === 'denied') throw error(404, t().refusals.notFound);
		const status = res.reason === 'room' ? 413 : 409;
		return json({ message: res.message ?? t().clones.copyHere.failedUse }, { status });
	}
	const row =
		req.kind === 'position'
			? db.select().from(positions).where(eq(positions.id, res.id)).get()
			: undefined;
	return json({
		id: res.id,
		made: res.made,
		...(row ? { position: positionSummary(row, group) } : {})
	});
};
