<script lang="ts">
	import { tick } from 'svelte';
	import { enhance } from '$app/forms';
	import { page } from '$app/state';
	import { gotoWhenSettled } from '$lib/sheets/history.svelte';
	import Sheet from '$lib/components/ui/Sheet.svelte';
	import Banner from '$lib/components/ui/Banner.svelte';
	import Icon from '$lib/components/ui/Icon.svelte';
	import Spinner from '$lib/components/ui/Spinner.svelte';
	import { GROUP, SECTION_LABEL, button } from '$lib/components/ui/styles';
	import {
		CANCEL,
		DROP_BUTTON,
		DROP_FAILED,
		DROP_TITLE,
		SYNC_FIRST,
		USE_INSTEAD,
		addToo,
		cantFollow,
		dropChoiceMeta,
		dropOne,
		dropSub,
		droppedToast,
		onlyInYours,
		possessive
	} from '$lib/clones/view';
	import type { DropChoice, DropOptions } from '$lib/types';
	import SyncSheet from './SyncSheet.svelte';
	import { dropped } from './dropped.svelte';

	/**
	 * Drop my copy (board C5): the person's own copy goes, and they are back on
	 * a version they read. One version: the sheet names it. Several: radios,
	 * the one copied from preselected; under one no added lesson holds, a
	 * ticked "Add Week 2 too" makes the practice follow (R8). What only theirs
	 * has is said; where they edit the version, Sync first opens the Sync
	 * sheet with only it ticked, and once that lands the drop is sent. The version's page
	 * opens in this page's place (the copy is archived) with a toast.
	 */
	let {
		open,
		onclose,
		drop,
		fromId,
		action = '?/drop'
	}: {
		open: boolean;
		onclose: () => void;
		drop: DropOptions;
		/** The person's copy: what goes. */
		fromId: number;
		action?: string;
	} = $props();

	const uid = $props.id();
	// svelte-ignore state_referenced_locally
	let picked = $state(drop.preselected);
	/** "Add Week 2 too", per choice: ticked unless unticked. */
	let adding = $state<Record<number, boolean>>({});
	let busy = $state(false);
	let refused = $state<string | null>(null);
	let sending = $state(false);
	let form: HTMLFormElement | undefined = $state();

	$effect(() => {
		if (!open) return;
		picked = drop.preselected;
		adding = {};
		refused = null;
	});

	const choice = $derived(drop.choices.find((c) => c.id === picked) ?? drop.choices[0]);
	const placeOf = (c: DropChoice) => (c.place.kind === 'team' ? c.place.name : 'Yours');
	const ticked = (c: DropChoice) => c.addLesson !== null && adding[c.id] !== false;
	const follows = $derived(choice.practiceFollows || ticked(choice));
	const sendable = $derived(drop.sendable.includes(choice.id));
	const warn = $derived(onlyInYours(choice.onlyInMine, sendable ? placeOf(choice) : null));
	const one = $derived(drop.choices.length === 1);

	function close() {
		sending = false;
		onclose();
	}

	/** Sync first landed: the drop goes next, as it stands. */
	async function sentThenDrop() {
		sending = false;
		await tick();
		form?.requestSubmit();
	}
</script>

