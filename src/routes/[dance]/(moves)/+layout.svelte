<script lang="ts">
	import { tick } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import { listOf } from '$lib/nav/pane';
	import { besideOf, type MovesList } from '$lib/nav/moves-pane';
	import { desk } from '$lib/nav/desk.svelte';
	import { listOpener, rememberedHref } from '$lib/nav/trail.svelte';
	import { MOVES_SEGMENTS } from '$lib/moves/segment';
	import ListPane from '$lib/components/shell/ListPane.svelte';
	import BandButton from '$lib/components/ui/BandButton.svelte';
	import Segmented from '$lib/components/ui/Segmented.svelte';
	import GroupModeButton from '$lib/components/shell/GroupModeButton.svelte';
	import FiguresList from '$lib/components/moves/FiguresList.svelte';
	import RoutinesList from '$lib/components/moves/RoutinesList.svelte';
	import PositionsList from '$lib/components/moves/PositionsList.svelte';
	import { revealLit, setMoves } from '$lib/components/moves/moves-context';

	/*
	 * Moves: Figures, Routines or Positions, and the item beside it (desktop spec,
	 * "A list and the item beside it"). The band, its switch and the list render
	 * here once, so opening an item keeps the list's scroll and filter. Which list
	 * sits beside an item, and which row is lit, is `besideOf`'s: a figure opened
	 * from a routine keeps the Routines list. On the phone the list pages look as
	 * they always have, and an item page is the item alone.
	 */
	let { data, children } = $props();

	const l = $derived(listOf(page.route.id));
	const isList = $derived(l?.open === false);
	// The opener the column goes by (not before a reload: a page entered fresh shows its own list).
	const beside = $derived(
		besideOf(page.route.id, page.url.pathname, listOpener(page.url.pathname))
	);
	const dance = $derived(data.dance.slug);

	// The list's New sheet: the band's +, the list's own buttons and the empty pane open it.
	let creating = $state(false);
	const pick = $state<{ value: number | null }>({ value: null });
	setMoves({ openNew: () => (creating = true), pick });

	// Follows the column; a tap moves it at once, before the next page lands.
	let segment = $derived<MovesList>(beside?.list ?? 'figures');

	const ROOT = {
		figures: '/[dance]/(moves)/figures',
		routines: '/[dance]/(moves)/routines',
		positions: '/[dance]/(moves)/positions'
	} as const;

	/*
	 * The switch. From a list it replaces the history entry: a view inside one
	 * tab, so Back leaves Moves rather than flipping between lists. From an item
	 * it pushes: the item was a place. Each list comes back with its filter.
	 */
	function openList(to: MovesList) {
		// eslint-disable-next-line svelte/no-navigation-without-resolve -- the path is resolved; the trail adds its search
		goto(rememberedHref(resolve(ROOT[to], { dance })), { replaceState: isList, keepFocus: true });
	}

	// The lit row stays in view in the column (desktop: the column scrolls on its own).
	const openKey = $derived(
		beside?.open
			? `${beside.list}:${beside.open.kind}:${'id' in beside.open ? beside.open.id : ''}`
			: ''
	);
	$effect(() => {
		if (!openKey || !desk.current) return;
		void tick().then(revealLit);
	});
</script>

{#snippet right()}
	<GroupModeButton />
	<BandButton
		icon="plus"
		label={segment === 'figures'
			? 'New move'
			: segment === 'routines'
				? 'New routine'
				: 'New position'}
		onclick={() => (creating = true)}
	/>
{/snippet}

{#snippet extra()}
	<!-- The band row's toggle on the desktop: 420 wide, as the board draws it. -->
	<div class="desk:w-[420px]">
		<Segmented
			onBand
			name="moves"
			label="Moves"
			items={MOVES_SEGMENTS}
			bind:value={segment}
			onchange={openList}
		/>
	</div>
{/snippet}

{#snippet list()}
	{#if beside?.list === 'routines'}
		<RoutinesList
			lists={data.lists.routines}
			dance={data.dance}
			open={beside.open}
			{isList}
			bind:creating
		/>
	{:else if beside?.list === 'positions'}
		<PositionsList lists={data.lists.positions} {dance} open={beside.open} {isList} bind:creating />
	{:else}
		<FiguresList
			lists={data.lists.figures}
			dance={data.dance}
			open={beside?.open ?? null}
			{isList}
			bind:creating
		/>
	{/if}
{/snippet}

{#if l}
	<ListPane title="Moves" {isList} {list} {right} {extra} empty={children}>
		{@render children()}
	</ListPane>
{:else}
	{@render children()}
{/if}
