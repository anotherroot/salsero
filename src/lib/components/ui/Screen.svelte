<script lang="ts">
	import type { Snippet } from 'svelte';
	import { page } from '$app/state';
	import { bandMode } from '$lib/nav/band';
	import { desk } from '$lib/nav/desk.svelte';
	import { PAGE_WIDTH, type PageWidth } from '$lib/nav/frame';
	import { listOf, paneBack } from '$lib/nav/pane';
	import { listOpener } from '$lib/nav/trail.svelte';
	import BandHeader from '$lib/components/shell/BandHeader.svelte';
	import { inPane } from '$lib/components/shell/pane-context';
	import type { DanceSlug } from '$lib/dances/dances';

	let {
		title,
		subtitle,
		deskSubtitle,
		compact = false,
		width = 'one',
		card = false,
		split,
		left,
		right,
		extra,
		hero,
		children
	}: {
		title: string;
		subtitle?: string;
		/** The band row's subtitle on the desktop, in place of `subtitle` (`BandHeader`). */
		deskSubtitle?: string;
		compact?: boolean;
		/** How wide the content grows on the desktop (`PAGE_WIDTH`); the phone ignores it. */
		width?: PageWidth;
		/**
		 * A card page (`CardFrame`, which sets it): on the desktop the band is not the
		 * fixed band row but the title above a 480 px column, and the sheet is that
		 * column. The phone ignores it.
		 */
		card?: boolean;
		/**
		 * `ListPane`'s own Screen: the list's band, and a sheet that on the desktop is
		 * the list column and the pane side by side. `list`: the list page, the phone's
		 * list as ever. `item`: an item page; on the phone only the item draws
		 * (its own Screen, in the pane): this band and sheet are not there.
		 */
		split?: 'list' | 'item';
		left?: Snippet;
		right?: Snippet;
		extra?: Snippet;
		hero?: Snippet;
		children: Snippet;
	} = $props();

	let scrollY = $state(0);
	const mode = $derived(bandMode(scrollY, compact, desk.current));
	const slim = $derived(mode === 'slim');

	/*
	 * Inside a list's item pane (desktop spec, "A list and the item beside it"), the
	 * desktop draws no band row here: the header is the pane's header, the sheet the
	 * pane's content. Its ‹ shows only for an item opened from outside its list
	 * (`paneBack`, by `listOpener`: the opener the list column also goes by, so a
	 * page entered fresh has neither the opener's list nor a ‹). The phone is unchanged.
	 */
	const pane = inPane();
	const back = $derived.by(() => {
		if (!pane) return true;
		const l = listOf(page.route.id);
		if (!l) return true;
		const opener = listOpener(page.url.pathname);
		return paneBack(opener, l.list, page.params.dance as DanceSlug);
	});

	/* The sheet's desktop classes: the page's own, a card's column, a pane's content, a list beside its pane. */
	const SHEET_DESK = $derived(
		card
			? 'desk:mt-0 desk:min-h-0 desk:w-[480px] desk:max-w-full desk:gap-[22px] desk:rounded-none desk:bg-transparent desk:p-0'
			: split
				? 'desk:mx-0 desk:mt-0 desk:flex desk:min-h-[calc(100dvh-var(--band-row-h))] desk:max-w-none desk:flex-row desk:gap-0 desk:rounded-none desk:p-0'
				: pane
					? 'desk:mt-0 desk:min-h-0 desk:w-full desk:max-w-[calc(var(--page-w)+80px)] desk:rounded-none desk:px-10 desk:pt-[18px] desk:pb-10'
					: 'desk:mx-auto desk:mt-0 desk:min-h-[calc(100dvh-var(--band-row-h))] desk:w-full desk:max-w-[calc(var(--page-w)+80px)] desk:rounded-none desk:px-10 desk:pt-7 desk:pb-10'
	);
	// An item page under a list: on the phone the sheet is not a box at all.
	const SHEET = $derived(
		split === 'item'
			? 'contents'
			: 'relative -mt-7 flex min-h-[60vh] flex-col gap-2 rounded-t-[28px] bg-ground px-4 pb-6'
	);
</script>

<svelte:window bind:scrollY />

{#if split !== 'item'}
	<!--
		Under the status bar: always the band, so the bar reads as part of the header
		and nothing scrolls into it. As tall as the safe area (0 in a desktop browser).
	-->
	<div aria-hidden="true" class="fixed inset-x-0 top-0 z-30 h-[var(--safe-top)] bg-band"></div>

	<!-- The slim band: fixed, fades in once the big one has scrolled away. Never on the desktop. -->
	<div
		data-slim-band
		class="fixed inset-x-0 top-0 z-30 bg-band px-[10px] transition-opacity duration-150 motion-reduce:transition-none desk:hidden"
		class:opacity-0={!slim}
		class:pointer-events-none={!slim}
		aria-hidden={slim ? undefined : 'true'}
		inert={!slim}
		style="padding-top: var(--safe-top); height: calc(4rem + var(--safe-top)); --focus-ring: var(--color-band-ink)"
	>
		<!-- The same 560 px column as the page, inside the full-width bar. -->
		<div class="mx-auto flex h-16 max-w-[560px] items-center gap-1">
			{#if left}{@render left()}{/if}
			{#if compact && subtitle}
				<!-- A compact screen's subtitle (a figure's variation) stays in the slim band. -->
				<span class="flex min-w-0 flex-1 flex-col gap-px">
					<span
						class="truncate font-display text-[22px] leading-tight font-extrabold tracking-[-0.005em] text-band-ink"
						>{title}</span
					>
					<span class="truncate text-[12px] leading-[1.3] font-semibold text-band-small"
						>{subtitle}</span
					>
				</span>
			{:else}
				<span
					class="min-w-0 flex-1 truncate font-display text-[22px] leading-tight font-extrabold tracking-[-0.005em] text-band-ink"
					>{title}</span
				>
			{/if}
			{#if right}<div class="flex items-center">{@render right()}</div>{/if}
		</div>
	</div>
{/if}

<!-- The band (`BandHeader`): the phone's big header, the desktop's band row, a card's title or a pane's header. -->
<BandHeader
	{title}
	{subtitle}
	{deskSubtitle}
	{compact}
	hero={!!hero}
	{slim}
	variant={card ? 'card' : pane && !split ? 'pane' : 'band'}
	{back}
	deskOnly={split === 'item'}
	{left}
	{right}
	{extra}
/>

<!--
	The sheet. On the desktop the content stops at its width, centred, under the band
	row; on a card page it is the card's column (the card itself is `CardFrame`'s); in
	a pane, the pane's content, from its left; a list's, the list column and its pane.
-->
<div class="{SHEET} {SHEET_DESK}" class:pt-5={!hero} style="--page-w: {PAGE_WIDTH[width]}px">
	{#if hero}<div class="-mt-[42px] mb-[10px] desk:mt-0">{@render hero()}</div>{/if}
	{@render children()}
</div>
