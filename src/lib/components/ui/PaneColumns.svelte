<script lang="ts">
	import type { Snippet } from 'svelte';

	/**
	 * Two columns in a pane (desktop spec, "Two columns: about on the left, videos
	 * on the right (3A)"): the one two-column switch. Its own wrapper is the `cols`
	 * size container (`two:` in layout.css: 700 px of content, a 780 px pane), never
	 * the pane: a container is the containing block of its `fixed` descendants, so
	 * nothing pinned (a bar, a toast) may be rendered inside it.
	 *
	 * Below the breakpoint, and on the phone, one flex column (the caller's `class`:
	 * its gap and bottom padding) whose children are the snippets' own: each snippet
	 * sits in a `display: contents` wrapper, so the order, the gaps and the flex
	 * children are exactly the page's as if there were no columns. Order: `top`,
	 * `left`, `right`, `leftEnd`.
	 *
	 * From `two:`, a grid: `top` across both columns in row 1; `left` in column 1,
	 * row 2; `right` in column 2, rows 2–3; `leftEnd` in column 1, row 3, so it
	 * follows `left` directly whatever `right`'s height (an item spanning a flexible
	 * track does not size the auto row). 32 px between the columns, top-aligned;
	 * each column is a flex column with the caller's gap (`gap: inherit`, down the
	 * chain), which is also the gap between the rows.
	 */
	let {
		ratio,
		class: klass = '',
		top,
		left,
		right,
		leftEnd
	}: {
		ratio: '5:7' | '1:1';
		/** The flex column's own classes: its gap and bottom padding. */
		class?: string;
		top?: Snippet;
		left: Snippet;
		right: Snippet;
		leftEnd?: Snippet;
	} = $props();

	const COLS = { '5:7': 'two:grid-cols-[5fr_7fr]', '1:1': 'two:grid-cols-[1fr_1fr]' } as const;
	/** A snippet's wrapper: no box below the breakpoint, a flex column from it. */
	const CELL = 'contents two:flex two:min-w-0 two:flex-col two:gap-[inherit]';
	/* Without `top` there is no first row (an empty one would still take a gap). */
	const ROWS = $derived(
		top
			? {
					grid: 'two:grid-rows-[auto_auto_1fr]',
					left: 'two:row-start-2',
					right: 'two:row-span-2 two:row-start-2',
					end: 'two:row-start-3'
				}
			: {
					grid: 'two:grid-rows-[auto_1fr]',
					left: 'two:row-start-1',
					right: 'two:row-span-2 two:row-start-1',
					end: 'two:row-start-2'
				}
	);
</script>

<div class="@container/cols" data-pane-columns>
	<div class="flex flex-col {klass} two:grid {COLS[ratio]} {ROWS.grid} two:items-start two:gap-x-8">
		{#if top}<div class="{CELL} two:col-span-2 two:row-start-1">{@render top()}</div>{/if}
		<div class="{CELL} two:col-start-1 {ROWS.left}">{@render left()}</div>
		<div class="{CELL} two:col-start-2 {ROWS.right}">{@render right()}</div>
		{#if leftEnd}<div class="{CELL} two:col-start-1 {ROWS.end}">{@render leftEnd()}</div>{/if}
	</div>
</div>
