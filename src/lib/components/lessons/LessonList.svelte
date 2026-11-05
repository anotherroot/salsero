<script lang="ts">
	import { resolve } from '$app/paths';
	import EmptyState from '$lib/components/ui/EmptyState.svelte';
	import Icon from '$lib/components/ui/Icon.svelte';
	import LessonRow from '$lib/components/lessons/LessonRow.svelte';
	import { GROUP, SECTION_LABEL, button } from '$lib/components/ui/styles';
	import { emptyLessonsBody, isOpenLesson, monthGroups, splitDrafts } from '$lib/lessons/list';
	import type { DanceSlug } from '$lib/dances/dances';
	import type { LessonItem } from '$lib/types';

	/**
	 * The Lessons list: a group's drafts apart, then the months, newest first; or
	 * the empty state with New lesson. The Lessons layout renders it once, so it
	 * is the phone's list page and the desktop's column beside an open lesson
	 * (`openId`: its row, or the row standing for it as a twin, is lit).
	 * `simple`: the rows without sizes and counts (below Everything). Without
	 * `onnew` (Follow my class creates nothing) the empty state has no New lesson.
	 */
	let {
		lessons,
		dance,
		openId,
		groupMode,
		simple = false,
		onnew
	}: {
		lessons: LessonItem[];
		dance: DanceSlug;
		openId: number | null;
		groupMode: boolean;
		simple?: boolean;
		onnew?: () => void;
	} = $props();

	// In group mode the editors' drafts sit apart, above the published months.
	const split = $derived(splitDrafts(lessons));
	const groups = $derived(monthGroups(split.published));
	const hrefOf = (l: LessonItem) => resolve('/[dance]/lessons/[id]', { dance, id: String(l.id) });
</script>

{#if lessons.length === 0}
	<div class="h-[52px] flex-none"></div>
	<EmptyState
		icon="lessons"
		title="No lessons yet"
		body={emptyLessonsBody(groupMode)}
		action={onnew ? newLesson : undefined}
	/>
	{#snippet newLesson()}
		<button type="button" class={button('primary')} onclick={onnew}>
			<Icon name="plus" size={20} /> New lesson
		</button>
	{/snippet}
{:else}
	<div class="flex flex-col gap-3.5">
		{#if split.drafts.length > 0}
			<section class="flex flex-col gap-2">
				<h2 class={SECTION_LABEL}>Drafts</h2>
				<ul class={GROUP} aria-label="Drafts">
					{#each split.drafts as lesson (lesson.id)}
						<LessonRow
							{lesson}
							draft
							current={isOpenLesson(lesson, openId)}
							{simple}
							href={hrefOf(lesson)}
						/>
					{/each}
				</ul>
			</section>
		{/if}
		{#each groups as group (group.key)}
			<section class="flex flex-col gap-2">
				<h2 class={SECTION_LABEL}>{group.label}</h2>
				<ul class={GROUP} aria-label={group.label}>
					{#each group.lessons as lesson (lesson.id)}
						<LessonRow
							{lesson}
							group={lesson.team?.name}
							current={isOpenLesson(lesson, openId)}
							{simple}
							href={hrefOf(lesson)}
						/>
					{/each}
				</ul>
			</section>
		{/each}
	</div>
{/if}
