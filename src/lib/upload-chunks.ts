/*
 * A blob sent chunk by chunk to a resumable upload route (lesson videos,
 * recordings, a phone-only video's server copy): the server's byte count is
 * the truth (409 + `x-received-bytes`), a dropped connection sends the same
 * chunk again, a refusal stops with its words. XHR under it, for progress
 * inside a chunk.
 */
import { t } from '$lib/i18n/catalog';
import { UPLOAD_CHUNK_BYTES } from '$lib/limits';
import { messageFromBody } from '$lib/upload-error';

export type PutChunk = (
	url: string,
	blob: Blob,
	start: number,
	total: number,
	head: { type: string; name: string },
	onLoaded: (loaded: number) => void
) => Promise<{ status: number; received: number; body: string }>;

/** One chunk by XHR (an 8 MiB chunk on mobile data takes tens of seconds: progress inside it). */
export const xhrPut: PutChunk = (url, blob, start, total, head, onLoaded) =>
	new Promise((resolve, reject) => {
		const xhr = new XMLHttpRequest();
		xhr.open('PUT', url);
		xhr.setRequestHeader('content-type', head.type);
		xhr.setRequestHeader('content-range', `bytes ${start}-${start + blob.size - 1}/${total}`);
		xhr.setRequestHeader('x-filename', encodeURIComponent(head.name));
		xhr.upload.onprogress = (e) => {
			if (e.lengthComputable) onLoaded(e.loaded);
		};
		xhr.onload = () => {
			const header = xhr.getResponseHeader('x-received-bytes');
			resolve({
				status: xhr.status,
				received: header === null ? start + blob.size : Number(header),
				body: xhr.responseText
			});
		};
		xhr.onerror = () => reject(new Error('network'));
		xhr.onabort = () => reject(new Error('aborted'));
		xhr.send(blob);
	});

export async function putChunks(
	url: string,
	blob: Blob,
	o: {
		type: string;
		name: string;
		onBytes?: (sent: number) => void;
		/** Bytes a chunk; the routes' 8 MiB. */
		chunk?: number;
		put?: PutChunk;
		/** A retry's wait, per attempt (ms). */
		wait?: number;
	}
): Promise<{ ok: true; body: string } | { ok: false; reason: string }> {
	const size = o.chunk ?? UPLOAD_CHUNK_BYTES;
	const put = o.put ?? xhrPut;
	const wait = o.wait ?? 500;
	const words = t().refusals.files.reason;
	let sent = 0;
	let attempts = 0;
	while (sent < blob.size) {
		const part = blob.slice(sent, Math.min(sent + size, blob.size));
		let res;
		try {
			res = await put(url, part, sent, blob.size, { type: o.type, name: o.name }, (loaded) =>
				o.onBytes?.(sent + loaded)
			);
		} catch {
			// The partial is truncated to the last good offset: the same chunk again is safe.
			if (++attempts > 3) return { ok: false, reason: words.connection };
			await new Promise((r) => setTimeout(r, wait * attempts));
			continue;
		}
		if (res.status === 409) {
			sent = res.received;
			o.onBytes?.(sent);
			if (++attempts > 3) return { ok: false, reason: words.outOfStep };
			continue;
		}
		if (res.status >= 400)
			return { ok: false, reason: messageFromBody(res.body) || words.status(res.status) };
		attempts = 0;
		sent = res.received;
		o.onBytes?.(sent);
		if (res.status === 201) return { ok: true, body: res.body };
	}
	return { ok: false, reason: words.notSaved };
}
