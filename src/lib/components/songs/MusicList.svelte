<script lang="ts">
	import { untrack } from 'svelte';
	import { enhance } from '$app/forms';
	import { afterNavigate, beforeNavigate, invalidate, replaceState } from '$app/navigation';
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import { keepFilter, keepSearch, keptFilter } from '$lib/nav/trail.svelte';
	import { desk } from '$lib/nav/desk.svelte';
	import { entryState } from '$lib/sheets/history.svelte';
	import SearchField from '$lib/components/ui/SearchField.svelte';
	import Badge from '$lib/components/ui/Badge.svelte';
	import Banner from '$lib/components/ui/Banner.svelte';
	import EmptyState from '$lib/components/ui/EmptyState.svelte';
	import FieldError from '$lib/components/ui/FieldError.svelte';
	import Icon from '$lib/components/ui/Icon.svelte';
	import SongRow from './SongRow.svelte';
	import UploadRow from './UploadRow.svelte';
	import AddSongSheet from './AddSongSheet.svelte';
	import ImportRow from './ImportRow.svelte';
	import { importSections } from '$lib/songs/imports';
	import { focusAfterRemoval } from '$lib/focus';
	import { t } from '$lib/i18n/catalog';
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
	import type { SubmitFunction } from '@sveltejs/kit';
	import type { Dance } from '$lib/dances/dances';
	import type { GroupMode, SongImportRow, SongItem } from '$lib/types';

	/**
	 * The Music list: search, Count only, Being added, Recent, A–Z with samples,
	 * then each group's class songs. The songs layout renders it once (`ListPane`),
	 * so it is the phone's list page and, on the desktop, the list column beside an
	 * open song. Its forms post to the list route's actions by name (a bare `?/x`
	 * would post to the open song's page).
	 *
	 * The search: on the list route it is the URL's `?q=`, as ever. Beside a song it
	 * is the list's own, filtered here from the whole library, and kept in the
	 * trail (`keepFilter`), so a list rebuilt on a song page (a reload, a tab back)
	 * comes back filtered.
	 */
	let {
		data,
		isList,
		adding = $bindable(false)
	}: {
		data: {
			dance: Dance;
			groupMode: GroupMode | null;
			songs: SongItem[];
			groups: { team: { id: number; name: string }; songs: (SongItem & { isNew: boolean })[] }[];
			twinned: number[];
			users: Record<number, number>;
			/** Pasted playlists: the space's own, then (in Mine) the ready lists of groups the person edits. */
			imports?: SongImportRow[];
		};
		/** The list route; otherwise a song is open (beside it on the desktop, alone on the phone). */
		isList: boolean;
		/** The Add a song sheet; the band's + opens it too. */
		adding?: boolean;
	} = $props();

	const dance = $derived(data.dance.slug);
	/** The list's own path: its kept search and filter are under it. */
	const list = $derived(resolve('/[dance]/songs', { dance }));

	/** This page's href with `key` set to `value`, or taken out when `value` is ''. */
	const songsHref = (key: string, value: string) => {
		const kept = [...page.url.searchParams].filter(([k]) => k !== key);
		const qs = new URLSearchParams(value ? [...kept, [key, value]] : kept).toString();
		return qs ? `${list}?${qs}` : list;
	};

	/*
	 * Filtered client-side as you type: the whole library is already here. On the
	 * list route it also goes into the URL as `q` once typing pauses, so a reload
	 * and the trail bring the search back like Figures'. A shallow replace, not a
	 * `goto`: a navigation would stop a playing sample and, offline, raise the
	 * Offline screen. `page.url` does not follow a shallow replace, so the URL
	 * is read from `location`. Beside a song the URL is the song's: the search is
	 * kept in the trail instead, for the list (its filter and its kept search).
	 *
	 * Seeded from the URL on the list route (the server's first paint is the same).
	 * On a song it starts empty, as the server drew it, and takes the kept filter
	 * once the page is up.
	 */
	let query = $state(untrack(() => (isList ? (page.url.searchParams.get('q') ?? '') : '')));
	let seeded = false;
	afterNavigate((nav) => {
		if (isList) {
			// A back or a link that lands here with its own search: show it.
			if (nav.type === 'popstate' || nav.type === 'link')
				query = page.url.searchParams.get('q') ?? '';
		} else if (!seeded) query = keptFilter(list);
		seeded = true;
		// `?add=1` opens the Add a song sheet on arrival.
		if (!isList || page.url.searchParams.get('add') !== '1') return;
		adding = true;
		const clean = songsHref('add', '');
		// The router is not ready on a first load until this tick is over.
		// eslint-disable-next-line svelte/no-navigation-without-resolve -- the path is resolved; only the query is added
		setTimeout(() => replaceState(clean, page.state), 0);
	});
	const searchOf = (q: string) => (q ? `?${new URLSearchParams({ q })}` : '');
	/** `leaving`: a navigation is under way, so the URL is not this page's to change. */
	function keepQuery(q: string, leaving = false) {
		// The column's filter and the list page's kept search, in one write.
		keepFilter(list, q, searchOf(q));
		if (!isList || leaving) return;
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
	const typed = $derived(query.trim() ? query : '');
	$effect(() => {
		const q = typed;
		pending = setTimeout(() => keepQuery(q), 300);
		return () => clearTimeout(pending);
	});
	// A song tapped mid-pause: that navigation goes, the URL's replace must not
	// overtake it; the trail still keeps what was typed.
	beforeNavigate(() => {
		clearTimeout(pending);
		if (seeded) keepQuery(typed, true);
	});
	// The upload in flight shows in the Music of the dance it is filed under.
	const uploadHere = $derived(upload.current?.dance === dance);
	/** Group mode: the group's songs, drafts and shared; otherwise the person's own. */
	const team = $derived(data.groupMode?.teamId ?? null);
	// The songs that stand for their twins (board C7): a "Twins" chip.
	const twinned = $derived(new Set(data.twinned));
	const imports = $derived(data.imports ?? []);
	const sections = $derived(importSections(imports));
	const view = $derived(
		team !== null
			? classLibraryView(data.songs, query, uploadHere, imports.length, sections.adding.length)
			: libraryView(data.songs, query, uploadHere, imports.length, sections.adding.length)
	);
	const importHref = (id: number) => resolve(`/${dance}/songs/imports/${id}`);
	/** After Cancel or Dismiss: focus the next list's row, else the one before. */
	const removed = (id: number) =>
		focusAfterRemoval(
			imports.map((r) => `import-${r.id}`),
			`import-${id}`,
			[]
		);
	/** Below the person's own: each group's shared songs (none in group mode). */
	const groups = $derived(groupSections(data.groups, query));

	/*
	 * The worker runs at home once a minute, so a waiting song changes state on
	 * its own. Poll only while something is waiting — searching or not — and the
	 * list is on screen: the list route, or beside a song on the desktop.
	 * Only the list's load reruns (`app:songs`, the layout's): `invalidateAll`
	 * would rerun the open song's load too, and its fields would snap back mid-edit.
	 */
	const waiting = $derived(
		data.songs.some((s) => s.status.startsWith('waiting_')) ||
			imports.some((r) => r.status === 'reading')
	);
	$effect(() => {
		if (!waiting || !(isList || desk.current)) return;
		const t = setInterval(() => invalidate('app:songs'), 10_000);
		return () => clearInterval(t);
	});

	const songHref = (s: SongItem) => resolve('/[dance]/songs/[id]', { dance, id: String(s.id) });
	/** The song open beside the list: its row is lit. */
	const current = (s: SongItem) => page.url.pathname === songHref(s);

	/** A refused Retry, under its song. Read from the result: beside a song SvelteKit applies no `form`. */
	let retryRefusal = $state<{ id: number; message: string } | null>(null);
	const retry =
		(id: number): SubmitFunction =>
		() =>
		async ({ result, update }) => {
			retryRefusal =
				result.type === 'failure'
					? { id, message: String(result.data?.message ?? 'Could not retry.') }
					: null;
			await update();
		};
</script>

<!-- A song being added or failed: its state as meta, a badge while the worker has it. -->
{#snippet addingRow(s: SongItem, q: string)}
	{@const st = songState(s, data.dance.styleLabel)}
	<SongRow
		href={songHref(s)}
		name={songName(s)}
		query={q}
		meta={st.meta}
		tone={st.tone}
		current={current(s)}
	>
		{#snippet trailing()}
			{#if st.badge}
				<Badge tone={st.badge.tone}><Icon name={st.badge.icon} size={14} />{st.badge.text}</Badge>
			{/if}
		{/snippet}
	</SongRow>
{/snippet}

{#snippet retryStrip(s: SongItem)}
	<li class="border-t border-hairline px-2 pt-1 pb-2">
		<form method="POST" action="/{dance}/songs?/retry" use:enhance={retry(s.id)}>
			<input type="hidden" name="id" value={s.id} />
			<button type="submit" class={button('tertiary', 'sm')} aria-label="Retry {songName(s)}">
				<Icon name="refresh" size={20} /> Retry
			</button>
		</form>
		{#if retryRefusal?.id === s.id}
			<div class="px-3.5">
				<FieldError id="retry-{s.id}-error" message={retryRefusal.message} />
			</div>
		{/if}
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
		current={current(s)}
	/>
{/snippet}

{#snippet toPick()}
	{#if sections.toPick.length}
		<h2 class="{SECTION_LABEL} pt-2.5">{t().songs.imports.toPick} · {sections.toPick.length}</h2>
		<ul class={GROUP}>
			{#each sections.toPick as r (r.id)}
				<ImportRow
					row={r}
					{dance}
					href={importHref(r.id)}
					current={page.url.pathname === importHref(r.id)}
				/>
			{/each}
		</ul>
	{/if}
{/snippet}

{#snippet addingGroup(adding: SongItem[], heading: string)}
	<h2 class="{SECTION_LABEL} pt-2.5">{heading}</h2>
	<ul class={GROUP}>
		{#each sections.adding as r (r.id)}
			<ImportRow row={r} {dance} href={importHref(r.id)} onremoved={() => removed(r.id)} />
		{/each}
		<UploadRow {dance} />
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

<div class="h-0.5 flex-none desk:hidden"></div>

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
			href={resolve(`/${dance}/player?bpm=180`)}
			class="flex min-h-16 items-center gap-3 py-[9px] pr-3.5 pl-4 active:bg-step"
		>
			<span
				class="flex size-10 flex-none items-center justify-center rounded-full bg-accent-soft text-accent-text"
			>
				<Icon name="metronome" size={22} />
			</span>
			<span class="flex min-w-0 flex-1 flex-col gap-0.5">
				<span class="text-[16px] leading-[1.3] font-bold text-ink">Count only</span>
				<span class="text-[13px] leading-[1.35] text-muted">{countOnlyMeta(data.dance.clave)}</span>
			</span>
			<span class="flex flex-none text-chevron"><Icon name="chevron-right" size={20} /></span>
		</a>
	</div>
{/if}

{#if view.kind === 'class'}
	{@render toPick()}
	{#if view.adding.length || uploadHere || sections.adding.length}{@render addingGroup(
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
	{@render toPick()}
	{#if view.adding.length || uploadHere || sections.adding.length}{@render addingGroup(
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

<AddSongSheet
	action="/{dance}/songs?/addUrl"
	open={adding}
	onclose={() => (adding = false)}
	dance={data.dance}
	{team}
/>
