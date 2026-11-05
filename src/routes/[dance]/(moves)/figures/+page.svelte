<script lang="ts">
	import EmptyState from '$lib/components/ui/EmptyState.svelte';
	import Icon from '$lib/components/ui/Icon.svelte';
	import { button } from '$lib/components/ui/styles';
	import { getMoves } from '$lib/components/moves/moves-context';
	import { emptyPane } from '$lib/moves/pane';
	import type { PageData } from './$types';

	/*
	 * Figures with nothing open. The list, its band and its forms are the (moves)
	 * layout's (`ListPane`, `FiguresList`); this is what the pane beside the list
	 * shows on the desktop. The phone draws none of it: there the list page is the list.
	 */
	let { data }: { data: PageData } = $props();
	const moves = getMoves();
	const pane = $derived(emptyPane('figures', !!data.groupMode));
</script>

<svelte:head><title>Figures · {data.dance.label}</title></svelte:head>

{#if pane.action}
	<EmptyState icon={pane.icon} title={pane.title} body={pane.body}>
		{#snippet action()}
			<button type="button" class={button('secondary', 'md')} onclick={() => moves.openNew()}>
				<Icon name="plus" size={20} />{pane.action}
			</button>
		{/snippet}
	</EmptyState>
{:else}
	<EmptyState icon={pane.icon} title={pane.title} body={pane.body} />
{/if}
