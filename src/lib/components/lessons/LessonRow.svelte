<script lang="ts">
	import { PRESS_ROW } from '$lib/components/ui/styles';
	import WaitingBadge from '$lib/components/ui/WaitingBadge.svelte';
	import type { Snippet } from 'svelte';
	import Badge from '$lib/components/ui/Badge.svelte';
	import Icon from '$lib/components/ui/Icon.svelte';
	import GroupMark from '$lib/components/moves/GroupMark.svelte';
	import { cloneChip, twinsChip } from '$lib/clones/twins';
	import { copyChip, copyMeta } from '$lib/teams/leave-view';
	import { dateTile, lessonCounts, onPhoneMark, videoMeta } from '$lib/lessons/list';
	import { kept } from '$lib/offline/kept.svelte';
	import { t } from '$lib/i18n/catalog';
	import type { LessonItem } from '$lib/types';

	/**
	 * One lesson in a list: its date tile, title, videos and the three counts.
	 * The Lessons tab's rows and a group page's; `draft` marks a group's lesson
	 * only its editors see yet, `group` names the group of one the person added.
	 * `aside` sits beside the link, outside it (the group page's Add). `simple`
	 * (a person below Everything): no size and no counts, as simple screens show
	 * none.
	 */
	let {
		lesson,
		href,
		draft = false,
		group,
		isNew = false,
		current = false,
		simple = false,
		aside
	}: {
		lesson: LessonItem;
		href: string;
		draft?: boolean;
		group?: string;
		isNew?: boolean;
		/** The lesson open beside the list (desktop): tinted, its badges solid. */
		current?: boolean;
		simple?: boolean;
		aside?: Snippet;
	} = $props();

	const tile = $derived(dateTile(lesson.lessonDay));
	const meta = $derived(videoMeta(lesson, !simple));
	/** Every video of it on this phone (offline phase 4b). */
	const onPhone = $derived(meta ? onPhoneMark(lesson, kept.status) : null);
	const pad = $derived(aside ? 'pr-2' : 'pr-3');
</script>

<li class="flex items-center" class:bg-accent-soft={current}>
	<a
		{href}
		aria-current={current ? 'page' : undefined}
		class="flex min-h-[84px] min-w-0 flex-1 items-center gap-3 py-3 pl-4 active:bg-step {pad} {PRESS_ROW}"
	>
		<span
			aria-hidden="true"
			class="flex h-[54px] w-12 flex-none flex-col items-center justify-center gap-[3px] rounded-xl bg-accent-soft"
		>
			<span
				class="text-[11px] leading-none font-extrabold tracking-[0.06em] text-accent-text uppercase"
				>{tile.weekday}</span
			>
			<span class="font-display text-[22px] leading-none font-extrabold text-ink">{tile.day}</span>
		</span>
		<span class="flex min-w-0 flex-1 flex-col gap-0.5">
			<span class="flex flex-wrap items-center gap-x-2 gap-y-1">
				<span class="text-[16px] leading-[1.3] font-bold text-ink"
					><span class="sr-only">{tile.label}, </span>{lesson.title}</span
				>
				{#if draft}<Badge tone="warn" solid={current}>{t().lesson.list.draft}</Badge>{/if}
				<WaitingBadge table="lessons" id={lesson.id} />
				{#if isNew}<Badge tone="accent" solid={current}>{t().lesson.list.isNew}</Badge>{/if}
				{#if lesson.copyOf}<Badge>{copyChip()}</Badge>{/if}
				<!-- The twin icon is the kit's `link`: the kit has none of its own. -->
				{#if lesson.twinned}<Badge><Icon name="link" size={14} />{twinsChip()}</Badge>{/if}
				<!-- With clones, as the Figures list marks them; a kept copy already says Copy. -->
				{#if (lesson.copies ?? 0) > 0 && !lesson.copyOf}<Badge
						><Icon name="copy" size={14} />{cloneChip()}</Badge
					>{/if}
			</span>
			{#if group}<GroupMark name={group} />{/if}
			{#if lesson.copyOf}<span class="text-[13px] text-muted">{copyMeta(lesson.copyOf)}</span>{/if}
			{#if meta}<span class="text-[13px] text-muted"
					>{meta}{#if onPhone}<span> · </span><span
							class="inline-flex items-center gap-0.5 font-bold text-done"
							><Icon name="phone-check" size={13} />{onPhone}</span
						>{/if}</span
				>{/if}
			<!-- Always all three, in the same place: a zero is muted rather than vanishing, so a lesson still missing something shows it. -->
			{#if !simple}
				<span class="mt-[5px] flex flex-wrap gap-x-3 text-[13px]">
					{#each lessonCounts(lesson) as c (c.word)}
						<span class={c.n === 0 ? 'text-muted' : 'text-ink-2'}
							><span class="font-extrabold tabular-nums {c.n === 0 ? '' : 'text-ink'}">{c.n}</span>
							{c.word}</span
						>
					{/each}
				</span>
			{/if}
		</span>
		{#if !aside}
			<span class="flex flex-none text-chevron"><Icon name="chevron-right" size={20} /></span>
		{/if}
	</a>
	{#if aside}<span class="flex flex-none pr-3">{@render aside()}</span>{/if}
</li>
