/*
 * Upload on a person's phone-only video (offline phase 4c), on an iPhone or a
 * phone's browser: the original this phone holds goes up whole (a browser
 * cannot compress it), chunk by chunk, to its row's file route; the server
 * then counts it. The Where button shows how far (`uploads.svelte.ts`).
 */
import { putChunks } from '$lib/upload-chunks';
import { getOriginal, syncNow } from './device.svelte';
import { startUpload, uploadOf } from './uploads.svelte';
import { appOriginals } from './places.svelte';
import { uploadFromApp } from './app-originals.svelte';
import { appVideos, uploadEnd } from './app-videos';

export type OriginalTarget = { table: 'recordings' | 'lesson_videos'; id: number; file: string };

type Deps = {
	get: (file: string) => Promise<Blob | null>;
	put: (
		url: string,
		blob: Blob,
		o: { type: string; name: string; onBytes: (n: number) => void }
	) => Promise<{ ok: true; body: string } | { ok: false; reason: string }>;
	uuid: () => string;
	/** After it lands: a sync, so the row's server copy reaches the copy. */
	synced: () => void;
	/** Before it: what waits in the outbox goes up, so the row is on the server (a fresh add's). */
	pushFirst?: () => Promise<unknown>;
};
const DEFAULTS: Deps = {
	get: getOriginal,
	put: (url, blob, o) => putChunks(url, blob, o),
	uuid: () => crypto.randomUUID(),
	synced: () => void syncNow(),
	pushFirst: () => syncNow()
};

export function fileRoute(v: OriginalTarget, uploadId: string): string {
	const base = v.table === 'recordings' ? 'recordings' : 'lesson-videos';
	return `/api/${base}/${v.id}/file/${uploadId}`;
}

export async function uploadOriginal(
	v: OriginalTarget,
	deps: Deps = DEFAULTS
): Promise<{ ok: true } | { ok: false; reason: string | null }> {
	// The Android app holds it in the gallery: the app compresses and sends it (part 2).
	if (deps === DEFAULTS && appOriginals.files.includes(v.file))
		return (await uploadFromApp(v.table, v.id, v.file))
			? { ok: true }
			: { ok: false, reason: null };
	// A second Upload while one runs joins it: the first one's outcome is told by the first.
	if (uploadOf(v.file) !== null) {
		await startUpload(v.file, async () => {}).catch(() => {});
		return { ok: true };
	}
	let out: { ok: true } | { ok: false; reason: string | null } = { ok: false, reason: null };
	await startUpload(v.file, async (onPct) => {
		await deps.pushFirst?.();
		const blob = await deps.get(v.file);
		if (!blob) return;
		const res = await deps.put(fileRoute(v, deps.uuid()), blob, {
			type: blob.type || 'video/mp4',
			name: v.file,
			onBytes: (n) => onPct(blob.size > 0 ? (n / blob.size) * 100 : 100)
		});
		out = res.ok ? { ok: true } : { ok: false, reason: res.reason };
	}).catch(() => {});
	if (out.ok) deps.synced();
	return out;
}

type LandDeps = {
	/** The Android app holds it: its upload runs in the app's queue, past Upload's answer. */
	inApp: (file: string) => boolean;
	/** Whether the app's upload of the file landed; listened to before it is queued. */
	ended: (file: string) => Promise<boolean>;
	upload: (v: OriginalTarget) => Promise<{ ok: true } | { ok: false; reason: string | null }>;
};
const LAND: LandDeps = {
	inApp: (file) => appOriginals.files.includes(file),
	ended: (file) => {
		const app = appVideos();
		return app ? uploadEnd(app, file) : Promise.resolve(false);
	},
	upload: (v) => uploadOriginal(v)
};

/** Upload, answered once the video is on the server (Move to uploads first, then moves). */
export async function landOriginal(
	v: OriginalTarget,
	deps: LandDeps = LAND
): Promise<{ ok: true } | { ok: false; reason: string | null }> {
	if (!deps.inApp(v.file)) return deps.upload(v);
	const ended = deps.ended(v.file);
	const out = await deps.upload(v);
	if (!out.ok) return out;
	return (await ended) ? { ok: true } : { ok: false, reason: null };
}
