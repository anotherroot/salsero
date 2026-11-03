<script lang="ts">
	import { resolve } from '$app/paths';
	import Screen from '$lib/components/ui/Screen.svelte';
	import BandButton from '$lib/components/ui/BandButton.svelte';
	import GroupModeButton from '$lib/components/shell/GroupModeButton.svelte';
	import EmptyState from '$lib/components/ui/EmptyState.svelte';
	import Icon from '$lib/components/ui/Icon.svelte';
	import NewLessonSheet from '$lib/components/lessons/NewLessonSheet.svelte';
	import LessonRow from '$lib/components/lessons/LessonRow.svelte';
	import { GROUP, SECTION_LABEL, button } from '$lib/components/ui/styles';
	import { diskSubtitle, emptyLessonsBody, monthGroups, splitDrafts } from '$lib/lessons/list';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let creating = $state(false);
	// The `form` that was there when the sheet opened: an older refusal is not this sheet's.
	let seen: unknown = $state(null);
	// A failed create re-renders with the message; keep the sheet open to show it.
	$effect(() => {
		if (form !== seen && form?.message) creating = true;
	});

	function openSheet() {
		seen = form;
		creating = true;
	}
	// In group mode the editors' drafts sit apart, above the published months.
	const split = $derived(splitDrafts(data.lessons));
	const groups = $derived(monthGroups(split.published));
</script>

<svelte:head><title>Lessons · {data.dance.label}</title></svelte:head>

<Screen title="Lessons" subtitle={diskSubtitle(data.storageBytes)}>
	{#snippet right()}
		<GroupModeButton />
		<BandButton icon="plus" label="New lesson" onclick={openSheet} />
	{/snippet}

	{#if data.lessons.length === 0}
		<div class="h-[52px] flex-none"></div>
		<EmptyState
			icon="lessons"
			title="No lessons yet"
			body={emptyLessonsBody(data.groupMode !== null)}
		>
			{#snippet action()}
				<button type="button" class={button('primary')} onclick={openSheet}>
					<Icon name="plus" size={20} /> New lesson
				</button>
			{/snippet}
		</EmptyState>
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
								href={resolve('/[dance]/lessons/[id]', {
									dance: data.dance.slug,
									id: String(lesson.id)
								})}
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
								href={resolve('/[dance]/lessons/[id]', {
									dance: data.dance.slug,
									id: String(lesson.id)
								})}
							/>
						{/each}
					</ul>
				</section>
			{/each}
		</div>
	{/if}
</Screen>

<NewLessonSheet
	open={creating}
	onclose={() => (creating = false)}
	action="?/create"
	refusal={form !== seen ? form : null}
	today={data.today}
	frequency={!data.groupMode}
/>
