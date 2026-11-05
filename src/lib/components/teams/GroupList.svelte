<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import type { SubmitFunction } from '@sveltejs/kit';
	import Banner from '$lib/components/ui/Banner.svelte';
	import Badge from '$lib/components/ui/Badge.svelte';
	import EmptyState from '$lib/components/ui/EmptyState.svelte';
	import Icon from '$lib/components/ui/Icon.svelte';
	import Spinner from '$lib/components/ui/Spinner.svelte';
	import { GROUP, button } from '$lib/components/ui/styles';
	import { newPill, peopleLine, roleLabel } from '$lib/teams/view';
	import type { DanceSlug } from '$lib/dances/dances';
	import type { TeamItem } from '$lib/types';

	/**
	 * The Groups list: the person's groups in this dance, or the empty state with
	 * New group. The Groups layout renders it once, so it is the phone's list page
	 * and the desktop's column beside an open group (`openId`: its row is lit, its
	 * badges solid). `workingIn`: the group group mode works in.
	 *
	 * On the desktop the badges sit beside the name (the 360 column has no room
	 * for them before the chevron); on the phone they stay on the right. Each is
	 * drawn in both places and only one place is ever displayed.
	 */
	let {
		teams,
		dance,
		openId,
		workingIn,
		onnew
	}: {
		teams: (TeamItem & { newCount: number })[];
		dance: DanceSlug;
		openId: number | null;
		workingIn: number | null;
		onnew: () => void;
	} = $props();

	// Restore, on a deleted group's row: its refusal (a live group has the name) shows above the list.
	// It posts to the group's own route (`{href}?/restore`), from any Groups page.
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

{#if teams.length === 0}
	<div class="h-[52px] flex-none"></div>
	<EmptyState
		icon="group"
		title="No groups yet"
		body="Make a group for your class, then share its code. Everyone in it sees the lessons you publish."
	>
		{#snippet action()}
			<button type="button" class={button('primary')} onclick={onnew}>
				<Icon name="plus" size={20} /> New group
			</button>
		{/snippet}
	</EmptyState>
{:else}
	{#if restoreError}<Banner kind="error">{restoreError}</Banner>{/if}
	<ul class={GROUP} aria-label="Your groups">
		{#each teams as team (team.id)}
			{@const href = resolve('/[dance]/groups/[id]', { dance, id: String(team.id) })}
			{@const lit = team.id === openId}
			{@const working = team.id === workingIn}
			{@const pill = newPill(team.newCount)}
			{#snippet badges()}
				{#if team.deletedAt !== null}
					<Badge>Deleted</Badge>
				{:else}
					{#if working}<Badge tone="accent" solid={lit}>Working in</Badge>{/if}
					{#if pill}<Badge tone="accent" solid={lit}>{pill}</Badge>{/if}
				{/if}
			{/snippet}
			<li class="flex items-center" class:bg-accent-soft={lit}>
				<a
					{href}
					aria-current={lit ? 'page' : undefined}
					class="flex min-h-[72px] min-w-0 flex-1 items-center gap-3 py-3 pr-3 pl-4 active:bg-step"
				>
					<span
						aria-hidden="true"
						class="flex h-12 w-12 flex-none items-center justify-center rounded-xl bg-accent-soft text-accent-text"
						><Icon name="group" size={24} /></span
					>
					<span class="flex min-w-0 flex-1 flex-col gap-0.5">
						<!-- The phone: the name alone (`contents`). The desktop: the name, then its badges. -->
						<span
							class="contents desk:flex desk:flex-wrap desk:items-center desk:gap-x-2 desk:gap-y-1"
						>
							<span
								class="truncate text-[16px] leading-[1.3] font-bold text-ink desk:whitespace-normal"
								>{team.name}</span
							>
							<span class="hidden desk:inline-flex desk:gap-2">{@render badges()}</span>
						</span>
						<span class="text-[13px] text-muted"
							>{peopleLine(team.people)} · {roleLabel(team.role)}</span
						>
					</span>
					<!-- The phone's badges, on the right as ever. -->
					<span class="contents desk:hidden">{@render badges()}</span>
					{#if team.deletedAt === null}
						{#if !working}
							<span class="flex flex-none text-chevron"
								><Icon name="chevron-right" size={20} /></span
							>
						{:else}
							<!-- The phone keeps Working in in the chevron's place; the desktop has room for both. -->
							<span class="hidden flex-none text-chevron desk:flex"
								><Icon name="chevron-right" size={20} /></span
							>
						{/if}
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
