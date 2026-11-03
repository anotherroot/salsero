<script lang="ts">
	import { enhance } from '$app/forms';
	import Screen from '$lib/components/ui/Screen.svelte';
	import BackButton from '$lib/components/shell/BackButton.svelte';
	import Banner from '$lib/components/ui/Banner.svelte';
	import EmptyState from '$lib/components/ui/EmptyState.svelte';
	import Spinner from '$lib/components/ui/Spinner.svelte';
	import { GROUP, button } from '$lib/components/ui/styles';
	import { agoText } from '$lib/format';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	/** The change whose Restore is on its way. */
	let busy = $state<number | null>(null);
</script>

<svelte:head><title>History · {data.root.title}</title></svelte:head>

<Screen title="History" subtitle="{data.root.title} · {data.team.name}" compact>
	{#snippet left()}
		<BackButton fallback={{ href: data.root.href, label: `Back to ${data.root.title}` }} />
	{/snippet}

	{#if form?.message}<Banner kind="error">{form.message}</Banner>{/if}

	{#if data.changes.length === 0}
		<EmptyState
			icon="clock"
			title="No changes yet"
			body="Who changes what in the group shows here."
		/>
	{:else}
		<ul class={GROUP} aria-label="Changes, newest first">
			{#each data.changes as change (change.id)}
				<li class="flex min-h-14 items-center gap-3 px-4 py-2.5">
					<div class="min-w-0 flex-1">
						<p class="text-[15px] font-bold text-ink">{change.line}</p>
						{#if change.was !== null}
							<p class="truncate text-[13px] text-muted">Was: {change.was}</p>
						{/if}
						<p class="text-[13px] text-muted">{agoText(change.at, data.now)}</p>
					</div>
					{#if change.restorable}
						<form
							method="POST"
							action="?/restore"
							use:enhance={() => {
								busy = change.id;
								return async ({ update }) => {
									try {
										await update();
									} finally {
										busy = null;
									}
								};
							}}
						>
							<input type="hidden" name="changeId" value={change.id} />
							<button
								type="submit"
								class={button('secondary', 'sm')}
								aria-busy={busy === change.id}
								disabled={busy !== null}
							>
								{#if busy === change.id}<Spinner /><span class="sr-only">Restoring…</span
									>{:else}Restore{/if}
							</button>
						</form>
					{/if}
				</li>
			{/each}
		</ul>
	{/if}
</Screen>
