<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { resolve } from '$app/paths';
	import BackButton from '$lib/components/shell/BackButton.svelte';
	import Badge from '$lib/components/ui/Badge.svelte';
	import Banner from '$lib/components/ui/Banner.svelte';
	import EmptyState from '$lib/components/ui/EmptyState.svelte';
	import FieldError from '$lib/components/ui/FieldError.svelte';
	import Screen from '$lib/components/ui/Screen.svelte';
	import Sheet from '$lib/components/ui/Sheet.svelte';
	import {
		CLIP,
		GROUP,
		LABEL,
		ROW_TALL,
		SECTION_LABEL,
		TEXTAREA,
		button
	} from '$lib/components/ui/styles';
	import { focusAfterRemoval } from '$lib/focus';
	import { barFraction, itemMeta, usageLine } from '$lib/storage-view';
	import { guarded } from '$lib/unsaved/guard.svelte';
	import type { StorageItem } from '$lib/types';
	import type { SubmitFunction } from '@sveltejs/kit';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const ACTION = { recording: 'deleteRecording', lessonVideo: 'deleteVideo' };
	const key = (i: StorageItem) => `${i.kind}-${i.id}`;
	const deletable = (i: StorageItem): i is StorageItem & { kind: keyof typeof ACTION } =>
		i.kind === 'recording' || i.kind === 'lessonVideo';

	let refused = $state<Record<string, string>>({});
	let asking = $state(false);
	let askOpen = $state(false);
	let askError = $state('');

	const groupHref = $derived(
		resolve('/[dance]/groups/[id]', { dance: data.dance.slug, id: String(data.team.id) })
	);

	const remove = (item: StorageItem): SubmitFunction => {
		return ({ cancel }) => {
			const keys = data.items.map(key);
			if (item.id === null) return cancel();
			delete refused[key(item)];
			return async ({ result, update }) => {
				if (result.type === 'failure') {
					refused[key(item)] = String(result.data?.message ?? 'Could not delete.');
					return;
				}
				await update();
				await invalidateAll();
				await focusAfterRemoval(keys, key(item), 'storage-back');
			};
		};
	};
</script>

<svelte:head><title>What uses space · {data.team.name}</title></svelte:head>

<Screen
	title="What uses space"
	subtitle="{data.team.name} · {usageLine(data.storage.usedBytes, data.storage.limitBytes)}"
	compact
>
	{#snippet left()}
		<BackButton fallback={{ href: groupHref, label: `Back to ${data.team.name}` }} />
	{/snippet}

	<div
		class="{CLIP} mx-4 h-2 rounded-full bg-chip"
		role="meter"
		aria-label="Space used"
		aria-valuemin={0}
		aria-valuemax={data.storage.limitBytes}
		aria-valuenow={Math.min(data.storage.usedBytes, data.storage.limitBytes)}
	>
		<div
			class="h-full rounded-full bg-accent"
			style:width="{barFraction(data.storage.usedBytes, data.storage.limitBytes) * 100}%"
		></div>
	</div>

	{#if data.role === 'owner'}
		<div class={GROUP}>
			{#if data.asked}
				<div class="{ROW_TALL} text-[15px] font-semibold text-muted">{data.asked}</div>
			{:else}
				<button type="button" class="{ROW_TALL} w-full text-left" onclick={() => (askOpen = true)}>
					<span class="min-w-0 flex-1 text-[16px] font-bold text-ink">Ask for more</span>
				</button>
			{/if}
		</div>
	{/if}

	<span class="{SECTION_LABEL} mt-[14px]" data-focus="storage-back" tabindex="-1"
		>Biggest first</span
	>
	{#if data.items.length === 0}
		<EmptyState icon="video" title="Nothing uses space yet" />
	{:else}
		<ul class={GROUP}>
			{#each data.items as item (key(item))}
				<li>
					<div class="flex min-h-16 items-center gap-3 py-2 pr-1.5 pl-4">
						{#snippet label()}
							<span class="flex items-center gap-2">
								<span class="truncate text-[16px] font-bold text-ink">{item.title}</span>
								{#if item.archived}<Badge>archived</Badge>{/if}
							</span>
							<span class="truncate text-[13px] text-muted">{itemMeta(item)}</span>
						{/snippet}
						{#if item.href}
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
									aria-label="Delete {item.title}, {item.context}"
								>
									Delete
								</button>
							</form>
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
		A deleted video or recording waits 30 days in Recently deleted and still uses space until then.
	</p>
</Screen>

{#if data.role === 'owner'}
	<Sheet title="Ask for more" open={askOpen} onclose={() => (askOpen = false)} size="small">
		<form
			id="ask-more"
			method="POST"
			action="?/ask"
			class="flex flex-col gap-3.5"
			use:guarded={{
				label: 'Ask for more',
				submit: ({ cancel }) => {
					if (asking) return cancel();
					askError = '';
					asking = true;
					return async ({ result, update }) => {
						askError =
							result.type === 'failure' ? String(result.data?.message ?? 'Could not ask.') : '';
						try {
							await update();
							if (result.type === 'success') askOpen = false;
						} finally {
							asking = false;
						}
					};
				}
			}}
		>
			{#if askError}<Banner kind="error" title={askError} />{/if}
			<p class="text-[14px] text-muted">
				The admin sees how much the group uses. A note is optional.
			</p>
			<label class="block">
				<span class={LABEL}>Note</span>
				<textarea name="note" rows="3" maxlength="500" class={TEXTAREA}></textarea>
			</label>
		</form>
		{#snippet footer()}
			<button
				type="submit"
				form="ask-more"
				class={button('primary', 'md', true)}
				aria-busy={asking}
			>
				Ask for more
			</button>
		{/snippet}
	</Sheet>
{/if}
