import { error, json } from '@sveltejs/kit';
import { t } from '$lib/i18n/catalog';
import { getDb } from '$lib/server/db';
import { moveSheet } from '$lib/server/loops/look';
import type { RequestHandler } from './$types';

/**
 * A move's preview sheet (picker preview): its live variations, each with its
 * look. Flat: the account's dance is the wall; another's and a missing one, one
 * 404. Answered on the device from its copy offline (`DEVICE_ENDPOINTS`).
 */
export const GET: RequestHandler = ({ params, locals }) => {
	const id = /^\d{1,16}$/.test(params.id) ? Number(params.id) : 0;
	const sheet = id ? moveSheet(getDb(), locals.user!, id) : null;
	if (!sheet) throw error(404, t().refusals.notFound);
	return json(sheet);
};
