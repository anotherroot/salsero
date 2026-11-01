<!--
	The Song field and its popup, in place of a `<select>`: a native dropdown
	cannot hold a play button. The field shows the pick with a ▶ that samples
	it; the rest of the field opens "Pick a song" — a search, then Recent and
	A to Z, every row with its own ▶. Sampling never changes the pick; tapping
	a row picks it and closes. Every way of closing stops the sample.
-->
<script lang="ts">
	import { onDestroy, type Snippet } from 'svelte';
	import Icon from '$lib/components/ui/Icon.svelte';
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import Sheet from '$lib/components/ui/Sheet.svelte';
	import SampleButton from '$lib/components/songs/SampleButton.svelte';
	import SearchField from '$lib/components/ui/SearchField.svelte';
	import EmptyState from '$lib/components/ui/EmptyState.svelte';
	import { CLIP, SECTION_LABEL } from '$lib/components/ui/styles';
	import { getDance, isDanceSlug } from '$lib/dances/dances';
	import { groupSongs, pickerCount, searchSongs } from '$lib/songs/search';
	import { segments } from '$lib/picker/model';
	import { sampling, stopSample } from '$lib/songs/sample-player.svelte';
	import { clock } from '$lib/format';
	import type { PickerSong } from '$lib/types';

	interface Props {
		/** This dance's ready songs. */
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
		/** Drawn under the card's head. */
		children?: Snippet;
	}

	let {
		songs,
		songId = $bindable(),
		labelId,
		variant = 'field',
		invalid = false,
		children
	}: Props = $props();

	const buttonId = $props.id();

	let open = $state(false);
	let query = $state('');
	let search: HTMLInputElement | undefined = $state();

	const slug = $derived(page.params.dance ?? 'salsa');
	const styleLabels = $derived(isDanceSlug(slug) ? getDance(slug).styleLabel : {});
	const picked = $derived(songs.find((s) => s.id === songId) ?? null);

	const searching = $derived(query.trim() !== '');
	const hits = $derived(searchSongs(songs, query));
	const groups = $derived(groupSongs(songs));
	const countText = $derived(pickerCount(searching ? hits.length : songs.length, searching));

	// Focus the search only with a mouse: on a phone the keyboard would cover
	// the list, which is what the popup was opened to see and sample.
	$effect(() => {
		if (search && matchMedia('(pointer: fine)').matches) search.focus();
	});

	// A sample keeps playing while typing only while its row is still listed:
	// a sample with no ■ in sight could not be stopped.
	$effect(() => {
		const id = sampling.id;
		if (open && searching && id !== null && !hits.some((s) => s.id === id)) stopSample();
	});

	/** `Style · 98 BPM · 4:12`, leaving out what is not known. */
	function meta(s: PickerSong): string {
		return [
			styleLabels[s.style] ?? s.style,
			s.bpm ? `${s.bpm} BPM` : null,
			s.durationS ? clock(s.durationS) : null
		]
			.filter(Boolean)
			.join(' · ');
	}

	/** ✕, the backdrop, Escape (and Back) all land here: the pick stays. */
	function close() {
		open = false;
		query = '';
		stopSample();
	}

	function pick(s: PickerSong) {
		songId = s.id;
		close();
	}

	// The field's ▶ goes with the field: a sample must not outlive it unseen
	// (the log popup closing, the source switched to Count only).
	onDestroy(() => {
		if (songs.some((s) => s.id === sampling.id)) stopSample();
	});
</script>

{#snippet row(s: PickerSong, last: boolean)}
	{@const on = s.id === songId}
	{@const segs = searching ? segments(s.title, query) : [{ text: s.title, hit: false }]}
	<li class="pl-4 {on ? 'bg-accent-soft' : ''}">
		<div
			class="flex min-h-16 items-center gap-1 pr-1 {last
				? ''
				: 'shadow-[inset_0_-1px_0_var(--color-hairline)]'}"
		>
			<button
				type="button"
				aria-current={on ? 'true' : undefined}
				onclick={() => pick(s)}
				class="flex min-w-0 flex-1 items-center gap-3 py-[9px] text-left"
			>
				<span
					class="grid size-[22px] flex-none place-items-center rounded-full border-2 {on
						? 'border-accent'
						: 'border-field-line'}"
					aria-hidden="true"
				>
					{#if on}<span class="size-2.5 rounded-full bg-accent"></span>{/if}
				</span>
				<span class="min-w-0">
					<span class="block truncate text-[16px] leading-[1.3] font-bold text-ink">
						{#each segs as seg, i (i)}{#if seg.hit}<mark
									class="rounded-[4px] bg-accent-soft px-px font-extrabold text-accent-text"
									>{seg.text}</mark
								>{:else}{seg.text}{/if}{/each}
					</span>
					{#if sampling.id === s.id}
						<span class="block truncate text-[13px] leading-[1.35] font-bold text-accent-text"
							>Sample from {clock(s.sample.startS)}</span
						>
					{:else}
						<span
							class="block truncate text-[13px] leading-[1.35] {on ? 'text-ink-2' : 'text-muted'}"
							>{meta(s)}</span
						>
					{/if}
				</span>
			</button>
			<SampleButton song={s.sample} name={s.title} tinted={on} />
		</div>
	</li>
{/snippet}

{#snippet card(list: PickerSong[])}
	<ul class="{CLIP} rounded-2xl bg-surface">
		{#each list as s, i (s.id)}{@render row(s, i === list.length - 1)}{/each}
	</ul>
{/snippet}

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
								>Sample from {clock(picked.sample.startS)}</span
							>
						{:else}
							<span class="block truncate text-[13px] text-muted tabular-nums">{meta(picked)}</span>
						{/if}
					{:else}
						<span class="block text-[16px] font-semibold text-muted">Pick a song</span>
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
							>Sample from {clock(picked.sample.startS)}</span
						>
					{:else}
						<span class="block truncate text-[13px] leading-[1.35] text-muted">{meta(picked)}</span>
					{/if}
				{:else}
					<span class="block text-[16px] font-medium text-muted">Pick a song</span>
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

<Sheet title="Pick a song" {open} onclose={close} tall={songs.length > 0}>
	<div class="flex h-full min-h-0 flex-col gap-2">
		<SearchField placeholder="Search songs" bind:value={query} bind:input={search} />
		<p class="flex justify-between gap-2 px-1 text-[13px] text-muted">
			<span class="font-bold">{countText}</span>
			<span class="flex items-center gap-1 text-right"
				><Icon name="play" size={12} filled />hear 15 s · tap a song to pick it</span
			>
		</p>

		<div class="-mx-4 min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-6">
			<div class="flex flex-col gap-2">
				{#if searching}
					{#if hits.length > 0}
						{@render card(hits)}
					{:else}
						<EmptyState
							icon="search"
							title="No song matches “{query.trim()}”"
							body="Once it is added and ready, it shows here."
						>
							{#snippet action()}
								<a
									href={resolve(`/${slug}/songs?add=1`)}
									onclick={close}
									class="inline-flex min-h-11 items-center text-[15px] font-extrabold text-accent-text"
									>Add it in Music</a
								>
							{/snippet}
						</EmptyState>
					{/if}
				{:else if groups.recent.length > 0}
					<h3 class={SECTION_LABEL}>Recent</h3>
					{@render card(groups.recent)}
					{#if groups.rest.length > 0}
						<h3 class="{SECTION_LABEL} mt-2">All songs A–Z</h3>
						{@render card(groups.rest)}
					{/if}
				{:else}
					{@render card(groups.rest)}
				{/if}
			</div>
		</div>
	</div>
</Sheet>
