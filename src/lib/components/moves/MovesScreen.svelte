<script lang="ts">
	import type { Snippet } from 'svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { rememberedHref } from '$lib/nav/trail.svelte';
	import Screen from '$lib/components/ui/Screen.svelte';
	import BandButton from '$lib/components/ui/BandButton.svelte';
	import GroupModeButton from '$lib/components/shell/GroupModeButton.svelte';
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
	let value = $derived<MovesSegment>(segment);

	function open(to: MovesSegment) {
		const href =
			to === 'figures'
				? resolve('/[dance]/figures', { dance })
				: resolve('/[dance]/routines', { dance });
		// Each list comes back with the chips and search it was left with.
		// eslint-disable-next-line svelte/no-navigation-without-resolve -- `href` is resolved; the trail adds its search
		goto(rememberedHref(href), { replaceState: true, keepFocus: true });
	}
</script>

<Screen title="Moves">
	{#snippet right()}
		<GroupModeButton />
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
