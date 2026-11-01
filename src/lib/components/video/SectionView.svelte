<!-- src/lib/components/video/SectionView.svelte -->
<script lang="ts">
	import type { Snippet } from 'svelte';
	import { preciseTime, sectionProgress, spotTime } from '$lib/video/spots';
	import type { Spot } from '$lib/types';
	import Icon from '$lib/components/ui/Icon.svelte';
	import { HIDE, playerButton } from './styles';
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
		/** Landscape: the name and link pills, above the timeline. */
		badges?: Snippet;
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
		row,
		badges
	}: Props = $props();

	const endMs = $derived(spot.endMs ?? spot.startMs);
	const progress = $derived(sectionProgress(spot, currentMs));
	const BACK = playerButton('ghost', 'md');
</script>

{#snippet track(overlay: boolean, middle: boolean)}
	<Timeline fromMs={spot.startMs} toMs={endMs} {currentMs} accentFill glass={overlay} {onseek} />
	<div
		class="flex justify-between text-[12px] font-bold tabular-nums {overlay
			? '-mt-1.5 text-white/85'
			: variant === 'panel'
				? '-mt-1.5 text-muted'
				: 'text-muted'}"
	>
		<span>{spotTime(spot.startMs)}</span>
		{#if middle}
			<span class="font-extrabold {overlay ? 'text-white' : 'text-ink'}">{progress}</span>
		{/if}
		<span>{spotTime(endMs)}</span>
	</div>
{/snippet}

{#if variant === 'panel'}
	<div class="flex flex-col gap-1.5 bg-ground pt-1.5 pb-[max(var(--safe-bottom),22px)]">
		<div class="flex items-center pr-2 pl-5">
			<span class="font-display text-[26px] font-extrabold tracking-[-0.01em] tabular-nums"
				>{progress}</span
			>
			<span class="flex-1"></span>
			{#if onhide}
				<button type="button" class={HIDE} onclick={onhide}>
					Hide<Icon name="chevron-down" size={18} />
				</button>
			{/if}
		</div>
		<div class="px-5">{@render track(false, false)}</div>
		<div class="px-4 py-2.5">
			<Transport {paused} size="large" {ontoggle} {onstep} {ontenth} />
		</div>
		{@render row?.()}
	</div>
{:else if variant === 'overlay'}
	<div class="flex flex-col">
		{@render badges?.()}
		{@render track(true, true)}
		<div class="mt-1.5">
			<Transport {paused} size="float" glass {ontoggle} {onstep} {ontenth} />
		</div>
	</div>
{:else}
	<div class="flex flex-col gap-1 px-4 pt-3">
		{@render track(false, true)}
		<div class="flex items-center gap-2 py-2">
			<span class="text-[15px] font-extrabold tabular-nums">{preciseTime(currentMs)}</span>
			<span class="flex-1"></span>
			<Transport {paused} {ontoggle} {onstep} {ontenth} />
			<span class="flex-1"></span>
			<button type="button" class={BACK} onclick={onfull}>
				<Icon name="chevron-left" size={20} />Full video
			</button>
		</div>
	</div>
{/if}
