import { invalidateAll } from '$app/navigation';
import { noteSaved } from '$lib/offline/device.svelte';
import type { DanceSlug } from '$lib/dances/dances';
import { MAX_RECORDING_LABEL } from '$lib/limits';
import { uploadFailure } from '$lib/upload-error';
import { track } from '$lib/unsaved/guard.svelte';
import { holdReload } from '$lib/nav/fresh.svelte';
import { t } from '$lib/i18n/catalog';

/*
 * The song upload in flight, in a module store rather than inside a button:
 * the Add a song sheet closes as soon as the upload starts, and its progress
 * row sits in Music's Being added group. The XHR outlives an in-app
 * navigation, so the row is still there on the way back; only a reload or a
 * closed tab cuts it off, and that asks first.
 */

export type SongUpload = {
	/** Which Music it shows in. */
	dance: DanceSlug;
	name: string;
	loaded: number;
	total: number;
	error: string | null;
};

export const upload = $state<{ current: SongUpload | null }>({ current: null });

let untrack: (() => void) | null = null;
let unhold: (() => void) | null = null;

function release() {
	untrack?.();
	untrack = null;
	unhold?.();
	unhold = null;
}

function fail(message: string) {
	release();
	if (upload.current) upload.current.error = message;
}

/**
 * Send `file` to `/api/songs` for `dance`, filed under `style`, as `team`'s
 * draft in group mode (the endpoint checks they edit it). A no-op while
 * another upload is moving: one at a time. The file is assumed checked
 * (`audioFileProblem`); the server checks again.
 *
 * XHR rather than fetch for upload progress: a phone upload over mobile data
 * can take a minute, and a spinner with no number reads as hung.
 */
export function startSongUpload(
	file: File,
	dance: DanceSlug,
	style: string,
	team: number | null = null
): void {
	if (upload.current && upload.current.error === null) return;

	upload.current = { dance, name: file.name, loaded: 0, total: file.size, error: null };
	untrack = track({ label: t().shell.upload.anUpload, dirty: () => true, unloadOnly: true });
	// A deploy waits for it too, rather than reloading the page under it.
	unhold = holdReload();

	const xhr = new XMLHttpRequest();
	const into = team === null ? '' : `&team=${team}`;
	xhr.open('POST', `/api/songs?dance=${encodeURIComponent(dance)}${into}`);
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
			// The device's copy has none of it yet (`noteSaved`).
			noteSaved();
			// The song's own row replaces this one once the list has it. A reload
			// that fails must not leave Upload disabled behind a finished upload.
			try {
				await invalidateAll();
			} finally {
				upload.current = null;
			}
			return;
		}
		const fallback =
			xhr.status === 413 ? t().shell.upload.tooLarge(MAX_RECORDING_LABEL) : t().shell.upload.failed;
		fail(uploadFailure(xhr.responseText, fallback));
	};
	xhr.onerror = () => fail(t().shell.upload.connection);
	xhr.send(file);
}

/** Clear a failed upload's row. */
export function dismissUpload(): void {
	if (upload.current?.error === null) return;
	upload.current = null;
}
