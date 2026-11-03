<script lang="ts">
	import Badge from '$lib/components/ui/Badge.svelte';
	import Icon from '$lib/components/ui/Icon.svelte';
	import { dateTile, lessonCounts, videoMeta } from '$lib/lessons/list';
	import type { LessonItem } from '$lib/types';

	/**
	 * One lesson in a list: its date tile, title, videos and the three counts.
	 * The Lessons tab's rows and a group page's; `draft` marks a group's lesson
	 * only its editors see yet.
	 */
	let {
		lesson,
		href,
		draft = false
	}: { lesson: LessonItem; href: string; draft?: boolean } = $props();

	const tile = $derived(dateTile(lesson.lessonDay));
	const meta = $derived(videoMeta(lesson));
</script>

<li>
	<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- the caller resolves it -->
	<a {href} class="flex min-h-[84px] items-center gap-3 py-3 pr-3 pl-4 active:bg-step">
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
				{#if draft}<Badge tone="warn">Draft</Badge>{/if}
			</span>
			{#if meta}<span class="text-[13px] text-muted">{meta}</span>{/if}
			<!-- Always all three, in the same place: a zero is muted rather than vanishing, so a lesson still missing something shows it. -->
			<span class="mt-[5px] flex flex-wrap gap-x-3 text-[13px]">
				{#each lessonCounts(lesson) as c (c.word)}
					<span class={c.n === 0 ? 'text-muted' : 'text-ink-2'}
						><span class="font-extrabold tabular-nums {c.n === 0 ? '' : 'text-ink'}">{c.n}</span>
						{c.word}</span
					>
				{/each}
			</span>
		</span>
		<span class="flex flex-none text-chevron"><Icon name="chevron-right" size={20} /></span>
	</a>
</li>
