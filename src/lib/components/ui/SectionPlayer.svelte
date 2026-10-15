<!-- src/lib/components/ui/SectionPlayer.svelte -->
<script lang="ts">
	import { loadVideoPrefs, saveVideoPrefs } from '$lib/video-prefs';
	import VideoPlayer from './VideoPlayer.svelte';
	import type { Spot, SpotOwner } from '$lib/types';

	/**
	 * The full-screen player opened straight on a section, looping it — for
	 * anything that shows a section without its own inline video. Mounted on a
	 * tap, so the stored mirror and speed can be read at once: there is no
	 * server render of it to match.
	 */
	let {
		src,
		owner,
		spot,
		onclose
	}: { src: string; owner: SpotOwner; spot: Spot; onclose: () => void } = $props();

	let prefs = $state(loadVideoPrefs());
</script>

<VideoPlayer
	{src}
	{owner}
	startAt={spot.startMs / 1000}
	loopSpot={spot}
	mirror={prefs.mirror}
	rate={prefs.rate}
	onchoose={(next) => {
		prefs = { mirror: next.mirror ?? prefs.mirror, rate: next.rate ?? prefs.rate };
		saveVideoPrefs(prefs);
	}}
	{onclose}
/>
