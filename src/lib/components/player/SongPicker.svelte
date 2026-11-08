<!--
	The Song field and its popup, in place of a `<select>`: a native dropdown
	cannot hold a play button. The field shows the pick with a ▶ that samples
	it; the rest of the field opens "Pick a song" — a search, then Recent, the
	person's own A to Z and a heading per group with its shared songs, every row
	with its own ▶. Sampling never changes the pick; tapping
	a row picks it and closes. Every way of closing stops the sample.
-->
<script lang="ts">
	import { onDestroy, type Snippet } from 'svelte';
	import Icon from '$lib/components/ui/Icon.svelte';
	import { page } from '$app/state';
	import SampleButton from '$lib/components/songs/SampleButton.svelte';
	import SongPickSheet from '$lib/components/songs/SongPickSheet.svelte';
	import { CLIP } from '$lib/components/ui/styles';
	import { getDance, isDanceSlug } from '$lib/dances/dances';
	import { songMeta } from '$lib/songs/search';
	import { sampling, stopSample } from '$lib/songs/sample-player.svelte';
	import { clock } from '$lib/format';
	import { t } from '$lib/i18n/catalog';
	import type { PickerSong } from '$lib/types';

	interface Props {
		/** This dance's ready songs: the person's own and their groups' shared ones (`songChoices`). */
		songs: PickerSong[];
		songId: number | null;
		/** The id of the visible "Song" text, which names the field's button. */
		labelId?: string;
		/** `field` is the form field; `card` is the player's setup card. */
		variant?: 'field' | 'card';
		/**
		 * The card's red ring: the picked song failed to load. Drawn only; a
		 * button takes no `aria-invalid`, and the caller's error line under the
		 * card (`role="alert"`) is what is announced.
		 */
		invalid?: boolean;
		/** A drill's or routine's Music, listed first in the popup (spec B). */
		first?: { label: string; ids: number[] } | null;
		/** Drawn under the card's head. */
		children?: Snippet;
	}

	let {
		songs,
		songId = $bindable(),
		labelId,
		variant = 'field',
		invalid = false,
		first = null,
		children
	}: Props = $props();

	const buttonId = $props.id();

	let open = $state(false);

	const slug = $derived(page.params.dance ?? 'salsa');
	const styleLabels = $derived(isDanceSlug(slug) ? getDance(slug).styleLabel : {});
	const picked = $derived(songs.find((s) => s.id === songId) ?? null);
	const meta = (s: PickerSong) => songMeta(s, styleLabels);

	/** ✕, the backdrop, Escape (and Back) all land here: the pick stays. */
	function close() {
		open = false;
	}

	// The field's ▶ goes with the field: a sample must not outlive it unseen
	// (the log popup closing, the source switched to Count only).
	onDestroy(() => {
		if (songs.some((s) => s.id === sampling.id)) stopSample();
	});
</script>

{#if variant === 'card'}
	<div class="{CLIP} rounded-2xl bg-surface {invalid ? 'ring-2 ring-danger ring-inset' : ''}">
		<div class="flex items-center gap-3 py-2.5 pr-2.5 pl-3">
			{#if picked}
				<SampleButton song={picked.sample} name={picked.title} />
			{/if}
			<button
				type="button"
				id="{buttonId}-field"
				aria-labelledby={labelId ? `${labelId} ${buttonId}-field` : undefined}
				aria-haspopup="dialog"
				onclick={() => (open = true)}
				class="flex min-h-11 min-w-0 flex-1 cursor-pointer items-center gap-3 text-left"
			>
				<span class="min-w-0 flex-1">
					{#if picked}
						<span class="block truncate text-[16px] leading-[1.3] font-bold text-ink"
							>{picked.title}</span
						>
						{#if sampling.id === picked.id}
							<span class="block truncate text-[13px] font-bold text-accent-text"
								>{t().songs.sample.from(clock(picked.sample.startS))}</span
							>
						{:else}
							<span class="block truncate text-[13px] text-muted tabular-nums">{meta(picked)}</span>
						{/if}
					{:else}
						<span class="block text-[16px] font-semibold text-muted">{t().songs.picker.title}</span>
					{/if}
				</span>
				<span class="flex-none text-muted" aria-hidden="true"
					><Icon name="chevron-down" size={20} /></span
				>
			</button>
		</div>
		{#if children}
			<div class="border-t border-hairline">{@render children()}</div>
		{/if}
	</div>
{:else}
	<div
		class="flex items-center rounded-[14px] bg-surface pr-1 shadow-[inset_0_0_0_1px_var(--color-field-line)]"
	>
		<button
			type="button"
			id="{buttonId}-field"
			aria-labelledby={labelId ? `${labelId} ${buttonId}-field` : undefined}
			aria-haspopup="dialog"
			onclick={() => (open = true)}
			class="flex min-h-[60px] min-w-0 flex-1 items-center gap-2 py-2 pr-1 pl-3.5 text-left"
		>
			<span class="min-w-0 flex-1">
				{#if picked}
					<span class="block truncate text-[16px] leading-[1.3] font-bold text-ink"
						>{picked.title}</span
					>
					{#if sampling.id === picked.id}
						<span class="block truncate text-[13px] leading-[1.35] font-bold text-accent-text"
							>{t().songs.sample.from(clock(picked.sample.startS))}</span
						>
					{:else}
						<span class="block truncate text-[13px] leading-[1.35] text-muted">{meta(picked)}</span>
					{/if}
				{:else}
					<span class="block text-[16px] font-medium text-muted">{t().songs.picker.title}</span>
				{/if}
			</span>
			<span class="flex flex-none text-muted" aria-hidden="true"
				><Icon name="chevron-down" size={20} /></span
			>
		</button>
		{#if picked}
			<SampleButton song={picked.sample} name={picked.title} />
		{/if}
	</div>
{/if}

<SongPickSheet
	{open}
	onclose={close}
	{songs}
	picked={songId}
	{first}
	onpick={(s) => {
		songId = s.id;
		close();
	}}
/>
