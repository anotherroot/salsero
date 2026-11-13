<!-- src/lib/components/player/RunClip.svelte -->
<script lang="ts">
	import { onDestroy } from 'svelte';
	import Icon from '$lib/components/ui/Icon.svelte';
	import { CLIP } from '$lib/components/ui/styles';
	import { t } from '$lib/i18n/catalog';
	import { claimSound, releaseSound, videoSound } from '$lib/player/video-sound.svelte';
	import { stopsBy } from '$lib/sound/page';
	import type { RunClip } from '$lib/types';

	/*
	 * A video in the player's About (practise-card design). A section or a
	 * recording loops muted while on screen, so the count and the song carry on;
	 * a tap plays it with sound from its start, which pauses the music
	 * (`videoSound`), and it goes back to its muted loop when it ends or another
	 * video takes the sound. A lesson's video is long: it waits for its ▶, plays
	 * with sound, and goes back to its poster. A bare <video>: nothing to edit.
	 */
	interface Props {
		clip: RunClip;
	}

	let { clip }: Props = $props();
	let video: HTMLVideoElement | undefined = $state();
	const long = $derived(clip.kind === 'lesson');
	// Per clip, not per section: two figures in one slot can link the same one.
	const uid = $props.id();
	const key = `clip:${uid}`;
	/** This video has the sound. */
	const loud = $derived(videoSound.key === key);
	/** A lesson video, once its ▶ is tapped. */
	let started = $state(false);

	const startS = $derived(clip.startMs / 1000);
	const endS = $derived(clip.endMs === null ? null : clip.endMs / 1000);

	function toStart() {
		if (video) video.currentTime = startS;
	}

	/** The sound is done with: back to the muted loop. */
	function quiet() {
		releaseSound(key);
		toStart();
	}

	function keepInRange() {
		if (!video || endS === null) return;
		if (video.currentTime >= endS) {
			if (loud) quiet();
			else toStart();
		} else if (video.currentTime < startS - 0.25) toStart();
	}

	function aloud() {
		if (loud) {
			releaseSound(key);
			return;
		}
		claimSound(key);
		if (!video) return;
		video.muted = false;
		toStart();
		void video.play().catch(() => {});
	}

	// Muted unless it has the sound; a lesson video that lost it goes back to its poster.
	$effect(() => {
		if (long) {
			if (!loud && started) started = false;
			return;
		}
		if (video) video.muted = !loud;
	});

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

	onDestroy(() => releaseSound(key));
</script>

<figure class="{CLIP} relative flex-none rounded-2xl bg-black" data-sound={key}>
	{#if long && !started}
		<button
			type="button"
			class="relative block aspect-video w-full cursor-pointer desk:max-h-[70dvh]"
			aria-label={t().player.withSound(clip.caption)}
			onclick={() => {
				started = true;
				claimSound(key);
			}}
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
			onplay={() => claimSound(key)}
			onended={() => releaseSound(key)}
			{@attach stopsBy(() => releaseSound(key))}
		></video>
	{:else}
		<video
			bind:this={video}
			class="block aspect-video w-full object-contain desk:max-h-[70dvh]"
			src={clip.src}
			muted
			data-ambient
			playsinline
			loop={endS === null && !loud}
			preload="metadata"
			onloadedmetadata={toStart}
			ontimeupdate={keepInRange}
			onended={() => {
				if (loud) quiet();
				else toStart();
				void video?.play().catch(() => {});
			}}
			{@attach stopsBy(() => releaseSound(key))}
		></video>
		<button
			type="button"
			class="absolute inset-0 cursor-pointer"
			aria-pressed={loud}
			aria-label={t().player.withSound(clip.caption)}
			onclick={aloud}
		>
			<span
				class="absolute top-2.5 right-2.5 grid size-8 place-items-center rounded-full bg-black/55 text-white"
				><Icon name={loud ? 'volume' : 'volume-off'} size={16} /></span
			>
		</button>
	{/if}
	<figcaption
		class="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-3.5 pt-6 pb-2.5 text-[13px] font-bold text-white"
		class:hidden={long && started}
	>
		{clip.caption}
	</figcaption>
</figure>
