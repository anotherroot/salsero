<script lang="ts">
	import { resolve } from '$app/paths';
	import Screen from '$lib/components/ui/Screen.svelte';
	import BackButton from '$lib/components/shell/BackButton.svelte';
	import MapPane from '$lib/components/positions/MapPane.svelte';
	import { t } from '$lib/i18n/catalog';
	import type { PageData } from './$types';

	/*
	 * The map. On the desktop it sits in the pane beside the Positions list, its
	 * Map row lit; its body is at most 800 wide (`MapPane`), so the page is `two`.
	 */
	let { data }: { data: PageData } = $props();

	const list = $derived(resolve('/[dance]/(moves)/positions', { dance: data.dance.slug }));
</script>

<svelte:head><title>{t().map.title} · {data.dance.label}</title></svelte:head>

<Screen title={t().map.title} subtitle={data.map.summary} width="two">
	{#snippet left()}
		<BackButton fallback={{ href: list, label: t().map.back }} />
	{/snippet}

	<MapPane map={data.map} />
</Screen>
