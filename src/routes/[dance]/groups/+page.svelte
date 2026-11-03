<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import type { SubmitFunction } from '@sveltejs/kit';
	import { guarded } from '$lib/unsaved/guard.svelte';
	import Screen from '$lib/components/ui/Screen.svelte';
	import BandButton from '$lib/components/ui/BandButton.svelte';
	import Sheet from '$lib/components/ui/Sheet.svelte';
	import Banner from '$lib/components/ui/Banner.svelte';
	import Badge from '$lib/components/ui/Badge.svelte';
	import EmptyState from '$lib/components/ui/EmptyState.svelte';
	import Icon from '$lib/components/ui/Icon.svelte';
	import Spinner from '$lib/components/ui/Spinner.svelte';
	import { FIELD, GROUP, LABEL, button } from '$lib/components/ui/styles';
	import { newPill, peopleLine, roleLabel } from '$lib/teams/view';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let creating = $state(false);
	// The `form` that was there when the sheet opened: an older refusal is not this sheet's.
	let seen: unknown = $state(null);
	$effect(() => {
		if (form !== seen && form?.message) creating = true;
	});
	let busy = $state(false);
	const fresh = $derived(form !== seen ? form : null);

	function openSheet() {
		seen = form;
		creating = true;
	}

	// Restore, on a deleted group's row: its refusal (a live group has the name) shows above the list.
	let restoreError = $state<string | null>(null);
	let restoring = $state<number | null>(null);
	const restore =
		(id: number): SubmitFunction =>
		({ cancel }) => {
			if (restoring !== null) return cancel();
			restoring = id;
			restoreError = null;
			return async ({ result, update }) => {
				try {
					if (result.type === 'failure') {
						restoreError = String(result.data?.message ?? 'That group could not be restored.');
					} else await update();
				} finally {
					restoring = null;
				}
			};
		};
</script>

<svelte:head><title>Groups · {data.dance.label}</title></svelte:head>

<Screen title="Groups" subtitle="Share lessons with a class">
	{#snippet right()}
		<BandButton icon="plus" label="New group" onclick={openSheet} />
	{/snippet}

	{#if data.teams.length === 0}
		<div class="h-[52px] flex-none"></div>
		<EmptyState
			icon="group"
			title="No groups yet"
			body="Make a group for your class, then share its code. Everyone in it sees the lessons you publish."
		>
			{#snippet action()}
				<button type="button" class={button('primary')} onclick={openSheet}>
					<Icon name="plus" size={20} /> New group
				</button>
			{/snippet}
		</EmptyState>
	{:else}
		{#if restoreError}<Banner kind="error">{restoreError}</Banner>{/if}
		<ul class={GROUP} aria-label="Your groups">
			{#each data.teams as team (team.id)}
				{@const href = resolve('/[dance]/groups/[id]', {
					dance: data.dance.slug,
					id: String(team.id)
				})}
				<li class="flex items-center">
					<a
						{href}
						class="flex min-h-[72px] min-w-0 flex-1 items-center gap-3 py-3 pr-3 pl-4 active:bg-step"
					>
						<span
							aria-hidden="true"
							class="flex h-12 w-12 flex-none items-center justify-center rounded-xl bg-accent-soft text-accent-text"
							><Icon name="group" size={24} /></span
						>
						<span class="flex min-w-0 flex-1 flex-col gap-0.5">
							<span class="truncate text-[16px] leading-[1.3] font-bold text-ink">{team.name}</span>
							<span class="text-[13px] text-muted"
								>{peopleLine(team.people)} · {roleLabel(team.role)}</span
							>
						</span>
						{#if team.deletedAt !== null}
							<Badge>Deleted</Badge>
						{:else if team.id === page.data.groupMode?.teamId}
							<Badge tone="accent">Working in</Badge>
						{:else}
							{#if newPill(team.newCount)}<Badge tone="accent">{newPill(team.newCount)}</Badge>{/if}
							<span class="flex flex-none text-chevron"
								><Icon name="chevron-right" size={20} /></span
							>
						{/if}
					</a>
					{#if team.deletedAt !== null}
						<!-- Only its owner still sees a deleted group: Restore, until it goes for good. -->
						<form
							method="POST"
							action="{href}?/restore"
							class="flex-none pr-3"
							use:enhance={restore(team.id)}
						>
							<button
								type="submit"
								class={button('secondary', 'sm')}
								aria-label="Restore {team.name}"
								aria-busy={restoring === team.id}
								disabled={restoring !== null}
								>{#if restoring === team.id}<Spinner />{:else}Restore{/if}</button
							>
						</form>
					{/if}
				</li>
			{/each}
		</ul>
	{/if}
</Screen>

<Sheet title="New group" open={creating} onclose={() => (creating = false)}>
	<form
		id="new-group"
		method="POST"
		action="?/create"
		novalidate
		class="flex flex-col gap-3.5"
		use:guarded={{
			label: 'New group',
			submit: ({ cancel }) => {
				if (busy) return cancel();
				busy = true;
				return async ({ update }) => {
					try {
						await update();
					} finally {
						busy = false;
					}
				};
			}
		}}
	>
		{#if fresh?.message}<Banner kind="error">{fresh.message}</Banner>{/if}
		<label class="block">
			<span class={LABEL}>Name</span>
			<!-- svelte-ignore a11y_autofocus -->
			<input
				name="name"
				autofocus
				autocomplete="off"
				maxlength="60"
				required
				value={fresh?.name ?? ''}
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
