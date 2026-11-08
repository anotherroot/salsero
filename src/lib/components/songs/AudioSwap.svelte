<script lang="ts">
	import { t } from '$lib/i18n/catalog';
	import { guarded } from '$lib/unsaved/guard.svelte';
	import Dialog from '$lib/components/ui/Dialog.svelte';
	import FieldError from '$lib/components/ui/FieldError.svelte';
	import Spinner from '$lib/components/ui/Spinner.svelte';
	import { FIELD, FIELD_INVALID, LABEL, button } from '$lib/components/ui/styles';

	/**
	 * Use another YouTube link: a field, Download this one and Cancel. Download
	 * asks first (the song's 1s go, and the copies kept in step download too),
	 * then posts the song page's `?/audio` with `seen`.
	 */
	let {
		seen,
		copies,
		refusal,
		sent,
		oncancel,
		ondone
	}: {
		/** What the page showed, for the clash check (JSON); empty for one's own song. */
		seen: string;
		/** How many copies kept in step get the new audio too. */
		copies: number;
		/** The page's refusal of this form, under the field. */
		refusal: string | null;
		/** What was typed before a refusal. */
		sent: string;
		oncancel: () => void;
		ondone: () => void;
	} = $props();

	/** A link, not words: the same in every language. */
	const EXAMPLE = 'https://youtu.be/…';
	const w = $derived(t().songs.source);
	let asking = $state(false);
	let busy = $state(false);
	let swapForm: HTMLFormElement | undefined = $state();
</script>

<form
	bind:this={swapForm}
	method="POST"
	action="?/audio"
	novalidate
	class="flex flex-col gap-2"
	use:guarded={{
		label: w.useAnother,
		submit: ({ cancel }) => {
			if (busy) return cancel();
			busy = true;
			asking = false;
			return async ({ result, update }) => {
				await update({ reset: false });
				busy = false;
				if (result.type === 'success') ondone();
			};
		}
	}}
>
	{#if seen}<input type="hidden" name="seen" value={seen} />{/if}
	<label class={LABEL} for="audio-url">{w.anotherLabel}</label>
	<!-- svelte-ignore a11y_autofocus -->
	<input
		id="audio-url"
		name="audioUrl"
		type="url"
		inputmode="url"
		autocomplete="off"
		autofocus
		placeholder={EXAMPLE}
		value={sent}
		class={refusal ? FIELD_INVALID : FIELD}
		aria-invalid={refusal ? 'true' : undefined}
		aria-describedby={refusal ? 'audio-url-error' : 'audio-url-help'}
	/>
	{#if refusal}
		<FieldError id="audio-url-error" message={refusal} />
	{:else}
		<p id="audio-url-help" class="text-[13px] leading-[1.4] text-muted">{w.swapHelp}</p>
	{/if}
	<button
		type="button"
		class={button('primary', 'md', true)}
		aria-busy={busy}
		onclick={() => (asking = true)}
	>
		{#if busy}<Spinner />{:else}{w.downloadThis}{/if}
	</button>
	<button type="button" class={button('tertiary', 'md', true)} onclick={oncancel}>{w.cancel}</button
	>
</form>

<Dialog
	open={asking}
	icon="download"
	title={w.askTitle}
	body={`${copies > 0 ? w.askCopies(copies) : w.askSelf} ${w.askBody}`}
	onclose={() => (asking = false)}
>
	{#snippet actions()}
		<button type="button" class={button('tertiary', 'sm')} onclick={() => (asking = false)}
			>{w.cancel}</button
		>
		<button type="button" class={button('primary', 'sm')} onclick={() => swapForm?.requestSubmit()}
			>{w.download}</button
		>
	{/snippet}
</Dialog>
