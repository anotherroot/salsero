<script lang="ts">
	import type { Snippet } from 'svelte';
	import Screen from '$lib/components/ui/Screen.svelte';
	import { desk } from '$lib/nav/desk.svelte';
	import Pane from './Pane.svelte';

	/**
	 * A list and the item beside it (desktop spec, "A list and the item beside it
	 * (2A)"), rendered once by a section's layout so the list survives opening an
	 * item: its scroll, search and state stay.
	 *
	 * Desktop: the list's band row (title, `extra` in the middle, `right`), then the
	 * list column (`width`, its own scroll, sticky under the band row) and the pane
	 * beside it: `children` (the item page, whose Screen draws the pane's header)
	 * on an item route, `empty` centred on the list route (`emptyBare`: from the
	 * pane's top, for an `empty` that is a page of its own). The window scrolls the
	 * pane; `--pane-left` puts the pane's pinned bars beside the list. A click on a
	 * row keeps its focus there (`data-sveltekit-keepfocus`, desktop only).
	 *
	 * `solo` (the list route only: an empty list's own state): on the desktop no
	 * column and no pane; `list` fills the sheet as one column of `soloWidth`, as a
	 * page of its own. `deskSubtitle`: the band row's subtitle on the desktop, in
	 * place of `subtitle`.
	 *
	 * Phone: the list route is the list page as ever (`Screen` around `list`; the
	 * empty pane is not drawn). An item route is the item page alone: the list
	 * column is in the DOM but `display: none`, so nothing in it is focused or read.
	 * `solo`, `soloWidth` and `deskSubtitle` change nothing on the phone.
	 *
	 * One DOM for both routes and both widths: only classes change with `isList`
	 * and `solo`, never the list's elements, so the list is not rebuilt when an item
	 * opens. (The pane's own element is the page's `<main>` on an item route; its
	 * content changes then anyway.)
	 */
	let {
		list,
		isList,
		width = 360,
		title,
		subtitle,
		deskSubtitle,
		extra,
		right,
		empty,
		emptyBare = false,
		solo = false,
		soloWidth = 'one',
		children
	}: {
		list: Snippet;
		/** The list route (nothing open), not an item route. */
		isList: boolean;
		/** The list column's width on the desktop, its hairline aside. */
		width?: number;
		title: string;
		subtitle?: string;
		/** The desktop's band row subtitle in place of `subtitle`. */
		deskSubtitle?: string;
		extra?: Snippet;
		right?: Snippet;
		/** What the pane shows with nothing open (desktop only). */
		empty: Snippet;
		/** `empty` straight in the pane, from its top, not centred in a box. */
		emptyBare?: boolean;
		/** On the desktop, the list alone as a page of its own (no column, no pane). List route only. */
		solo?: boolean;
		/** `solo`'s width (`PAGE_WIDTH`). */
		soloWidth?: 'one' | 'narrow';
		children: Snippet;
	} = $props();

	// An item route always has its pane: solo is the list route's.
	const alone = $derived(solo && isList);
</script>

<Screen
	{title}
	{subtitle}
	{deskSubtitle}
	{extra}
	{right}
	split={alone ? undefined : isList ? 'list' : 'item'}
	width={soloWidth}
>
	<!--
		On the phone's list route `contents`: the list's rows are the sheet's own, as ever. On
		the desktop a column of fixed height: its rows keep theirs (`shrink-0`) and it scrolls.
		Solo: `contents` at every width, the sheet's own rows.
	-->
	<div
		data-list-column
		data-sveltekit-keepfocus={desk.current ? '' : undefined}
		class={alone
			? 'contents'
			: `${isList ? 'contents' : 'hidden'} desk:sticky desk:top-[var(--band-row-h)] desk:flex desk:h-[calc(100dvh-var(--band-row-h))] desk:w-[calc(var(--list-w)+1px)] desk:flex-none desk:flex-col desk:gap-2.5 desk:overflow-y-auto desk:overscroll-contain desk:border-r desk:border-hairline desk:pt-6 desk:pr-5 desk:pb-6 desk:pl-6 desk:*:shrink-0`}
		style="--list-w: {width}px"
	>
		{@render list()}
	</div>
	<!--
		Not a size container (`two:` is a columns wrapper's): that would make the pane
		the containing block of its pinned bars.
	-->
	<Pane
		class={alone
			? 'hidden'
			: `${isList ? 'hidden' : 'contents'} desk:block desk:min-w-0 desk:flex-1 desk:[--pane-left:calc(var(--side-w)+var(--list-w)+1px)]`}
		style="--list-w: {width}px"
		main={!isList}
	>
		{#if isList}
			{#if emptyBare}
				{@render empty()}
			{:else}
				<div class="flex min-h-[calc(100dvh-var(--band-row-h))] items-center justify-center">
					{@render empty()}
				</div>
			{/if}
		{:else}
			{@render children()}
		{/if}
	</Pane>
</Screen>
