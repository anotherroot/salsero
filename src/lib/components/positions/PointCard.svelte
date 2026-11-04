<script lang="ts">
	import type { Snippet } from 'svelte';
	import Icon from '$lib/components/ui/Icon.svelte';
	import VideoProblem from '$lib/components/ui/VideoProblem.svelte';
	import { CLIP } from '$lib/components/ui/styles';
	import { watchMedia, type MediaProblem } from '$lib/media';
	import {
		PAUSE,
		POINT_PROBLEM,
		playFrom,
		pointLabel,
		pointMeta,
		spotVideoLabel
	} from '$lib/positions/view';
	import type { LinkedSpot } from '$lib/types';

	/**
	 * A point linked to a position, as one card: its still, "Point at 1:12",
	 * and its video ("… · the picture" when it is the position's picture). A
	 * tap plays it inline from the moment, sound on, and carries on (a point is
	 * a moment, not a loop); another tap pauses. A file that is gone or will
	 * not play says so in place of the still, as a recording's card does
	 * (`watchMedia`). `action` sits at the end of the caption (an editor's unlink).
	 */
	let {
		spot,
		picture = false,
		focusKey,
		action
	}: { spot: LinkedSpot; picture?: boolean; focusKey?: string; action?: Snippet } = $props();

	let video: HTMLVideoElement | undefined = $state();
	/** The first tap seeks to the point; after that, play and pause go on from where it is. */
	let started = $state(false);
	let paused = $state(true);
	let problem = $state<MediaProblem | null>(null);

	// The frame at the point, which the browser draws from the file's metadata.
	const at = $derived(`${spot.video.src}#t=${(spot.spot.startMs / 1000).toFixed(3)}`);
	const meta = $derived(pointMeta(spotVideoLabel(spot.video), picture));

	function toggle() {
		if (!video) return;
		if (!started) {
			video.currentTime = spot.spot.startMs / 1000;
			started = true;
		}
		// A refused play (autoplay policy, a source gone) leaves the disc showing.
		if (video.paused) video.play().catch(() => {});
		else video.pause();
	}
</script>

<div class="{CLIP} rounded-2xl bg-surface">
	{#if problem}
		<VideoProblem
			title={POINT_PROBLEM[problem].title}
			body={POINT_PROBLEM[problem].body}
			{meta}
			action={action ? actionSlot : undefined}
		/>
	{:else}
		<div class="relative">
			<video
				bind:this={video}
				src={at}
				preload="metadata"
				muted={!started}
				playsinline
				disableremoteplayback
				tabindex="-1"
				aria-hidden="true"
				bind:paused
				class="block h-[180px] w-full bg-chip object-cover"
				{@attach watchMedia(spot.video.src, (p) => (problem = p))}
			></video>
			<button
				type="button"
				data-focus={focusKey}
				aria-label={paused ? playFrom(spot.spot.startMs) : PAUSE}
				onclick={toggle}
				class="theme-media absolute inset-0 grid cursor-pointer place-items-center"
			>
				{#if paused}
					<span
						aria-hidden="true"
						class="grid size-12 place-items-center rounded-full bg-black/55 text-white shadow-[inset_0_0_0_1.5px_rgb(255_255_255/0.35)]"
						><span class="ml-[3px] flex"><Icon name="play" filled size={24} /></span></span
					>
				{/if}
			</button>
		</div>
		<div class="flex min-h-[60px] items-center gap-2.5 py-2 pr-1.5 pl-4">
			<span class="flex min-w-0 flex-1 flex-col gap-0.5">
				<span class="text-[16px] leading-tight font-bold text-ink"
					>{pointLabel(spot.spot.startMs)}</span
				>
				<span class="text-[13px] text-muted">{meta}</span>
			</span>
			{@render actionSlot()}
		</div>
	{/if}
</div>

{#snippet actionSlot()}{@render action?.()}{/snippet}
