<script lang="ts">
	import Icon from '$lib/components/ui/Icon.svelte';
	import { CLIP } from '$lib/components/ui/styles';
	import { t } from '$lib/i18n/catalog';

	/**
	 * A suggested section, played in a loop before it exists: the video from its
	 * start to its end, again and again, the stretch drawn dashed on the bar.
	 */
	let { src, startMs, endMs }: { src: string; startMs: number; endMs: number } = $props();

	let video = $state<HTMLVideoElement | null>(null);
	let playing = $state(false);
	let duration = $state(0);

	function toggle() {
		if (!video) return;
		if (playing) return video.pause();
		if (video.currentTime < startMs / 1000 || video.currentTime >= endMs / 1000)
			video.currentTime = startMs / 1000;
		void video.play();
	}
	function loop() {
		if (video && video.currentTime >= endMs / 1000) video.currentTime = startMs / 1000;
	}
	const pct = (ms: number) => (duration ? Math.min(100, (ms / 1000 / duration) * 100) : 0);
</script>

<div class="{CLIP} relative rounded-xl bg-black">
	<!-- svelte-ignore a11y_media_has_caption -->
	<video
		bind:this={video}
		{src}
		preload="metadata"
		playsinline
		class="block aspect-video w-full desk:max-h-[70dvh]"
		onplay={() => (playing = true)}
		onpause={() => (playing = false)}
		ontimeupdate={loop}
		onloadedmetadata={() => {
			duration = video?.duration ?? 0;
			if (video) video.currentTime = startMs / 1000;
		}}
	></video>
	<button
		type="button"
		class="absolute inset-0 flex items-center justify-center"
		aria-label={t().suggestions.playSection}
		onclick={toggle}
	>
		{#if !playing}
			<span class="flex size-12 items-center justify-center rounded-full bg-surface text-ink">
				<Icon name="play" size={22} />
			</span>
		{/if}
	</button>
	<div class="pointer-events-none absolute inset-x-3 bottom-3 h-1 rounded-full bg-white/35">
		<span
			class="absolute -top-1.5 h-4 rounded border-2 border-dashed border-white bg-white/25"
			style:left="{pct(startMs)}%"
			style:width="{Math.max(2, pct(endMs) - pct(startMs))}%"
		></span>
	</div>
</div>
