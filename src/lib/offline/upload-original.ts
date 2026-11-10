/*
 * Upload on a person's phone-only video (offline phase 4c), on an iPhone or a
 * phone's browser: the original this phone holds goes up whole (a browser
 * cannot compress it), chunk by chunk, to its row's file route; the server
 * then counts it. The Where button shows how far (`uploads.svelte.ts`).
 */
import { putChunks } from '$lib/upload-chunks';
import { getOriginal, syncNow } from './device.svelte';
import { startUpload } from './uploads.svelte';

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
};
const DEFAULTS: Deps = {
	get: getOriginal,
	put: (url, blob, o) => putChunks(url, blob, o),
	uuid: () => crypto.randomUUID(),
	synced: () => void syncNow()
};

export function fileRoute(v: OriginalTarget, uploadId: string): string {
	const base = v.table === 'recordings' ? 'recordings' : 'lesson-videos';
	return `/api/${base}/${v.id}/file/${uploadId}`;
}

export async function uploadOriginal(
	v: OriginalTarget,
	deps: Deps = DEFAULTS
): Promise<{ ok: true } | { ok: false; reason: string | null }> {
	let out: { ok: true } | { ok: false; reason: string | null } = { ok: false, reason: null };
	await startUpload(v.file, async (onPct) => {
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
