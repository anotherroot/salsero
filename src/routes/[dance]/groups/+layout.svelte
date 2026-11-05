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
	import GroupList from '$lib/components/teams/GroupList.svelte';
	import { FIELD, LABEL, button } from '$lib/components/ui/styles';
	import { PICK_GROUP } from '$lib/teams/view';
	import { canMakeGroup, levelShown } from '$lib/levels/levels';

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
	const making = $derived(canMakeGroup(levelShown(page.data.user?.level)));

	// The lit row stays in view in the column (desktop: the column scrolls on its own).
	$effect(() => {
		if (openId === null || !desk.current) return;
		void tick().then(revealLit);
	});

	// The New group sheet: the band's + and the empty list's button open it.
	let creating = $state(false);
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
	<BandButton icon="plus" label="New group" onclick={openSheet} />
{/snippet}

{#snippet list()}
	<GroupList
		teams={data.teams}
		dance={data.dance.slug}
		{openId}
		{workingIn}
		onnew={making ? openSheet : undefined}
	/>
{/snippet}

{#snippet pick()}
	<!-- The list page: only its <title>, which would never mount if ListPane did not render it. -->
	{@render children()}
	<EmptyState icon="group" title={PICK_GROUP.title} body={PICK_GROUP.body} />
{/snippet}

{#if l}
	<ListPane
		title="Groups"
		subtitle="Share lessons with a class"
		{isList}
		solo={isList && data.teams.length === 0}
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

<Sheet title="New group" size="small" open={creating} onclose={close}>
	<form
		id="new-group"
		method="POST"
		action={`/${data.dance.slug}/groups?/create`}
		novalidate
		class="flex flex-col gap-3.5"
		use:guarded={{
			label: 'New group',
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
			<span class={LABEL}>Name</span>
			<!-- svelte-ignore a11y_autofocus -->
			<input
				name="name"
				autofocus
				autocomplete="off"
				maxlength="60"
				required
				value={refusal?.name ?? ''}
				placeholder="Salsa nadaljevalna"
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
			aria-label={busy ? 'Creating group' : undefined}
		>
			{#if busy}<Spinner />{:else}Create group{/if}
		</button>
	{/snippet}
</Sheet>