{#snippet addBox(c: DropChoice)}
	{#if c.addLesson}
		<label class="flex min-h-12 cursor-pointer items-center gap-3 px-4 py-1.5">
			<input
				type="checkbox"
				class="size-[22px] flex-none"
				style="accent-color: var(--color-accent)"
				checked={ticked(c)}
				onchange={(e) => (adding = { ...adding, [c.id]: e.currentTarget.checked })}
			/>
			<span class="text-[15px] font-semibold text-ink">{addToo(c.addLesson.title)}</span>
		</label>
	{/if}
{/snippet}

<Sheet title={DROP_TITLE} sub={dropSub(one ? choice.access : null)} {open} onclose={close}>
	<div class="flex flex-col gap-3">
		{#if refused}<Banner kind="error">{refused}</Banner>{/if}
		{#if one}
			<p
				class="flex items-start gap-3 rounded-2xl bg-step p-3.5 text-[14px] leading-[1.4] text-ink-2"
			>
				<span class="mt-px flex-none text-muted"><Icon name="refresh" size={20} /></span>
				<span class="min-w-0 flex-1">{dropOne(placeOf(choice), choice.label, follows)}</span>
			</p>
			{#if !choice.practiceFollows}
				<div class={GROUP}>
					<p class="px-4 pt-3 pb-1 text-[13px] text-muted">{cantFollow(null, drop.kind)}</p>
					{@render addBox(choice)}
				</div>
			{/if}
		{:else}
			<fieldset class="flex flex-col gap-1.5">
				<legend id="{uid}-use" class={SECTION_LABEL}>{USE_INSTEAD}</legend>
				<div class={GROUP}>
					{#each drop.choices as c (c.id)}
						{@const meta = dropChoiceMeta(c, c.id === picked && c.addLesson !== null, drop.kind)}
						<div>
							<label class="flex min-h-[64px] cursor-pointer items-center gap-3 px-4 py-2">
								<span class="flex min-w-0 flex-1 flex-col">
									<span class="text-[16px] font-bold text-ink">{possessive(placeOf(c))}</span>
									{#if meta}<span class="text-[13px] text-muted">{meta}</span>{/if}
								</span>
								<input
									type="radio"
									name="{uid}-to"
									value={c.id}
									checked={picked === c.id}
									class="size-[22px] flex-none cursor-pointer"
									style="accent-color: var(--color-accent)"
									onchange={() => (picked = c.id)}
								/>
							</label>
							{#if c.id === picked}{@render addBox(c)}{/if}
						</div>
					{/each}
				</div>
			</fieldset>
		{/if}
		{#if warn}<Banner kind="warning">{warn}</Banner>{/if}
	</div>

	{#snippet footer()}
		<div class="flex flex-col gap-2">
			{#if sendable && choice.onlyInMine.length > 0}
				<button
					type="button"
					class={button('secondary', 'md', true)}
					aria-haspopup="dialog"
					disabled={busy}
					onclick={() => (sending = true)}><Icon name="refresh" size={20} />{SYNC_FIRST}</button
				>
			{/if}
			<form
				bind:this={form}
				method="POST"
				{action}
				class="grid grid-cols-[1fr_2fr] gap-2"
				use:enhance={({ cancel }) => {
					// One drop per tap: a second tap while the first is out is dropped.
					if (busy) return cancel();
					busy = true;
					refused = null;
					const place = placeOf(choice);
					return async ({ result, update }) => {
						try {
							if (result.type === 'redirect') {
								// The copy is archived: its page gives way to the version's, whose
								// page shows the toast (only that page: `dropped`).
								dropped.set(droppedToast(place), result.location, page.url.pathname);
								close();
								try {
									await gotoWhenSettled(result.location, {
										replaceState: true,
										invalidateAll: true
									});
								} catch (err) {
									dropped.clear();
									throw err;
								}
							} else if (result.type === 'failure') {
								const data = result.data as { message?: unknown } | undefined;
								refused = typeof data?.message === 'string' ? data.message : DROP_FAILED;
							} else if (result.type === 'error') {
								refused = DROP_FAILED;
							} else {
								await update();
							}
						} finally {
							busy = false;
						}
					};
				}}
			>
				<input type="hidden" name="to" value={choice.id} />
				{#if ticked(choice) && !choice.practiceFollows}
					<input type="hidden" name="addLesson" value={choice.addLesson?.id} />
				{/if}
				<button type="button" class={button('tertiary', 'md', true)} onclick={close}
					>{CANCEL}</button
				>
				<button
					type="submit"
					class={button('danger', 'md', true)}
					aria-busy={busy}
					aria-label={busy ? 'Dropping your copy' : undefined}
				>
					{#if busy}<Spinner />{:else}{DROP_BUTTON}{/if}
				</button>
			</form>
		</div>
	{/snippet}
</Sheet>

{#if sendable}
	<SyncSheet
		open={open && sending}
		onclose={() => (sending = false)}
		kind={drop.kind}
		id={fromId}
		only={choice.id}
		onsynced={sentThenDrop}
	/>
{/if}
