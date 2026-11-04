<script lang="ts">
	import { enhance } from '$app/forms';
	import { afterNavigate, beforeNavigate, invalidateAll, replaceState } from '$app/navigation';
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import { keepSearch } from '$lib/nav/trail.svelte';
	import { entryState } from '$lib/sheets/history.svelte';
	import Screen from '$lib/components/ui/Screen.svelte';
	import BandButton from '$lib/components/ui/BandButton.svelte';
	import GroupModeButton from '$lib/components/shell/GroupModeButton.svelte';
	import SearchField from '$lib/components/ui/SearchField.svelte';
	import Badge from '$lib/components/ui/Badge.svelte';
	import Banner from '$lib/components/ui/Banner.svelte';
	import EmptyState from '$lib/components/ui/EmptyState.svelte';
	import Icon from '$lib/components/ui/Icon.svelte';
	import SongRow from '$lib/components/songs/SongRow.svelte';
	import UploadRow from '$lib/components/songs/UploadRow.svelte';
	import AddSongSheet from '$lib/components/songs/AddSongSheet.svelte';
	import { GROUP, SECTION_LABEL, button } from '$lib/components/ui/styles';
	import {
		classLibraryView,
		countOnlyMeta,
		groupSections,
		libraryView,
		readyMeta,
		sharedMeta,
		songName,
		songState
	} from '$lib/songs/library';
	import { upload } from '$lib/songs/upload.svelte';
	import type { SongItem } from '$lib/types';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	/** This page's href with `key` set to `value`, or taken out when `value` is ''. */
	const songsHref = (key: string, value: string) => {
		const href = resolve('/[dance]/songs', { dance: data.dance.slug });
		const kept = [...page.url.searchParams].filter(([k]) => k !== key);
		const qs = new URLSearchParams(value ? [...kept, [key, value]] : kept).toString();
		return qs ? `${href}?${qs}` : href;
	};

	// The Add a song sheet opens on this; `?add=1` opens it on arrival.
	let adding = $state(false);
	afterNavigate((nav) => {
		// A back or a link that lands here with its own search: show it.
		if (nav.type === 'popstate' || nav.type === 'link')
			query = page.url.searchParams.get('q') ?? '';
		if (page.url.searchParams.get('add') !== '1') return;
		adding = true;
		const clean = songsHref('add', '');
		// The router is not ready on a first load until this tick is over.
		// eslint-disable-next-line svelte/no-navigation-without-resolve -- the path is resolved; only the query is added
		setTimeout(() => replaceState(clean, page.state), 0);
	});
	// Only Add a song's own refusals reach the sheet: they always hand the link back.
	const addForm = $derived(form && 'url' in form ? form : null);
	// A refusal re-renders with the message; keep the sheet open to show it.
	$effect(() => {
		if (addForm?.message) adding = true;
	});
	/*
	 * Filtered client-side as you type: the whole library is already here. It
	 * also goes into the URL as `q` once typing pauses, so a reload and the
	 * trail bring the search back like Figures'. A shallow replace, not a
	 * `goto`: a navigation would stop a playing sample and, offline, raise the
	 * Offline screen. `page.url` does not follow a shallow replace, so the URL
	 * is read from `location`.
	 */
	let query = $state(page.url.searchParams.get('q') ?? '');
	function keepQuery(q: string) {
		const url = new URL(location.href);
		if ((url.searchParams.get('q') ?? '') === q) return;
		// A sheet's own entry is not the page's: wait until it has closed.
		if (entryState().sheets) {
			pending = setTimeout(() => keepQuery(q), 300);
			return;
		}
		if (q) url.searchParams.set('q', q);
		else url.searchParams.delete('q');
		// eslint-disable-next-line svelte/no-navigation-without-resolve -- this page's own path; only the query changes
		replaceState(url.pathname + url.search, entryState());
		keepSearch();
	}
	let pending: ReturnType<typeof setTimeout> | undefined;
	$effect(() => {
		const q = query.trim() ? query : '';
		pending = setTimeout(() => keepQuery(q), 300);
		return () => clearTimeout(pending);
	});
	// A song tapped mid-pause: that navigation goes, this one must not overtake it.
	beforeNavigate(() => clearTimeout(pending));
	// The upload in flight shows in the Music of the dance it is filed under.
	const uploadHere = $derived(upload.current?.dance === data.dance.slug);
	/** Group mode: the group's songs, drafts and shared; otherwise the person's own. */
	const team = $derived(data.groupMode?.teamId ?? null);
	// The songs that stand for their twins (board C7): a "Twins" chip.
	const twinned = $derived(new Set(data.twinned));
	const view = $derived(
		team !== null
			? classLibraryView(data.songs, query, uploadHere)
			: libraryView(data.songs, query, uploadHere)
	);
	/** Below the person's own: each group's shared songs (none in group mode). */
	const groups = $derived(groupSections(data.groups, query));

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

