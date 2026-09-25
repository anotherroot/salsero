<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { UPLOAD_CHUNK_BYTES } from '$lib/limits';
	import { screenFiles, summarise, type Skipped } from '$lib/upload-queue';

	/**
	 * Upload files in slices, so their size is bounded by the disk rather than by
	 * what one request can carry — Cloudflare rejects a body over 100 MB, and a
	 * class video is far bigger than that.
	 *
	 * A sibling of `UploadButton` rather than a mode inside it. That one is a
	 * single request with a single status code; this is a loop with per-chunk
	 * retry, offset reconciliation and aggregate progress, and success only on
	 * the last request. Folding both into one component would put all of that in
	 * the path figure recordings take, which works today and has no tests.
	 *
	 * Several files may be picked at once, and they go up one at a time: the
	 * chunk protocol's whole premise is that the partial file's size IS the
	 * resume offset, and one stream at a time is also what a phone's uplink
	 * actually wants. A file that fails does not stop the ones behind it — the
	 * batch reports at the end which ones did not land.
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
	/** Which file of how many, while a batch of more than one is running. */
	let position = $state<{ index: number; count: number } | null>(null);
	let message = $state<string | null>(null);
	let input: HTMLInputElement | undefined = $state();

	const busy = $derived(progress !== null);

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

	/** A server message, as a phrase that reads inside brackets after a filename. */
	function reasonFrom(status: number, body: string): string {
		let text = body;
		try {
			text = JSON.parse(body).message ?? body;
		} catch {
			/* plain-text error body */
		}
		return (text || `the server said ${status}`).replace(/\.$/, '');
	}

	/**
	 * One file, chunk by chunk. `onBytes` reports bytes of THIS file that have
	 * landed, so the caller can keep a bar that spans the whole batch.
	 */
	async function uploadOne(
		file: File,
		onBytes: (sent: number) => void
	): Promise<string | null /* the reason it failed, or null */> {
		const url = `${uploadUrl}/${crypto.randomUUID()}`;
		let sent = 0;
		let attempts = 0;

		while (sent < file.size) {
			const blob = file.slice(sent, Math.min(sent + UPLOAD_CHUNK_BYTES, file.size));
			let res;
			try {
				res = await putChunk(url, blob, sent, file.size, file, (loaded) => onBytes(sent + loaded));
			} catch {
				// A dropped connection leaves the partial truncated to the last good
				// offset, so retrying the same chunk is always safe.
				if (++attempts > 3) return 'the connection dropped';
				await new Promise((r) => setTimeout(r, 500 * attempts));
				continue;
			}

			if (res.status === 409) {
				// The server says the file is at a different offset. Believe it.
				sent = res.received;
				onBytes(sent);
				if (++attempts > 3) return 'that upload got out of step';
				continue;
			}
			if (res.status >= 400) return reasonFrom(res.status, res.body);

			attempts = 0;
			sent = res.received;
			onBytes(sent);

			if (res.done) return null;
		}

		return 'the upload finished but the video was not saved';
	}

	async function upload(picked: File[]) {
		message = null;
		const { accepted, rejected } = screenFiles(picked, maxBytes);
		const failed: Skipped[] = [...rejected];
		let added = 0;

		// Every size is known before the first request, so the bar can span the
		// batch instead of restarting at zero for each file.
		const total = accepted.reduce((sum, f) => sum + f.size, 0);
		let done = 0;
		progress = accepted.length > 0 ? 0 : null;

		for (const [i, file] of accepted.entries()) {
			position = accepted.length > 1 ? { index: i + 1, count: accepted.length } : null;
			const reason = await uploadOne(file, (sent) => {
				progress = total === 0 ? 1 : (done + sent) / total;
			});
			if (reason === null) added += 1;
			else failed.push({ name: file.name, reason });
			done += file.size;
			progress = total === 0 ? 1 : done / total;
		}

		progress = null;
		position = null;
		if (input) input.value = '';
		message = summarise(added, failed);
		// Once, at the end: refreshing between files would tear down and re-mount
		// the <video> elements already on the page, mid-upload.
		if (added > 0) await invalidateAll();
	}
</script>

<label
	class="flex h-12 cursor-pointer items-center justify-center rounded-xl border border-dashed border-rule text-[14px] font-medium text-accent"
>
	{#if !busy}
		{label}
	{:else if position}
		Uploading {position.index} of {position.count}… {Math.round((progress ?? 0) * 100)}%
	{:else}
		Uploading… {Math.round((progress ?? 0) * 100)}%
	{/if}
	<input
		bind:this={input}
		type="file"
		{accept}
		multiple
		class="sr-only"
		disabled={busy}
		onchange={(e) => {
			const files = Array.from(e.currentTarget.files ?? []);
			if (files.length > 0) upload(files);
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
