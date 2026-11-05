<script lang="ts">
	import type { Snippet } from 'svelte';
	import { setPane } from './pane-context';

	/**
	 * The item pane beside a list (`ListPane`): a component of its own so the pane's
	 * context (`setPane`) reaches what it holds and nothing else, not the list and
	 * not the band row. `class` and `style` are ListPane's. `main`: an item is open,
	 * and the pane is the page's main (its header, the item's, is then no banner);
	 * on the list route the list's sheet around it is.
	 */
	let {
		class: klass,
		style,
		main = false,
		children
	}: { class: string; style: string; main?: boolean; children: Snippet } = $props();
	setPane();
</script>

<svelte:element this={main ? 'main' : 'div'} class={klass} {style} data-pane
	>{@render children()}</svelte:element
>
