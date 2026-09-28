<!-- src/lib/components/ui/VideoFrame.svelte -->
<script lang="ts">
	import { onMount } from 'svelte';
	import { watchMedia, type MediaProblem } from '$lib/media';
	import { VIDEO_RATES, loadVideoPrefs, saveVideoPrefs, type VideoRate } from '$lib/video-prefs';

	interface Props {
		src: string;
		kind?: 'video' | 'audio';
		onproblem: (problem: MediaProblem) => void;
	}

	let { src, kind = 'video', onproblem }: Props = $props();

	// Defaults on the server and the first client render, then the stored
	// choice on mount: reading localStorage during SSR is impossible, and
	// reading it before hydration would render a different page than the
	// server sent.
	let mirror = $state(false);
	let rate = $state<VideoRate>(1);
	onMount(() => {
		({ mirror, rate } = loadVideoPrefs());
	});

	function choose(next: { mirror?: boolean; rate?: VideoRate }) {
		mirror = next.mirror ?? mirror;
		rate = next.rate ?? rate;
		saveVideoPrefs({ mirror, rate });
	}

	/** A slowed teacher should sound slowed, not like a cartoon. */
	const keepPitch = (el: HTMLMediaElement) => {
		el.preservesPitch = true;
	};
</script>

{#if kind === 'video'}
	<!-- svelte-ignore a11y_media_has_caption -->
	<video
		{src}
		controls
		playsinline
		preload="metadata"
		class="aspect-video w-full bg-black"
		class:mirror
		bind:playbackRate={rate}
		{@attach watchMedia(src, onproblem)}
		{@attach keepPitch}
	></video>
{:else}
	<audio
		{src}
		controls
		preload="metadata"
		class="w-full p-2"
		bind:playbackRate={rate}
		{@attach watchMedia(src, onproblem)}
		{@attach keepPitch}
	></audio>
{/if}
<div class="flex items-center gap-2 px-3 pt-2 text-[12px]">
	{#if kind === 'video'}
		<button
			type="button"
			aria-pressed={mirror}
			onclick={() => choose({ mirror: !mirror })}
			class="h-8 rounded-lg border px-2.5 {mirror
				? 'border-accent text-accent'
				: 'border-rule text-ink-2'}">Mirror</button
		>
	{/if}
	<span class="ml-auto flex gap-1" role="group" aria-label="Speed">
		{#each VIDEO_RATES as r (r)}
			<button
				type="button"
				aria-pressed={rate === r}
				onclick={() => choose({ rate: r })}
				class="h-8 min-w-11 rounded-lg border px-2 {rate === r
					? 'border-accent bg-accent text-accent-ink'
					: 'border-rule text-ink-2'}">{r}×</button
			>
		{/each}
	</span>
</div>

<style>
	/* Learn it facing the teacher, as in a studio mirror. */
	.mirror {
		transform: scaleX(-1);
	}
</style>
