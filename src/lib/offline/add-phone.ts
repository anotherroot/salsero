/*
 * Adding a video on a phone (offline phase 4c): on the person's own figure or
 * lesson it stays on this phone as the original, and only its row goes to the
 * copy (a device write, synced later); Upload sends it later. A group's place,
 * a computer and an Android app too old to keep gallery originals upload at
 * once, as before.
 */
import { phoneFirst, type PhoneEnv } from './phone-first';
import type { OriginalPut } from './protocol';

export type AddMode = 'phone' | 'upload' | 'app-phone' | 'app-link';

/** What adding a video does here; `own`: the person's own figure or lesson. */
export function addMode(env: PhoneEnv, own: boolean): AddMode {
	if (env.app) return env.appVideos && own ? 'app-phone' : 'app-link';
	return own && phoneFirst(env) ? 'phone' : 'upload';
}

const EXT = /^[a-z0-9]{1,5}$/;
const BY_TYPE: Record<string, string> = {
	'video/mp4': 'mp4',
	'video/quicktime': 'mov',
	'video/webm': 'webm',
	'video/x-matroska': 'mkv',
	'video/3gpp': '3gp'
};

/** The original's name: a uuid and an extension the server's file rule takes. */
export function phoneFileName(file: { name: string; type: string }, uuid: string): string {
	const byType = BY_TYPE[file.type.split(';')[0].trim().toLowerCase()];
	const byName = /\.([^.]+)$/.exec(file.name)?.[1]?.toLowerCase();
	const ext = byType ?? (byName && EXT.test(byName) ? byName : 'mp4');
	return `${uuid}.${ext}`;
}

export type AddTarget = { figureId: number } | { lessonId: number };

type Deps = {
	put: (file: string, mime: string, blob: Blob) => Promise<OriginalPut>;
	post: (url: string, body: unknown) => Promise<Response>;
	drop: (file: string) => Promise<boolean>;
	uuid: () => string;
	/** This device's id slot, as it knows it. */
	slot: () => number | null;
};

export function phoneRoute(target: AddTarget): string {
	return 'figureId' in target
		? `/api/figures/${target.figureId}/recordings/phone`
		: `/api/lessons/${target.lessonId}/videos/phone`;
}

/** The original first (nothing to point at otherwise), then the row; a refused row drops it. */
export async function addOnPhone(
	target: AddTarget,
	file: File,
	deps: Deps
): Promise<
	{ ok: true; file: string; id: number } | { ok: false; reason: 'space' | 'store' | 'refused' }
> {
	const name = phoneFileName(file, deps.uuid());
	const mime = file.type || 'video/mp4';
	const stored = await deps.put(name, mime, file);
	if (!stored.ok) return stored;
	const slot = deps.slot();
	let res: Response | null;
	try {
		res = await deps.post(phoneRoute(target), {
			file: name,
			mime,
			sizeBytes: file.size,
			...(slot === null ? {} : { slot })
		});
	} catch {
		res = null;
	}
	if (!res || !res.ok) {
		await deps.drop(name);
		return { ok: false, reason: 'refused' };
	}
	const row = (await res.json().catch(() => null)) as { id?: unknown } | null;
	return { ok: true, file: name, id: typeof row?.id === 'number' ? row.id : 0 };
}
