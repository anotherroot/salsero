import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { env } from '$env/dynamic/private';
import { MAX_RECORDING_BYTES, MAX_RECORDING_LABEL } from '$lib/limits';

export { MAX_RECORDING_BYTES, MAX_RECORDING_LABEL };

/** `$DATA_DIR/recordings`, created on first use. */
export function recordingsDir(): string {
	if (!env.DATA_DIR) throw new Error('DATA_DIR is not set');
	const dir = join(env.DATA_DIR, 'recordings');
	mkdirSync(dir, { recursive: true });
	return dir;
}

/** Stored names are ours: a uuid and a short extension. Anything else is refused before touching disk. */
export const RECORDING_FILE_RE =
	/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.[a-z0-9]{1,5}$/;

const EXT_BY_MIME: Record<string, string> = {
	'video/mp4': 'mp4',
	'video/quicktime': 'mov',
	'video/webm': 'webm',
	'video/3gpp': '3gp',
	'audio/mpeg': 'mp3',
	'audio/mp4': 'm4a',
	'audio/x-m4a': 'm4a',
	'audio/aac': 'aac',
	'audio/ogg': 'ogg',
	'audio/webm': 'weba',
	'audio/wav': 'wav',
	'audio/x-wav': 'wav',
	'audio/flac': 'flac'
};

/** An extension for a stored file: from the MIME type, else the original name, else `bin`. */
export function extensionFor(mime: string, originalName: string): string {
	const known = EXT_BY_MIME[mime.split(';')[0].trim().toLowerCase()];
	if (known) return known;
	const m = /\.([a-z0-9]{1,5})$/i.exec(originalName);
	return m ? m[1].toLowerCase() : 'bin';
}
