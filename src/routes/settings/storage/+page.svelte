<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import BandButton from '$lib/components/ui/BandButton.svelte';
	import Badge from '$lib/components/ui/Badge.svelte';
	import EmptyState from '$lib/components/ui/EmptyState.svelte';
	import FieldError from '$lib/components/ui/FieldError.svelte';
	import Icon from '$lib/components/ui/Icon.svelte';
	import Screen from '$lib/components/ui/Screen.svelte';
	import { CLIP, GROUP, SECTION_LABEL, button } from '$lib/components/ui/styles';
	import { focusAfterRemoval } from '$lib/focus';
	import { t } from '$lib/i18n/catalog';
	import { barFraction, itemMeta, usageLine } from '$lib/storage-view';
	import type { StorageItem } from '$lib/types';
	import type { SubmitFunction } from '@sveltejs/kit';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	const s = $derived(t().settings.storage);

	const ACTION = { recording: 'deleteRecording', lessonVideo: 'deleteVideo', song: 'deleteSong' };
	const key = (i: StorageItem) => `${i.kind}-${i.id}`;
	const deletable = (i: StorageItem): i is StorageItem & { kind: keyof typeof ACTION } =>
		i.kind !== 'voice';

	/** A refusal shown under the row it belongs to. */
	let refused = $state<Record<string, string>>({});

	const remove = (item: StorageItem): SubmitFunction => {
		return ({ cancel }) => {
			const keys = data.items.map(key);
			if (item.id === null) return cancel();
			delete refused[key(item)];
			return async ({ result, update }) => {
				if (result.type === 'failure' && result.status === 409) {
					refused[key(item)] = String(result.data?.message ?? t().settings.storage.couldNotDelete);
					return;
				}
				await update();
				await invalidateAll();
				await focusAfterRemoval(keys, key(item), 'storage-back');
			};
		};
	};
</script>

<svelte:head><title>{s.whatUses}</title></svelte:head>

<Screen title={s.whatUses} subtitle={usageLine(data.storage.usedBytes, data.storage.limitBytes)}>
	{#snippet left()}
		<BandButton icon="back" label={t().shell.backTo(t().shell.settings)} href="/settings" />
	{/snippet}

	{#if data.storage.limitBytes !== null}
		<div
			class="{CLIP} mx-4 h-2 rounded-full bg-chip"
			role="meter"
			aria-label={s.spaceUsed}
			aria-valuemin={0}
			aria-valuemax={data.storage.limitBytes}
			aria-valuenow={Math.min(data.storage.usedBytes, data.storage.limitBytes)}
		>
			<div
				class="h-full rounded-full bg-accent"
				style:width="{barFraction(data.storage.usedBytes, data.storage.limitBytes) * 100}%"
			></div>
		</div>
	{/if}

	<span class="{SECTION_LABEL} mt-[14px]" data-focus="storage-back" tabindex="-1"
		>{s.biggestFirst}</span
	>
	{#if data.items.length === 0}
		<EmptyState icon="video" title={s.nothingYet} />
	{:else}
		<ul class={GROUP}>
			{#each data.items as item (key(item))}
				<li>
					<div class="flex min-h-16 items-center gap-3 py-2 pr-1.5 pl-4">
						{#snippet label()}
							<span class="flex items-center gap-2">
								<span class="truncate text-[16px] font-bold text-ink">{item.title}</span>
								{#if item.archived}<Badge>{s.archived}</Badge>{/if}
							</span>
							<span class="truncate text-[13px] text-muted">{itemMeta(item)}</span>
						{/snippet}
						{#if item.href}
							<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- hrefs carry their own dance -->
							<a href={item.href} class="flex min-w-0 flex-1 flex-col" data-focus={key(item)}>
								{@render label()}
							</a>
						{:else}
							<div class="flex min-w-0 flex-1 flex-col" data-focus={key(item)} tabindex="-1">
								{@render label()}
							</div>
						{/if}
						{#if deletable(item)}
							<form method="POST" action="?/{ACTION[item.kind]}" use:enhance={remove(item)}>
								<input type="hidden" name="id" value={item.id} />
								<button
									class={button('danger-text', 'sm')}
									aria-label={s.deleteLabel(item.title, item.context)}
								>
									{t().common.delete}
								</button>
							</form>
						{:else}
							<span class="flex flex-none pr-2 text-chevron"
								><Icon name="chevron-right" size={20} /></span
							>
						{/if}
					</div>
					{#if refused[key(item)]}
						<div class="px-4 pb-3">
							<FieldError id="refused-{key(item)}" message={refused[key(item)]} />
						</div>
					{/if}
				</li>
			{/each}
		</ul>
	{/if}
	<p class="px-4 pt-2 text-[13px] text-muted">
		{s.freeNote}
	</p>
</Screen>
