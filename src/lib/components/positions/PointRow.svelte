<script lang="ts">
	import type { Snippet } from 'svelte';
	import { watchMedia, type MediaProblem } from '$lib/media';
	import { loadVideoPrefs, saveVideoPrefs } from '$lib/video-prefs';
	import { refreshWhenSettled } from '$lib/sheets/history.svelte';
	import VideoPlayer from '$lib/components/ui/VideoPlayer.svelte';
	import Icon from '$lib/components/ui/Icon.svelte';
	import PointStill from './PointStill.svelte';
	import {
		POINT_PROBLEM,
		playFrom,
		pointLabel,
		pointMeta,
		spotVideoLabel
	} from '$lib/positions/view';
	import type { LinkedSpot } from '$lib/types';

	/**
	 * A point linked to a position, as a row of its Recordings card (beside the
	 * sections' `SectionRow`): a small still at its moment, "Point at 1:12", and
	 * its video ("… · the picture" when it is the position's picture). A tap
	 * opens the full-screen player at the point; a point is a moment, not a
	 * loop. A file that is gone or will not play says so in the row's line and
	 * does not open (`watchMedia` on the still). `trailing` is an editor's Unlink.
	 */
	let {
		spot,
		picture = false,
		focusKey,
		canEdit,
		trailing
	}: {
		spot: LinkedSpot;
		picture?: boolean;
		focusKey: string;
		/** Marking and editing spots in its player: off for a reader of a group's video. */
		canEdit: boolean;
		trailing?: Snippet;
	} = $props();

	let problem = $state<MediaProblem | null>(null);
	let open = $state(false);
	let prefs = $state(loadVideoPrefs());

	const label = $derived(pointLabel(spot.spot.startMs));
	const meta = $derived(
		problem ? POINT_PROBLEM[problem].title : pointMeta(spotVideoLabel(spot.video), picture)
	);
	const from = $derived(spot.video.from);
</script>

{#snippet still()}
	<span
		class="relative h-10 w-[60px] shrink-0 overflow-hidden rounded-[10px] bg-chip"
		aria-hidden="true"
	>
		{#if problem !== 'missing'}
			<PointStill src={spot.video.src} ms={spot.spot.startMs} class="size-full" />
		{/if}
		<span class="theme-media absolute inset-0 grid place-items-center text-white"
			><span class="ml-px flex drop-shadow"><Icon name="play" filled size={16} /></span></span
		>
	</span>
	<span class="min-w-0 py-2">
		<span class="block truncate text-[16px] font-bold">{label}</span>
		<span class="block truncate text-[13px] {problem ? 'font-bold text-status' : 'text-muted'}"
			>{meta}</span
		>
	</span>
{/snippet}

<div class="flex min-h-[60px] items-center pr-1.5 pl-4">
	{#if problem === null}
		<button
			data-focus={focusKey}
			type="button"
			class="flex min-h-[60px] min-w-0 flex-1 cursor-pointer items-center gap-3 text-left"
			aria-label="{playFrom(spot.spot.startMs)}, {spotVideoLabel(spot.video)}"
			onclick={() => {
				prefs = loadVideoPrefs();
				open = true;
			}}>{@render still()}</button
		>
	{:else}
		<div data-focus={focusKey} class="flex min-h-[60px] min-w-0 flex-1 items-center gap-3">
			{@render still()}
		</div>
	{/if}
	{#if trailing}
		{@render trailing()}
	{:else if problem === null}
		<span class="flex size-11 flex-none items-center justify-center text-chevron" aria-hidden="true"
			><Icon name="chevron-right" size={20} /></span
		>
	{/if}
	<!-- Only to learn whether the file is there and plays: never shown. -->
	<video
		src={spot.video.src}
		preload="metadata"
		muted
		class="hidden"
		aria-hidden="true"
		{@attach watchMedia(spot.video.src, (p) => (problem = p))}
	></video>
</div>

{#if open}
	<VideoPlayer
		src={spot.video.src}
		owner={spot.video.owner}
		startAt={spot.spot.startMs / 1000}
		title={from.kind === 'lesson' ? from.title : from.figure}
		subtitle={from.kind === 'lesson' ? 'Lesson video' : 'Recording'}
		linking={canEdit}
		{canEdit}
		mirror={prefs.mirror}
		rate={prefs.rate}
		muted={prefs.muted}
		onchoose={(next) => {
			prefs = { ...prefs, ...next };
			saveVideoPrefs(next);
		}}
		onclose={() => {
			open = false;
			if (canEdit) void refreshWhenSettled();
		}}
	/>
{/if}
