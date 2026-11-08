<script lang="ts">
	import { page } from '$app/state';
	import MapPane from '$lib/components/positions/MapPane.svelte';
	import HowBody from '$lib/components/positions/HowBody.svelte';
	import PaneHeading from '$lib/components/shell/PaneHeading.svelte';
	import { nothingAt, parsePositionFilter } from '$lib/positions/filter';
	import { EMPTY_ACTIONS, HOW_PANE_SUBTITLE } from '$lib/positions/view';
	import { t } from '$lib/i18n/catalog';
	import type { PageData } from './$types';

	/*
	 * Positions with nothing open. The list, its band and its sheets are the
	 * (moves) layout's (`ListPane`, `PositionsList`); this is the pane beside it on
	 * the desktop, from the pane's top (`emptyBare`): the map, or with no positions
	 * at all How positions work. The phone draws none of it.
	 */
	let { data }: { data: PageData } = $props();

	const title = $derived(t().moves.segments.positions);

	const l = $derived(data.lists.positions);
	const nothing = $derived(
		nothingAt(l, parsePositionFilter(page.url.searchParams, l.types, l.inGroupMode))
	);
</script>

<svelte:head><title>{title} · {data.dance.label}</title></svelte:head>

{#if nothing}
	<PaneHeading title={EMPTY_ACTIONS.how} subtitle={HOW_PANE_SUBTITLE} />
	<div class="max-w-[720px] px-10 pt-[18px] pb-10"><HowBody /></div>
{:else}
	<MapPane map={data.map} heading />
{/if}
