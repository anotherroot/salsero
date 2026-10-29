<!-- src/lib/components/ui/SectionPlayer.svelte -->
<script lang="ts">
	import { loadVideoPrefs, saveVideoPrefs } from '$lib/video-prefs';
	import VideoPlayer from './VideoPlayer.svelte';
	import type { SectionVideo, Spot, SpotOwner } from '$lib/types';

	/**
	 * The full-screen player opened straight on a section's view, looping it —
	 * for anything that shows a section without its own inline video. Mounted on
	 * a tap, so the stored mirror and speed can be read at once: there is no
	 * server render of it to match.
	 */
	let {
		src,
		owner,
		spot,
		from,
		onclose
	}: {
		src: string;
		owner: SpotOwner;
		spot: Spot;
		/** Where the video is from, for the top bar. */
		from?: SectionVideo['from'];
		onclose: () => void;
	} = $props();

	let prefs = $state(loadVideoPrefs());
</script>

<VideoPlayer
	{src}
	{owner}
	startAt={spot.startMs / 1000}
	loopSpot={spot}
	mirror={prefs.mirror}
	rate={prefs.rate}
	title={from ? (from.kind === 'lesson' ? from.title : from.figure) : 'Video'}
	subtitle={from ? (from.kind === 'lesson' ? 'Lesson video' : 'Recording') : ''}
	onchoose={(next) => {
		prefs = { ...prefs, mirror: next.mirror ?? prefs.mirror, rate: next.rate ?? prefs.rate };
		saveVideoPrefs({ mirror: prefs.mirror, rate: prefs.rate });
	}}
	{onclose}
/>
