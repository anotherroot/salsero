<!-- src/lib/components/video/SectionView.svelte -->
<script lang="ts">
	import type { Snippet } from 'svelte';
	import { preciseTime, sectionProgress, spotTime } from '$lib/video/spots';
	import type { Spot } from '$lib/types';
	import Icon from './Icon.svelte';
	import { icons } from './icons';
	import { BTN_GHOST } from './styles';
	import Timeline from './Timeline.svelte';
	import Transport from './Transport.svelte';

	/**
	 * One section, looping: its own timeline from start to end and the controls
	 * for practising it. `panel` is the portrait screen under the video (the top
	 * bar carries ‹ Full video and Edit, the name is on the video, and the row
	 * of sections sits at the bottom); `overlay` is the bottom of a landscape
	 * screen, over the picture; `bar` sits under the desktop video.
	 */
	interface Props {
		spot: Spot;
		currentMs: number;
		paused: boolean;
		variant: 'panel' | 'overlay' | 'bar';
		onfull: () => void;
		onseek: (ms: number) => void;
		ontoggle: () => void;
		onstep: (s: -1 | 1) => void;
		ontenth: (d: -1 | 1) => void;
		/** Portrait: folds the controls to a slim bar. */
		onhide?: () => void;
		/** Portrait: the row of sections. */
		row?: Snippet;
	}

	let {
		spot,
		currentMs,
		paused,
		variant,
		onfull,
		onseek,
		ontoggle,
		onstep,
		ontenth,
		onhide,
		row
	}: Props = $props();

	const endMs = $derived(spot.endMs ?? spot.startMs);
	const progress = $derived(sectionProgress(spot, currentMs));
</script>

{#snippet track(overlay: boolean, middle: boolean)}
	<Timeline fromMs={spot.startMs} toMs={endMs} {currentMs} accentFill {overlay} {onseek} />
	<div
		class="flex justify-between text-[12px] tabular-nums {overlay
			? 'text-white/85'
			: 'text-(--pl-muted)'}"
	>
		<span>{spotTime(spot.startMs)}</span>
		{#if middle}
			<span class="font-semibold {overlay ? 'text-white' : 'text-(--pl-ink)'}">{progress}</span>
		{/if}
		<span>{spotTime(endMs)}</span>
	</div>
{/snippet}

{#if variant === 'panel'}
	<div class="flex flex-col gap-2 pt-1.5 pb-3">
		<div class="flex items-center gap-2 pr-2 pl-4">
			<span class="text-[20px] font-semibold tabular-nums">{progress}</span>
			<span class="flex-1"></span>
			{#if onhide}
				<button type="button" class="{BTN_GHOST} h-9 pr-2 pl-3 text-(--pl-ink-2)" onclick={onhide}>
					Hide<Icon d={icons.chevronDown} size={18} />
				</button>
			{/if}
		</div>
		<div class="px-4">{@render track(false, false)}</div>
		<div class="pt-1"><Transport {paused} size="large" {ontoggle} {onstep} {ontenth} /></div>
		{@render row?.()}
	</div>
{:else if variant === 'overlay'}
	<div class="flex flex-col gap-1 px-6 pb-3">
		{@render track(true, true)}
		<div class="mt-1"><Transport {paused} overlay {ontoggle} {onstep} {ontenth} /></div>
	</div>
{:else}
	<div class="flex flex-col gap-1 px-4 pt-3">
		{@render track(false, true)}
		<div class="flex items-center gap-2 py-2">
			<span class="text-[15px] font-semibold tabular-nums">{preciseTime(currentMs)}</span>
			<span class="flex-1"></span>
			<Transport {paused} {ontoggle} {onstep} {ontenth} />
			<span class="flex-1"></span>
			<button type="button" class={BTN_GHOST} onclick={onfull}>
				<Icon d={icons.chevronLeft} />Full video
			</button>
		</div>
	</div>
{/if}
