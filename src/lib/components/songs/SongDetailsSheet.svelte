<script lang="ts">
	import type { Dance } from '$lib/dances/dances';
	import { guarded } from '$lib/unsaved/guard.svelte';
	import Sheet from '$lib/components/ui/Sheet.svelte';
	import Banner from '$lib/components/ui/Banner.svelte';
	import FieldError from '$lib/components/ui/FieldError.svelte';
	import Icon from '$lib/components/ui/Icon.svelte';
	import Spinner from '$lib/components/ui/Spinner.svelte';
	import { CHIP, FIELD, LABEL, button } from '$lib/components/ui/styles';
	import { t } from '$lib/i18n/catalog';
	import { styleLabelsOf } from '$lib/moves/figures';
	import type { SourceRow } from '$lib/songs/song-page';
	import AudioFrom from './AudioFrom.svelte';
	import AudioSwap from './AudioSwap.svelte';

	/** What `?/update` handed back: a refusal keeps everything typed. */
	type DetailsForm = {
		/** `audioUrl`: Use another YouTube link's refusal (the page's `audio`). */
		field?: 'title' | 'artist' | 'audioUrl';
		message?: string;
		audioUrl?: string;
		title?: string;
		artist?: string;
		style?: string;
	};

	let {
		open,
		onclose,
		song,
		dance,
		form: given,
		seen,
		onarchive,
		sources = [],
		canSwap = false,
		copies = 0,
		swapping = $bindable(false)
	}: {
		open: boolean;
		onclose: () => void;
		song: { title: string; artist: string | null; style: string };
		dance: Dance;
		form: DetailsForm | null | undefined;
		/** What the page showed, for the clash check (JSON). */
		seen: string;
		/** A person's own song is archived from here; a group's is deleted from its menu. */
		onarchive?: () => void;
		/** The "Audio from" card's rows (`sourceRows`). */
		sources?: SourceRow[];
		/** Use another YouTube link is offered: a song from a link, not waiting. */
		canSwap?: boolean;
		/** How many copies kept in step new audio reaches (`audioReach`). */
		copies?: number;
		/** The field for another YouTube link is open in place of the details. */
		swapping?: boolean;
	} = $props();

	let busy = $state(false);
	/** A refusal is thrown away when the sheet closes; reopening must not bring it back. Raw so `===` holds. */
	let closedOn = $state.raw<DetailsForm | null | undefined>(undefined);
	// Only a refusal of this form (it carries `title`) is ours.
	const form = $derived(given === closedOn || given?.title === undefined ? null : given);

	const sent = $derived(form?.style && dance.styles.includes(form.style) ? form.style : null);
	const stored = $derived(song.style);
	let style = $derived(sent ?? stored);

	const titleError = $derived(form?.field === 'title' ? form.message : null);
	const artistError = $derived(form?.field === 'artist' ? form.message : null);
	const otherError = $derived(form?.message && !form.field ? form.message : null);
	// Use another YouTube link's refusal: it carries `audioUrl`, never `title`.
	const swapForm = $derived(given !== closedOn && given?.field === 'audioUrl' ? given : null);
	$effect(() => {
		if (swapForm) swapping = true;
	});

	const w = $derived(t().songs.page);
	const styleLabel = $derived(styleLabelsOf(dance.styleLabel));

	function close() {
		closedOn = given;
		style = stored;
		swapping = false;
		onclose();
	}
</script>

<Sheet title={w.details} {open} onclose={close}>
	<div class="flex flex-col gap-3.5">
		{#if swapping}
			<AudioFrom rows={sources} />
			<AudioSwap
				{seen}
				{copies}
				refusal={swapForm?.message ?? null}
				sent={swapForm?.audioUrl ?? ''}
				oncancel={() => {
					closedOn = given;
					swapping = false;
				}}
				ondone={close}
			/>
		{:else}
			<form
				method="POST"
				action="?/update"
				novalidate
				class="flex flex-col gap-3.5"
				use:guarded={{
					label: t().songs.page.details,
					submit: ({ cancel }) => {
						if (busy) return cancel();
						busy = true;
						return async ({ result, update }) => {
							await update({ reset: false });
							busy = false;
							if (result.type === 'success') close();
						};
					}
				}}
			>
				{#if otherError}<Banner kind="error" title={otherError} />{/if}
				{#if seen}<input type="hidden" name="seen" value={seen} />{/if}

				<div>
					<label class={LABEL} for="song-title">{t().songs.add.title}</label>
					<!-- svelte-ignore a11y_autofocus -->
					<input
						id="song-title"
						name="title"
						required
						maxlength="200"
						autofocus
						autocomplete="off"
						value={form?.title ?? song.title}
						class={FIELD}
						aria-invalid={titleError ? 'true' : undefined}
						aria-describedby={titleError ? 'song-title-error' : undefined}
					/>
					{#if titleError}<FieldError id="song-title-error" message={titleError} />{/if}
				</div>

				<div>
					<label class={LABEL} for="song-artist">{w.artist}</label>
					<input
						id="song-artist"
						name="artist"
						maxlength="200"
						autocomplete="off"
						value={form?.artist ?? song.artist ?? ''}
						class={FIELD}
						aria-invalid={artistError ? 'true' : undefined}
						aria-describedby={artistError ? 'song-artist-error' : undefined}
					/>
					{#if artistError}<FieldError id="song-artist-error" message={artistError} />{/if}
				</div>

				<fieldset>
					<legend class={LABEL}>{t().songs.add.style}</legend>
					<div class="flex flex-wrap gap-2">
						{#each dance.styles as s (s)}
							<label class={CHIP}>
								<input type="radio" name="style" value={s} bind:group={style} class="sr-only" />
								{styleLabel[s]}
							</label>
						{/each}
					</div>
				</fieldset>

				<button
					type="submit"
					class={button('primary', 'md', true)}
					aria-busy={busy}
					aria-label={busy ? w.saving : undefined}
				>
					{#if busy}<Spinner />{:else}{t().common.save}{/if}
				</button>
			</form>

			<AudioFrom rows={sources} />
			{#if canSwap}
				<button
					type="button"
					class={button('secondary', 'md', true)}
					onclick={() => (swapping = true)}>{t().songs.source.useAnother}</button
				>
			{/if}

			{#if onarchive}
				<div class="flex justify-center border-t border-hairline pt-2">
					<button type="button" class={button('danger-text', 'sm')} onclick={onarchive}>
						<Icon name="trash" size={18} />{w.archiveSong}
					</button>
				</div>
			{/if}
		{/if}
	</div>
</Sheet>
