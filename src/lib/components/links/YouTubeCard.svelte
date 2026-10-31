<!-- src/lib/components/links/YouTubeCard.svelte -->
<script lang="ts">
	import { onMount } from 'svelte';
	import { youtubeEmbed, youtubeThumb, youtubeWatch } from '$lib/links';
	import { loadVideoPrefs, saveVideoPrefs } from '$lib/video-prefs';
	import { clock } from '$lib/format';
	import Icon from '$lib/components/ui/Icon.svelte';
	import { iconButton } from '$lib/components/ui/styles';

	interface Props {
		id: string;
		start: number | null;
		title: string | null;
		/** The lesson page: a closed card is a 112 x 64 thumbnail beside its title. */
		compact?: boolean;
	}

	let { id, start, title, compact = false }: Props = $props();

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
		saveVideoPrefs({ mirror });
	}
</script>

{#if compact && !playing}
	<div class="flex items-center gap-3 pt-3 pr-1.5 pb-2.5 pl-3">
		<button
			type="button"
			class="relative block h-16 w-28 flex-none cursor-pointer overflow-hidden rounded-xl bg-black"
			aria-label="Play {title ?? 'the video'}"
			onclick={() => (playing = true)}
		>
			<img src={youtubeThumb(id)} alt="" loading="lazy" class="size-full object-cover" />
			<span class="absolute inset-0 grid place-items-center">
				<span class="grid size-8 place-items-center rounded-full bg-black/70 text-white"
					><Icon name="play" size={16} filled /></span
				>
			</span>
		</button>
		<div class="flex min-w-0 flex-1 flex-col gap-0.5">
			<span class="text-[16px] leading-[1.3] font-bold">{title ?? 'YouTube'}</span>
			<span class="flex items-center gap-[5px] text-[13px] text-muted">
				<Icon name="youtube" size={16} />youtube.com{start ? ` · from ${clock(start)}` : ''}
			</span>
		</div>
		<a
			href={youtubeWatch(id, start)}
			target="_blank"
			rel="external noopener noreferrer"
			aria-label="Open on YouTube"
			class="{iconButton('bare')} text-muted"><Icon name="external" size={22} /></a
		>
	</div>
{:else}
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
			class="relative block aspect-video w-full cursor-pointer bg-black"
			aria-label="Play {title ?? 'the video'}"
			onclick={() => (playing = true)}
		>
			<img
				src={youtubeThumb(id)}
				alt=""
				loading="lazy"
				class="size-full object-cover"
				class:mirror
			/>
			<span class="absolute inset-0 grid place-items-center">
				<span class="grid size-[52px] place-items-center rounded-full bg-black/70 text-white"
					><Icon name="play" size={24} filled /></span
				>
			</span>
		</button>
	{/if}
	<div class="flex items-center gap-1 py-2 pr-1.5 pl-3.5">
		<div class="flex min-w-0 flex-1 flex-col gap-0.5">
			<span class="text-[15px] leading-snug font-bold">{title ?? 'YouTube'}</span>
			<span class="flex items-center gap-[5px] text-[12px] text-muted">
				<Icon name="youtube" size={15} />youtube.com{start ? ` · from ${clock(start)}` : ''}
			</span>
		</div>
		<button
			type="button"
			aria-pressed={mirror}
			aria-label="Mirror"
			onclick={toggleMirror}
			class="{iconButton('bare')} {mirror ? 'bg-accent-soft text-accent-text' : 'text-muted'}"
			><Icon name="mirror" size={22} /></button
		>
		<!-- Always offered: the work PC's browser may block the embed outright. -->
		<a
			href={youtubeWatch(id, start)}
			target="_blank"
			rel="external noopener noreferrer"
			aria-label="Open on YouTube"
			class="{iconButton('bare')} text-muted"><Icon name="external" size={22} /></a
		>
	</div>
{/if}

<style>
	/* The embed's own controls mirror with it — the accepted cost of doing this from outside. */
	.mirror {
		transform: scaleX(-1);
	}
</style>
