<script lang="ts">
	import type { Snippet } from 'svelte';
	import PointStill from './PointStill.svelte';
	import { CLIP } from '$lib/components/ui/styles';
	import { pointLabel, pointMeta, spotVideoLabel } from '$lib/positions/view';
	import type { LinkedSpot } from '$lib/types';

	/**
	 * A point linked to a position, as one card: its still, "Point at 1:12",
	 * and its video ("… · the picture" when it is the position's picture).
	 * `action` sits at the end of the caption (an editor's unlink).
	 */
	let {
		spot,
		picture = false,
		action
	}: { spot: LinkedSpot; picture?: boolean; action?: Snippet } = $props();
</script>

<div class="{CLIP} rounded-2xl bg-surface">
	<PointStill src={spot.video.src} ms={spot.spot.startMs} />
	<div class="flex min-h-[60px] items-center gap-2.5 py-2 pr-1.5 pl-4">
		<span class="flex min-w-0 flex-1 flex-col gap-0.5">
			<span class="text-[16px] leading-tight font-bold text-ink"
				>{pointLabel(spot.spot.startMs)}</span
			>
			<span class="text-[13px] text-muted">{pointMeta(spotVideoLabel(spot.video), picture)}</span>
		</span>
		{@render action?.()}
	</div>
</div>
