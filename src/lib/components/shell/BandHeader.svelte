<script lang="ts">
	import type { Snippet } from 'svelte';
	import { page } from '$app/state';
	import { groupLabel } from '$lib/teams/mode';
	import Icon from '$lib/components/ui/Icon.svelte';
	import type { GroupMode } from '$lib/types';

	/**
	 * The band's header, `Screen`'s and a list's (`ListPane`, through its Screen):
	 * one markup for every band.
	 *
	 * On the phone the big header. On the desktop, by `variant`:
	 * - `band`: the band row (desktop spec, "The band row"): fixed, 88 px, a
	 *   three-column grid from the side's edge to the window's right edge — the
	 *   title block (reaching back over the side to x 30, or 18 for a Back:
	 *   `--band-x`, from `--band-left`; 30 again when the Back is hidden on the
	 *   desktop: mark its wrapper `data-desk-hidden`), `extra` centred over the sheet, `right` 30 px from the edge.
	 * - `card`: the title above a card page's 480 px column (`CardFrame`).
	 * - `pane`: the header of an item open beside its list, on the ground: the
	 *   name in `display_s` ink, the subtitle under it, `left` (‹) only when `back`,
	 *   `right` (tonal buttons, BandButton's pane tone) at the pane's right edge.
	 *
	 * One DOM for both widths. The phone's rows (the group line; Back, the title and
	 * the actions; the subtitle) are one wrapping flex row: the title block is
	 * `display: contents` there and only becomes a box on the desktop, where it is
	 * a small grid. `deskOnly`: not on the phone at all (a list's band row while an
	 * item page draws the phone's own band).
	 */
	let {
		title,
		subtitle,
		compact = false,
		hero = false,
		slim = false,
		variant = 'band',
		back = true,
		deskOnly = false,
		left,
		right,
		extra
	}: {
		title: string;
		subtitle?: string;
		compact?: boolean;
		/** The page has a hero card over the band's foot: a deeper band. */
		hero?: boolean;
		/** The slim band is showing: this one is inert (only one Back may take focus). */
		slim?: boolean;
		variant?: 'band' | 'card' | 'pane';
		/** In a pane on the desktop: whether `left` (the ‹) shows (`paneBack`). */
		back?: boolean;
		deskOnly?: boolean;
		left?: Snippet;
		right?: Snippet;
		extra?: Snippet;
	} = $props();

	/** In group mode the band says whose space this is. */
	const group = $derived((page.data.groupMode ?? null) as GroupMode | null);

	/* Each element's desktop classes, by variant. The phone's are written in the markup. */
	const D = $derived(
		variant === 'band'
			? {
					header:
						'desk:fixed desk:inset-x-0 desk:top-0 desk:z-30 desk:grid desk:h-[var(--band-row-h)] desk:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] desk:items-center desk:gap-x-6 desk:py-0 desk:pr-10 desk:pl-[max(var(--side-w),var(--band-x))] desk:[--band-x:var(--band-left)] desk:has-[[data-desk-hidden]]:[--band-x:30px]',
					edge: 'desk:fixed desk:top-0',
					row: 'desk:contents',
					block:
						'desk:col-start-1 desk:row-start-1 desk:ml-[calc(var(--band-x)-max(var(--side-w),var(--band-x)))] desk:grid desk:min-w-0 desk:grid-cols-[max-content_minmax(0,max-content)_minmax(0,1fr)] desk:items-center desk:justify-start',
					groupLine: 'desk:col-start-2 desk:col-end-4 desk:row-start-1 desk:mb-1 desk:min-w-0',
					left: 'desk:col-start-1 desk:row-span-2 desk:row-start-1 desk:mr-[14px] desk:ml-0 desk:has-[[data-desk-hidden]]:hidden',
					h1: 'desk:col-start-2 desk:row-start-2 desk:self-baseline',
					name: 'desk:block desk:truncate',
					sub: 'desk:order-none desk:col-start-3 desk:row-start-2 desk:ml-[14px] desk:min-w-0 desk:self-baseline desk:truncate desk:pl-0',
					right: 'desk:col-start-3 desk:row-start-1 desk:ml-0 desk:justify-self-end',
					extra: 'desk:col-start-2 desk:row-start-1 desk:mt-0'
				}
			: variant === 'card'
				? {
						header: 'desk:w-[480px] desk:max-w-full desk:p-0 desk:pl-2',
						edge: 'desk:fixed desk:top-0',
						row: '',
						block: '',
						groupLine: 'desk:col-start-2 desk:col-end-4 desk:row-start-1 desk:mb-1 desk:min-w-0',
						left: '',
						h1: 'desk:col-start-2 desk:row-start-2 desk:self-baseline',
						name: '',
						sub: '',
						right: 'desk:col-start-3 desk:row-start-1 desk:ml-0 desk:justify-self-end',
						extra: 'desk:col-start-2 desk:row-start-1 desk:mt-0'
					}
				: {
						header:
							'[--focus-ring:var(--color-band-ink)] desk:flex-row desk:flex-wrap desk:items-start desk:justify-between desk:gap-x-4 desk:gap-y-3 desk:bg-transparent desk:px-10 desk:pt-6 desk:pb-1 desk:[--focus-ring:var(--color-accent)]',
						edge: 'desk:hidden',
						row: 'desk:contents',
						block:
							'desk:grid desk:min-w-0 desk:flex-1 desk:grid-cols-[auto_minmax(0,1fr)] desk:items-center',
						groupLine: 'desk:hidden',
						left: `desk:col-start-1 desk:row-span-2 desk:row-start-1 desk:mr-[6px]${back ? '' : ' desk:hidden'}`,
						h1: 'desk:col-start-2 desk:row-start-1 desk:text-[30px] desk:leading-[1.05] desk:tracking-[-0.015em] desk:text-ink',
						name: 'desk:block desk:truncate',
						sub: 'desk:order-none desk:col-start-2 desk:row-start-2 desk:mt-1 desk:min-w-0 desk:truncate desk:pl-0 desk:leading-[1.3] desk:text-muted',
						right: 'desk:mr-0 desk:ml-0 desk:flex-none desk:gap-2',
						extra: 'desk:mt-0 desk:basis-full'
					}
	);
	// The band's cream ring; in a pane it is a class (`D.header`), so the desktop can take the accent.
	const ring = $derived(variant === 'pane' ? '' : '--focus-ring: var(--color-band-ink); ');
