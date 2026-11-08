<!-- src/lib/components/ui/SectionPlayer.svelte -->
<script lang="ts">
	import { t } from '$lib/i18n/catalog';
	import { loadVideoPrefs, saveVideoPrefs } from '$lib/video-prefs';
	import VideoPlayer from './VideoPlayer.svelte';
	import type { SectionVideo, Spot, SpotOwner } from '$lib/types';

	/**
	 * The full-screen player opened straight on a section's view, looping it —
	 * for anything that shows a section without its own inline video. Mounted on
	 * a tap, so the stored mirror, speed and mute can be read at once: there is no
	 * server render of it to match.
	 */
	let {
		src,
		owner,
		spot,
		from,
		linking = false,
		canEdit = true,
		simple = false,
		onclose
	}: {
		src: string;
		owner: SpotOwner;
		spot: Spot;
		/** Where the video is from, for the top bar. */
		from?: SectionVideo['from'];
		/** The player may link sections: only where the page manages them. */
		linking?: boolean;
		/** Marking and editing spots: off for a reader of a group's video. */
		canEdit?: boolean;
		/** The simple player: the section loops with repeat lit, and nothing to mark or edit. */
		simple?: boolean;
		onclose: () => void;
	} = $props();

	let prefs = $state(loadVideoPrefs());
</script>

<VideoPlayer
	{src}
	{owner}
	startAt={spot.startMs / 1000}
	loopSpot={spot}
	{linking}
	{canEdit}
	{simple}
	mirror={prefs.mirror}
	rate={prefs.rate}
	muted={prefs.muted}
	repeat={prefs.repeat}
	title={from ? (from.kind === 'lesson' ? from.title : from.figure) : t().video.untitled}
	subtitle={from ? (from.kind === 'lesson' ? t().video.lessonVideo : t().video.recording) : ''}
	onchoose={(next) => {
		prefs = { ...prefs, ...next };
		saveVideoPrefs(next);
	}}
	{onclose}
/>
