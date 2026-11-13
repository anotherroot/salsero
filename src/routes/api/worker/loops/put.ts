import { rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { getDb } from '$lib/server/db';
import { failJson, loopsDir } from '$lib/server/files';
import { loopFiles } from '$lib/server/loops/store';
import { gone, idOf } from './gone';

/** A strip of 12 frames is ~25 KB (measured); anything near this is not one. */
export const MAX_LOOP_BYTES = 512 * 1024;

/** A loop's strip or still from the worker: a JPEG, written whole under its name. Again replaces it. */
export async function putLoopFile(
	rawId: string,
	request: Request,
	which: 'strip' | 'still'
): Promise<Response> {
	const files = loopFiles(getDb(), idOf(rawId));
	if (!files) return gone();
	if (Number(request.headers.get('content-length') ?? 0) > MAX_LOOP_BYTES)
		return failJson(413, 'The picture is too large.');
	const bytes = new Uint8Array(await request.arrayBuffer());
	if (bytes.length > MAX_LOOP_BYTES) return failJson(413, 'The picture is too large.');
	if (bytes.length < 3 || bytes[0] !== 0xff || bytes[1] !== 0xd8 || bytes[2] !== 0xff)
		return failJson(400, 'The picture must be a JPEG.');
	const path = join(loopsDir(), files[which]);
	await writeFile(`${path}.part`, bytes);
	await rename(`${path}.part`, path);
	return new Response(null, { status: 204 });
}