{#snippet retryStrip(s: SongItem)}
	<li class="border-t border-hairline px-2 pt-1 pb-2">
		<form method="POST" action="?/retry" use:enhance>
			<input type="hidden" name="id" value={s.id} />
			<button type="submit" class={button('tertiary', 'sm')} aria-label="Retry {songName(s)}">
				<Icon name="refresh" size={20} /> Retry
			</button>
		</form>
	</li>
{/snippet}

{#snippet readyRow(s: SongItem, q: string, isNew = false)}
	<SongRow
		href={songHref(s)}
		name={songName(s)}
		query={q}
		meta={s.sharedAt !== null && team !== null
			? sharedMeta(s, data.dance.styleLabel, data.users[s.id] ?? 0)
			: readyMeta(s, data.dance.styleLabel)}
		sample={s.sample}
		draft={team !== null && s.sharedAt === null}
		{isNew}
		twinned={twinned.has(s.id)}
	/>
{/snippet}

{#snippet addingGroup(adding: SongItem[], heading: string)}
	<h2 class="{SECTION_LABEL} pt-2.5">{heading}</h2>
	<ul class={GROUP}>
		<UploadRow dance={data.dance.slug} />
		{#each adding as s (s.id)}
			{@render addingRow(s, '')}
			{#if s.status === 'failed'}
				{@render retryStrip(s)}
			{/if}
		{/each}
	</ul>
{/snippet}

{#snippet workerNote()}
	<Banner kind="info" title="Runs on the laptop at home">
		Downloads and beat analysis happen about once a minute while it is on.
	</Banner>
{/snippet}

<Screen title="Music">
	{#snippet right()}
		<GroupModeButton />
		<BandButton icon="plus" label="Add a song" onclick={() => (adding = true)} />
	{/snippet}

	<div class="h-0.5 flex-none"></div>

	{#if view.kind !== 'empty' || data.groups.length > 0}
		<form role="search" onsubmit={(e) => e.preventDefault()}>
			<SearchField
				name="q"
				placeholder="Search songs"
				label="Search songs"
				bind:value={query}
				onclear={() => (query = '')}
			/>
		</form>
		<p class="sr-only" role="status">
			{view.kind === 'search'
				? view.hits.length
					? view.heading
					: `No song matches “${query.trim()}”`
				: ''}
		</p>
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

	{#if view.kind === 'class'}
		{#if view.adding.length || uploadHere}{@render addingGroup(
				view.adding,
				view.addingHeading
			)}{/if}
		{#if view.worker}{@render workerNote()}{/if}
		{#if view.drafts.length}
			<h2 class="{SECTION_LABEL} pt-2.5">{view.draftsHeading}</h2>
			<ul class={GROUP}>
				{#each view.drafts as s (s.id)}{@render readyRow(s, '')}{/each}
			</ul>
		{/if}
		{#if view.shared.length}
			<h2 class="{SECTION_LABEL} pt-2.5">{view.sharedHeading}</h2>
			<ul class={GROUP}>
				{#each view.shared as s (s.id)}{@render readyRow(s, '')}{/each}
			</ul>
		{/if}
	{:else if view.kind === 'list'}
		{#if view.adding.length || uploadHere}{@render addingGroup(
				view.adding,
				view.addingHeading
			)}{/if}
		{#if view.worker}{@render workerNote()}{/if}
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
						{#if s.status === 'failed'}{@render retryStrip(s)}{/if}
					{/if}
				{/each}
			</ul>
		{:else if groups.length === 0}
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
	{:else if team !== null}
		<div class="h-10 flex-none"></div>
		<EmptyState
			icon="music"
			title="No class songs yet"
			body="Add one from YouTube or upload an audio file. It stays a draft, seen only by the group's editors, until you share it with the class."
		>
			{#snippet action()}
				<button type="button" class={button('primary', 'md')} onclick={() => (adding = true)}>
					<Icon name="plus" size={20} /> Add a song
				</button>
			{/snippet}
		</EmptyState>
	{:else if groups.length === 0}
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

	<!-- Each group's class songs, after the person's own (a search keeps the matches). -->
	{#each groups as g (g.team.id)}
		<h2 class="{SECTION_LABEL} pt-2.5">{g.heading}</h2>
		<ul class={GROUP} aria-label={g.team.name}>
			{#each g.songs as s (s.id)}{@render readyRow(
					s,
					view.kind === 'search' ? query : '',
					s.isNew
				)}{/each}
		</ul>
	{/each}
</Screen>

<AddSongSheet
	open={adding}
	onclose={() => (adding = false)}
	dance={data.dance}
	form={addForm}
	{team}
/>
