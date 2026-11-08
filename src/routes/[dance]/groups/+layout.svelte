<script lang="ts">
	import { tick } from 'svelte';
	import { page } from '$app/state';
	import { desk } from '$lib/nav/desk.svelte';
	import { revealLit } from '$lib/components/shell/reveal';
	import { gotoWhenSettled } from '$lib/sheets/history.svelte';
	import { guarded } from '$lib/unsaved/guard.svelte';
	import { listOf, openIdOf } from '$lib/nav/pane';
	import ListPane from '$lib/components/shell/ListPane.svelte';
	import BandButton from '$lib/components/ui/BandButton.svelte';
	import EmptyState from '$lib/components/ui/EmptyState.svelte';
	import Sheet from '$lib/components/ui/Sheet.svelte';
	import Banner from '$lib/components/ui/Banner.svelte';
	import Spinner from '$lib/components/ui/Spinner.svelte';
	import ClassCodeField from '$lib/components/teams/ClassCodeField.svelte';
	import GroupList from '$lib/components/teams/GroupList.svelte';
	import ClassList from '$lib/components/teams/ClassList.svelte';
	import { FIELD, LABEL, SECTION_LABEL, button } from '$lib/components/ui/styles';
	import { MY_CLASS, PICK_GROUP } from '$lib/teams/view';
	import { canMakeGroup, levelShown, youPath, type Level } from '$lib/levels/levels';
	import { fullName } from '$lib/names';
	import YouSettings from '$lib/components/settings/YouSettings.svelte';
	import { t } from '$lib/i18n/catalog';

	/*
	 * Groups: the list and the group beside it (desktop spec, "A list and the
	 * item beside it"). The list renders here once, so opening a group, or its
	 * People, storage, History or Recently deleted, keeps the column and its
	 * scroll, with the group's row lit. With no groups the list is the page alone
	 * (`solo`). On the phone the list page looks as it always has and a group's
	 * pages are the page alone.
	 */
	let { data, children } = $props();

	const l = $derived(listOf(page.route.id));
	const isList = $derived(l?.open === false);
	const openId = $derived(openIdOf(page.url.pathname, 'groups', data.dance.slug));
	// Opening a group does not switch group mode: Working in marks the mode's group only.
	const workingIn = $derived(data.groupMode?.teamId ?? null);
	// New group is drawn only at Everything (levels hide the entry, not the route).
	const level = $derived<Level>(levelShown(page.data.user?.level));
	const making = $derived(canMakeGroup(level));
	// Join with a code sits beside New group at the other levels; Follow my class has its empty state's field.
	const joining = $derived(level !== 'follow');
	const joinAction = $derived(`/${data.dance.slug}/groups?/joinCode`);
	// My class (Follow my class): in one class its page alone, no list column (the
	// index opens it); in two or more the list of classes beside it; in none, Join your class.
	const myClass = $derived(data.myClass);
	const classCount = $derived(data.teams.filter((t) => t.deletedAt === null).length);
	const oneClass = $derived(myClass !== null && classCount === 1 && !isList);
	const empty = $derived(myClass ? classCount === 0 : data.teams.length === 0);
	// Above Follow my class the phone's tab is You: the groups, then the settings
	// (`you`); the desktop keeps Groups, with Settings in the side.
	const you = $derived(data.you);
	const title = $derived(myClass ? MY_CLASS.title : t().shell.tabs.you);
	const deskTitle = $derived(myClass ? undefined : t().shell.tabs.groups);
	const user = $derived(page.data.user);
	const deskSubtitle = $derived(myClass ? undefined : t().groups.list.subtitle);
	const w = $derived(t().groups.list);
	const subtitle = $derived.by(() => {
		if (!myClass) return user ? fullName(user) : undefined;
		return classCount > 1 ? MY_CLASS.classes : undefined;
	});

	// The lit row stays in view in the column (desktop: the column scrolls on its own).
	$effect(() => {
		if (openId === null || !desk.current) return;
		void tick().then(revealLit);
	});

	// The New group sheet: the band's + and the empty list's button open it.
	let creating = $state(false);
	// The Join with a code sheet. A joined class opens beside the list, which closes it.
	let codeOpen = $state(false);
	$effect(() => {
		void page.url.pathname;
		codeOpen = false;
	});
	let busy = $state(false);
	// The last create's refusal, shown in the sheet until it closes or opens again.
	let refusal = $state<{ message?: string; name?: string } | null>(null);

	function openSheet() {
		refusal = null;
		creating = true;
	}
	function close() {
		creating = false;
		refusal = null;
	}
