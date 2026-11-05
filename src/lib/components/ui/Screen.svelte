<script lang="ts">
	import type { Snippet } from 'svelte';
	import { page } from '$app/state';
	import { bandMode } from '$lib/nav/band';
	import { desk } from '$lib/nav/desk.svelte';
	import { PAGE_WIDTH, type PageWidth } from '$lib/nav/frame';
	import { groupLabel } from '$lib/teams/mode';
	import Icon from './Icon.svelte';
	import type { GroupMode } from '$lib/types';

	let {
		title,
		subtitle,
		compact = false,
		width = 'one',
		left,
		right,
		extra,
		hero,
		children
	}: {
		title: string;
		subtitle?: string;
		compact?: boolean;
		/** How wide the content grows on the desktop (`PAGE_WIDTH`); the phone ignores it. */
		width?: PageWidth;
		left?: Snippet;
		right?: Snippet;
		extra?: Snippet;
		hero?: Snippet;
		children: Snippet;
	} = $props();

	let scrollY = $state(0);
	const mode = $derived(bandMode(scrollY, compact, desk.current));
	const slim = $derived(mode === 'slim');
	/** In group mode the band says whose space this is. */
	const group = $derived((page.data.groupMode ?? null) as GroupMode | null);
</script>

<svelte:window bind:scrollY />

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

<!--
	The band. On the phone the big header, inert while the slim band shows (only
	one Back may take focus). On the desktop the same element is the band row
	(desktop spec, "The band row"): fixed, 88 px, a three-column grid from the
	side's edge to the window's right edge — the title block (reaching back over
	the side to x 30, or 18 for a Back: `--band-x`), `extra` centred over the
	sheet, `right` 30 px from the edge.

	One DOM for both. The phone's rows (the group line; Back, the title and the
	actions; the subtitle) are one wrapping flex row: the title block is
	`display: contents` there and only becomes a box on the desktop, where it is
	a small grid (Back; the group line above the title; the subtitle beside the
	title on its baseline).
-->
<header
	class="relative flex flex-col gap-[6px] bg-band px-5 {compact
		? 'pt-[calc(22px+var(--safe-top))]'
		: 'pt-[calc(30px+var(--safe-top))]'} {hero
		? 'pb-[92px]'
		: extra
			? 'pb-[50px]'
			: 'pb-[52px]'} desk:fixed desk:inset-x-0 desk:top-0 desk:z-30 desk:grid desk:h-[var(--band-row-h)] desk:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] desk:items-center desk:gap-x-6 desk:py-0 desk:pr-10 desk:pl-[max(var(--side-w),var(--band-x))]"
	inert={slim}
	style="--focus-ring: var(--color-band-ink); --band-x: {left ? 18 : 30}px"
>
	{#if group}
		<!-- A thin striped edge from the band's own ink, never a colour of its own. -->
		<div
			aria-hidden="true"
			data-group-edge
			class="absolute inset-x-0 top-[var(--safe-top)] h-[6px] desk:fixed desk:top-0"
			style="background: repeating-linear-gradient(135deg, color-mix(in srgb, var(--color-band-ink) 35%, transparent) 0 6px, transparent 6px 12px)"
		></div>
	{/if}
	<div class="flex flex-wrap items-center gap-x-1 gap-y-[6px] desk:contents">
		<div
			class="contents desk:col-start-1 desk:row-start-1 desk:ml-[calc(var(--band-x)-max(var(--side-w),var(--band-x)))] desk:grid desk:min-w-0 desk:grid-cols-[max-content_minmax(0,max-content)_max-content] desk:items-center desk:justify-start"
			data-band-title
		>
			{#if group}
				<div
					class="flex basis-full items-center gap-1.5 text-band-small desk:col-start-2 desk:col-end-4 desk:row-start-1 desk:mb-1 desk:min-w-0"
					data-group-line
				>
					<Icon name="people" size={16} />
					<span class="truncate text-[13px] font-bold">{groupLabel(group.name)}</span>
				</div>
			{/if}
			{#if left}
				<div
					class="-ml-[10px] flex desk:col-start-1 desk:row-span-2 desk:row-start-1 desk:mr-[14px] desk:ml-0"
				>
					{@render left()}
				</div>
			{/if}
			<!--
				The h1 takes the line's free space; the title inside it keeps its own
				width, so the clamp clips the glyphs at the text's edge as it always has.
			-->
			<h1
				class="flex min-w-0 grow basis-0 font-display font-extrabold text-band-ink desk:col-start-2 desk:row-start-2 desk:self-baseline {compact
					? 'text-[30px] leading-[1.1] tracking-[-0.015em]'
					: 'text-[46px] leading-[1.05] tracking-[-0.02em]'}"
			>
				<span class="line-clamp-2 min-w-0 break-words desk:block desk:truncate">{title}</span>
			</h1>
			{#if subtitle}
				<span
					class="order-last basis-full text-[15px] font-semibold text-band-small desk:order-none desk:col-start-3 desk:row-start-2 desk:ml-[14px] desk:self-baseline desk:pl-0 desk:whitespace-nowrap"
					class:pl-[38px]={!!left}>{subtitle}</span
				>
			{/if}
		</div>
		{#if right}
			<div
				class="-mr-[10px] ml-2 flex items-center desk:col-start-3 desk:row-start-1 desk:ml-0 desk:justify-self-end"
			>
				{@render right()}
			</div>
		{/if}
	</div>
	{#if extra}
		<div class="mt-4 desk:col-start-2 desk:row-start-1 desk:mt-0">{@render extra()}</div>
	{/if}
</header>

<!-- The sheet. On the desktop the content stops at its width, centred, under the band row. -->
<div
	class="relative -mt-7 flex min-h-[60vh] flex-col gap-2 rounded-t-[28px] bg-ground px-4 pb-6 desk:mx-auto desk:mt-0 desk:min-h-[calc(100dvh-var(--band-row-h))] desk:w-full desk:max-w-[calc(var(--page-w)+80px)] desk:rounded-none desk:px-10 desk:pt-7 desk:pb-10"
	class:pt-5={!hero}
	style="--page-w: {PAGE_WIDTH[width]}px"
>
	{#if hero}<div class="-mt-[42px] mb-[10px] desk:mt-0">{@render hero()}</div>{/if}
	{@render children()}
</div>
