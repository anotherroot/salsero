<script lang="ts">
	import MapPane from '$lib/components/positions/MapPane.svelte';
	import { t } from '$lib/i18n/catalog';
	import type { PageData } from './$types';

	/*
	 * The map (spec 2026-11-08-map-walk). No Screen: on the phone the map is the
	 * whole screen with its title floating over it, and on the desktop it sits in
	 * the pane beside the Positions list, its Map row lit, under the pane's own
	 * heading (`MapPane` draws both). This is the page's main at both widths.
	 */
	let { data }: { data: PageData } = $props();
</script>

<svelte:head><title>{t().map.title} · {data.dance.label}</title></svelte:head>

<main><MapPane map={data.map} /></main>
