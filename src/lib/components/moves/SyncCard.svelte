<script lang="ts">
	import NavTile from './NavTile.svelte';
	import { syncCard, type SyncKind } from '$lib/moves/sync';

	/**
	 * "3 figures out of sync": the card under Coverage that filters a Moves list
	 * to the rows whose copies disagree. On (the list is filtered), it reads as
	 * lit and tapping it again clears the filter. Nothing when nothing differs
	 * and the filter is off.
	 */
	let {
		kind,
		n,
		on,
		href,
		onclick
	}: {
		kind: SyncKind;
		n: number;
		/** The list is under the filter. */
		on: boolean;
		/** The list with the filter flipped. */
		href: string;
		/** Flip it in place (a list column beside an open item). */
		onclick?: (e: MouseEvent) => void;
	} = $props();

	const card = $derived(syncCard(kind, n));
</script>

{#if card}
	<div class="flex flex-none gap-2">
		<NavTile
			{href}
			{onclick}
			icon="refresh"
			title={card.title}
			meta={card.meta}
			status
			current={on}
		/>
	</div>
{/if}
