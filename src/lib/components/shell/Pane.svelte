<script lang="ts">
	import type { Snippet } from 'svelte';
	import { setPane } from './pane-context';

	/**
	 * The item pane beside a list (`ListPane`): a component of its own so the pane's
	 * context (`setPane`) reaches what it holds and nothing else, not the list and
	 * not the band row. `class` and `style` are ListPane's. A plain box, never a
	 * landmark: on an item route the item's own sheet is the page's main and its
	 * header the banner, at both widths (`Screen`).
	 */
	let {
		class: klass,
		style,
		children
	}: { class: string; style: string; children: Snippet } = $props();
	setPane();
</script>

<div class={klass} {style} data-pane>{@render children()}</div>
