<!--
	The Song field and its popup, in place of a `<select>`: a native dropdown
	cannot hold a play button. The field shows the pick with a ▶ that samples
	it; the rest of the field opens "Pick a song" — a search, then Recent and
	A to Z, every row with its own ▶. Sampling never changes the pick; tapping
	a row picks it and closes. Every way of closing stops the sample.
-->
<script lang="ts">
	import { onDestroy } from 'svelte';
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import Sheet from '$lib/components/ui/Sheet.svelte';
	import SampleButton from '$lib/components/songs/SampleButton.svelte';
	import { FIELD } from '$lib/components/ui/styles';
	import { getDance, isDanceSlug } from '$lib/dances/dances';
	import { groupSongs, highlight, searchSongs } from '$lib/songs/search';
	import { sampling, stopSample } from '$lib/songs/sample-player.svelte';
	import { clock } from '$lib/format';
	import type { PickerSong } from '$lib/types';

	interface Props {
		/** This dance's ready songs. */
		songs: PickerSong[];
		songId: number | null;
		/** The id of the visible "Song" text, which names the field's button. */
		labelId?: string;
	}

	let { songs, songId = $bindable(), labelId }: Props = $props();

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
	const countText = $derived(
		searching
			? hits.length === 1
				? '1 match'
				: `${hits.length} matches`
			: songs.length === 1
				? '1 song'
				: `${songs.length} songs`
	);

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

	const heading =
		'border-t border-line bg-surface px-3 pt-2.5 pb-1.5 text-[11px] font-medium tracking-wide text-muted uppercase first:border-t-0';
</script>

{#snippet line(s: PickerSong)}
	{#if sampling.id === s.id}
		<span class="block truncate text-[12px] text-accent">Sample from {clock(s.sample.startS)}</span>
	{:else}
		<span class="block truncate text-[12px] text-muted tabular-nums">{meta(s)}</span>
	{/if}
{/snippet}

{#snippet row(s: PickerSong)}
	{@const on = s.id === songId}
	{@const h = searching ? highlight(s.title, query) : null}
	<li class="flex items-stretch border-t border-line first:border-t-0 {on ? 'bg-accent/8' : ''}">
		<button
			type="button"
			aria-current={on ? 'true' : undefined}
			onclick={() => pick(s)}
			class="inset-focus flex min-w-0 flex-1 items-center gap-3 px-3 py-2.5 text-left"
		>
			<span
				class="grid size-4 flex-none place-items-center rounded-full border-[1.5px] {on
					? 'border-accent'
					: 'border-rule'}"
				aria-hidden="true"
			>
				{#if on}<span class="size-2 rounded-full bg-accent"></span>{/if}
			</span>
			<span class="min-w-0">
				<span class="block truncate text-[15px] font-medium">
					{#if h}{h.before}<mark class="bg-transparent font-bold text-accent">{h.match}</mark
						>{h.after}{:else}{s.title}{/if}
				</span>
				{@render line(s)}
			</span>
		</button>
		<SampleButton song={s.sample} />
	</li>
{/snippet}

<div class="flex items-stretch rounded-lg border border-rule bg-raised">
	<button
		type="button"
		id="{buttonId}-field"
		aria-labelledby={labelId ? `${labelId} ${buttonId}-field` : undefined}
		aria-haspopup="dialog"
		onclick={() => (open = true)}
		class="inset-focus flex min-w-0 flex-1 items-center gap-3 px-3 py-2 text-left"
	>
		<span class="min-w-0 flex-1">
			{#if picked}
				<span class="block truncate text-[15px] font-medium">{picked.title}</span>
				{@render line(picked)}
			{:else}
				<span class="block py-1 text-[15px] text-muted">Pick a song</span>
			{/if}
		</span>
		<span class="flex-none text-[14px] text-muted" aria-hidden="true">⌄</span>
	</button>
	{#if picked}
		<SampleButton song={picked.sample} />
	{/if}
</div>

<Sheet title="Pick a song" {open} onclose={close}>
	<div class="relative">
		<svg
			width="16"
			height="16"
			viewBox="0 0 16 16"
			fill="none"
			stroke-width="1.8"
			class="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 stroke-muted"
			aria-hidden="true"
		>
			<circle cx="7" cy="7" r="5" />
			<path d="M11 11l3.5 3.5" stroke-linecap="round" />
		</svg>
		<input
			bind:this={search}
			bind:value={query}
			type="search"
			placeholder="Search songs"
			aria-label="Search songs"
			autocomplete="off"
			class="{FIELD} pl-9 placeholder:text-muted"
		/>
	</div>
	<p class="mt-2 mb-2 flex justify-between gap-3 text-[12px] text-muted">
		<span>{countText}</span>
		<span class="text-right">▶ hear 15 s · tap a song to pick it</span>
	</p>

	<!-- 88dvh is the sheet's cap; the rest is its header, the search and the count line. -->
	<div class="max-h-[calc(88dvh-11.5rem)] overflow-y-auto rounded-lg border border-line bg-raised">
		{#if searching}
			{#if hits.length > 0}
				<ul>
					{#each hits as s (s.id)}{@render row(s)}{/each}
				</ul>
			{:else}
				<p class="px-4 py-7 text-center text-[14px] leading-relaxed text-muted">
					No song matches “{query.trim()}”.<br />
					<a
						href={resolve('/[dance]/songs', { dance: slug })}
						onclick={close}
						class="font-medium text-accent">Add it on the Songs page.</a
					>
				</p>
			{/if}
		{:else}
			{#if groups.recent.length > 0}
				<p class={heading}>Recent</p>
				<ul>
					{#each groups.recent as s (s.id)}{@render row(s)}{/each}
				</ul>
				<p class={heading}>All songs A–Z</p>
			{/if}
			<ul>
				{#each groups.rest as s (s.id)}{@render row(s)}{/each}
			</ul>
		{/if}
	</div>
</Sheet>

<style>
	/*
	 * The app's focus ring sits 2px outside; on a row inside the scroll box or
	 * the field's border it would be clipped or cross the next row, so it goes
	 * inside here. A scoped rule, because utilities lose to the global one.
	 */
	.inset-focus:focus-visible {
		outline-offset: -2px;
	}
</style>
