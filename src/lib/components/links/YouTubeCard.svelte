<!-- src/lib/components/links/YouTubeCard.svelte -->
<script lang="ts">
	import { onMount } from 'svelte';
	import { youtubeEmbed, youtubeThumb, youtubeWatch } from '$lib/links';
	import { loadVideoPrefs, saveVideoPrefs } from '$lib/video-prefs';
	import { clock } from '$lib/format';
	import { t } from '$lib/i18n/catalog';
	import Icon from '$lib/components/ui/Icon.svelte';
	import { iconButton } from '$lib/components/ui/styles';

	interface Props {
		id: string;
		start: number | null;
		title: string | null;
		/** The lesson page: a closed card is a 112 x 64 thumbnail beside its title. */
		compact?: boolean;
		/** The embed is open (bindable: the player's About closes it when another video takes the sound). */
		playing?: boolean;
		/** The thumbnail was tapped: the video is about to play, with sound. */
		onplay?: () => void;
	}

	let { id, start, title, compact = false, playing = $bindable(false), onplay }: Props = $props();

	function play() {
		playing = true;
		onplay?.();
	}

	/** The site's name under the title: the same in every language. */
	const HOST = 'youtube.com';

	/*
	 * A thumbnail until tapped. Five iframes on a lesson would load five players
	 * on mobile data before anyone pressed play; one image each costs almost
	 * nothing, and the tap that swaps in the iframe also starts it (autoplay=1).
	 */
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
			aria-label={title === null ? t().links.youtube.playVideo : t().links.youtube.play(title)}
			onclick={play}
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
				<Icon name="youtube" size={16} />{HOST}{start ? t().links.youtube.from(clock(start)) : ''}
			</span>
		</div>
		<a
			href={youtubeWatch(id, start)}
			target="_blank"
			rel="external noopener noreferrer"
			aria-label={t().links.youtube.open}
			class={iconButton('bare', 'muted')}><Icon name="external" size={22} /></a
		>
	</div>
{:else}
	{#if playing}
		<iframe
			src={youtubeEmbed(id, start)}
			title={title ?? t().links.youtube.frame}
			class="aspect-video w-full bg-black desk:max-h-[70dvh]"
			class:mirror
			allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
			allowfullscreen
			referrerpolicy="strict-origin-when-cross-origin"
		></iframe>
	{:else}
		<button
			type="button"
			class="relative block aspect-video w-full cursor-pointer bg-black desk:max-h-[70dvh]"
			aria-label={title === null ? t().links.youtube.playVideo : t().links.youtube.play(title)}
			onclick={play}
		>
			<img
				src={youtubeThumb(id)}
				alt=""
				loading="lazy"
				class="size-full object-cover desk:object-contain"
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
				<Icon name="youtube" size={15} />{HOST}{start ? t().links.youtube.from(clock(start)) : ''}
			</span>
		</div>
		<button
			type="button"
			aria-pressed={mirror}
			aria-label={t().video.mirror}
			onclick={toggleMirror}
			class={mirror ? iconButton('tonal') : iconButton('bare', 'muted')}
			><Icon name="mirror" size={22} /></button
		>
		<!-- Always offered: the work PC's browser may block the embed outright. -->
		<a
			href={youtubeWatch(id, start)}
			target="_blank"
			rel="external noopener noreferrer"
			aria-label={t().links.youtube.open}
			class={iconButton('bare', 'muted')}><Icon name="external" size={22} /></a
		>
	</div>
{/if}

<style>
	/* The embed's own controls mirror with it — the accepted cost of doing this from outside. */
	.mirror {
		transform: scaleX(-1);
	}
</style>
