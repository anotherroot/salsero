<script lang="ts">
	import Icon from '$lib/components/ui/Icon.svelte';
	import type { DeskSkeleton, Skeleton } from '$lib/nav/pending';
	import { PAGE_WIDTH, type Frame } from '$lib/nav/frame';

	/**
	 * The destination's shape, shown while its data is on the way. It COVERS
	 * the old page rather than replacing it: SvelteKit records the old page's
	 * scroll position only once the new data has arrived, so hiding the old
	 * page would save a scroll of zero and break Back. A navigation that is
	 * refused or fails also finds the old page exactly as it was left.
	 *
	 * It stops at the top of the tab bar when the destination shows one, so the
	 * tab that just lit stays in view, and runs to the bottom when it does not.
	 * It sits above the bars pinned over a page's end (z-30).
	 */
	let {
		skeleton,
		tabs,
		desk = 'frame',
		frame = 'side'
	}: {
		skeleton: Skeleton;
		tabs: boolean;
		/** The desktop: the whole frame, the pane alone (the list column stays live), or nothing. */
		desk?: DeskSkeleton;
		/** The desktop frame it draws inside: with the side, or without it (Practice). */
		frame?: Frame;
	} = $props();
	const side = $derived(frame === 'side');

	/*
	 * How the overlay sits on the desktop; the phone's is the classes before it.
	 * The whole frame's overlay is clear over the side and lets clicks through
	 * there, as the phone's tab bar stays live: only its band row and sheet take them.
	 */
	const DESK = {
		frame: 'desk:pointer-events-none desk:inset-0 desk:bg-transparent',
		pane: 'desk:top-[var(--band-row-h)] desk:bottom-0 desk:left-[calc(var(--side-w)+361px)]',
		none: 'desk:hidden'
	} as const;

	const WIDTHS = [
		[62, 40],
		[48, 56],
		[70, 34],
		[54, 46],
		[66, 38]
	];
</script>

