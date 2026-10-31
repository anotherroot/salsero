<script lang="ts">
	import { enhance } from '$app/forms';
	import { onMount } from 'svelte';
	import { invalidateAll } from '$app/navigation';
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import Screen from '$lib/components/ui/Screen.svelte';
	import BandButton from '$lib/components/ui/BandButton.svelte';
	import SearchField from '$lib/components/ui/SearchField.svelte';
	import Badge from '$lib/components/ui/Badge.svelte';
	import Banner from '$lib/components/ui/Banner.svelte';
	import EmptyState from '$lib/components/ui/EmptyState.svelte';
	import Icon from '$lib/components/ui/Icon.svelte';
	import SongRow from '$lib/components/songs/SongRow.svelte';
	import UploadRow from '$lib/components/songs/UploadRow.svelte';
	import AddSongSheet from '$lib/components/songs/AddSongSheet.svelte';
	import { GROUP, SECTION_LABEL, button } from '$lib/components/ui/styles';
	import { countOnlyMeta, libraryView, readyMeta, songName, songState } from '$lib/songs/library';
	import { upload } from '$lib/songs/upload.svelte';
	import type { SongItem } from '$lib/types';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	// The Add a song sheet opens on this; `?add=1` opens it on arrival.
	let adding = $state(false);
	onMount(() => {
		if (page.url.searchParams.get('add') === '1') adding = true;
	});
	// Only Add a song's own refusals reach the sheet: they always hand the link back.
	const addForm = $derived(form && 'url' in form ? form : null);
	// A refusal re-renders with the message; keep the sheet open to show it.
	$effect(() => {
		if (addForm?.message) adding = true;
	});
	// Client-side and not in the URL: the whole library is already here.
	let query = $state('');
	const view = $derived(libraryView(data.songs, query, upload.current !== null));

	/*
	 * The worker runs at home once a minute, so a waiting song changes state on
	 * its own. Poll only while something is waiting — searching or not.
	 */
	const waiting = $derived(data.songs.some((s) => s.status.startsWith('waiting_')));
	$effect(() => {
		if (!waiting) return;
		const t = setInterval(() => invalidateAll(), 10_000);
		return () => clearInterval(t);
	});

	const songHref = (s: SongItem) =>
		resolve('/[dance]/songs/[id]', { dance: data.dance.slug, id: String(s.id) });
</script>

<svelte:head><title>Music · {data.dance.label}</title></svelte:head>

<!-- A song being added or failed: its state as meta, a badge while the worker has it. -->
{#snippet addingRow(s: SongItem, q: string)}
	{@const st = songState(s, data.dance.styleLabel)}
	<SongRow href={songHref(s)} name={songName(s)} query={q} meta={st.meta} tone={st.tone}>
		{#snippet trailing()}
			{#if st.badge}
				<Badge tone={st.badge.tone}><Icon name={st.badge.icon} size={14} />{st.badge.text}</Badge>
			{/if}
		{/snippet}
	</SongRow>
{/snippet}

{#snippet readyRow(s: SongItem, q: string)}
	<SongRow
		href={songHref(s)}
		name={songName(s)}
		query={q}
		meta={readyMeta(s, data.dance.styleLabel)}
		sample={s.sample}
	/>
{/snippet}

<Screen title="Music">
	{#snippet right()}
		<BandButton icon="plus" label="Add a song" onclick={() => (adding = true)} />
	{/snippet}

	<div class="h-0.5 flex-none"></div>

	{#if view.kind !== 'empty'}
		<form role="search" onsubmit={(e) => e.preventDefault()}>
			<SearchField
				name="q"
				placeholder="Search songs"
				label="Search songs"
				bind:value={query}
				onclear={() => (query = '')}
			/>
		</form>
	{/if}

	{#if view.kind !== 'search'}
		<div class={GROUP} role="group" aria-label="Practice">
			<a
				href={resolve(`/${data.dance.slug}/player?bpm=180`)}
				class="flex min-h-16 items-center gap-3 py-[9px] pr-3.5 pl-4 active:bg-step"
			>
				<span
					class="flex size-10 flex-none items-center justify-center rounded-full bg-accent-soft text-accent-text"
				>
					<Icon name="metronome" size={22} />
				</span>
				<span class="flex min-w-0 flex-1 flex-col gap-0.5">
					<span class="text-[16px] leading-[1.3] font-bold text-ink">Count only</span>
					<span class="text-[13px] leading-[1.35] text-muted"
						>{countOnlyMeta(data.dance.clave)}</span
					>
				</span>
				<span class="flex flex-none text-chevron"><Icon name="chevron-right" size={20} /></span>
			</a>
		</div>
	{/if}

	{#if view.kind === 'list'}
		{#if view.adding.length || upload.current}
			<h2 class="{SECTION_LABEL} pt-2.5">{view.addingHeading}</h2>
			<ul class={GROUP}>
				<UploadRow />
				{#each view.adding as s (s.id)}
					{@render addingRow(s, '')}
					{#if s.status === 'failed'}
						<li class="border-t border-hairline px-2 pt-1 pb-2">
							<form method="POST" action="?/retry" use:enhance>
								<input type="hidden" name="id" value={s.id} />
								<button
									type="submit"
									class={button('tertiary', 'sm')}
									aria-label="Retry {songName(s)}"
								>
									<Icon name="refresh" size={20} /> Retry
								</button>
							</form>
						</li>
					{/if}
				{/each}
			</ul>
		{/if}
		{#if view.worker}
			<Banner kind="info" title="Runs on the laptop at home">
				Downloads and beat analysis happen about once a minute while it is on.
			</Banner>
		{/if}
		{#if view.recent.length}
			<h2 class="{SECTION_LABEL} pt-2.5">Recent</h2>
			<ul class={GROUP}>
				{#each view.recent as s (s.id)}{@render readyRow(s, '')}{/each}
			</ul>
		{/if}
		{#if view.rest.length}
			<h2 class="{SECTION_LABEL} pt-2.5">{view.restHeading}</h2>
			<ul class={GROUP}>
				{#each view.rest as s (s.id)}{@render readyRow(s, '')}{/each}
			</ul>
		{/if}
	{:else if view.kind === 'search'}
		{#if view.hits.length}
			<h2 class="{SECTION_LABEL} pt-1.5">{view.heading}</h2>
			<ul class={GROUP}>
				{#each view.hits as s (s.id)}
					{#if s.status === 'ready'}
						{@render readyRow(s, query)}
					{:else}
						{@render addingRow(s, query)}
					{/if}
				{/each}
			</ul>
		{:else}
			<EmptyState
				icon="search"
				title={`No song matches “${query.trim()}”`}
				body="Add it with the + above."
			>
				{#snippet action()}
					<button type="button" class={button('secondary', 'sm')} onclick={() => (adding = true)}>
						Add a song
					</button>
				{/snippet}
			</EmptyState>
		{/if}
	{:else}
		<div class="h-10 flex-none"></div>
		<EmptyState
			icon="music"
			title="No songs yet"
			body="Add one from YouTube or upload an audio file. The laptop at home downloads it and finds the beat."
		>
			{#snippet action()}
				<button type="button" class={button('primary', 'md')} onclick={() => (adding = true)}>
					<Icon name="plus" size={20} /> Add a song
				</button>
			{/snippet}
		</EmptyState>
	{/if}
</Screen>

<AddSongSheet open={adding} onclose={() => (adding = false)} dance={data.dance} form={addForm} />
