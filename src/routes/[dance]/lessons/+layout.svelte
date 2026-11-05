<script lang="ts">
	import { tick } from 'svelte';
	import { page } from '$app/state';
	import { desk } from '$lib/nav/desk.svelte';
	import { revealLit } from '$lib/components/shell/reveal';
	import { gotoWhenSettled } from '$lib/sheets/history.svelte';
	import { listOf, openIdOf } from '$lib/nav/pane';
	import ListPane from '$lib/components/shell/ListPane.svelte';
	import BandButton from '$lib/components/ui/BandButton.svelte';
	import EmptyState from '$lib/components/ui/EmptyState.svelte';
	import Icon from '$lib/components/ui/Icon.svelte';
	import GroupModeButton from '$lib/components/shell/GroupModeButton.svelte';
	import LessonList from '$lib/components/lessons/LessonList.svelte';
	import NewLessonSheet from '$lib/components/lessons/NewLessonSheet.svelte';
	import { button } from '$lib/components/ui/styles';
	import { diskSubtitle, groupVideosSubtitle, PICK_LESSON } from '$lib/lessons/list';

	/*
	 * Lessons: the list and the lesson beside it (desktop spec, "A list and the
	 * item beside it"). The list renders here once, so opening a lesson keeps its
	 * scroll; the list page is the pane with nothing open, a lesson page the
	 * lesson. With no lessons the list is the page alone (`solo`). On the phone
	 * the list page looks as it always has and a lesson page is the lesson alone.
	 */
	let { data, children } = $props();

	const l = $derived(listOf(page.route.id));
	const isList = $derived(l?.open === false);
	const openId = $derived(openIdOf(page.url.pathname, 'lessons', data.dance.slug));

	// The lit row stays in view in the column (desktop: the column scrolls on its own).
	$effect(() => {
		if (openId === null || !desk.current) return;
		void tick().then(revealLit);
	});

	// The New lesson sheet: the band's +, the list's own button and the empty pane's open it.
	let creating = $state(false);
	type Refusal = {
		field?: string;
		message?: string;
		title?: string;
		notes?: string;
		lessonDay?: string;
	};
	// The last create's refusal, shown in the sheet until it closes or opens again.
	let refusal = $state<Refusal | null>(null);

	function openSheet() {
		refusal = null;
		creating = true;
	}
	function close() {
		creating = false;
		refusal = null;
	}
	// The list route's action is posted by name from any lesson page, so its refusal
	// comes back in the submit result, never the page's form data. A made lesson opens beside the
	// list, which stays (so the sheet closes here and the load reruns).
	async function handle(
		result: { type: string; data?: unknown; location?: string },
		update: () => Promise<void>
	) {
		if (result.type === 'failure') refusal = (result.data ?? {}) as Refusal;
		else if (result.type === 'redirect' && result.location) {
			close();
			await gotoWhenSettled(result.location, { invalidateAll: true });
		} else await update();
	}
</script>

{#snippet right()}
	<GroupModeButton />
	<BandButton icon="plus" label="New lesson" onclick={openSheet} />
{/snippet}

{#snippet list()}
	<LessonList
		lessons={data.lessons}
		dance={data.dance.slug}
		{openId}
		groupMode={data.groupMode !== null}
		onnew={openSheet}
	/>
{/snippet}

{#snippet pick()}
	<EmptyState icon="lessons" title={PICK_LESSON.title} body={PICK_LESSON.body}>
		{#snippet action()}
			<button type="button" class={button('secondary')} onclick={openSheet}>
				<Icon name="plus" size={20} /> New lesson
			</button>
		{/snippet}
	</EmptyState>
{/snippet}

{#if l}
	<ListPane
		title="Lessons"
		subtitle={diskSubtitle(data.storageBytes)}
		deskSubtitle={data.groupStorage
			? groupVideosSubtitle(data.groupStorage.usedBytes, data.groupStorage.limitBytes)
			: undefined}
		{isList}
		solo={isList && data.lessons.length === 0}
		soloWidth="narrow"
		{list}
		{right}
		empty={pick}
	>
		{@render children()}
	</ListPane>
{:else}
	{@render children()}
{/if}

<NewLessonSheet
	open={creating}
	onclose={close}
	action={`/${data.dance.slug}/lessons?/create`}
	{refusal}
	today={data.today}
	frequency={!data.groupMode}
	{handle}
/>
