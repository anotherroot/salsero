<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { MAX_RECORDING_BYTES, MAX_RECORDING_LABEL } from '$lib/limits';

	interface Props {
		/** Endpoint taking the raw file as the POST body. */
		url: string;
		accept: 'audio/*' | 'video/*,audio/*';
		label: string;
		/** Extra request headers for this file (metadata rides in headers, not the body). */
		headers?: (file: File) => Record<string, string>;
	}

	let { url, accept, label, headers }: Props = $props();

	let progress = $state<number | null>(null);
	let message = $state<string | null>(null);
	let input: HTMLInputElement | undefined = $state();

	const mb = (n: number) => `${Math.round(n / 1024 / 1024)} MB`;
	const allowed = $derived(accept === 'audio/*' ? /^audio\// : /^(video|audio)\//);

	/*
	 * XHR rather than fetch for upload progress: a phone upload over mobile data
	 * can take a minute, and a spinner with no number reads as hung.
	 */
	function upload(file: File) {
		message = null;
		if (file.size > MAX_RECORDING_BYTES) {
			message = `That file is ${mb(file.size)}; the limit is ${MAX_RECORDING_LABEL}.`;
			return;
		}
		if (!allowed.test(file.type)) {
			message =
				accept === 'audio/*'
					? 'Only audio files can be added.'
					: 'Only video and audio files can be added.';
			return;
		}

		const xhr = new XMLHttpRequest();
		xhr.open('POST', url);
		xhr.setRequestHeader('content-type', file.type);
		xhr.setRequestHeader('x-filename', encodeURIComponent(file.name));
		for (const [k, v] of Object.entries(headers?.(file) ?? {})) xhr.setRequestHeader(k, v);
		xhr.upload.onprogress = (e) => {
			if (e.lengthComputable) progress = e.loaded / e.total;
		};
		xhr.onload = async () => {
			progress = null;
			if (input) input.value = '';
			if (xhr.status === 201) {
				await invalidateAll();
				return;
			}
			let text = xhr.responseText;
			try {
				text = JSON.parse(text).message ?? text;
			} catch {
				/* plain-text error body */
			}
			message =
				xhr.status === 413
					? `That file is too large (limit ${MAX_RECORDING_LABEL}).`
					: text || 'Upload failed.';
		};
		xhr.onerror = () => {
			progress = null;
			message = 'Upload failed — check the connection and try again.';
		};
		progress = 0;
		xhr.send(file);
	}
</script>

<label
	class="flex h-12 cursor-pointer items-center justify-center rounded-xl border border-dashed border-rule text-[14px] font-medium text-ink-2 has-focus-visible:outline-2 has-focus-visible:outline-accent {progress !==
	null
		? 'pointer-events-none opacity-60'
		: ''}"
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
	<div class="mt-2 h-1.5 overflow-hidden rounded-full bg-line" aria-hidden="true">
		<div class="h-full bg-accent transition-[width]" style="width: {progress * 100}%"></div>
	</div>
{/if}
{#if message}
	<p class="mt-2 rounded-lg bg-danger/10 px-3 py-2 text-[13px] text-danger" role="alert">
		{message}
	</p>
{/if}
