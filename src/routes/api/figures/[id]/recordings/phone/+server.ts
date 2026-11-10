import { error, json } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import { t } from '$lib/i18n/catalog';
import { addPhoneRecording, phoneRefusal, readPhoneVideo } from '$lib/server/phone-videos';
import { flowAfter } from '$lib/server/clones/flow-hook';
import type { RequestHandler } from './$types';

/**
 * A recording kept only on the phone (offline phase 4c): the row, with no
 * file on the server. A device write: it runs on the device first and is
 * replayed. A group's figure, another person's and a missing one: 404.
 */
export const POST: RequestHandler = async ({ params, request, locals }) => {
	const figureId = Number(params.id);
	if (!locals.user || !Number.isInteger(figureId)) throw error(404, t().refusals.figureNotFound);
	const body = readPhoneVideo(await request.json().catch(() => null));
	if ('refused' in body) throw error(400, phoneRefusal(body.refused));
	const rec = addPhoneRecording(getDb(), locals.user.id, figureId, body);
	if (!rec) throw error(404, t().refusals.figureNotFound);
	// Keep in step: the variation gained a recording; a phone-only one stays behind.
	await flowAfter(locals.user.id, 'figure', figureId);
	return json(rec, { status: 201 });
};
