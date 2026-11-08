<script lang="ts">
	import { enhance } from '$app/forms';
	import { t } from '$lib/i18n/catalog';
	import { guarded } from '$lib/unsaved/guard.svelte';
	import Banner from '$lib/components/ui/Banner.svelte';
	import BottomBar from '$lib/components/ui/BottomBar.svelte';
	import Dialog from '$lib/components/ui/Dialog.svelte';
	import Spinner from '$lib/components/ui/Spinner.svelte';
	import { CHIP, GROUP, LABEL, TICK, button, rowButton } from '$lib/components/ui/styles';
	import {
		allState,
		initial,
		originLine,
		picksOut,
		rowMeta,
		selectAll,
		styleOf,
		withEdit,
		withTick,
		type PickEdit,
		type PickState
	} from '$lib/songs/pick-list';
	import PickRow from './PickRow.svelte';
	import type { Dance } from '$lib/dances/dances';
	import type { SongImportKind } from '$lib/labels';
	import type { PickItem } from '$lib/types';

	/**
	 * The pick list (option A2): Style for all, Select all, a row per song, and a
	 * pinned Dismiss / Add N. Nothing starts ticked. Posts the ticked songs as JSON
	 * (`picks`) to the page's `?/add`; leaving with picks or edits asks first.
	 */
	let {
		items,
		kind,
		truncated,
		dance,
		refusal
	}: {
		items: PickItem[];
		kind: SongImportKind;
		truncated: boolean;
		dance: Dance;
		/** The page's refusal of Add. */
		refusal: string | null;
	} = $props();

	const w = $derived(t().songs.pick);
	const spotify = $derived(kind.startsWith('spotify'));
	// The list arrives once per page: the state starts from it and is the page's own after.
	// svelte-ignore state_referenced_locally
	let s = $state<PickState>(initial(items, dance.styles));
	const all = $derived(allState(items, s));
	const picks = $derived(picksOut(items, s));
	let busy = $state(false);
	let dismissing = $state(false);

	const editOf = (item: PickItem): PickEdit =>
		s.edits.get(item.i) ?? { title: item.title, artist: item.artist ?? '', style: null };
	const tick = (i: number, on: boolean) => (s.ticked = withTick(s.ticked, i, on));
	const edit = (i: number, e: PickEdit) => (s.edits = withEdit(s.edits, i, e));
</script>

<div class="flex flex-col gap-3.5">
	{#if truncated}<Banner kind="info" title={w.firstN(items.length)} />{/if}
	{#if refusal}<Banner kind="error" title={refusal} />{/if}

	<fieldset>
		<legend class={LABEL}>{w.styleForAll}</legend>
		<div class="flex flex-wrap gap-2">
			{#each dance.styles as st (st)}
				<label class={CHIP}>
					<input
						type="radio"
						name="style-for-all"
						value={st}
						bind:group={s.styleForAll}
						class="sr-only"
					/>
					{dance.styleLabel[st]}
				</label>
			{/each}
		</div>
	</fieldset>

	<div class="flex items-center gap-3 px-4">
		<input
			id="pick-all"
			type="checkbox"
			class={TICK}
			checked={all === 'all'}
			indeterminate={all === 'some'}
			onchange={() => (s.ticked = selectAll(items, s))}
		/>
		<label for="pick-all" class="flex-1 text-[16px] font-extrabold text-ink">{w.selectAll}</label>
		<span class="text-[14px] font-semibold text-muted">{w.picked(s.ticked.size, items.length)}</span
		>
	</div>

	<ul class={GROUP}>
		{#each items as item (item.i)}
			<PickRow
				{item}
				{dance}
				{spotify}
				ticked={s.ticked.has(item.i)}
				open={s.open === item.i}
				edit={editOf(item)}
				style={styleOf(item.i, s)}
				meta={rowMeta(item, s, dance.styleLabel)}
				origin={originLine(kind, item)}
				ontick={(on) => tick(item.i, on)}
				onopen={() => (s.open = item.i)}
				onclose={() => (s.open = null)}
				onedit={(e) => edit(item.i, e)}
			/>
		{/each}
	</ul>
	<div class="h-24 flex-none"></div>
</div>

<BottomBar width="song">
	<form
		method="POST"
		action="?/add"
		class="flex gap-2.5"
		use:guarded={{
			label: w.unsaved,
			submit: ({ cancel }) => {
				if (busy || picks.length === 0) return cancel();
				busy = true;
				return async ({ update }) => {
					await update({ reset: false });
					busy = false;
				};
			}
		}}
	>
		<input type="hidden" name="picks" value={JSON.stringify(picks)} />
		<input type="hidden" name="styleForAll" value={s.styleForAll} />
		<button type="button" class={rowButton('secondary')} onclick={() => (dismissing = true)}
			>{w.dismiss}</button
		>
		<button
			type="submit"
			class={rowButton('primary')}
			disabled={picks.length === 0}
			aria-busy={busy}
		>
			{#if busy}<Spinner />{:else}{w.add(picks.length)}{/if}
		</button>
	</form>
</BottomBar>

<Dialog
	open={dismissing}
	icon="trash"
	title={w.dismissTitle}
	body={w.dismissBody}
	onclose={() => (dismissing = false)}
>
	{#snippet actions()}
		<button type="button" class={button('tertiary', 'sm')} onclick={() => (dismissing = false)}
			>{w.cancel}</button
		>
		<form method="POST" action="?/dismiss" use:enhance>
			<button type="submit" class={button('primary', 'sm')}>{w.dismiss}</button>
		</form>
	{/snippet}
</Dialog>
