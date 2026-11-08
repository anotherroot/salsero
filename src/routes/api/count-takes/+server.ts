import { randomUUID } from 'node:crypto';
import { unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { error, json } from '@sveltejs/kit';
import { PHRASE_PATTERNS, TEMPO_LADDER, type PhrasePattern } from '$lib/labels';
import { MAX_PRE_ROLL_S, MAX_TAKE_BYTES, MAX_TAKE_LABEL } from '$lib/limits';
import { putCountTake } from '$lib/server/countTakes';
import { getDb } from '$lib/server/db';
import { TooLargeError, countDir, saveStream } from '$lib/server/files';
import { freeDisk, roomForOwner, takeSlotBytes } from '$lib/server/storage';
import { t } from '$lib/i18n/catalog';
import type { RequestHandler } from './$types';

/** A header that must be a finite number in a sane range, or the upload is refused. */
function num(raw: string | null, min: number, max: number): number | null {
	const n = Number(raw);
	return Number.isFinite(n) && n >= min && n <= max ? n : null;
}

/**
 * Upload one recorded half-bar of the count.
 *
 * Raw body, not multipart, matching `api/figures/[id]/recordings` — though
 * these are ~200 KB rather than a phone video, so the cap is `MAX_TAKE_BYTES`.
 * Metadata rides in headers because the body is the WAV itself.
 *
 * Everything here is validated even though only our own recorder posts it: a
 * bad `pattern` or `bpm` would sit in the table until the player looked for a
 * take and found one it could not place, which surfaces as silence rather than
 * as an error.
 */
export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.user) throw error(401, t().refusals.signIn);
	const h = request.headers;

	const pattern = h.get('x-pattern');
	if (!(PHRASE_PATTERNS as readonly string[]).includes(pattern ?? '')) {
		throw error(400, t().refusals.take.unknownPattern);
	}
	const bpm = Number(h.get('x-bpm'));
	if (!(TEMPO_LADDER as readonly number[]).includes(bpm)) {
		throw error(400, t().refusals.take.tempo);
	}
	const phrase = h.get('x-phrase');
	if (phrase !== 'a' && phrase !== 'b') throw error(400, t().refusals.take.phrase);

	const sampleRate = num(h.get('x-sample-rate'), 8000, 192000);
	// The phrase itself is three or four beats; at the slowest rung that is 2 s.
	const lengthS = num(h.get('x-length'), 0.2, 5);
	const preRollS = num(h.get('x-pre-roll'), 0, MAX_PRE_ROLL_S);
	const durationS = num(h.get('x-duration'), 0.2, 8);
	if (sampleRate === null || lengthS === null || preRollS === null || durationS === null) {
		throw error(400, t().refusals.take.metadata);
	}
	if (durationS < lengthS) throw error(400, t().refusals.take.shorter);

	if (Number(h.get('content-length') ?? 0) > MAX_TAKE_BYTES) {
		throw error(413, t().settings.voice.takeTooLarge(MAX_TAKE_LABEL));
	}
	// A take replacing one in the same slot only adds the difference.
	const replacedBytes = takeSlotBytes(getDb(), locals.user.id, { pattern: pattern!, bpm, phrase });
	const room = roomForOwner(
		getDb(),
		{ userId: locals.user.id },
		Math.max(0, Number(h.get('content-length') ?? 0) - replacedBytes),
		await freeDisk()
	);
	if (!room.ok) throw error(413, room.message);
	if (!request.body) throw error(400, t().refusals.take.empty);

	const file = `${randomUUID()}.wav`;
	const path = join(countDir(), file);
	let sizeBytes: number;
	try {
		sizeBytes = await saveStream(request.body, path, MAX_TAKE_BYTES);
	} catch (e) {
		if (e instanceof TooLargeError)
			throw error(413, t().settings.voice.takeTooLarge(MAX_TAKE_LABEL));
		throw e;
	}

	// The file is already on the disk: the floor is what is free without it.
	const after = roomForOwner(
		getDb(),
		{ userId: locals.user.id },
		Math.max(0, sizeBytes - replacedBytes),
		(await freeDisk()) + sizeBytes
	);
	if (!after.ok) {
		await unlink(path).catch(() => {});
		throw error(413, after.message);
	}

	const { replaced } = putCountTake(getDb(), locals.user.id, {
		pattern: pattern as PhrasePattern,
		bpm,
		phrase,
		file,
		sampleRate,
		preRollS,
		lengthS,
		durationS,
		sizeBytes
	});

	// The row for the old take is already gone; its file is now unreferenced.
	// Outside the transaction on purpose — a failed unlink leaves a stray file,
	// which is harmless, and must not undo a good recording.
	if (replaced) await unlink(join(countDir(), replaced)).catch(() => {});

	return json({ ok: true }, { status: 201 });
};
