import { error, json } from '@sveltejs/kit';
import { t } from '$lib/i18n/catalog';
import { getDb } from '$lib/server/db';
import { figureSheet } from '$lib/server/loops/look';
import type { RequestHandler } from './$types';

const idOf = (raw: string | null) => (raw !== null && /^\d{1,16}$/.test(raw) ? Number(raw) : 0);

/**
 * A figure's preview sheet (picker preview). Flat: the account's dance is the
 * wall. `?spot=` names the section its row's picture was cut from. Another
 * person's, another dance's and a missing one: the same 404. Answered on the
 * device from its copy offline (`DEVICE_ENDPOINTS`).
 */
export const GET: RequestHandler = ({ params, url, locals }) => {
	const id = idOf(params.id);
	const spot = idOf(url.searchParams.get('spot'));
	const sheet = id ? figureSheet(getDb(), locals.user!, id, spot || null) : null;
	if (!sheet) throw error(404, t().refusals.notFound);
	return json(sheet);
};