</script>

<header
	class="relative {deskOnly ? 'hidden' : 'flex'} flex-col gap-[6px] bg-band px-5 {compact
		? 'pt-[calc(22px+var(--safe-top))]'
		: 'pt-[calc(30px+var(--safe-top))]'} {hero
		? 'pb-[92px]'
		: extra
			? 'pb-[50px]'
			: 'pb-[52px]'} {D.header}"
	inert={slim}
	style="{ring}--band-left: {left ? 18 : 30}px"
>
	{#if group}
		<!-- A thin striped edge from the band's own ink, never a colour of its own. -->
		<div
			aria-hidden="true"
			data-group-edge
			class="absolute inset-x-0 top-[var(--safe-top)] h-[6px] {D.edge}"
			style="background: repeating-linear-gradient(135deg, color-mix(in srgb, var(--color-band-ink) 35%, transparent) 0 6px, transparent 6px 12px)"
		></div>
	{/if}
	<div class="flex flex-wrap items-center gap-x-1 gap-y-[6px] {D.row}">
		<div class="contents {D.block}" data-band-title>
			{#if group}
				<div
					class="flex basis-full items-center gap-1.5 text-band-small {D.groupLine}"
					data-group-line
				>
					<Icon name="people" size={16} />
					<span class="truncate text-[13px] font-bold">{groupLabel(group.name)}</span>
				</div>
			{/if}
			{#if left}
				<div class="-ml-[10px] flex {D.left}">
					{@render left()}
				</div>
			{/if}
			<!--
				The h1 takes the line's free space; the title inside it keeps its own
				width, so the clamp clips the glyphs at the text's edge as it always has.
			-->
			<h1
				class="flex min-w-0 grow basis-0 font-display font-extrabold text-band-ink {D.h1} {compact
					? 'text-[30px] leading-[1.1] tracking-[-0.015em]'
					: 'text-[46px] leading-[1.05] tracking-[-0.02em]'}"
			>
				<span class="line-clamp-2 min-w-0 break-words {D.name}">{title}</span>
			</h1>
			{#if subtitle}
				<span
					class="order-last basis-full text-[15px] font-semibold text-band-small {D.sub}"
					class:pl-[38px]={!!left}>{subtitle}</span
				>
			{/if}
		</div>
		{#if right}
			<div class="-mr-[10px] ml-2 flex items-center {D.right}">
				{@render right()}
			</div>
		{/if}
	</div>
	{#if extra}
		<div class="mt-4 {D.extra}">{@render extra()}</div>
	{/if}
</header>
