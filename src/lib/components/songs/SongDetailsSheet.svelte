<script lang="ts">
	import type { Dance } from '$lib/dances/dances';
	import { guarded } from '$lib/unsaved/guard.svelte';
	import Sheet from '$lib/components/ui/Sheet.svelte';
	import Banner from '$lib/components/ui/Banner.svelte';
	import FieldError from '$lib/components/ui/FieldError.svelte';
	import Icon from '$lib/components/ui/Icon.svelte';
	import Spinner from '$lib/components/ui/Spinner.svelte';
	import { CHIP, FIELD, LABEL, button } from '$lib/components/ui/styles';

	/** What `?/update` handed back: a refusal keeps everything typed. */
	type DetailsForm = {
		field?: 'title' | 'artist';
		message?: string;
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
		onarchive
	}: {
		open: boolean;
		onclose: () => void;
		song: { title: string; artist: string | null; style: string; sourceUrl: string | null };
		dance: Dance;
		form: DetailsForm | null | undefined;
		/** What the page showed, for the clash check (JSON). */
		seen: string;
		/** A person's own song is archived from here; a group's is deleted from its menu. */
		onarchive?: () => void;
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

	function close() {
		closedOn = given;
		style = stored;
		onclose();
	}
</script>

<Sheet title="Song details" {open} onclose={close}>
	<div class="flex flex-col gap-3.5">
		<form
			method="POST"
			action="?/update"
			novalidate
			class="flex flex-col gap-3.5"
			use:guarded={{
				label: 'Song details',
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
				<label class={LABEL} for="song-title">Title</label>
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
				<label class={LABEL} for="song-artist">Artist</label>
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
				aria-label={busy ? 'Saving' : undefined}
			>
				{#if busy}<Spinner />{:else}Save{/if}
			</button>
		</form>

		{#if song.sourceUrl}
			<p class="text-center text-[13px] break-all text-muted">From {song.sourceUrl}</p>
		{/if}

		{#if onarchive}
			<div class="flex justify-center border-t border-hairline pt-2">
				<button type="button" class={button('danger-text', 'sm')} onclick={onarchive}>
					<Icon name="trash" size={18} />Archive song
				</button>
			</div>
		{/if}
	</div>
</Sheet>
