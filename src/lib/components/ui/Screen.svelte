<script lang="ts">
	import type { Snippet } from 'svelte';
	import { bandMode, bandProgress } from '$lib/nav/band';
	import { bandCollapse } from '$lib/components/shell/band-collapse';
	import { desk } from '$lib/nav/desk.svelte';
	import { PAGE_WIDTH, type PageWidth } from '$lib/nav/frame';
	import BandHeader from '$lib/components/shell/BandHeader.svelte';
	import { inPane } from '$lib/components/shell/pane-context';

	let {
		title,
		subtitle,
		deskSubtitle,
		deskTitle,
		compact = false,
		width = 'one',
		card = false,
		split,
		left,
		right,
		extra,
		below,
		hero,
		heroDesk = true,
		children
	}: {
		title: string;
		subtitle?: string;
		/** The band row's subtitle on the desktop, in place of `subtitle` (`BandHeader`). */
		deskSubtitle?: string;
		/** The band row's title on the desktop, in place of `title` (`BandHeader`). */
		deskTitle?: string;
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
		/**
		 * In a pane on the desktop, a row under the title (and `extra`, which joins
		 * it there): desk-only content, never on the phone (`BandHeader`).
		 */
		below?: Snippet;
		hero?: Snippet;
		/**
		 * false: the hero is the phone's only (the desktop pins its action elsewhere, as a
		 * group routine's Practise), so its wrapper is not drawn there either.
		 */
		heroDesk?: boolean;
		children: Snippet;
	} = $props();

	let scrollY = $state(0);
	let innerWidth = $state(0);
	/** The sheet and the slim band's height: where the slim band pins (`bandMode`). */
	let sheet = $state<HTMLElement>();
	let slimH = $state(0);
	/*
	 * The scroll at which the sheet's top edge meets the slim band's bottom: there
	 * the big band would start to leave, so the slim one takes over. Read again as
	 * the page scrolls or resizes (a title that wraps, a band that grows).
	 */
	const pinAt = $derived.by(() => {
		void scrollY;
		void innerWidth;
		if (!sheet || slimH === 0) return null;
		return sheet.getBoundingClientRect().top + window.scrollY - slimH;
	});
	const mode = $derived(bandMode(scrollY, compact, desk.current, pinAt));
	const slim = $derived(mode === 'slim');
	/*
	 * On the way to the pin the big band folds into the slim one: its title shrinks
	 * into the slim title's place and its buttons move to the slim row
	 * (`band-collapse.ts`), so at the pin the slim band takes over unseen.
	 */
	let slimEl = $state<HTMLElement>();
	const fold = bandCollapse();
	$effect(() => {
		const y = scrollY;
		const header = (sheet?.previousElementSibling as HTMLElement | null) ?? null;
		if (desk.current || split === 'item' || !header || !slimEl || pinAt === null) {
			fold.clear(header);
			return;
		}
		const key = `${innerWidth}|${title}|${subtitle ?? ''}|${compact}`;
		fold.update(header, slimEl, y, bandProgress(y, compact, pinAt), key);
	});

	/*
	 * Inside a list's item pane (desktop spec, "A list and the item beside it"), the
	 * desktop draws no band row here: the header is the pane's header, the sheet the
	 * pane's content. Whether its ‹ shows is `BackButton`'s own gate. The phone is
	 * unchanged.
	 */
	const pane = inPane();
	/*
	 * The page's one main: this sheet, a pane's included (on an item route the item's
	 * own sheet is the main at both widths, and its header the banner), except the
	 * sheet of an item's list beside it, which holds the list column and that pane.
	 * That list's band row is no landmark either (`BandHeader`'s `deskOnly`).
	 */
	const main = $derived(split !== 'item');

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

<svelte:window bind:scrollY bind:innerWidth />

{#if split !== 'item'}
	<!--
		Under the status bar: always the band, so the bar reads as part of the header
		and nothing scrolls into it. As tall as the safe area (0 in a desktop browser).
	-->
	<div aria-hidden="true" class="fixed inset-x-0 top-0 z-30 h-[var(--safe-top)] bg-band"></div>

	<!--
		The slim band: fixed, there from the pin on. The big band has folded into it by
		then (title and buttons in its places), so it takes over without a fade. Never
		on the desktop.
	-->
	<div
		data-slim-band
		bind:this={slimEl}
		bind:clientHeight={slimH}
		class="fixed inset-x-0 top-0 z-30 bg-band px-[10px] desk:hidden"
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
						data-slim-name>{title}</span
					>
					<span
						class="truncate text-[12px] leading-[1.3] font-semibold text-band-small"
						data-slim-sub>{subtitle}</span
					>
				</span>
			{:else}
				<span
					class="min-w-0 flex-1 truncate font-display text-[22px] leading-tight font-extrabold tracking-[-0.005em] text-band-ink"
					data-slim-name>{title}</span
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
	{deskTitle}
	{compact}
	hero={!!hero}
	{slim}
	variant={card ? 'card' : pane && !split ? 'pane' : 'band'}
	deskOnly={split === 'item'}
	{left}
	{right}
	{extra}
	{below}
/>

<!--
	The sheet. On the desktop the content stops at its width, centred, under the band
	row; on a card page it is the card's column (the card itself is `CardFrame`'s); in
	a pane, the pane's content, from its left; a list's, the list column and its pane.
-->
<svelte:element
	this={main ? 'main' : 'div'}
	bind:this={sheet}
	class="{SHEET} {SHEET_DESK}"
	class:pt-5={!hero}
	style="--page-w: {PAGE_WIDTH[width]}px"
>
	<!-- A list's hero (`split`): on the desktop it is its column's first card (`ListPane`). -->
	{#if hero}<div class="-mt-[42px] mb-[10px] desk:mt-0{heroDesk && !split ? '' : ' desk:hidden'}">
			{@render hero()}
		</div>{/if}
	{@render children()}
</svelte:element>
