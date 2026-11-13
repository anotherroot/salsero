<script lang="ts">
	/**
	 * The preview sheet's video (picker preview): the figure's section, muted,
	 * looping from its start to its end. It is an ordinary small video in one
	 * sound at a time: opening it stops what plays (`quietWhile`), and closing it
	 * plays again the plain videos it stopped. The sound button only unmutes.
	 * When it cannot play here (offline and not kept, a phone-only original on
	 * another phone, a file gone) the loop's clip plays in its place (a muted
	 * background loop, kept on the phone), else its still; with no picture
	 * either, "No video yet". Adapted from `suggestions/SectionPreview`.
	 */
	import { onMount } from 'svelte';
	import { t } from '$lib/i18n/catalog';
	import Icon from '$lib/components/ui/Icon.svelte';
	import { CLIP } from '$lib/components/ui/styles';
	import { quietWhile } from '$lib/sound/page';
	import type { Picture } from '$lib/types';

	interface Props {
		src: string;
		startMs: number;
		endMs: number;
		/** The row's picture: what moves when the video cannot play. */
		picture: Picture;
	}

	let { src, startMs, endMs, picture }: Props = $props();

	let video = $state<HTMLVideoElement | null>(null);
	let muted = $state(true);
	let failed = $state(false);
	/** The fallback's clip, then its still, would not load. */
	let fallback = $state<'clip' | 'still' | 'none'>('clip');
	const seconds = $derived(Math.max(1, Math.round((endMs - startMs) / 1000)));

	onMount(() => {
		const el = video;
		if (!el) return;
		const resume = quietWhile(el);
		void el.play().catch(() => {});
		return () => {
			el.pause();
			resume();
		};
	});

	/** Back to the start once past the end (or before the start, after a seek). */
	function loop() {
		if (!video) return;
		const t = video.currentTime;
		if (t >= endMs / 1000 || t < startMs / 1000 - 0.5) video.currentTime = startMs / 1000;
	}
</script>

<div class="{CLIP} relative aspect-video w-full rounded-2xl bg-black desk:max-h-[70dvh]">
	{#if !failed}
		<video
			bind:this={video}
			src="{src}#t={startMs / 1000}"
			{muted}
			playsinline
			preload="auto"
			class="block size-full object-contain"
			ontimeupdate={loop}
			onloadedmetadata={() => {
				if (video) video.currentTime = startMs / 1000;
			}}
			onerror={() => (failed = true)}
		></video>
		<button
			type="button"
			class="absolute top-2 right-2 flex size-9 cursor-pointer items-center justify-center rounded-full bg-black/55 text-white"
			aria-label={muted ? t().picker.look.soundOn : t().picker.look.soundOff}
			aria-pressed={!muted}
			onclick={() => (muted = !muted)}
			><Icon name={muted ? 'volume-off' : 'volume'} size={20} /></button
		>
		<span
			class="pointer-events-none absolute bottom-2 left-2.5 rounded-full bg-black/55 px-2 py-0.5 text-[12px] font-bold text-white tabular-nums"
			>{t().video.secs(seconds)}</span
		>
	{:else if picture && fallback === 'clip'}
		<video
			src={picture.clip}
			poster={picture.still}
			muted
			loop
			playsinline
			autoplay
			data-ambient
			class="block size-full object-contain"
			onerror={() => (fallback = 'still')}
		></video>
	{:else if picture && fallback === 'still'}
		<img
			src={picture.still}
			alt=""
			class="block size-full object-contain"
			onerror={() => (fallback = 'none')}
		/>
	{:else}
		<div
			class="flex size-full flex-col items-center justify-center gap-2 bg-accent-soft text-[15px] font-bold text-accent-text"
		>
			<Icon name="video" size={28} />{t().picker.look.noVideo}
		</div>
	{/if}
</div>
