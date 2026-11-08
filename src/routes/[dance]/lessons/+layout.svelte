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
	import { groupModeShown, levelShown, simple, type Level } from '$lib/levels/levels';
	import LessonList from '$lib/components/lessons/LessonList.svelte';
	import ClassList from '$lib/components/teams/ClassList.svelte';
	import { MY_CLASS } from '$lib/teams/view';
	import NewLessonSheet from '$lib/components/lessons/NewLessonSheet.svelte';
	import { button } from '$lib/components/ui/styles';
	import { diskSubtitle, groupVideosSubtitle, pickLesson } from '$lib/lessons/list';
	import { t } from '$lib/i18n/catalog';

	/*
	 * Lessons: the list and the lesson beside it (desktop spec, "A list and the
	 * item beside it"). The list renders here once, so opening a lesson keeps its
	 * scroll; the list page is the pane with nothing open, a lesson page the
	 * lesson. With no lessons the list is the page alone (`solo`). On the phone
	 * the list page looks as it always has and a lesson page is the lesson alone.
	 *
	 * Levels (levels spec, "Desktop"): at Follow my class a lesson sits beside My
	 * class's list of classes, its class lit, or alone in one class (or none), as
	 * the class page does; nothing creates there, so no New lesson. Below
	 * Everything the rows show no sizes or counts.
	 */
	let { data, children } = $props();

	const l = $derived(listOf(page.route.id));
	const isList = $derived(l?.open === false);
	const openId = $derived(openIdOf(page.url.pathname, 'lessons', data.dance.slug));
	const level = $derived<Level>(levelShown(page.data.user?.level));
	const making = $derived(level !== 'follow');
	// Follow my class, a lesson open: My class's list beside it, from two classes.
	const classes = $derived(isList ? null : data.classes);
	const liveClasses = $derived(classes?.teams.filter((t) => t.deletedAt === null).length ?? 0);
	const openClass = $derived<number | null>(page.data.team?.id ?? null);

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
	{#if groupModeShown(level)}<GroupModeButton />{/if}
	{#if making}<BandButton icon="plus" label={t().lesson.list.newLesson} onclick={openSheet} />{/if}
{/snippet}

{#snippet list()}
	<LessonList
		lessons={data.lessons}
		dance={data.dance.slug}
		{openId}
		groupMode={data.groupMode !== null}
		simple={simple(level)}
		onnew={making ? openSheet : undefined}
	/>
{/snippet}

{#snippet newLesson()}
	<button type="button" class={button('secondary')} onclick={openSheet}>
		<Icon name="plus" size={20} />
		{t().lesson.list.newLesson}
	</button>
{/snippet}

{#snippet pick()}
	<!-- The list page: only its <title>, which would never mount if ListPane did not render it. -->
	{@render children()}
	<EmptyState
		icon="lessons"
		title={pickLesson().title}
		body={pickLesson().body}
		action={making ? newLesson : undefined}
	/>
{/snippet}

{#snippet classList()}
	{#if classes?.myClass}
		<ClassList
			teams={classes.teams}
			dance={data.dance.slug}
			openId={openClass}
			lastDays={classes.myClass.lastDays}
			today={classes.myClass.today}
			joinAction={`/${data.dance.slug}/groups?/joinCode`}
		/>
	{/if}
{/snippet}

{#if l && classes}
	{#if liveClasses > 1}
		<ListPane
			title={MY_CLASS.title}
			subtitle={MY_CLASS.classes}
			isList={false}
			list={classList}
			empty={pick}
		>
			{@render children()}
		</ListPane>
	{:else}
		{@render children()}
	{/if}
{:else if l}
	<ListPane
		title={t().shell.tabs.lessons}
		subtitle={simple(level) ? undefined : diskSubtitle(data.storageBytes)}
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
	{handle}
/>
