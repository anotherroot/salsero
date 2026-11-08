<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import Screen from '$lib/components/ui/Screen.svelte';
	import BackButton from '$lib/components/shell/BackButton.svelte';
	import EmptyState from '$lib/components/ui/EmptyState.svelte';
	import FieldError from '$lib/components/ui/FieldError.svelte';
	import Spinner from '$lib/components/ui/Spinner.svelte';
	import { GROUP, button } from '$lib/components/ui/styles';
	import { KIND_NAME, deletedByLine, purgeLine } from '$lib/teams/deleted';
	import { t } from '$lib/i18n/catalog';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	/** The row whose Restore is on its way. */
	let busy = $state<string | null>(null);
	const w = $derived(t().groups.deleted);
	const keyOf = (item: { kind: string; id: number }) => `${item.kind}-${item.id}`;
	const groupHref = $derived(
		resolve('/[dance]/groups/[id]', { dance: data.dance.slug, id: String(data.team.id) })
	);
</script>

<svelte:head><title>{w.head(data.team.name)}</title></svelte:head>

<Screen title={t().groups.page.recentlyDeleted} subtitle={data.team.name} compact>
	{#snippet left()}
		<BackButton fallback={{ href: groupHref, label: t().shell.backTo(data.team.name) }} />
	{/snippet}

	{#if data.items.length === 0}
		<EmptyState icon="trash" title={w.emptyTitle} body={w.emptyBody} />
	{:else}
		<ul class={GROUP} aria-label={w.listLabel}>
			{#each data.items as item (keyOf(item))}
				{@const key = keyOf(item)}
				{@const purge = purgeLine(item)}
				<li id="deleted-{key}" class="flex min-h-14 items-center gap-3 px-4 py-2.5">
					<div class="min-w-0 flex-1">
						<p class="text-[12px] font-bold tracking-wide text-muted uppercase">
							{KIND_NAME[item.kind]}
						</p>
						<p class="text-[15px] font-bold break-words text-ink">{item.label}</p>
						<p class="text-[13px] text-muted">{deletedByLine(item, data.now)}</p>
						{#if purge}<p class="text-[13px] text-muted">{purge}</p>{/if}
						{#if form?.action === 'restore' && form.key === key && form.message}
							<FieldError id="deleted-{key}-error" message={form.message} />
						{/if}
					</div>
					<form
						method="POST"
						action="?/restore"
						use:enhance={() => {
							busy = key;
							return async ({ update }) => {
								try {
									await update();
								} finally {
									busy = null;
								}
							};
						}}
					>
						<input type="hidden" name="kind" value={item.kind} />
						<input type="hidden" name="id" value={item.id} />
						<button
							type="submit"
							class={button('secondary', 'sm')}
							aria-busy={busy === key}
							aria-label={w.restoreLabel(KIND_NAME[item.kind], item.label)}
							disabled={busy !== null}
						>
							{#if busy === key}<Spinner /><span class="sr-only">{t().picker.restoring}</span
								>{:else}{t().picker.restore}{/if}
						</button>
					</form>
				</li>
			{/each}
		</ul>
	{/if}
</Screen>
