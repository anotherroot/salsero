<script lang="ts">
	import { resolve } from '$app/paths';
	import PaneColumns from '$lib/components/ui/PaneColumns.svelte';
	import Badge from '$lib/components/ui/Badge.svelte';
	import Icon from '$lib/components/ui/Icon.svelte';
	import Spinner from '$lib/components/ui/Spinner.svelte';
	import SongRow from '$lib/components/songs/SongRow.svelte';
	import { GROUP, SECTION_LABEL, button } from '$lib/components/ui/styles';
	import { t } from '$lib/i18n/catalog';
	import { dateTile } from '$lib/lessons/list';
	import { classMeta, classSongsHeading, latestAndEarlier, MY_CLASS } from '$lib/teams/view';
	import { readyMeta, songName } from '$lib/songs/library';
	import { practiseHref } from '$lib/songs/music';
	import { reportOpen } from '$lib/teams/opens-api';
	import type { DanceSlug } from '$lib/dances/dances';
	import type { AddState, SongItem, TeamLessonItem } from '$lib/types';

	/**
	 * My class's class page (Follow my class, levels spec "My class"): the latest
	 * class as a big card, the earlier ones as rows, newest first, and the class
	 * songs with their samples. A class not added yet (one from before the person
	 * joined) has a small Add: one tap, the default picks (`onadd`, the page's
	 * `addNow`). An added class shows nothing extra. Each class opens its lesson
	 * page; each song opens Practice with it (`practiseHref`), not the song page, whose
	 * tools are an editor's: My class is drawn only at Follow my class (`simpleClass`,
	 * levels.ts). The tap records the song as opened, as the song page would.
	 */
	type ClassLesson = TeamLessonItem & {
		isNew: boolean;
		add: AddState | null;
		/** What Add puts on Today: the lesson, its routines and drills. */
		practise: number;
	};
	/** A shared, ready class song. */
	type ClassSong = SongItem & { isNew: boolean };

	let {
		dance,
		styleLabel,
		lessons,
		songs,
		addingNow,
		onadd
	}: {
		dance: DanceSlug;
		styleLabel: Record<string, string>;
		lessons: ClassLesson[];
		songs: ClassSong[];
		/** The class whose Add is on its way, if any: every Add waits for it. */
		addingNow: number | null;
		onadd: (lessonId: number) => void;
	} = $props();

	const classes = $derived(latestAndEarlier(lessons));
	const href = (id: number) => resolve('/[dance]/lessons/[id]', { dance, id: String(id) });
	/** Add is drawn on a class that can be added and is not yet. */
	const addable = (l: ClassLesson) => l.add !== null && !l.add.added && l.add.offer !== null;
	const w = $derived(t().entry.classes);
</script>

