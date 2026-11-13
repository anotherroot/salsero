<script lang="ts">
	import { resolve } from '$app/paths';
	import ListenPage from '$lib/components/hearing/ListenPage.svelte';
	import { t } from '$lib/i18n/catalog';
	import type { PageData } from './$types';

	/** "Can you find the 1?" on one song: the person picks the round; nothing is saved. */
	let { data }: { data: PageData } = $props();
	const w = $derived(t().hearing);
</script>

<svelte:head><title>{w.pageTitle(data.dance.label)}</title></svelte:head>

<ListenPage
	dance={data.dance}
	songs={[{ id: data.song.id, title: data.song.title, grid: data.grid }]}
	title={w.card.title}
	name={data.song.title}
	backHref={resolve(`/${data.dance.slug}/songs/${data.song.id}`)}
	backLabel={data.song.title}
/>
