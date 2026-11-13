import { rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { getDb } from '$lib/server/db';
import { failJson, loopsDir } from '$lib/server/files';
import { loopFiles } from '$lib/server/loops/store';
import { gone, idOf } from './gone';

/**
 * The most a loop's file may be: a 60 s clip at 128 px is ~240 KB (measured ~4 KB a second), a
 * still ~3 KB. Anything near these is not one.
 */
export const MAX_LOOP_BYTES = { clip: 1024 * 1024, still: 512 * 1024 } as const;

/** An MP4 starts with a box whose type is `ftyp`; a JPEG with FF D8 FF. */
const isMp4 = (b: Uint8Array) =>
	b.length >= 8 && b[4] === 0x66 && b[5] === 0x74 && b[6] === 0x79 && b[7] === 0x70;
const isJpeg = (b: Uint8Array) => b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;

/** A loop's clip or still from the worker, written whole under its name. Again replaces it. */
export async function putLoopFile(
	rawId: string,
	request: Request,
	which: 'clip' | 'still'
): Promise<Response> {
	const files = loopFiles(getDb(), idOf(rawId));
	if (!files) return gone();
	const max = MAX_LOOP_BYTES[which];
	if (Number(request.headers.get('content-length') ?? 0) > max)
		return failJson(413, 'The file is too large.');
	const bytes = new Uint8Array(await request.arrayBuffer());
	if (bytes.length > max) return failJson(413, 'The file is too large.');
	if (which === 'clip' ? !isMp4(bytes) : !isJpeg(bytes))
		return failJson(
			400,
			which === 'clip' ? 'The clip must be an MP4.' : 'The still must be a JPEG.'
		);
	const path = join(loopsDir(), files[which]);
	await writeFile(`${path}.part`, bytes);
	await rename(`${path}.part`, path);
	return new Response(null, { status: 204 });
}