{#snippet add(l: ClassLesson)}
	<button
		type="button"
		class={button('secondary', 'sm')}
		aria-label={w.addLesson(l.title)}
		aria-busy={addingNow === l.id}
		disabled={addingNow !== null}
		onclick={() => onadd(l.id)}
		>{#if addingNow === l.id}<Spinner />{:else}{w.add}{/if}</button
	>
{/snippet}

{#snippet latestCard(l: ClassLesson)}
	{@const tile = dateTile(l.lessonDay)}
	{@const meta = classMeta(l.videos, l.practise)}
	<div class="flex items-start rounded-[22px] bg-surface">
		<a
			href={href(l.id)}
			class="flex min-w-0 flex-1 items-center gap-4 rounded-[22px] p-4 active:bg-step"
		>
			<span
				aria-hidden="true"
				class="flex h-[76px] w-16 flex-none flex-col items-center justify-center gap-1 rounded-2xl bg-accent-soft"
			>
				<span
					class="text-[12px] leading-none font-extrabold tracking-[0.06em] text-accent-text uppercase"
					>{tile.weekday}</span
				>
				<span class="font-display text-[30px] leading-none font-extrabold text-ink">{tile.day}</span
				>
			</span>
			<span class="flex min-w-0 flex-1 flex-col gap-1">
				<span class="flex flex-wrap items-center gap-x-2 gap-y-1">
					<span class="font-display text-[22px] leading-[1.15] font-extrabold text-ink"
						><span class="sr-only">{tile.label}, </span>{l.title}</span
					>
					{#if l.isNew}<Badge tone="accent">{w.isNew}</Badge>{/if}
				</span>
				{#if meta}<span class="text-[15px] text-muted">{meta}</span>{/if}
			</span>
			{#if !addable(l)}
				<span class="flex flex-none self-center text-chevron"
					><Icon name="chevron-right" size={22} /></span
				>
			{/if}
		</a>
		{#if addable(l)}<span class="flex flex-none self-center pr-4">{@render add(l)}</span>{/if}
	</div>
{/snippet}

{#snippet classRow(l: ClassLesson)}
	{@const tile = dateTile(l.lessonDay)}
	{@const meta = classMeta(l.videos, l.practise)}
	<li class="flex items-center">
		<a
			href={href(l.id)}
			class="flex min-h-[72px] min-w-0 flex-1 items-center gap-3 py-3 pl-4 active:bg-step {addable(
				l
			)
				? 'pr-2'
				: 'pr-3'}"
		>
			<span
				aria-hidden="true"
				class="flex h-[54px] w-12 flex-none flex-col items-center justify-center gap-[3px] rounded-xl bg-accent-soft"
			>
				<span
					class="text-[11px] leading-none font-extrabold tracking-[0.06em] text-accent-text uppercase"
					>{tile.weekday}</span
				>
				<span class="font-display text-[22px] leading-none font-extrabold text-ink">{tile.day}</span
				>
			</span>
			<span class="flex min-w-0 flex-1 flex-col gap-0.5">
				<span class="flex flex-wrap items-center gap-x-2 gap-y-1">
					<span class="text-[16px] leading-[1.3] font-bold text-ink"
						><span class="sr-only">{tile.label}, </span>{l.title}</span
					>
					{#if l.isNew}<Badge tone="accent">{w.isNew}</Badge>{/if}
				</span>
				{#if meta}<span class="text-[13px] text-muted">{meta}</span>{/if}
			</span>
			{#if !addable(l)}
				<span class="flex flex-none text-chevron"><Icon name="chevron-right" size={20} /></span>
			{/if}
		</a>
		{#if addable(l)}<span class="flex flex-none pr-3">{@render add(l)}</span>{/if}
	</li>
{/snippet}

{#snippet classesColumn()}
	{#if classes.latest}
		<section class="flex flex-col gap-2" aria-label={w.latest}>
			{@render latestCard(classes.latest)}
		</section>
		{#if classes.earlier.length > 0}
			<section class="flex flex-col gap-2">
				<h2 class={SECTION_LABEL}>{MY_CLASS.earlier}</h2>
				<ul class={GROUP} aria-label={MY_CLASS.earlier}>
					{#each classes.earlier as l (l.id)}{@render classRow(l)}{/each}
				</ul>
			</section>
		{/if}
	{:else}
		<div class="rounded-2xl bg-surface px-4 py-5 text-[15px] text-muted">{w.noClasses}</div>
	{/if}
{/snippet}

{#snippet songsColumn()}
	{#if songs.length > 0}
		<section class="flex flex-col gap-2">
			<h2 class={SECTION_LABEL}>{classSongsHeading(songs.length)}</h2>
			<ul class={GROUP} aria-label={w.songs}>
				{#each songs as s (s.id)}
					<SongRow
						href={practiseHref(dance, { lesson: true }, s.id)}
						onopen={() => reportOpen('song', s.id)}
						name={songName(s)}
						meta={readyMeta(s, styleLabel)}
						sample={s.sample}
						isNew={s.isNew}
					/>
				{/each}
			</ul>
		</section>
	{/if}
{/snippet}

<PaneColumns ratio="7:5" class="gap-4" left={classesColumn} right={songsColumn} />
