<!-- src/lib/components/player/RunClip.svelte -->
<script lang="ts">
	import { CLIP } from '$lib/components/ui/styles';
	import type { RunClip } from '$lib/types';

	/*
	 * A video in the player's About (one-player design): muted, so the count and
	 * the song carry on, looping its section's range (or the whole recording),
	 * playing only while it is on screen. A bare <video>: no controls, no spots,
	 * nothing to edit from here.
	 */
	interface Props {
		clip: RunClip;
	}

	let { clip }: Props = $props();
	let video: HTMLVideoElement | undefined = $state();

	const startS = $derived(clip.startMs / 1000);
	const endS = $derived(clip.endMs === null ? null : clip.endMs / 1000);

	function toStart() {
		if (video) video.currentTime = startS;
	}

	function keepInRange() {
		if (!video || endS === null) return;
		if (video.currentTime >= endS || video.currentTime < startS - 0.25) toStart();
	}

	$effect(() => {
		const v = video;
		if (!v || typeof IntersectionObserver === 'undefined') return;
		const seen = new IntersectionObserver(
			([entry]) => {
				if (entry?.isIntersecting) void v.play().catch(() => {});
				else v.pause();
			},
			{ threshold: 0.5 }
		);
		seen.observe(v);
		return () => seen.disconnect();
	});
</script>

<figure class="{CLIP} relative flex-none rounded-2xl bg-black">
	<video
		bind:this={video}
		class="block aspect-video w-full object-contain desk:max-h-[70dvh]"
		src={clip.src}
		muted
		playsinline
		loop={endS === null}
		preload="metadata"
		onloadedmetadata={toStart}
		ontimeupdate={keepInRange}
		onended={() => {
			toStart();
			void video?.play().catch(() => {});
		}}
	></video>
	<figcaption
		class="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-3.5 pt-6 pb-2.5 text-[13px] font-bold text-white"
	>
		{clip.caption}
	</figcaption>
</figure>
