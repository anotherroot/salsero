<script lang="ts">
	import { frameView } from '$lib/teams/frame-view.svelte';
	import type { Snippet } from 'svelte';
	import { page } from '$app/state';
	import GroupBadge from './GroupBadge.svelte';
	import GroupFaces from './GroupFaces.svelte';
	import { PANE_PAD_DESK, PANE_TITLE_DESK } from '$lib/components/ui/styles';
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
	 *   name in `display_s` ink, the subtitle under it, `left` (a Stop editing ×
	 *   always; a ‹ only when `BackButton`'s own pane gate lets it show), `right`
	 *   (tonal buttons, BandButton's pane tone) at the pane's right edge, then
	 *   `extra` and `below` as full-width rows, 12 px apart.
	 *
	 * One DOM for both widths. The phone's rows (the group line; Back, the title and
	 * the actions; the subtitle) are one wrapping flex row: the title block is
	 * `display: contents` there and only becomes a box on the desktop, where it is
	 * a small grid. `deskOnly`: not on the phone at all (a list's band row while an
	 * item page draws the phone's own band). `deskSubtitle`: the desktop's subtitle
	 * in place of `subtitle` (two spans, one per width); without it, one span.
	 *
	 * Landmarks: the header is the banner and its title the page's one h1, except a
	 * `deskOnly` band (a list's band row beside an open item): a plain box with a
	 * plain title, since the item's own header (in the pane on the desktop, the
	 * page itself on the phone) is the banner and its name the h1.
	 */
	let {
		title,
		subtitle,
		deskSubtitle,
		deskTitle,
		compact = false,
		hero = false,
		slim = false,
		variant = 'band',
		deskOnly = false,
		left,
		right,
		extra,
		below
	}: {
		title: string;
		subtitle?: string;
		/** The desktop's subtitle in place of `subtitle`; the phone keeps `subtitle`. */
		deskSubtitle?: string;
		/** The desktop's title in place of `title`; the phone keeps `title` (Groups is You on the phone). */
		deskTitle?: string;
		compact?: boolean;
		/** The page has a hero card over the band's foot: a deeper band. */
		hero?: boolean;
		/** The slim band is showing: this one is inert (only one Back may take focus). */
		slim?: boolean;
		variant?: 'band' | 'card' | 'pane';
		deskOnly?: boolean;
		left?: Snippet;
		right?: Snippet;
		extra?: Snippet;
		/** The pane's desk-only row under the title and `extra`; never on the phone. */
		below?: Snippet;
	} = $props();

	/** In a group's view the band says whose space this is (a held view too: a drill being edited). */
	const group = $derived((page.data.groupMode ?? frameView.current) as GroupMode | null);

	/* Each element's desktop classes, by variant. The phone's are written in the markup. */
	const D = $derived(
		variant === 'band'
			? {
					header:
						'desk:fixed desk:inset-x-0 desk:top-0 desk:z-30 desk:grid desk:h-[var(--band-row-h)] desk:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] desk:items-center desk:gap-x-6 desk:py-0 desk:pr-10 desk:pl-[max(var(--side-w),var(--band-x))] desk:[--band-x:var(--band-left)] desk:has-[[data-desk-hidden]]:[--band-x:30px]',
					row: 'desk:contents',
					block:
						'desk:col-start-1 desk:row-start-1 desk:ml-[calc(var(--band-x)-max(var(--side-w),var(--band-x)))] desk:grid desk:min-w-0 desk:grid-cols-[max-content_minmax(0,max-content)_minmax(0,1fr)] desk:items-center desk:justify-start',
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
						row: '',
						block: '',
						left: '',
						h1: 'desk:col-start-2 desk:row-start-2 desk:self-baseline',
						name: '',
						sub: '',
						right: 'desk:col-start-3 desk:row-start-1 desk:ml-0 desk:justify-self-end',
						extra: 'desk:col-start-2 desk:row-start-1 desk:mt-0'
					}
				: {
						header:
							'[--focus-ring:var(--color-band-ink)] desk:flex-row desk:flex-wrap desk:items-start desk:justify-between desk:gap-x-4 desk:gap-y-3 desk:bg-transparent desk:[--focus-ring:var(--color-accent)] ' +
							PANE_PAD_DESK,
						row: 'desk:contents',
						block:
							'desk:grid desk:min-w-0 desk:flex-1 desk:grid-cols-[auto_minmax(0,1fr)] desk:items-center',
						left: 'desk:col-start-1 desk:row-span-2 desk:row-start-1 desk:mr-[6px]',
						h1: 'desk:col-start-2 desk:row-start-1 desk:text-ink ' + PANE_TITLE_DESK,
						name: 'desk:block desk:truncate',
						sub: 'desk:order-none desk:col-start-2 desk:row-start-2 desk:mt-1 desk:min-w-0 desk:truncate desk:pl-0 desk:leading-[1.3] desk:text-muted',
						right: 'desk:mr-0 desk:ml-0 desk:flex-none desk:gap-2',
						extra: 'desk:mt-0 desk:basis-full'
					}
	);
	// The band's cream ring; in a pane it is a class (`D.header`), so the desktop can take the accent.
	const ring = $derived(variant === 'pane' ? '' : '--focus-ring: var(--color-band-ink); ');
</script>

<svelte:element
	this={deskOnly ? 'div' : 'header'}
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
	<div class="flex flex-wrap items-center gap-x-1 gap-y-[6px] {D.row}">
		{#if group}
			<!--
				The group's row (group view spec): whose space this is and who sees it.
				The phone's only: on the desktop the side's card says it.
			-->
			<div class="flex basis-full items-center gap-2.5 pb-1.5 desk:hidden" data-group-row data-band-fade>
				<GroupBadge size={30} />
				<span class="min-w-0 flex-1 truncate text-[17px] font-extrabold text-band-ink"
					>{group.name}</span
				>
				<GroupFaces faces={group.faces} people={group.people} />
			</div>
		{/if}
		<div class="contents {D.block}" data-band-title>
			{#if left}
				<div class="-ml-[10px] flex {D.left}" data-band-left>
					{@render left()}
				</div>
			{/if}
			<!--
				The h1 takes the line's free space; the title inside it keeps its own
				width, so the clamp clips the glyphs at the text's edge as it always has.
			-->
			<svelte:element
				this={deskOnly ? 'p' : 'h1'}
				class="flex min-w-0 grow basis-0 font-display font-extrabold text-band-ink {D.h1} {compact
					? 'text-[30px] leading-[1.1] tracking-[-0.015em]'
					: 'text-[46px] leading-[1.05] tracking-[-0.02em]'}"
			>
				<span class="line-clamp-2 min-w-0 break-words {D.name}" data-band-name
					>{#if deskTitle}<span class="desk:hidden">{title}</span><span class="hidden desk:inline"
							>{deskTitle}</span
						>{:else}{title}{/if}</span
				>
			</svelte:element>
			{#if deskSubtitle}
				{#if subtitle}
					<span
						class="order-last basis-full text-[15px] font-semibold text-band-small desk:hidden"
						class:pl-[38px]={!!left}
						data-band-sub>{subtitle}</span
					>
				{/if}
				<span
					class="order-last hidden basis-full text-[15px] font-semibold text-band-small desk:block {D.sub}"
					class:pl-[38px]={!!left}
					data-band-fade>{deskSubtitle}</span
				>
			{:else if subtitle}
				<span
					class="order-last basis-full text-[15px] font-semibold text-band-small {D.sub}"
					class:pl-[38px]={!!left}
					data-band-sub>{subtitle}</span
				>
			{/if}
		</div>
		{#if right}
			<div class="-mr-[10px] ml-2 flex items-center {D.right}" data-band-right>
				{@render right()}
			</div>
		{/if}
	</div>
	{#if extra}
		<div class="mt-4 {D.extra}" data-band-fade>{@render extra()}</div>
	{/if}
	{#if below && variant === 'pane'}
		<div class="hidden desk:block desk:basis-full" data-below>{@render below()}</div>
	{/if}
</svelte:element>
