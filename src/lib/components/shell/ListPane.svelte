<script lang="ts">
	import type { Snippet } from 'svelte';
	import Screen from '$lib/components/ui/Screen.svelte';
	import Pane from './Pane.svelte';

	/**
	 * A list and the item beside it (desktop spec, "A list and the item beside it
	 * (2A)"), rendered once by a section's layout so the list survives opening an
	 * item: its scroll, search and state stay.
	 *
	 * Desktop: the list's band row (title, `extra` in the middle, `right`), then the
	 * list column (`width`, its own scroll, sticky under the band row) and the pane
	 * beside it: `children` (the item page, whose Screen draws the pane's header)
	 * on an item route, `empty` centred on the list route. The window scrolls the
	 * pane; `--pane-left` puts the pane's pinned bars beside the list.
	 *
	 * Phone: the list route is the list page as ever (`Screen` around `list`; the
	 * empty pane is not drawn). An item route is the item page alone: the list
	 * column is in the DOM but `display: none`, so nothing in it is focused or read.
	 *
	 * One DOM for both routes and both widths: only classes change with `isList`,
	 * never the elements, so the list is not rebuilt when an item opens.
	 */
	let {
		list,
		isList,
		width = 360,
		title,
		subtitle,
		extra,
		right,
		empty,
		children
	}: {
		list: Snippet;
		/** The list route (nothing open), not an item route. */
		isList: boolean;
		/** The list column's width on the desktop, its hairline aside. */
		width?: number;
		title: string;
		subtitle?: string;
		extra?: Snippet;
		right?: Snippet;
		/** What the pane shows with nothing open (desktop only). */
		empty: Snippet;
		children: Snippet;
	} = $props();
</script>

<Screen {title} {subtitle} {extra} {right} split={isList ? 'list' : 'item'}>
	<!--
		On the phone's list route `contents`: the list's rows are the sheet's own, as ever. On
		the desktop a column of fixed height: its rows keep theirs (`shrink-0`) and it scrolls.
	-->
	<div
		data-list-column
		class="{isList
			? 'contents'
			: 'hidden'} desk:sticky desk:top-[var(--band-row-h)] desk:flex desk:h-[calc(100dvh-var(--band-row-h))] desk:w-[calc(var(--list-w)+1px)] desk:flex-none desk:flex-col desk:gap-2.5 desk:overflow-y-auto desk:overscroll-contain desk:border-r desk:border-hairline desk:pt-6 desk:pr-5 desk:pb-6 desk:pl-6 desk:*:shrink-0"
		style="--list-w: {width}px"
	>
		{@render list()}
	</div>
	<!--
		Not a size container (`two:` is a columns wrapper's): that would make the pane
		the containing block of its pinned bars.
	-->
	<Pane
		class="{isList
			? 'hidden'
			: 'contents'} desk:block desk:min-w-0 desk:flex-1 desk:[--pane-left:calc(var(--side-w)+var(--list-w)+1px)]"
		style="--list-w: {width}px"
	>
		{#if isList}
			<div class="flex min-h-[calc(100dvh-var(--band-row-h))] items-center justify-center">
				{@render empty()}
			</div>
		{:else}
			{@render children()}
		{/if}
	</Pane>
</Screen>
