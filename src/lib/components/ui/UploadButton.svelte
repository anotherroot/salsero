<script lang="ts">
	import { uploadFailure } from '$lib/upload-error';
	import { invalidateAll } from '$app/navigation';
	import { track } from '$lib/unsaved/guard.svelte';
	import { holdReload } from '$lib/nav/fresh.svelte';
	import { MAX_RECORDING_LABEL } from '$lib/limits';
	import { uploadProblem } from '$lib/media';
	import type { IconName } from '$lib/icons/icons';
	import Icon from './Icon.svelte';
	import Banner from './Banner.svelte';
	import UploadCard from './UploadCard.svelte';
	import { button } from './styles';
	import { t } from '$lib/i18n/catalog';

	interface Props {
		/** Endpoint taking the raw file as the POST body. */
		url: string;
		accept: 'audio/*' | 'video/*' | 'video/*,audio/*';
		label: string;
		/** What goes up, for the progress bar's name: "Uploading recording". */
		noun?: string;
		/** Extra request headers for this file (metadata rides in headers, not the body). */
		headers?: (file: File) => Record<string, string>;
		icon?: IconName;
		kind?: 'primary' | 'secondary';
		size?: 'sm' | 'md';
		/** True while a file is going up, for a parent that lays out around it. */
		busy?: boolean;
		/** No button of its own: another control opens the file chooser through `chooser`. The progress card and a failure still show. */
		bare?: boolean;
		/** Set on mount: opens the file chooser. Call it from a user's tap (a file input opens only from one). */
		chooser?: () => void;
	}

	let {
		url,
		accept,
		label,
		noun,
		headers,
		icon = 'upload',
		kind = 'secondary',
		size = 'md',
		bare = false,
		// eslint-disable-next-line no-useless-assignment -- the parent reads it back
		chooser = $bindable(),
		// eslint-disable-next-line no-useless-assignment -- the parent reads it back
		busy = $bindable(false)
	}: Props = $props();

	let progress = $state<number | null>(null);
	$effect(() => {
		busy = progress !== null;
	});
	let message = $state<{ title: string; body?: string } | null>(null);
	let input: HTMLInputElement | undefined = $state();
	$effect(() => {
		chooser = () => input?.click();
	});

	// The request outlives an in-app navigation (the component goes, the XHR
	// does not), so only a reload or a closed tab would cut it off.
	$effect(() =>
		track({
			label: t().shell.upload.anUpload,
			dirty: () => progress !== null,
			unloadOnly: true
		})
	);

	/*
	 * XHR rather than fetch for upload progress: a phone upload over mobile data
	 * can take a minute, and a spinner with no number reads as hung.
	 */
	function upload(file: File) {
		message = null;
		const problem = uploadProblem(file, accept);
		if (problem) {
			message = problem;
			if (input) input.value = '';
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
			const w = t().shell.upload;
			const fallback = xhr.status === 413 ? w.tooLarge(MAX_RECORDING_LABEL) : w.failed;
			message = { title: uploadFailure(xhr.responseText, fallback) };
		};
		xhr.onerror = () => {
			progress = null;
			message = { title: t().shell.upload.connection };
		};
		// A deploy does not reload the page under the upload: it waits for loadend.
		xhr.onloadend = holdReload();
		progress = 0;
		xhr.send(file);
	}
</script>

<label
	class="{button(
		kind,
		size,
		true
	)} has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-accent {progress !==
		null || bare
		? 'hidden!'
		: ''}"
>
	<Icon name={icon} size={20} />{label}
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
	<UploadCard pct={progress * 100} label={noun ?? t().shell.upload.nouns.file} />
{/if}
{#if message}
	<div class="mt-2">
		<Banner kind="error" title={message.title}>
			{#if message.body}{message.body}{/if}
		</Banner>
	</div>
{/if}
