import { json } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import { failJson } from '$lib/server/files';
import {
	finishTimeline,
	PIECE_MS,
	timelineDir,
	timelineSource
} from '$lib/server/ai-timelines/store';
import { piecesPresent } from '$lib/server/ai-timelines/files';
import { serverNow } from '$lib/server/server-clock';
import { gone, idOf } from '../../gone';
import type { RequestHandler } from './$types';

/** Every piece is in: the timeline is ready for the AI. */
export const POST: RequestHandler = async ({ params, request }) => {
	const id = idOf(params.id);
	const db = getDb();
	if (!id || !timelineSource(db, id)) return gone(id);
	const body = (await request.json().catch(() => ({}))) as {
		pieces?: unknown;
		duration_ms?: unknown;
	};
	const pieces = body.pieces;
	const durationMs = body.duration_ms;
	if (
		typeof pieces !== 'number' ||
		typeof durationMs !== 'number' ||
		!Number.isInteger(durationMs) ||
		durationMs <= 0 ||
		pieces !== Math.ceil(durationMs / PIECE_MS)
	)
		return failJson(400, 'pieces must be duration_ms / 60000, rounded up.');
	if (!(await piecesPresent(timelineDir(id), pieces)))
		return failJson(400, 'Not every piece is in.');
	if (!finishTimeline(db, id, pieces, durationMs, serverNow()))
		return failJson(409, 'This timeline is not waiting for pieces.');
	return json({ ok: true }, { status: 201 });
};
