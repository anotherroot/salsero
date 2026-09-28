<!-- src/lib/components/links/YouTubeCard.svelte -->
<script lang="ts">
	import { onMount } from 'svelte';
	import { youtubeEmbed, youtubeThumb, youtubeWatch } from '$lib/links';
	import { loadVideoPrefs, saveVideoPrefs } from '$lib/video-prefs';

	interface Props {
		id: string;
		start: number | null;
		title: string | null;
	}

	let { id, start, title }: Props = $props();

	/*
	 * A thumbnail until tapped. Five iframes on a lesson would load five players
	 * on mobile data before anyone pressed play; one image each costs almost
	 * nothing, and the tap that swaps in the iframe also starts it (autoplay=1).
	 */
	let playing = $state(false);
	let mirror = $state(false);
	onMount(() => {
		mirror = loadVideoPrefs().mirror;
	});

	function toggleMirror() {
		mirror = !mirror;
		saveVideoPrefs({ ...loadVideoPrefs(), mirror });
	}
</script>

{#if playing}
	<iframe
		src={youtubeEmbed(id, start)}
		title={title ?? 'YouTube video'}
		class="aspect-video w-full bg-black"
		class:mirror
		allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
		allowfullscreen
		referrerpolicy="strict-origin-when-cross-origin"
	></iframe>
{:else}
	<button
		type="button"
		class="relative block aspect-video w-full bg-black"
		aria-label="Play {title ?? 'the video'}"
		onclick={() => (playing = true)}
	>
		<img src={youtubeThumb(id)} alt="" loading="lazy" class="size-full object-cover" class:mirror />
		<span class="absolute inset-0 grid place-items-center">
			<span class="grid size-14 place-items-center rounded-full bg-black/70 text-[22px] text-white"
				>▶</span
			>
		</span>
	</button>
{/if}
<div class="flex items-center gap-2 px-3 py-2 text-[12px]">
	<span class="min-w-0 flex-1 truncate text-ink-2">{title ?? 'YouTube'}</span>
	<button
		type="button"
		aria-pressed={mirror}
		onclick={toggleMirror}
		class="h-8 rounded-lg border px-2.5 {mirror
			? 'border-accent text-accent'
			: 'border-rule text-ink-2'}">Mirror</button
	>
	<!-- Always offered: the work PC's browser may block the embed outright. -->
	<a
		href={youtubeWatch(id, start)}
		target="_blank"
		rel="external noopener noreferrer"
		class="text-accent">Open on YouTube ↗</a
	>
</div>

<style>
	/* The embed's own controls mirror with it — the accepted cost of doing this from outside. */
	.mirror {
		transform: scaleX(-1);
	}
</style>
