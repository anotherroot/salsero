<script lang="ts">
	/**
	 * Add a video on a phone (offline phase 4c): on the person's own figure or
	 * lesson it stays on this phone as the untouched original, and its row is a
	 * device write; a toast offers Upload. The dashed button of the upload it
	 * stands in for, or `bare` (another control opens the chooser, as the
	 * figure's Add sheet does).
	 */
	import Icon from './Icon.svelte';
	import Toast from './Toast.svelte';
	import Banner from './Banner.svelte';
	import { DASHED_ADD } from './styles';
	import { t } from '$lib/i18n/catalog';
	import { MAX_LESSON_VIDEO_BYTES } from '$lib/limits';
	import { refreshWhenSettled } from '$lib/sheets/history.svelte';
	import { dropOriginal, kept, putOriginal } from '$lib/offline/device.svelte';
	import { addOnPhone, type AddTarget } from '$lib/offline/add-phone';
	import { uploadOriginal } from '$lib/offline/upload-original';
	import { addFromApp } from '$lib/offline/app-originals.svelte';

	let {
		target,
		label,
		multiple = false,
		bare = false,
		viaApp = false,
		// eslint-disable-next-line no-useless-assignment -- the parent reads it back
		chooser = $bindable()
	}: {
		target: AddTarget;
		label: string;
		multiple?: boolean;
		bare?: boolean;
		/** The Android app keeps the original in the gallery: its picker, not a file input (part 2). */
		viaApp?: boolean;
		/** Set on mount: opens the file chooser (from a user's tap). */
		chooser?: () => void;
	} = $props();

	const w = $derived(t().video.place);
	let input: HTMLInputElement | undefined = $state();
	$effect(() => {
		chooser = viaApp ? () => void addViaApp() : () => input?.click();
	});

	async function addViaApp() {
		failed = null;
		busy = true;
		try {
			const out = await addFromApp(target, multiple);
			if (out.refused > 0) failed = w.notSaved;
			if (out.added.length > 0) {
				last = out.added[out.added.length - 1];
				toast = { id: ++seq, message: w.saved, action: w.upload, icon: 'check', tone: 'done' };
				await refreshWhenSettled();
			}
		} finally {
			busy = false;
		}
	}
	let busy = $state(false);
	let failed = $state<string | null>(null);
	let toast = $state<{
		id: number;
		message: string;
		action?: string;
		icon?: 'check';
		tone?: 'done';
	} | null>(null);
	let last: { id: number; file: string } | null = null;
	let seq = 0;
	const table = $derived(
		'figureId' in target ? ('recordings' as const) : ('lesson_videos' as const)
	);

	async function add(files: File[]) {
		failed = null;
		busy = true;
		let added = 0;
		try {
			for (const file of files) {
				if (file.size > MAX_LESSON_VIDEO_BYTES) {
					failed = w.refusal.tooBig;
					continue;
				}
				const out = await addOnPhone(target, file, {
					put: putOriginal,
					post: (url, body) =>
						fetch(url, {
							method: 'POST',
							headers: { 'content-type': 'application/json' },
							body: JSON.stringify(body)
						}),
					drop: dropOriginal,
					uuid: () => crypto.randomUUID(),
					slot: () => kept.status?.slot ?? null
				});
				if (out.ok) {
					added++;
					last = { id: out.id, file: out.file };
				} else failed = out.reason === 'space' ? w.noSpace : w.notSaved;
			}
		} finally {
			busy = false;
			if (input) input.value = '';
		}
		if (added > 0) {
			toast = { id: ++seq, message: w.saved, action: w.upload, icon: 'check', tone: 'done' };
			await refreshWhenSettled();
		}
	}

	function upload() {
		const v = last;
		toast = null;
		if (v && v.id > 0)
			void uploadOriginal({ table, id: v.id, file: v.file }).then((out) => {
				if (out.ok) void refreshWhenSettled();
				else toast = { id: ++seq, message: out.reason ?? w.uploadFailed };
			});
	}
</script>

{#if viaApp}
	{#if !bare}
		<button
			type="button"
			class={DASHED_ADD}
			aria-busy={busy}
			disabled={busy}
			onclick={() => void addViaApp()}><Icon name="upload" size={20} />{label}</button
		>
	{/if}
{:else}<label class={DASHED_ADD} class:hidden={bare} aria-busy={busy}>
		<Icon name="upload" size={20} />{label}
		<input
			bind:this={input}
			type="file"
			accept="video/*"
			{multiple}
			class="sr-only"
			disabled={busy}
			onchange={(e) => void add([...(e.currentTarget.files ?? [])])}
		/>
	</label>{/if}
{#if failed}
	<div class="mt-2"><Banner kind="error" title={failed} /></div>
{/if}
<Toast {toast} onaction={upload} ondismiss={() => (toast = null)} />
