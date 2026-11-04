<script lang="ts">
	import { enhance } from '$app/forms';
	import { refreshWhenSettled } from '$lib/sheets/history.svelte';
	import Sheet from '$lib/components/ui/Sheet.svelte';
	import Banner from '$lib/components/ui/Banner.svelte';
	import Icon from '$lib/components/ui/Icon.svelte';
	import Spinner from '$lib/components/ui/Spinner.svelte';
	import SearchField from '$lib/components/ui/SearchField.svelte';
	import { GROUP, button } from '$lib/components/ui/styles';
	import { fold } from '$lib/fold';
	import {
		CANCEL,
		MARK_SAME,
		SAME_AS_EMPTY,
		SAME_AS_FAILED,
		SAME_AS_SEARCH,
		sameAsTitle,
		twinChoiceLabel,
		twinsNote
	} from '$lib/clones/view';
	import type { TwinOffer } from '$lib/types';

	/**
	 * Same as… (board C7 p1): the page's figure is the same move as some
	 * others in your app. A folded search over them, each with its place as
	 * meta and a box; the note says twins never sync and only you see them.
	 * Mark as the same saves exactly the ticked set (unticking separates).
	 * The twin icon is the kit's `link`: the kit has no twin icon of its own.
	 */
	let {
		open,
		onclose,
		offer,
		action = '?/sameAs'
	}: { open: boolean; onclose: () => void; offer: TwinOffer; action?: string } = $props();

	let query = $state('');
	let ticked = $state<number[]>([]);
	let busy = $state(false);
	let refused = $state<string | null>(null);

	$effect(() => {
		if (!open) return;
		query = '';
		refused = null;
		ticked = offer.candidates.filter((c) => c.ticked).map((c) => c.id);
	});

	const shown = $derived.by(() => {
		const q = fold(query.trim());
		return q === '' ? offer.candidates : offer.candidates.filter((c) => fold(c.label).includes(q));
	});

	const toggle = (id: number) =>
		(ticked = ticked.includes(id) ? ticked.filter((x) => x !== id) : [...ticked, id]);
</script>

<Sheet title={sameAsTitle(offer.title)} {open} {onclose} tall>
	<div class="flex flex-col gap-3">
		{#if refused}<Banner kind="error">{refused}</Banner>{/if}
		<form role="search" onsubmit={(e) => e.preventDefault()}>
			<SearchField bind:value={query} placeholder={SAME_AS_SEARCH} />
		</form>
		{#if shown.length === 0}
			<p class="py-4 text-center text-[14px] text-muted">{SAME_AS_EMPTY}</p>
		{:else}
			<div class={GROUP}>
				{#each shown as c (c.id)}
					<label class="flex min-h-[64px] cursor-pointer items-center gap-3 px-4 py-2">
						<span class="flex min-w-0 flex-1 flex-col">
							<span class="text-[16px] font-bold text-ink">{c.label}</span>
							<span class="text-[13px] text-muted">{twinChoiceLabel(c.place)}</span>
						</span>
						<input
							type="checkbox"
							checked={ticked.includes(c.id)}
							class="size-[22px] flex-none cursor-pointer"
							style="accent-color: var(--color-accent)"
							onchange={() => toggle(c.id)}
						/>
					</label>
				{/each}
			</div>
		{/if}
		<p
			class="flex items-start gap-3 rounded-2xl bg-step p-3.5 text-[14px] leading-[1.4] text-ink-2"
		>
			<span class="mt-px flex-none text-muted"><Icon name="link" size={20} /></span>
			<span class="min-w-0 flex-1">{twinsNote(offer.kind)}</span>
		</p>
	</div>

	{#snippet footer()}
		<form
			method="POST"
			{action}
			class="grid grid-cols-[1fr_2fr] gap-2"
			use:enhance={({ cancel }) => {
				// One save per tap.
				if (busy) return cancel();
				busy = true;
				refused = null;
				return async ({ result }) => {
					try {
						if (result.type === 'success') {
							onclose();
							await refreshWhenSettled();
						} else {
							refused = SAME_AS_FAILED;
						}
					} finally {
						busy = false;
					}
				};
			}}
		>
			<!-- Every tick travels, however the search filters the list. -->
			{#each ticked as id (id)}<input type="hidden" name="twin" value={id} />{/each}
			<button type="button" class={button('tertiary', 'md', true)} onclick={onclose}
				>{CANCEL}</button
			>
			<button type="submit" class={button('primary', 'md', true)} disabled={busy} aria-busy={busy}>
				{#if busy}<Spinner />{:else}<Icon name="check" size={20} />{MARK_SAME}{/if}
			</button>
		</form>
	{/snippet}
</Sheet>
