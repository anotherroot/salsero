import { join } from 'node:path';
import { error } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import { shotOf } from '$lib/server/feedback';
import { feedbackDir, serveFile } from '$lib/server/files';
import { requireAdmin } from '$lib/server/scope';
import { t } from '$lib/i18n/catalog';
import type { RequestHandler } from './$types';

/** A feedback message's screenshot: the admin of its dance only; anything else is a 404. */
export const GET: RequestHandler = async ({ params, locals, request }) => {
	requireAdmin(locals);
	const id = Number(params.id);
	const shot = Number.isInteger(id) ? shotOf(getDb(), locals.user!.dance, id) : null;
	if (shot === null) throw error(404, t().refusals.notFound);
	return serveFile(join(feedbackDir(), shot), 'image/jpeg', request);
};