{#snippet rows(n: number, leading: boolean)}
	<div class="overflow-hidden rounded-2xl bg-surface" aria-hidden="true">
		{#each { length: n }, i (i)}
			{@const [w1, w2] = WIDTHS[i % WIDTHS.length]}
			<div class="pl-4">
				<div
					class="flex min-h-16 items-center gap-3 pr-4 {i < n - 1
						? 'border-b border-hairline'
						: ''}"
				>
					{#if leading}<span class="bone size-10 flex-none rounded-xl"></span>{/if}
					<div class="flex flex-1 flex-col gap-2">
						<span class="bone h-3 rounded-md" style="width: {w1}%"></span>
						<span class="bone h-2.5 rounded-[5px] opacity-80" style="width: {w2}%"></span>
					</div>
				</div>
			</div>
		{/each}
	</div>
{/snippet}

{#snippet bar(w: string, h: number, r = 6)}
	<span class="bone block flex-none" style="width: {w}; height: {h}px; border-radius: {r}px"></span>
{/snippet}

{#snippet deskList()}
	<!-- The list column's rows: the search pill, filter chips, a label, then the rows. -->
	<div class="flex flex-col gap-2.5" aria-hidden="true">
		{@render bar('100%', 44, 22)}
		<div class="flex flex-wrap gap-2">
			{#each [52, 102, 64, 52, 104, 60] as w, i (i)}
				{@render bar(`${w}px`, 34, 17)}
			{/each}
		</div>
		<div class="mx-1 mt-2">{@render bar('80px', 11)}</div>
		{@render rows(7, false)}
	</div>
{/snippet}

{#snippet deskPane()}
	<!-- The item beside the list: its title and actions, then two columns of cards. -->
	<div class="flex flex-col gap-3.5 px-10 pt-[26px] pb-1" aria-hidden="true">
		{@render bar('220px', 30, 8)}
		<div class="flex gap-2">
			{@render bar('70px', 36, 18)}
			{@render bar('80px', 36, 18)}
			{@render bar('110px', 36, 18)}
		</div>
	</div>
	<div class="px-10 pt-[18px] pb-10" aria-hidden="true">
		<div
			class="mx-auto grid items-start gap-8"
			style="max-width: {PAGE_WIDTH.two}px; grid-template-columns: minmax(0, 5fr) minmax(0, 7fr)"
		>
			<div class="flex min-w-0 flex-col gap-2">
				{@render card(4)}
				{@render rows(2, false)}
				{@render card(3)}
			</div>
			<div class="flex min-w-0 flex-col gap-2">
				{@render rows(5, false)}
				{@render card(3)}
			</div>
		</div>
	</div>
{/snippet}

{#snippet card(n: number)}
	<div class="flex flex-col gap-3 rounded-2xl bg-surface p-4">
		{@render bar('40%', 14)}
		{#each { length: n - 1 }, i (i)}
			{@render bar(['85%', '70%', '55%'][i % 3], 12)}
		{/each}
	</div>
{/snippet}

{#snippet deskSheet()}
	<!-- One page that is not a list and pane: a single sheet of rows, centred. -->
	<div
		class="mx-auto px-10 pt-6 pb-10"
		style="max-width: {PAGE_WIDTH.one + 80}px"
		aria-hidden="true"
	>
		{@render rows(7, skeleton.kind === 'today')}
	</div>
{/snippet}

<div
	class="fixed inset-x-0 top-0 bottom-[var(--sk-bottom)] z-[35] overflow-hidden bg-ground {DESK[
		desk
	]}"
	style="--sk-bottom: {tabs ? 'calc(var(--tab-bar-h) + var(--safe-bottom))' : '0px'}"
	aria-busy="true"
>
	<!-- The phone's skeleton, as ever; the desktop draws its own below. -->
	<div class="mx-auto max-w-[560px] desk:hidden">
		<p class="sr-only" role="status">Loading…</p>

		<header
			class="flex flex-col bg-band px-5 {skeleton.kind === 'today' ||
			skeleton.kind === 'figure' ||
			skeleton.kind === 'routine'
				? 'gap-[6px]'
				: skeleton.kind === 'moves'
					? 'pb-[50px]'
					: 'pb-8'}"
			style="padding-top: calc({skeleton.kind === 'figure'
				? 22
				: 30}px + var(--safe-top)); --focus-ring: var(--color-band-ink){skeleton.kind === 'today' ||
			skeleton.kind === 'routine'
				? '; padding-bottom: 92px'
				: skeleton.kind === 'figure'
					? '; padding-bottom: 52px'
					: ''}"
		>
			{#if skeleton.kind === 'today'}
				<div class="flex items-center justify-between gap-3" aria-hidden="true">
					<h1
						class="font-display text-[46px] leading-[1.05] font-extrabold tracking-[-0.02em] text-band-ink"
					>
						Today
					</h1>
					<div class="-mr-[10px] flex text-band-ink">
						<span class="flex size-11 items-center justify-center opacity-45"
							><Icon name="chevron-left" size={24} /></span
						>
						<span class="flex size-11 items-center justify-center"
							><Icon name="settings" size={24} /></span
						>
					</div>
				</div>
				<span class="mt-1 block h-[14px] w-[150px] rounded-[7px] bg-band-ink opacity-[0.28]"></span>
			{:else if skeleton.kind === 'moves'}
				<!-- As Screen draws it: the title, then the Segmented track with the destination's half lit. -->
				<h1
					class="font-display text-[46px] leading-[1.05] font-extrabold tracking-[-0.02em] text-band-ink"
				>
					Moves
				</h1>
				<div
					class="mt-[22px] grid h-[50px] grid-cols-3 rounded-full bg-band-track p-[3px]"
					aria-hidden="true"
				>
					<span
						class="h-11 rounded-full bg-band-ink"
						class:col-start-2={skeleton.segment === 'routines'}
						class:col-start-3={skeleton.segment === 'positions'}
					></span>
				</div>
			{:else if skeleton.kind === 'figure'}
				<!-- As Screen's compact band draws it: back, a title, the pencil; the variation under it. -->
				<div class="-mx-[10px] flex items-center gap-1 text-band-ink" aria-hidden="true">
					<span class="flex size-11 flex-none items-center justify-center"
						><Icon name="back" size={24} /></span
					>
					<span class="h-[30px] w-[55%] rounded-lg bg-band-ink opacity-30"></span>
					<span class="flex-1"></span>
					<span class="flex size-11 flex-none items-center justify-center opacity-60"
						><Icon name="pencil" size={24} /></span
					>
				</div>
				<span
					class="ml-[38px] block h-[14px] w-24 rounded-[7px] bg-band-ink opacity-[0.28]"
					aria-hidden="true"
				></span>
			{:else if skeleton.kind === 'routine'}
				<!-- As Screen's full band draws it: back, a 46 px title, the pencil and ⋯. -->
				<div class="-mx-[10px] flex items-center gap-1 text-band-ink" aria-hidden="true">
					<span class="flex size-11 flex-none items-center justify-center"
						><Icon name="back" size={24} /></span
					>
					<span class="h-[46px] w-1/2 rounded-[10px] bg-band-ink opacity-30"></span>
					<span class="flex-1"></span>
					<span class="flex size-11 flex-none items-center justify-center opacity-60"
						><Icon name="pencil" size={24} /></span
					>
					<span class="flex size-11 flex-none items-center justify-center opacity-60"
						><Icon name="more" size={24} /></span
					>
				</div>
			{:else if skeleton.kind === 'list'}
				<h1 class="font-display text-[34px] leading-tight font-extrabold text-band-ink">
					{skeleton.title}
				</h1>
			{:else}
				<div class="flex h-[42px] items-center" aria-hidden="true">
					<span class="h-6 w-40 rounded-md bg-band-ink opacity-30"></span>
				</div>
			{/if}
		</header>

		{#if skeleton.kind === 'today'}
			<div
				class="relative -mt-7 flex min-h-[60vh] flex-col gap-2 rounded-t-[28px] bg-ground px-4 pb-6"
			>
				<div
					class="-mt-[42px] mb-[10px] flex min-h-[84px] items-center gap-[14px] rounded-[22px] bg-surface py-[14px] pr-[14px] pl-5 shadow-[0_4px_16px_rgb(0_0_0/0.12)]"
					aria-hidden="true"
				>
					<span class="flex flex-1 flex-col gap-[10px]">
						<span class="bone h-[18px] rounded-[9px]" style="width: 58%"></span>
						<span class="bone h-[11px] rounded-[5px]" style="width: 38%"></span>
					</span>
					<span class="bone size-[54px] flex-none rounded-full"></span>
				</div>
				<span class="bone mt-0.5 block h-2.5 w-16 rounded-[5px]" aria-hidden="true"></span>
				{@render rows(3, true)}
				<span class="bone mt-3.5 block h-2.5 w-24 rounded-[5px]" aria-hidden="true"></span>
				{@render rows(2, true)}
			</div>
		{:else if skeleton.kind === 'figure'}
			<div
				class="relative -mt-7 flex flex-col gap-2 rounded-t-[28px] bg-ground px-4 pt-5"
				aria-hidden="true"
			>
				<!-- The facts card: two badges, the eight counts, a fact. -->
				<div class="flex flex-col gap-3.5 rounded-2xl bg-surface p-4">
					<div class="flex gap-1.5">
						<span class="bone h-[22px] w-14 rounded-full"></span>
						<span class="bone h-[22px] w-24 rounded-full"></span>
					</div>
					<div class="flex gap-1">
						{#each { length: 8 }, i (i)}
							<span class="bone h-[30px] flex-1 rounded-lg"></span>
						{/each}
					</div>
					<div class="flex flex-col gap-2">
						<span class="bone h-2.5 w-[28%] rounded-[5px]"></span>
						<span class="bone h-3 w-[62%] rounded-md"></span>
					</div>
				</div>
				<span class="bone mt-2 ml-4 block h-[13px] w-16 rounded-[6px]"></span>
				{@render rows(2, false)}
			</div>
		{:else if skeleton.kind === 'routine'}
			<div
				class="relative -mt-7 flex flex-col gap-2 rounded-t-[28px] bg-ground px-4"
				aria-hidden="true"
			>
				<!-- The Practise hero, straddling the sheet's edge; backed by the ground so the band does not show through. -->
				<div class="-mt-[42px] mb-[10px] rounded-[22px] bg-ground">
					<span class="bone block h-[84px] rounded-[22px]"></span>
				</div>
				<!-- The facts: where it starts and ends, then the loop and break badges. -->
				<div class="flex flex-col gap-2 px-1 pt-0.5 pb-1">
					<span class="bone block h-3.5 w-[70%] rounded-[7px]"></span>
					<div class="flex gap-1.5">
						<span class="bone h-[22px] w-24 rounded-full"></span>
						<span class="bone h-[22px] w-16 rounded-full"></span>
					</div>
				</div>
				<span class="bone mt-1.5 ml-4 block h-[13px] w-16 rounded-[6px]"></span>
				{#each WIDTHS.slice(0, 4) as [w1, w2], i (i)}
					<div class="flex h-16 items-center gap-2.5 rounded-2xl bg-surface pr-4 pl-3">
						<span class="bone size-5 flex-none rounded-full"></span>
						<span class="bone size-[26px] flex-none rounded-full"></span>
						<div class="flex flex-1 flex-col gap-2">
							<span class="bone h-3 rounded-md" style="width: {w1}%"></span>
							<span class="bone h-2.5 rounded-[5px] opacity-80" style="width: {w2}%"></span>
						</div>
					</div>
				{/each}
			</div>
		{:else if skeleton.kind === 'moves'}
			<div class="relative -mt-7 flex flex-col gap-2 rounded-t-[28px] bg-ground px-4 pt-5">
				{#if skeleton.segment === 'figures'}
					<!-- The Coverage tile. -->
					<div class="flex gap-2" aria-hidden="true">
						<div class="flex h-16 flex-1 items-center gap-2.5 rounded-2xl bg-surface px-3">
							<span class="bone size-[38px] flex-none rounded-full"></span>
							<div class="flex flex-1 flex-col gap-[7px]">
								<span class="bone h-[11px] w-[40%] rounded-md"></span>
								<span class="bone h-[9px] w-[30%] rounded-[5px]"></span>
							</div>
						</div>
					</div>
				{:else if skeleton.segment === 'positions'}
					<!-- The two lines, then Templates and How positions work. -->
					<div class="flex flex-col gap-2 px-1 pb-1" aria-hidden="true">
						<span class="bone block h-3 w-[62%] rounded-md"></span>
						<span class="bone block h-2.5 w-[86%] rounded-[5px] opacity-80"></span>
					</div>
					<div class="flex gap-2" aria-hidden="true">
						<span class="bone h-11 flex-1 rounded-full"></span>
						<span class="bone h-11 flex-1 rounded-full"></span>
					</div>
				{/if}
				{#if skeleton.segment !== 'routines'}
					<span class="bone block h-11 rounded-full" aria-hidden="true"></span>
					<div class="-mr-4 flex gap-2 overflow-hidden py-1" aria-hidden="true">
						{#each [52, 112, 66, 54, 70] as w, i (i)}
							<span class="bone h-9 flex-none rounded-full" style="width: {w}px"></span>
						{/each}
					</div>
				{/if}
				<span class="bone mt-1.5 mb-0.5 ml-4 block h-2.5 w-[72px] rounded-[5px]" aria-hidden="true"
				></span>
				{@render rows(skeleton.segment === 'figures' ? 5 : 6, false)}
			</div>
		{:else}
			<div class="space-y-4 px-4 pt-4">
				{#if skeleton.kind === 'list'}
					{@render rows(7, false)}
				{:else}
					<div class="bone aspect-video rounded-2xl" aria-hidden="true"></div>
					{@render rows(3, false)}
				{/if}
			</div>
		{/if}
	</div>
	{#if desk === 'frame'}
		<!--
			The desktop frame: the band row with the destination's title (covering the old
			page's), the side left to the layout (already lit for the destination), and the
			sheet with its rounded corner: a list column of rows beside a pane of cards, or
			one sheet of rows.
		-->
		<div class="hidden desk:block">
			<p class="sr-only" role="status">Loading…</p>
			<div
				class="pointer-events-auto fixed inset-x-0 top-0 flex h-[var(--band-row-h)] items-center bg-band pr-10 pl-[30px]"
				aria-hidden="true"
			>
				{#if skeleton.deskTitle}
					<span
						class="truncate font-display text-[46px] leading-none font-extrabold tracking-[-0.02em] text-band-ink"
						>{skeleton.deskTitle}</span
					>
				{:else}
					<span class="h-8 w-56 rounded-lg bg-band-ink opacity-30"></span>
				{/if}
			</div>
			<div
				class="pointer-events-auto fixed top-[var(--band-row-h)] right-0 bottom-0 bg-band {side
					? 'left-[var(--side-w)]'
					: 'left-0'}"
			>
				<div
					class="flex h-full overflow-hidden bg-ground {side
						? 'rounded-tl-[28px]'
						: 'rounded-t-[28px]'}"
				>
					{#if skeleton.pane}
						<div
							class="flex h-full w-[361px] flex-none flex-col gap-2.5 overflow-hidden border-r border-hairline pt-6 pr-5 pl-6"
						>
							{@render deskList()}
						</div>
						<div class="min-w-0 flex-1 overflow-hidden">
							{#if skeleton.open}{@render deskPane()}{/if}
						</div>
					{:else}
						<div class="min-w-0 flex-1 overflow-hidden">{@render deskSheet()}</div>
					{/if}
				</div>
			</div>
		</div>
	{:else if desk === 'pane'}
		<!-- Only the pane: the list column beside it is live. -->
		<div class="hidden desk:block">
			<p class="sr-only" role="status">Loading…</p>
			{@render deskPane()}
		</div>
	{/if}
</div>

<style>
	.bone {
		background: var(--color-skeleton);
	}
	@media (prefers-reduced-motion: no-preference) {
		.bone {
			animation: breathe 1.4s ease-in-out infinite;
		}
	}
	@keyframes breathe {
		50% {
			opacity: 0.55;
		}
	}
</style>
