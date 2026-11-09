<!-- src/lib/components/player/RunClip.svelte -->
<script lang="ts">
	import Icon from '$lib/components/ui/Icon.svelte';
	import { CLIP } from '$lib/components/ui/styles';
	import { t } from '$lib/i18n/catalog';
	import type { RunClip } from '$lib/types';

	/*
	 * A video in the player's About (one-player design). A section or a
	 * recording plays muted, so the count and the song carry on, looping its
	 * range (or the whole recording), only while it is on screen. A lesson's
	 * video is long and has its own sound: it waits for its ▶. A bare <video>:
	 * nothing to edit from here.
	 */
	interface Props {
		clip: RunClip;
	}

	let { clip }: Props = $props();
	let video: HTMLVideoElement | undefined = $state();
	const long = $derived(clip.kind === 'lesson');
	/** A lesson video, once its ▶ is tapped. */
	let started = $state(false);

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
		if (!v || long || typeof IntersectionObserver === 'undefined') return;
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
	{#if long && !started}
		<button
			type="button"
			class="relative block aspect-video w-full cursor-pointer desk:max-h-[70dvh]"
			aria-label={t().links.youtube.playVideo}
			onclick={() => (started = true)}
		>
			<span class="absolute inset-0 grid place-items-center">
				<span class="grid size-[52px] place-items-center rounded-full bg-white/90 text-black"
					><Icon name="play" size={24} filled /></span
				>
			</span>
		</button>
	{:else if long}
		<!-- svelte-ignore a11y_media_has_caption -->
		<video
			bind:this={video}
			class="block aspect-video w-full object-contain desk:max-h-[70dvh]"
			src={clip.src}
			controls
			autoplay
			playsinline
			preload="metadata"
		></video>
	{:else}
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
	{/if}
	<figcaption
		class="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-3.5 pt-6 pb-2.5 text-[13px] font-bold text-white"
		class:hidden={long && started}
	>
		{clip.caption}
	</figcaption>
</figure>
