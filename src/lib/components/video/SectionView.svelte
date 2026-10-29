<!-- src/lib/components/video/SectionView.svelte -->
<script lang="ts">
	import { VIDEO_RATES, type VideoRate } from '$lib/video-prefs';
	import { lengthText, preciseTime, spotLabel, spotTime } from '$lib/video/spots';
	import type { Spot } from '$lib/types';
	import Icon from './Icon.svelte';
	import { icons } from './icons';
	import { BTN, BTN_ACCENT, BTN_GHOST } from './styles';
	import Timeline from './Timeline.svelte';
	import Transport from './Transport.svelte';

	/**
	 * One section, looping: its own timeline from start to end and the controls
	 * for practising it. `panel` is the portrait screen under the video;
	 * `overlay` is the bottom of a landscape screen, over the picture (the top
	 * bar carries ‹ Full video and Edit there); `bar` sits under the desktop
	 * video.
	 */
	interface Props {
		spot: Spot;
		currentMs: number;
		paused: boolean;
		rate: VideoRate;
		variant: 'panel' | 'overlay' | 'bar';
		onfull: () => void;
		onedit: () => void;
		onseek: (ms: number) => void;
		ontoggle: () => void;
		onstep: (s: -1 | 1) => void;
		ontenth: (d: -1 | 1) => void;
		onrate: (r: VideoRate) => void;
	}

	let {
		spot,
		currentMs,
		paused,
		rate,
		variant,
		onfull,
		onedit,
		onseek,
		ontoggle,
		onstep,
		ontenth,
		onrate
	}: Props = $props();

	const endMs = $derived(spot.endMs ?? spot.startMs);
	const elapsed = $derived(
		lengthText(Math.max(0, Math.min(endMs - spot.startMs, currentMs - spot.startMs))).replace(
			' s',
			''
		)
	);
	const length = $derived(lengthText(endMs - spot.startMs));
</script>

{#snippet track(overlay: boolean)}
	<Timeline fromMs={spot.startMs} toMs={endMs} {currentMs} accentFill {overlay} {onseek} />
	<div
		class="flex justify-between text-[12px] tabular-nums {overlay
			? 'text-white/85'
			: 'text-(--pl-muted)'}"
	>
		<span>{spotTime(spot.startMs)}</span>
		<span class="font-semibold {overlay ? 'text-white' : 'text-(--pl-ink)'}"
			>{elapsed} / {length}</span
		>
		<span>{spotTime(endMs)}</span>
	</div>
{/snippet}

{#if variant === 'panel'}
	<div class="flex min-h-0 flex-1 flex-col gap-3.5 px-4 pt-2 pb-5">
		<div class="-ml-2 flex items-center gap-2">
			<button type="button" class="{BTN_GHOST} pr-3 pl-1.5" onclick={onfull}>
				<Icon d={icons.chevronLeft} />Full video
			</button>
			<span class="ml-auto flex items-center gap-1.5 text-[12px] text-(--pl-muted)">
				<Icon d={icons.loop} size={14} class="text-(--pl-accent)" />Looping
			</span>
		</div>
		<div class="-mt-1.5 flex flex-col gap-0.5">
			<span class="truncate text-[20px] font-semibold">{spotLabel(spot)}</span>
			{#if spot.linkedTo.length > 0}
				<span class="text-[13px] text-(--pl-ink-2)">Linked to {spot.linkedTo.join(', ')}</span>
			{/if}
		</div>
		<div>{@render track(false)}</div>
		<div class="flex flex-1 flex-col items-center justify-center gap-5">
			<span class="text-[12px] text-(--pl-muted) tabular-nums"
				>{preciseTime(currentMs)} in the video</span
			>
			<Transport {paused} size="large" {ontoggle} {onstep} {ontenth} />
			<div role="group" aria-label="Speed" class="flex gap-1 rounded-2xl bg-(--pl-surface) p-1">
				{#each VIDEO_RATES as r (r)}
					<button
						type="button"
						class="{rate === r ? BTN_ACCENT : BTN_GHOST} min-w-16"
						aria-pressed={rate === r}
						onclick={() => onrate(r)}>{r}×</button
					>
				{/each}
			</div>
		</div>
		<button type="button" class="{BTN} h-14 w-full rounded-2xl text-[15px]" onclick={onedit}>
			<Icon d={icons.pencil} />Edit section
		</button>
	</div>
{:else if variant === 'overlay'}
	<div class="flex flex-col gap-1 px-6 pb-3">
		{@render track(true)}
		<div class="mt-1"><Transport {paused} overlay {ontoggle} {onstep} {ontenth} /></div>
	</div>
{:else}
	<div class="flex flex-col gap-1 px-4 pt-3">
		{@render track(false)}
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
