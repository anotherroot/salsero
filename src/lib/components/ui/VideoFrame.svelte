<!-- src/lib/components/ui/VideoFrame.svelte -->
<script lang="ts">
	import { onMount, untrack, type Snippet } from 'svelte';
	import { watchMedia, type MediaProblem } from '$lib/media';
	import {
		RATE_LABEL,
		VIDEO_RATES,
		loadVideoPrefs,
		saveVideoPrefs,
		type VideoRate
	} from '$lib/video-prefs';
	import { inlineBands, inlineParts, lengthText, timeText } from '$lib/video/inline';
	import { buffering } from '$lib/video/chrome';
	import { fetchSpots } from '$lib/video/spots-api';
	import { ON_VIDEO } from '$lib/components/video/styles';
	import Timeline from '$lib/components/video/Timeline.svelte';
	import VideoPlayer from './VideoPlayer.svelte';
	import Icon from './Icon.svelte';
	import Spinner from './Spinner.svelte';
	import { CLIP, iconButton } from './styles';
	import type { Spot, SpotOwner } from '$lib/types';

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
		/** The page's own list of this video's sections: when it changes (a section edited from the list), the bar fetches its bands again. */
		sections?: unknown;
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
		action,
		sections
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

	// Our controls on the picture (`$lib/video/inline`): the browser's are off.
	let played = $state(false);
	let paused = $state(true);
	let currentTime = $state(0);
	let duration = $state(NaN);
	let waiting = $state(false);
	let spots = $state<Spot[]>([]);
	const parts = $derived(inlineParts({ played, paused, waiting }));
	const length = $derived(lengthText(duration));

	/** The sections as bands. Fetched on the first play, so a page scrolled past asks nothing; a failure leaves the bar bare. */
	function loadSpots() {
		if (!owner) return;
		fetchSpots(owner)
			.then((s) => (spots = s))
			.catch(() => {});
	}

	// A page refresh after a section changed elsewhere (the section list's own player) brings a new list.
	$effect(() => {
		void sections;
		if (untrack(() => played)) untrack(loadSpots);
	});

	function toggle() {
		if (!inline) return;
		// A refused play (autoplay policy, a source gone) leaves the disc showing.
		if (inline.paused) inline.play().catch(() => {});
		else inline.pause();
	}

	function openFull() {
		if (!inline) return;
		inline.pause();
		fullAt = inline.currentTime;
	}
</script>

{#if kind === 'video'}
	<div class="{CLIP} relative aspect-video w-full bg-black">
		<!-- svelte-ignore a11y_media_has_caption -->
		<video
			bind:this={inline}
			{src}
			playsinline
			disableremoteplayback
			preload="metadata"
			class="absolute inset-0 size-full"
			class:mirror
			bind:playbackRate={rate}
			bind:paused
			bind:currentTime
			bind:duration
			onplay={() => {
				if (!played) loadSpots();
				played = true;
			}}
			onwaiting={() => (waiting = buffering(waiting, 'waiting'))}
			onplaying={() => (waiting = buffering(waiting, 'playing'))}
			oncanplay={() => (waiting = buffering(waiting, 'canplay'))}
			onseeked={() => (waiting = buffering(waiting, 'seeked'))}
			onpause={() => (waiting = buffering(waiting, 'pause'))}
			onerror={() => (waiting = buffering(waiting, 'error'))}
			onemptied={() => (waiting = buffering(waiting, 'emptied'))}
			{@attach watchMedia(src, onproblem)}
			{@attach keepPitch}
		></video>
		<!-- Outside the mirrored element, so Mirror never flips the controls.
		     The player's palette: the overlay sits on a black picture in either page theme. -->
		<div class="theme-media absolute inset-0">
			<button
				type="button"
				aria-label={paused ? 'Play' : 'Pause'}
				onclick={toggle}
				class="absolute inset-0 grid cursor-pointer place-items-center"
			>
				{#if parts.spinner || parts.disc}
					<span
						aria-hidden="true"
						class="grid size-12 place-items-center rounded-full bg-black/55 text-white shadow-[inset_0_0_0_1.5px_rgb(255_255_255/0.35)]"
					>
						{#if parts.spinner}
							<Spinner size={24} />
						{:else}
							<span class="ml-[3px] flex"><Icon name="play" filled size={24} /></span>
						{/if}
					</span>
				{/if}
			</button>
			{#if parts.length && length}
				<span
					class="{ON_VIDEO} pointer-events-none absolute right-2 bottom-2 font-bold text-white/92"
					>{length}</span
				>
			{/if}
			{#if parts.bar && length}
				<div
					class="pointer-events-none absolute inset-x-0 bottom-0 bg-linear-to-b from-black/0 to-black/72 px-3 pt-3"
				>
					<span class="block text-[12px] font-extrabold text-white tabular-nums"
						>{timeText(currentTime, duration)}</span
					>
					<div class="pointer-events-auto">
						<Timeline
							fromMs={0}
							toMs={duration * 1000}
							currentMs={currentTime * 1000}
							bands={inlineBands(spots)}
							glass
							keyboard
							onseek={(ms) => {
								if (inline) inline.currentTime = ms / 1000;
							}}
						/>
					</div>
				</div>
			{/if}
		</div>
	</div>
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
			// Sections added or moved in the player show on the bar.
			if (played) loadSpots();
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
