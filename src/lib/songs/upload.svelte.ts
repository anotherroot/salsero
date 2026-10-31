import { invalidateAll } from '$app/navigation';
import type { DanceSlug } from '$lib/dances/dances';
import { MAX_RECORDING_LABEL } from '$lib/limits';
import { track } from '$lib/unsaved/guard.svelte';

/*
 * The song upload in flight, in a module store rather than inside a button:
 * the Add a song sheet closes as soon as the upload starts, and its progress
 * row sits in Music's Being added group. The XHR outlives an in-app
 * navigation, so the row is still there on the way back; only a reload or a
 * closed tab cuts it off, and that asks first.
 */

export type SongUpload = { name: string; loaded: number; total: number; error: string | null };

export const upload = $state<{ current: SongUpload | null }>({ current: null });

let untrack: (() => void) | null = null;

function release() {
	untrack?.();
	untrack = null;
}

function fail(message: string) {
	release();
	if (upload.current) upload.current.error = message;
}

/**
 * Send `file` to `/api/songs` for `dance`, filed under `style`. A no-op while
 * another upload is moving: one at a time. The file is assumed checked
 * (`audioFileProblem`); the server checks again.
 *
 * XHR rather than fetch for upload progress: a phone upload over mobile data
 * can take a minute, and a spinner with no number reads as hung.
 */
export function startSongUpload(file: File, dance: DanceSlug, style: string): void {
	if (upload.current && upload.current.error === null) return;

	upload.current = { name: file.name, loaded: 0, total: file.size, error: null };
	untrack = track({ label: 'An upload', dirty: () => true, unloadOnly: true });

	const xhr = new XMLHttpRequest();
	xhr.open('POST', `/api/songs?dance=${encodeURIComponent(dance)}`);
	xhr.setRequestHeader('content-type', file.type);
	xhr.setRequestHeader('x-filename', encodeURIComponent(file.name));
	xhr.setRequestHeader('x-style', style);
	xhr.upload.onprogress = (e) => {
		if (!upload.current || !e.lengthComputable) return;
		upload.current.loaded = e.loaded;
		upload.current.total = e.total;
	};
	xhr.onload = async () => {
		if (xhr.status === 201) {
			release();
			// The song's own row replaces this one once the list has it.
			await invalidateAll();
			upload.current = null;
			return;
		}
		if (xhr.status === 413) return fail(`That file is too large (limit ${MAX_RECORDING_LABEL}).`);
		let text = xhr.responseText;
		try {
			text = JSON.parse(text).message ?? text;
		} catch {
			/* plain-text error body */
		}
		fail(text || 'Upload failed.');
	};
	xhr.onerror = () => fail('Upload failed — check the connection and try again.');
	xhr.send(file);
}

/** Clear a failed upload's row. */
export function dismissUpload(): void {
	if (upload.current?.error === null) return;
	upload.current = null;
}
