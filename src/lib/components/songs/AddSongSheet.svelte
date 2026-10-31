<script lang="ts">
	import type { Dance } from '$lib/dances/dances';
	import { guarded } from '$lib/unsaved/guard.svelte';
	import { audioFileProblem } from '$lib/songs/library';
	import { startSongUpload, upload } from '$lib/songs/upload.svelte';
	import Sheet from '$lib/components/ui/Sheet.svelte';
	import Banner from '$lib/components/ui/Banner.svelte';
	import FieldError from '$lib/components/ui/FieldError.svelte';
	import Icon from '$lib/components/ui/Icon.svelte';
	import Spinner from '$lib/components/ui/Spinner.svelte';
	import { MAX_RECORDING_LABEL } from '$lib/limits';
	import { CHIP, FIELD, LABEL, button } from '$lib/components/ui/styles';

	/** What `?/addUrl` handed back: a refusal keeps everything typed. */
	type AddForm = {
		field?: 'url' | 'title';
		message?: string;
		url?: string;
		title?: string;
		style?: string;
	};

	let {
		open,
		onclose,
		dance,
		form
	}: { open: boolean; onclose: () => void; dance: Dance; form: AddForm | null | undefined } =
		$props();

	let busy = $state(false);
	/** Picked chip; a refusal brings back the one that was sent. Shared with the upload. */
	let style = $derived(
		form?.style && dance.styles.includes(form.style) ? form.style : dance.styles[0]
	);
	/** Why the picked file was not sent, under the Upload button. */
	let fileProblem = $state<string | null>(null);
	/** One upload at a time: another is moving and has not failed. */
	const uploading = $derived(upload.current !== null && upload.current.error === null);

	const urlError = $derived(form?.field === 'url' ? form.message : null);
	const titleError = $derived(form?.field === 'title' ? form.message : null);
	// A refusal that is about no one field goes at the top of the sheet.
	const otherError = $derived(form?.message && !form.field ? form.message : null);

	function close() {
		fileProblem = null;
		onclose();
	}

	function pick(input: HTMLInputElement) {
		const file = input.files?.[0];
		if (!file) return;
		const problem = audioFileProblem(file);
		if (problem) {
			fileProblem = problem;
			input.value = '';
			return;
		}
		fileProblem = null;
		startSongUpload(file, dance.slug, style);
		close();
	}
</script>

<Sheet title="Add a song" {open} onclose={close}>
	<div class="flex flex-col gap-3.5">
		<form
			id="add-song"
			method="POST"
			action="?/addUrl"
			novalidate
			class="flex flex-col gap-3.5"
			use:guarded={{
				label: 'Add a song',
				submit: ({ cancel }) => {
					// One song per tap: a second tap while the first is out is dropped.
					if (busy) return cancel();
					busy = true;
					return async ({ result, update }) => {
						await update();
						busy = false;
						if (result.type === 'success') close();
					};
				}
			}}
		>
			{#if otherError}<Banner kind="error" title={otherError} />{/if}

			<div>
				<label class={LABEL} for="add-song-url">YouTube link</label>
				<div class="relative">
					<span
						class="pointer-events-none absolute top-1/2 left-3.5 flex -translate-y-1/2 text-muted"
					>
						<Icon name="youtube" size={20} />
					</span>
					<!-- The sheet exists to paste this one thing. -->
					<!-- svelte-ignore a11y_autofocus -->
					<input
						id="add-song-url"
						name="url"
						type="url"
						inputmode="url"
						autocomplete="off"
						autofocus
						placeholder="https://www.youtube.com/watch?v=…"
						value={form?.url ?? ''}
						class="{FIELD} pl-11"
						aria-invalid={urlError ? 'true' : undefined}
						aria-describedby={urlError ? 'add-song-url-error' : undefined}
					/>
				</div>
				{#if urlError}<FieldError id="add-song-url-error" message={urlError} />{/if}
			</div>

			<div>
				<label class={LABEL} for="add-song-title"
					>Title <span class="font-normal text-muted">(optional)</span></label
				>
				<input
					id="add-song-title"
					name="title"
					maxlength="200"
					placeholder="Song title"
					value={form?.title ?? ''}
					class={FIELD}
					aria-invalid={titleError ? 'true' : undefined}
					aria-describedby={titleError ? 'add-song-title-error' : undefined}
				/>
				{#if titleError}<FieldError id="add-song-title-error" message={titleError} />{/if}
			</div>

			<fieldset>
				<legend class={LABEL}>Style</legend>
				<div class="flex flex-wrap gap-2">
					{#each dance.styles as s (s)}
						<label class={CHIP}>
							<input type="radio" name="style" value={s} bind:group={style} class="sr-only" />
							{dance.styleLabel[s]}
						</label>
					{/each}
				</div>
			</fieldset>

			<button
				type="submit"
				class={button('primary', 'md', true)}
				aria-busy={busy}
				aria-label={busy ? 'Adding song' : undefined}
			>
				{#if busy}<Spinner />{:else}Add song{/if}
			</button>
		</form>

		<div aria-hidden="true" class="flex items-center gap-3 py-0.5">
			<span class="h-px flex-1 bg-hairline"></span>
			<span class="text-[13px] font-bold text-muted">or</span>
			<span class="h-px flex-1 bg-hairline"></span>
		</div>

		<div class="flex flex-col gap-2">
			<label
				class="{button(
					'secondary',
					'md',
					true
				)} has-focus-visible:shadow-[0_0_0_6px_color-mix(in_srgb,var(--color-accent)_20%,transparent)] has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-accent has-disabled:cursor-default has-disabled:bg-disabled-bg has-disabled:text-disabled-ink"
			>
				<Icon name="upload" size={20} /> Upload an audio file
				<input
					type="file"
					accept="audio/*"
					class="sr-only"
					disabled={uploading}
					onchange={(e) => pick(e.currentTarget)}
				/>
			</label>
			{#if fileProblem}
				<Banner kind="error" title={fileProblem} />
			{:else}
				<p class="px-3 pt-1 text-center text-[13px] text-muted">
					{uploading
						? 'One upload at a time — wait for the one in Music.'
						: `Up to ${MAX_RECORDING_LABEL}. It gets the style above.`}
				</p>
			{/if}
		</div>
	</div>
</Sheet>
