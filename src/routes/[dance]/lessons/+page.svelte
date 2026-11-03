<script lang="ts">
	import { resolve } from '$app/paths';
	import Screen from '$lib/components/ui/Screen.svelte';
	import BandButton from '$lib/components/ui/BandButton.svelte';
	import EmptyState from '$lib/components/ui/EmptyState.svelte';
	import Icon from '$lib/components/ui/Icon.svelte';
	import NewLessonSheet from '$lib/components/lessons/NewLessonSheet.svelte';
	import LessonRow from '$lib/components/lessons/LessonRow.svelte';
	import { GROUP, SECTION_LABEL, button } from '$lib/components/ui/styles';
	import { diskSubtitle, monthGroups } from '$lib/lessons/list';
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
	const groups = $derived(monthGroups(data.lessons));
</script>

<svelte:head><title>Lessons · {data.dance.label}</title></svelte:head>

<Screen title="Lessons" subtitle={diskSubtitle(data.storageBytes)}>
	{#snippet right()}
		<BandButton icon="plus" label="New lesson" onclick={openSheet} />
	{/snippet}

	{#if data.lessons.length === 0}
		<div class="h-[52px] flex-none"></div>
		<EmptyState
			icon="lessons"
			title="No lessons yet"
			body="Add one after your next class — the videos, the notes, and something on Today to make you go back over it."
		>
			{#snippet action()}
				<button type="button" class={button('primary')} onclick={openSheet}>
					<Icon name="plus" size={20} /> New lesson
				</button>
			{/snippet}
		</EmptyState>
	{:else}
		<div class="flex flex-col gap-3.5">
			{#each groups as group (group.key)}
				<section class="flex flex-col gap-2">
					<h2 class={SECTION_LABEL}>{group.label}</h2>
					<ul class={GROUP} aria-label={group.label}>
						{#each group.lessons as lesson (lesson.id)}
							<LessonRow
								{lesson}
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
/>