</script>

{#snippet right()}
	<BandButton icon="plus" label={w.newGroup} onclick={openSheet} />
{/snippet}

{#snippet list()}
	{#if myClass}
		<ClassList
			teams={data.teams}
			dance={data.dance.slug}
			{openId}
			lastDays={myClass.lastDays}
			today={myClass.today}
			{joinAction}
		/>
	{:else}
		{#if you}<h2 class="{SECTION_LABEL} desk:hidden">{t().shell.tabs.groups}</h2>{/if}
		<GroupList
			teams={data.teams}
			dance={data.dance.slug}
			{openId}
			{workingIn}
			onnew={making ? openSheet : undefined}
			onjoin={joining ? () => (codeOpen = true) : undefined}
			{joinAction}
		/>
		{#if you}
			<!-- The phone's You: the settings under the groups. The desktop has Settings in the side. -->
			<div class="contents desk:hidden">
				<YouSettings
					settings={you}
					theme={page.data.theme}
					from={youPath(level, data.dance.slug)}
				/>
			</div>
		{/if}
	{/if}
{/snippet}

{#snippet pick()}
	<!-- The list page: only its <title>, which would never mount if ListPane did not render it. -->
	{@render children()}
	{@const words = myClass ? MY_CLASS.pick : PICK_GROUP}
	<EmptyState icon="group" title={words.title} body={words.body} />
{/snippet}

{#if l && !oneClass}
	<ListPane
		{title}
		{deskTitle}
		{subtitle}
		{deskSubtitle}
		{isList}
		solo={isList && empty}
		soloWidth="narrow"
		{list}
		right={making ? right : undefined}
		empty={pick}
	>
		{@render children()}
	</ListPane>
{:else}
	{@render children()}
{/if}

<Sheet title={w.joinWithCode} size="small" open={codeOpen} onclose={() => (codeOpen = false)}>
	<ClassCodeField action={joinAction} />
</Sheet>

<Sheet title={w.newGroup} size="small" open={creating} onclose={close}>
	<form
		id="new-group"
		method="POST"
		action={`/${data.dance.slug}/groups?/create`}
		novalidate
		class="flex flex-col gap-3.5"
		use:guarded={{
			label: w.newGroup,
			submit: ({ cancel }) => {
				// One group per tap: a second tap while the first is out is dropped.
				if (busy) return cancel();
				busy = true;
				// The list route's action is posted by name from any Groups page, so its refusal
				// comes back in the submit result, never the page's form data (the group page's
				// own New lesson reads that). A made group opens beside the list, which stays
				// (so the sheet closes here and the load reruns).
				return async ({ result, update }) => {
					try {
						if (result.type === 'failure') {
							refusal = (result.data ?? {}) as { message?: string; name?: string };
						} else if (result.type === 'redirect') {
							close();
							await gotoWhenSettled(result.location, { invalidateAll: true });
						} else await update();
					} finally {
						busy = false;
					}
				};
			}
		}}
	>
		{#if refusal?.message}<Banner kind="error">{refusal.message}</Banner>{/if}
		<label class="block">
			<span class={LABEL}>{t().groups.page.name}</span>
			<!-- svelte-ignore a11y_autofocus -->
			<input
				name="name"
				autofocus
				autocomplete="off"
				maxlength="60"
				required
				value={refusal?.name ?? ''}
				placeholder={w.namePlaceholder}
				class={FIELD}
			/>
		</label>
	</form>

	{#snippet footer()}
		<button
			type="submit"
			form="new-group"
			class={button('primary', 'md', true)}
			aria-busy={busy}
			aria-label={busy ? w.creatingGroup : undefined}
		>
			{#if busy}<Spinner />{:else}{w.createGroup}{/if}
		</button>
	{/snippet}
</Sheet>
