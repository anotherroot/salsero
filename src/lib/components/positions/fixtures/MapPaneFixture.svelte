<script lang="ts">
	import MapPane from '../MapPane.svelte';
	import { setMoves } from '$lib/components/moves/moves-context';
	import type { MapData } from '$lib/positions/map-view';

	/** Specs only (`map-pane.spec.ts`): MapPane inside the (moves) layout's context. */
	let { map }: { map: MapData } = $props();
	setMoves({ openNew: () => {}, pick: { value: null } });
</script>

<MapPane {map} />
