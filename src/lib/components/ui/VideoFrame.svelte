<!-- src/lib/components/ui/VideoFrame.svelte -->
<script lang="ts">
	import { onMount, type Snippet } from 'svelte';
	import { watchMedia, type MediaProblem } from '$lib/media';
	import {
		RATE_LABEL,
		VIDEO_RATES,
		loadVideoPrefs,
		saveVideoPrefs,
		type VideoRate
	} from '$lib/video-prefs';
	import VideoPlayer from './VideoPlayer.svelte';
	import Icon from './Icon.svelte';
	import { iconButton } from './styles';
	import type { SpotOwner } from '$lib/types';

	interface Props {
		src: string;
		kind?: 'video' | 'audio';
		/** The recording or lesson video this is, for full screen and its spots. */
		owner?: SpotOwner;
		onproblem: (problem: MediaProblem) => void;
		/** Where a saved YouTube video came from, shown as a link under the controls. */
		sourceUrl?: string | null;
		/** What the full-screen player's top bar names: the figure or lesson. */
		title?: string;
		/** After the full-screen player closes — a page whose lists show its spots refreshes. */
		onclosed?: () => void;
		/** The full-screen player may link sections: only where the page manages them. */
		linking?: boolean;
		/** A title and a line under the picture; Full screen then sits beside it. */
		caption?: { title: string; meta?: string };
		/** At the right of the caption row in place of Full screen (which then joins the control row). */
		action?: Snippet;
	}

	let {
		src,
		kind = 'video',
		owner,
		onproblem,
		sourceUrl = null,
		title = 'Video',
		onclosed,
		linking = false,
		caption,
		action
	}: Props = $props();

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

	let inline: HTMLVideoElement | undefined = $state();
	let fullAt = $state<number | null>(null);

	function openFull() {
		if (!inline) return;
		inline.pause();
		fullAt = inline.currentTime;
	}
</script>

{#if kind === 'video'}
	<!-- svelte-ignore a11y_media_has_caption -->
	<video
		bind:this={inline}
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
{#snippet fullScreen()}
	<button
		type="button"
		onclick={openFull}
		aria-label="Full screen"
		class={iconButton('bare', 'muted')}><Icon name="expand" size={22} /></button
	>
{/snippet}
{#if caption}
	<div class="flex items-center gap-1 py-1.5 pr-1.5 pl-3.5">
		<div class="flex min-w-0 flex-1 flex-col gap-px">
			<span class="truncate text-[15px] font-bold">{caption.title}</span>
			{#if caption.meta}<span class="text-[12px] text-muted">{caption.meta}</span>{/if}
		</div>
		{#if action}{@render action()}{:else if owner && kind === 'video'}{@render fullScreen()}{/if}
	</div>
{/if}
<div class="flex items-center gap-2 pr-3 pb-2.5 pl-2">
	{#if kind === 'video'}
		<button
			type="button"
			aria-pressed={mirror}
			aria-label="Mirror"
			onclick={() => choose({ mirror: !mirror })}
			class={mirror ? iconButton('tonal') : iconButton('bare', 'muted')}
			><Icon name="mirror" size={22} /></button
		>
		<span class="text-[13px] font-bold text-muted">Mirror</span>
		{#if owner && (!caption || action)}{@render fullScreen()}{/if}
	{/if}
	<span class="flex-1"></span>
	<span class="flex h-9 items-center rounded-full bg-chip px-px" role="group" aria-label="Speed">
		{#each VIDEO_RATES as r (r)}
			<button
				type="button"
				aria-pressed={rate === r}
				aria-label="Speed {r}×"
				onclick={() => choose({ rate: r })}
				class="flex h-11 w-10 cursor-pointer items-center justify-center"
			>
				<span
					class="flex h-[30px] w-9 items-center justify-center rounded-full text-[13px] {rate === r
						? 'bg-surface font-extrabold text-ink shadow-[0_1px_3px_rgba(0,0,0,0.14)]'
						: 'font-bold text-ink-2'}">{RATE_LABEL[r]}</span
				>
			</button>
		{/each}
	</span>
</div>
{#if sourceUrl}
	<a
		href={sourceUrl}
		target="_blank"
		rel="external noopener noreferrer"
		class="block px-3.5 pb-2.5 text-[12px] text-muted">from YouTube ↗</a
	>
{/if}

{#if kind === 'video' && owner && fullAt !== null}
	<VideoPlayer
		{src}
		{owner}
		startAt={fullAt}
		{title}
		{linking}
		subtitle={'recordingId' in owner ? 'Recording' : 'Lesson video'}
		{mirror}
		{rate}
		onchoose={choose}
		onclose={(at) => {
			if (inline) inline.currentTime = at;
			fullAt = null;
			onclosed?.();
		}}
	/>
{/if}

<style>
	/* Learn it facing the teacher, as in a studio mirror. */
	.mirror {
		transform: scaleX(-1);
	}
</style>
