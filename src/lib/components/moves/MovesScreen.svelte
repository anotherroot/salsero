<script lang="ts">
	import type { Snippet } from 'svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import Screen from '$lib/components/ui/Screen.svelte';
	import BandButton from '$lib/components/ui/BandButton.svelte';
	import Segmented from '$lib/components/ui/Segmented.svelte';
	import { MOVES_SEGMENTS, type MovesSegment } from '$lib/moves/segment';
	import type { DanceSlug } from '$lib/dances/dances';

	/**
	 * The Moves tab: Figures and Routines are two routes drawn inside this one
	 * band. The switch replaces the history entry — it is a view inside one
	 * tab, so Back leaves Moves rather than flipping between the two.
	 */
	let {
		segment,
		dance,
		onnew,
		children
	}: { segment: MovesSegment; dance: DanceSlug; onnew: () => void; children: Snippet } = $props();

	// Follows the route; a tap moves it at once, before the next page lands.
	let value = $derived<string>(segment);

	function open(to: string) {
		const href =
			to === 'figures'
				? resolve('/[dance]/figures', { dance })
				: resolve('/[dance]/routines', { dance });
		goto(href, { replaceState: true, keepFocus: true });
	}
</script>

<Screen title="Moves">
	{#snippet right()}
		<BandButton
			icon="plus"
			label={segment === 'figures' ? 'New figure' : 'New routine'}
			onclick={onnew}
		/>
	{/snippet}
	{#snippet extra()}
		<Segmented
			onBand
			name="moves"
			label="Moves"
			items={MOVES_SEGMENTS}
			bind:value
			onchange={open}
		/>
	{/snippet}
	{@render children()}
</Screen>
