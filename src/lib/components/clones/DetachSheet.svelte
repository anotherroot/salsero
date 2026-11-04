<script lang="ts">
	import { enhance } from '$app/forms';
	import { refreshWhenSettled } from '$lib/sheets/history.svelte';
	import Sheet from '$lib/components/ui/Sheet.svelte';
	import Banner from '$lib/components/ui/Banner.svelte';
	import Icon from '$lib/components/ui/Icon.svelte';
	import Spinner from '$lib/components/ui/Spinner.svelte';
	import { button } from '$lib/components/ui/styles';
	import {
		CANCEL,
		DETACH_BUTTON,
		DETACH_FAILED,
		DETACH_MINE,
		DETACH_NO_MORE,
		detachGroup,
		detachTitle
	} from '$lib/clones/view';
	import type { CloneKind, DetachOffer } from '$lib/types';

	/**
	 * Detach (board C8 p1): the copy stops following its source. Your own
	 * copy stays yours and stays shown with theirs, as twins; a group's row
	 * just becomes an ordinary group row. The page stays where it is and
	 * refreshes: its tabs now show the others as twins, and the "updated
	 * since" line is gone.
	 */
	let {
		open,
		onclose,
		kind,
		detach,
		action = '?/detach'
	}: {
		open: boolean;
		onclose: () => void;
		kind: CloneKind;
		detach: DetachOffer;
		action?: string;
	} = $props();

	let busy = $state(false);
	let refused = $state<string | null>(null);

	$effect(() => {
		if (open) refused = null;
	});
</script>

<Sheet title={detachTitle(detach.place, detach.group)} sub={detachGroup(kind)} {open} {onclose}>
	<div class="flex flex-col gap-3">
		{#if refused}<Banner kind="error">{refused}</Banner>{/if}
		<ul class="flex flex-col gap-2 rounded-2xl bg-step p-3.5 text-[14px] leading-[1.4] text-ink-2">
			{#if !detach.group}
				<li class="flex items-start gap-3">
					<span class="mt-px flex-none text-muted"><Icon name="group" size={20} /></span>
					<span class="min-w-0 flex-1">{DETACH_MINE}</span>
				</li>
			{/if}
			<li class="flex items-start gap-3">
				<span class="mt-px flex-none text-muted"><Icon name="refresh" size={20} /></span>
				<span class="min-w-0 flex-1">{DETACH_NO_MORE}</span>
			</li>
		</ul>
	</div>

	{#snippet footer()}
		<form
			method="POST"
			{action}
			class="grid grid-cols-[1fr_2fr] gap-2"
			use:enhance={({ cancel }) => {
				// One detach per tap: a second tap while the first is out is dropped.
				if (busy) return cancel();
				busy = true;
				refused = null;
				return async ({ result }) => {
					try {
						if (result.type === 'success') {
							onclose();
							await refreshWhenSettled();
						} else if (result.type === 'failure') {
							const data = result.data as { message?: unknown } | undefined;
							refused = typeof data?.message === 'string' ? data.message : DETACH_FAILED;
						} else {
							refused = DETACH_FAILED;
						}
					} finally {
						busy = false;
					}
				};
			}}
		>
			<button type="button" class={button('tertiary', 'md', true)} onclick={onclose}
				>{CANCEL}</button
			>
			<button
				type="submit"
				class={button('primary', 'md', true)}
				aria-busy={busy}
				aria-label={busy ? 'Detaching' : undefined}
			>
				{#if busy}<Spinner />{:else}{DETACH_BUTTON}{/if}
			</button>
		</form>
	{/snippet}
</Sheet>
