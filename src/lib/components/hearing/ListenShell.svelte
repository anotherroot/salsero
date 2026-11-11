<script lang="ts">
	import type { Snippet } from 'svelte';
	import BandButton from '$lib/components/ui/BandButton.svelte';
	import BottomBar from '$lib/components/ui/BottomBar.svelte';

	/**
	 * The listening player's frame, copied from the running player
	 * (`Running.svelte`): the band is the stage, the sheet below holds the tap
	 * area or the round's choices, the bar is pinned under both. The whole screen
	 * on the phone; a 560 px column on the desktop.
	 */
	interface Props {
		title: string;
		subtitle: string;
		backLabel: string;
		onback: () => void;
		stage: Snippet;
		bar: Snippet;
		children: Snippet;
		/** A long sheet (the result): the band takes only what it needs and the sheet scrolls. */
		scroll?: boolean;
	}

	let {
		title,
		subtitle,
		backLabel,
		onback,
		stage,
		bar,
		children,
		scroll = false
	}: Props = $props();
</script>

<div
	class="fixed inset-y-0 left-1/2 z-10 flex w-full max-w-[560px] -translate-x-1/2 flex-col bg-band"
>
	<header
		class="flex flex-col gap-1.5 bg-band px-4 pt-[calc(var(--safe-top)+12px)] pb-9 {scroll
			? 'flex-none'
			: 'min-h-0 flex-1'}"
		style="--focus-ring: var(--color-band-ink)"
	>
		<div class="-ml-[10px] flex min-w-0 items-center gap-1">
			<span class="flex-none" title={backLabel}>
				<BandButton icon="back" label={backLabel} onclick={onback} />
			</span>
			<h1
				class="min-w-0 truncate font-display text-[26px] leading-[1.1] font-extrabold tracking-[-0.015em] text-band-ink"
			>
				{title}
			</h1>
		</div>
		<p class="truncate pl-[38px] text-[15px] font-semibold text-band-small">{subtitle}</p>
		<div
			class="flex flex-col gap-3 {scroll
				? 'items-start pt-2 text-left'
				: 'min-h-0 flex-1 items-center justify-center-safe text-center'}"
		>
			{@render stage()}
		</div>
	</header>
	<div
		class="relative -mt-7 flex flex-col rounded-t-[28px] bg-ground {scroll
			? 'min-h-0 flex-1 overflow-y-auto overscroll-contain'
			: 'flex-none'}"
	>
		<div class="flex flex-col gap-3 px-4 pt-4 pb-[calc(100px+var(--safe-bottom))]">
			{@render children()}
		</div>
	</div>
	<BottomBar>
		{@render bar()}
	</BottomBar>
</div>
