import { randomUUID } from 'node:crypto';
import { writeGate } from '$lib/server/sync/gate';
import { unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { error, json } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import {
	MAX_RECORDING_BYTES,
	MAX_RECORDING_LABEL,
	TooLargeError,
	audioDir,
	extensionFor,
	safeDecodeHeader,
	saveStream
} from '$lib/server/files';
import { createSongFromUpload } from '$lib/server/songs';
import { freeDisk, roomForOwner, type Owner } from '$lib/server/storage';
import { getTeam, roleOf } from '$lib/server/teams';
import type { Space } from '$lib/server/scope';
import { DANCES, isDanceSlug, type DanceSlug } from '$lib/dances/dances';
import { t } from '$lib/i18n/catalog';
import type { RequestHandler } from './$types';

/**
 * The space an upload names: the person's own, or with `?team=` a group they
 * own or edit, live and of this dance. Anything else is the stranger's 404,
 * before a byte is written: a file never lands in a space by guessing. The
 * group-mode cookie is never read here.
 */
function uploadSpace(userId: string, dance: DanceSlug, team: string | null): Space {
	if (team === null) return { userId, dance };
	const id = /^[1-9][0-9]{0,9}$/.test(team) ? Number(team) : 0;
	const found = id ? getTeam(getDb(), id) : null;
	const role = found ? roleOf(getDb(), userId, found.id) : null;
	if (
		!found ||
		found.dance !== dance ||
		found.deletedAt !== null ||
		found.purgedAt !== null ||
		(role !== 'owner' && role !== 'editor')
	) {
		throw error(404, t().refusals.noGroup);
	}
	return { dance, teamId: found.id, actorId: userId };
}

/** Upload a song file from the browser. Raw body, streamed — see the recordings endpoint. */
export const POST: RequestHandler = async ({ request, url, locals }) => {
	// The endpoint is shared by both dances (it stays flat, out of `[dance]`),
	// so the caller has to say which one it is uploading into. No default: a
	// guess here would file the song on the wrong side of the wall.
	if (!locals.user) throw error(401, t().refusals.signIn);
	const dance = url.searchParams.get('dance') ?? '';
	if (!isDanceSlug(dance)) return new Response(t().refusals.unknownDance, { status: 400 });
	// Only the account's own dance (the dance split): the other is a stranger's.
	if (dance !== locals.user.dance) throw error(404, t().refusals.notFound);
	const space = uploadSpace(locals.user.id, dance, url.searchParams.get('team'));
	const owner: Owner = 'teamId' in space ? { teamId: space.teamId } : { userId: locals.user.id };

	const mime = (request.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase();
	if (!mime.startsWith('audio/')) throw error(415, t().songs.add.audioOnly);
	if (Number(request.headers.get('content-length') ?? 0) > MAX_RECORDING_BYTES) {
		throw error(413, t().shell.upload.larger(MAX_RECORDING_LABEL));
	}
	const room = roomForOwner(
		getDb(),
		owner,
		Number(request.headers.get('content-length') ?? 0),
		await freeDisk()
	);
	if (!room.ok) throw error(413, room.message);
	if (!request.body) throw error(400, t().shell.upload.empty);

	const name = safeDecodeHeader(request.headers.get('x-filename'));
	const styleHeader = request.headers.get('x-style') ?? '';
	const style = DANCES[dance].styles.includes(styleHeader) ? styleHeader : DANCES[dance].styles[0];
	const file = `${randomUUID()}.${extensionFor(mime, name)}`;
	const path = join(audioDir(), file);

	let bytes: number;
	try {
		bytes = await saveStream(request.body, path, MAX_RECORDING_BYTES);
	} catch (err) {
		if (err instanceof TooLargeError)
			throw error(413, t().shell.upload.larger(MAX_RECORDING_LABEL));
		throw error(400, t().shell.upload.interrupted);
	}
	if (bytes === 0) {
		await unlink(path).catch(() => {});
		throw error(400, t().shell.upload.empty);
	}

	// The file is already on the disk: the floor is what is free without it.
	const after = roomForOwner(getDb(), owner, bytes, (await freeDisk()) + bytes);
	if (!after.ok) {
		await unlink(path).catch(() => {});
		throw error(413, after.message);
	}

	const title = name.replace(/\.[a-z0-9]{1,5}$/i, '').slice(0, 200);
	// Under the write gate: the body is in, only the database write waits for a replay.
	const song = await writeGate.shared(async () =>
		createSongFromUpload(getDb(), space, {
			file,
			mime,
			title,
			style,
			sizeBytes: bytes
		})
	);
	return json({ id: song.id }, { status: 201 });
};
