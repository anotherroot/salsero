<!--
	The Song field and its popup, in place of a `<select>`: a native dropdown
	cannot hold a play button. The field shows the pick with a ▶ that samples
	it; the rest of the field opens "Pick a song" — the shared picker: a search,
	then Recent and A to Z (one flat A to Z while searching), every row with its
	own ▶. Sampling never changes the pick; tapping a row picks it and closes.
	Every way of closing stops the sample.
-->
<script lang="ts">
	import { onDestroy } from 'svelte';
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import Picker from '$lib/components/picker/Picker.svelte';
	import SampleButton from '$lib/components/songs/SampleButton.svelte';
	import { getDance, isDanceSlug } from '$lib/dances/dances';
	import { groupSongs, searchSongs } from '$lib/songs/search';
	import { sampling, stopSample } from '$lib/songs/sample-player.svelte';
	import { clock } from '$lib/format';
	import type { PickGroup, PickRow } from '$lib/picker/model';
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

	const slug = $derived(page.params.dance ?? 'salsa');
	const styleLabels = $derived(isDanceSlug(slug) ? getDance(slug).styleLabel : {});
	const picked = $derived(songs.find((s) => s.id === songId) ?? null);

	const searching = $derived(query.trim() !== '');
	const hits = $derived(searchSongs(songs, query));
	const grouped = $derived(groupSongs(songs));
	const countText = $derived(
		searching
			? hits.length === 1
				? '1 match'
				: `${hits.length} matches`
			: songs.length === 1
				? '1 song'
				: `${songs.length} songs`
	);

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

	/** A song as a picker row; its second line follows its sample. */
	function toRow(s: PickerSong): PickRow {
		const on = sampling.id === s.id;
		return {
			key: `song:${s.id}`,
			value: s.id,
			label: s.title,
			meta: on ? `Sample from ${clock(s.sample.startS)}` : meta(s),
			metaAccent: on
		};
	}

	/** Searching: one flat A to Z of hits. Otherwise Recent, then the rest A to Z. */
	const groups = $derived<PickGroup[]>(
		searching
			? [{ title: '', entries: hits.map(toRow) }]
			: grouped.recent.length > 0
				? [
						{ title: 'Recent', entries: grouped.recent.map(toRow) },
						{ title: 'All songs A–Z', entries: grouped.rest.map(toRow) }
					]
				: [{ title: '', entries: grouped.rest.map(toRow) }]
	);

	const byId = $derived(new Map(songs.map((s) => [s.id, s])));

	/** ✕, the backdrop, Escape (and Back) all land here: the pick stays. */
	function close() {
		open = false;
		stopSample();
	}

	function pick(row: PickRow) {
		songId = row.value;
		close();
	}

	// The field's ▶ goes with the field: a sample must not outlive it unseen
	// (the log popup closing, the source switched to Count only).
	onDestroy(() => {
		if (songs.some((s) => s.id === sampling.id)) stopSample();
	});
</script>

{#snippet line(s: PickerSong)}
	{#if sampling.id === s.id}
		<span class="block truncate text-[12px] text-accent">Sample from {clock(s.sample.startS)}</span>
	{:else}
		<span class="block truncate text-[12px] text-muted tabular-nums">{meta(s)}</span>
	{/if}
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

<Picker
	{open}
	title="Pick a song"
	placeholder="Search songs"
	kind="field"
	chosen={songId === null ? null : `song:${songId}`}
	{groups}
	prefiltered
	bind:query
	nothingLeft="No songs yet."
	onpick={pick}
	onclose={close}
>
	{#snippet top()}
		<p class="mt-2 flex justify-between gap-3 text-[12px] text-muted">
			<span>{countText}</span>
			<span class="text-right">▶ hear 15 s · tap a song to pick it</span>
		</p>
	{/snippet}
	{#snippet empty()}
		{#if searching}
			No song matches “{query.trim()}”.
			<a
				href={resolve('/[dance]/songs', { dance: slug })}
				onclick={close}
				class="font-medium text-accent">Add it on the Songs page.</a
			>
		{:else}
			No songs yet.
		{/if}
	{/snippet}
	{#snippet rowEnd(row: PickRow)}
		{@const s = byId.get(row.value)}
		{#if s}<SampleButton song={s.sample} />{/if}
	{/snippet}
</Picker>

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
