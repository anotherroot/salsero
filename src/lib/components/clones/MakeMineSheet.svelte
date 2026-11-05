<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import { gotoWhenSettled } from '$lib/sheets/history.svelte';
	import Sheet from '$lib/components/ui/Sheet.svelte';
	import Banner from '$lib/components/ui/Banner.svelte';
	import Icon from '$lib/components/ui/Icon.svelte';
	import Spinner from '$lib/components/ui/Spinner.svelte';
	import { SECTION_LABEL, button } from '$lib/components/ui/styles';
	import {
		ARCHIVED_SONG_COPY,
		MAKE_MINE,
		MAKE_MINE_SUB,
		YOU_GET,
		makeMineSize,
		makeMineTitle,
		restoreLine,
		staysTheirs,
		switchNote,
		youGet
	} from '$lib/clones/view';
	import type { MakeMineOffer } from '$lib/types';

	/**
	 * Edit on a class's thing the person only reads (board C2 p1): what Make it
	 * mine gives them, what stays the class's, and which of their own rows
	 * switch to the copy. One tap makes it, then the copy's page opens once the
	 * sheet's Back has landed. A refusal (no room, a name taken) shows here,
	 * with Ask for more when their limit is the reason.
	 */
	let {
		open,
		onclose,
		offer,
		action = '?/makeMine'
	}: {
		open: boolean;
		onclose: () => void;
		offer: MakeMineOffer;
		/** Where the form posts. */
		action?: string;
	} = $props();

	let busy = $state(false);
	let refused = $state<{ message: string; askForMore: boolean } | null>(null);
	const stays = $derived(staysTheirs(offer.kind, offer.team));
	const note = $derived(switchNote(offer.repoint, offer.practised));
	/** "Uses 380 MB of your space": a lesson's videos, a song's audio. Nothing for a reuse. */
	const size = $derived(makeMineSize(offer.bytes));
	/** The person's song copy is archived: a person's song has no restore. */
	const blocked = $derived(offer.kind === 'song' && offer.existing?.archived === true);
	const restoring = $derived(offer.existing?.archived === true && !blocked);

	/** Closing forgets a refusal, so the next open starts clean. */
	function close() {
		refused = null;
		onclose();
	}
</script>

<Sheet
	title={makeMineTitle(offer.label)}
	sub={restoring ? restoreLine : MAKE_MINE_SUB}
	{open}
	onclose={close}
>
	<div class="flex flex-col gap-3">
		{#if refused}
			{@const r = refused}
			{#if r.askForMore}
				<Banner kind="error">
					{r.message}
					{#snippet action()}
						<a href={resolve('/settings/storage')} class={button('tertiary', 'sm')}>Ask for more</a>
					{/snippet}
				</Banner>
			{:else}
				<Banner kind="error">{r.message}</Banner>
			{/if}
		{:else if blocked}
			<Banner kind="warning">{ARCHIVED_SONG_COPY}</Banner>
		{/if}
		<div class="flex flex-col gap-3 rounded-2xl bg-surface py-4">
			<div class="flex flex-col gap-1">
				<h3 class={SECTION_LABEL}>{YOU_GET}</h3>
				<p class="px-4 text-[15px] leading-[1.4] text-ink">{youGet(offer.kind)}</p>
			</div>
			{#if stays}
				<div class="flex flex-col gap-1">
					<h3 class={SECTION_LABEL}>{stays.title}</h3>
					<p class="px-4 text-[15px] leading-[1.4] text-ink">{stays.body}</p>
				</div>
			{/if}
			{#if size}
				<p class="px-4 text-[14px] font-semibold text-muted">{size}</p>
			{/if}
		</div>
		{#if note}
			<p
				class="flex items-start gap-3 rounded-2xl bg-step p-3.5 text-[14px] leading-[1.4] text-ink-2"
			>
				<span class="mt-px flex-none text-muted"><Icon name="refresh" size={20} /></span>
				<span class="min-w-0 flex-1">{note}</span>
			</p>
		{/if}
	</div>

	{#snippet footer()}
		<form
			method="POST"
			{action}
			class="grid grid-cols-[1fr_2fr] gap-2"
			use:enhance={({ cancel }) => {
				// One copy per tap: a second tap while the first is out is dropped.
				if (busy) return cancel();
				busy = true;
				refused = null;
				return async ({ result, update }) => {
					try {
						if (result.type === 'redirect') {
							// The copy opens over this page, once the sheet's Back has landed.
							close();
							await gotoWhenSettled(result.location, { invalidateAll: true });
						} else if (result.type === 'failure') {
							const data = result.data as { message?: unknown; askForMore?: unknown } | undefined;
							refused = {
								message:
									typeof data?.message === 'string' ? data.message : 'That copy could not be made.',
								askForMore: data?.askForMore === true
							};
						} else if (result.type === 'error') {
							refused = { message: 'That copy could not be made. Try again.', askForMore: false };
						} else {
							await update();
						}
					} finally {
						busy = false;
					}
				};
			}}
		>
			<button type="button" class={button('tertiary', 'md', true)} onclick={close}>Cancel</button>
			<button
				type="submit"
				class={button('primary', 'md', true)}
				disabled={blocked}
				aria-busy={busy}
				aria-label={busy ? 'Making it yours' : undefined}
			>
				{#if busy}<Spinner />{:else}<Icon name="pencil" size={20} />{MAKE_MINE}{/if}
			</button>
		</form>
	{/snippet}
</Sheet>
