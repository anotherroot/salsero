<script lang="ts">
	import { resolve } from '$app/paths';
	import Screen from '$lib/components/ui/Screen.svelte';
	import BackButton from '$lib/components/shell/BackButton.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
</script>

<svelte:head><title>Positions · {data.dance.label}</title></svelte:head>

<!-- A stub: the list is rewritten with owned positions. -->
<Screen title="Positions" subtitle="Hands before and after a figure">
	{#snippet left()}
		<BackButton
			fallback={{
				href: resolve('/[dance]/figures', { dance: data.dance.slug }),
				label: 'Back to Moves'
			}}
		/>
	{/snippet}
	<ul class="flex flex-col gap-2 px-4 py-4">
		{#each data.positions as p (p.id)}
			<li class="text-base">{p.name}</li>
		{/each}
	</ul>
</Screen>
