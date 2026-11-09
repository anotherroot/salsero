import { getDb } from '$lib/server/db';
import { failJson } from '$lib/server/files';
import { timelineDir, timelineSource } from '$lib/server/ai-timelines/store';
import { parsePiece } from '$lib/server/ai-timelines/piece';
import { writePiece } from '$lib/server/ai-timelines/files';
import { gone, idOf } from '../../../gone';
import type { RequestHandler } from './$types';

/** A piece's body: a minute of frames and sound, base64 in JSON. */
const MAX_BODY = 4 * 1024 * 1024;
/** An hour of video is 60 pieces. */
const MAX_PIECES = 60;

/** One minute of a timeline, from the worker. Uploading it again replaces it. */
export const PUT: RequestHandler = async ({ params, request }) => {
	const id = idOf(params.id);
	if (!id || !timelineSource(getDb(), id)) return gone(id);
	const k = Number(params.k);
	if (!Number.isInteger(k) || k < 0 || k >= MAX_PIECES)
		return failJson(400, `The piece number must be 0 to ${MAX_PIECES - 1}.`);
	if (Number(request.headers.get('content-length') ?? 0) > MAX_BODY)
		return failJson(413, 'The piece is too large.');
	const text = await request.text();
	if (text.length > MAX_BODY) return failJson(413, 'The piece is too large.');
	let raw: unknown;
	try {
		raw = JSON.parse(text);
	} catch {
		return failJson(400, 'The piece must be JSON.');
	}
	const piece = parsePiece(raw, k);
	if (typeof piece === 'string') return failJson(400, piece);
	await writePiece(timelineDir(id), k, piece);
	return new Response(null, { status: 204 });
};
