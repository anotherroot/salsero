<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { UPLOAD_CHUNK_BYTES } from '$lib/limits';
	import { byteSize } from '$lib/format';

	/**
	 * Upload a file in slices, so its size is bounded by the disk rather than by
	 * what one request can carry — Cloudflare rejects a body over 100 MB, and a
	 * class video is far bigger than that.
	 *
	 * A sibling of `UploadButton` rather than a mode inside it. That one is a
	 * single request with a single status code; this is a loop with per-chunk
	 * retry, offset reconciliation and aggregate progress, and success only on
	 * the last request. Folding both into one component would put all of that in
	 * the path figure recordings take, which works today and has no tests.
	 */
	interface Props {
		/** `PUT {uploadUrl}/{uploadId}` carries each chunk. */
		uploadUrl: string;
		accept: string;
		label: string;
		maxBytes: number;
	}

	let { uploadUrl, accept, label, maxBytes }: Props = $props();

	let progress = $state<number | null>(null);
	let message = $state<string | null>(null);
	let input: HTMLInputElement | undefined = $state();

	/** One chunk. Resolves to the server's byte count, or the finished row. */
	function putChunk(
		url: string,
		blob: Blob,
		start: number,
		total: number,
		file: File,
		onprogress: (loaded: number) => void
	): Promise<{ done: boolean; received: number; status: number; body: string }> {
		return new Promise((resolve, reject) => {
			const xhr = new XMLHttpRequest();
			xhr.open('PUT', url);
			xhr.setRequestHeader('content-type', file.type);
			xhr.setRequestHeader('content-range', `bytes ${start}-${start + blob.size - 1}/${total}`);
			xhr.setRequestHeader('x-filename', encodeURIComponent(file.name));
			// XHR, not fetch: an 8 MiB chunk on mobile data takes tens of seconds,
			// and a progress bar that only moves between chunks reads as hung.
			xhr.upload.onprogress = (e) => {
				if (e.lengthComputable) onprogress(e.loaded);
			};
			xhr.onload = () => {
				const header = xhr.getResponseHeader('x-received-bytes');
				resolve({
					done: xhr.status === 201,
					received: header === null ? start + blob.size : Number(header),
					status: xhr.status,
					body: xhr.responseText
				});
			};
			xhr.onerror = () => reject(new Error('network'));
			xhr.onabort = () => reject(new Error('aborted'));
			xhr.send(blob);
		});
	}

	function errorFrom(status: number, body: string): string {
		try {
			return JSON.parse(body).message ?? body;
		} catch {
			return body || `Upload failed (${status}).`;
		}
	}

	async function upload(file: File) {
		message = null;
		if (file.size > maxBytes) {
			message = `That file is ${byteSize(file.size)}; the limit is ${byteSize(maxBytes)}.`;
			return;
		}
		if (!/^video\//.test(file.type)) {
			message = 'Only video files can be added.';
			return;
		}

		const id = crypto.randomUUID();
		const url = `${uploadUrl}/${id}`;
		let sent = 0;
		let attempts = 0;
		progress = 0;

		while (sent < file.size) {
			const blob = file.slice(sent, Math.min(sent + UPLOAD_CHUNK_BYTES, file.size));
			let res;
			try {
				res = await putChunk(url, blob, sent, file.size, file, (loaded) => {
					progress = (sent + loaded) / file.size;
				});
			} catch {
				// A dropped connection leaves the partial truncated to the last good
				// offset, so retrying the same chunk is always safe.
				if (++attempts > 3) {
					progress = null;
					message = 'The connection dropped. Try again.';
					return;
				}
				await new Promise((r) => setTimeout(r, 500 * attempts));
				continue;
			}

			if (res.status === 409) {
				// The server says the file is at a different offset. Believe it.
				sent = res.received;
				progress = sent / file.size;
				if (++attempts > 3) {
					progress = null;
					message = 'That upload got out of step. Try again.';
					return;
				}
				continue;
			}
			if (res.status >= 400) {
				progress = null;
				message = errorFrom(res.status, res.body);
				return;
			}

			attempts = 0;
			sent = res.received;
			progress = sent / file.size;

			if (res.done) {
				progress = null;
				if (input) input.value = '';
				await invalidateAll();
				return;
			}
		}

		progress = null;
		message = 'The upload finished but the video was not saved. Try again.';
	}
</script>

<label
	class="flex h-12 cursor-pointer items-center justify-center rounded-xl border border-dashed border-rule text-[14px] font-medium text-accent"
>
	{progress === null ? label : `Uploading… ${Math.round(progress * 100)}%`}
	<input
		bind:this={input}
		type="file"
		{accept}
		class="sr-only"
		disabled={progress !== null}
		onchange={(e) => {
			const file = e.currentTarget.files?.[0];
			if (file) upload(file);
		}}
	/>
</label>

{#if progress !== null}
	<div class="mt-2 h-1 overflow-hidden rounded-full bg-rule">
		<div class="h-full bg-accent transition-all" style="width: {progress * 100}%"></div>
	</div>
{/if}

{#if message}
	<p class="mt-2 text-[13px] text-danger">{message}</p>
{/if}
