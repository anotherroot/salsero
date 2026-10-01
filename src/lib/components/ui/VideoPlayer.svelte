<!-- src/lib/components/ui/VideoPlayer.svelte -->
<script lang="ts">
	import { onMount } from 'svelte';
	import { VIDEO_RATES, type VideoRate } from '$lib/video-prefs';
	import { spotTime, step } from '$lib/video/spots';
	import type { SpotOwner } from '$lib/types';

	interface Props {
		src: string;
		owner: SpotOwner;
		/** Seconds: where the inline player was. */
		startAt: number;
		mirror: boolean;
		rate: VideoRate;
		onchoose: (next: { mirror?: boolean; rate?: VideoRate }) => void;
		/** Seconds: where to leave the inline player. */
		onclose: (at: number) => void;
	}

	// `owner` is read from Task 5 on, for its spots.
	// eslint-disable-next-line svelte/no-unused-props
	let { src, startAt, mirror, rate, onchoose, onclose }: Props = $props();

	let dialog: HTMLDialogElement = $state()!;
	let stage: HTMLDivElement = $state()!;
	let video: HTMLVideoElement = $state()!;

	let current = $state(0);
	let duration = $state(NaN);
	let paused = $state(true);
	let shown = $state(true);

	/*
	 * Our own fullscreen. The browser's — and on an iPhone, iOS's player — would
	 * hide every control below. Where `requestFullscreen` exists (Android,
	 * desktop) the stage asks for it; where it does not, the dialog filling the
	 * viewport IS the fullscreen, and from the home-screen app there is no
	 * browser chrome around it.
	 */
	let wentFullscreen = false;
	onMount(() => {
		dialog.showModal();
		stage.requestFullscreen?.().then(
			() => (wentFullscreen = true),
			() => {
				// Refused (no user activation left, or an iframe): the dialog still fills the screen.
			}
		);
		const left = () => {
			if (wentFullscreen && !document.fullscreenElement) close();
		};
		document.addEventListener('fullscreenchange', left);
		return () => document.removeEventListener('fullscreenchange', left);
	});

	let closed = false;
	function close() {
		if (closed) return;
		closed = true;
		const at = video.currentTime;
		video.pause();
		if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
		dialog.close();
		onclose(at);
	}

	$effect(() => {
		video.playbackRate = rate;
	});

	function toggle() {
		if (video.paused) void video.play();
		else video.pause();
	}

	function nudge(deltaS: number) {
		video.currentTime = step(video.currentTime, deltaS, video.duration);
	}

	/* Controls fade while playing and come back on a tap or a mouse move. */
	let hideTimer: ReturnType<typeof setTimeout> | undefined;
	function wake() {
		shown = true;
		clearTimeout(hideTimer);
		if (!paused) hideTimer = setTimeout(() => (shown = false), 3000);
	}
	$effect(() => {
		void paused;
		wake();
		return () => clearTimeout(hideTimer);
	});

	function onkeydown(e: KeyboardEvent) {
		if (e.target instanceof HTMLInputElement && e.target.type === 'text') return;
		const handled: Record<string, () => void> = {
			' ': toggle,
			ArrowLeft: () => nudge(-1),
			ArrowRight: () => nudge(1)
		};
		const act = handled[e.key];
		if (!act) return;
		// Also stops a focused button's own Space activation, which would toggle twice.
		e.preventDefault();
		act();
		wake();
	}
</script>

<dialog
	bind:this={dialog}
	aria-label="Video"
	class="player"
	oncancel={(e) => {
		e.preventDefault();
		close();
	}}
	{onkeydown}
>
	<div bind:this={stage} class="relative h-full w-full bg-black text-white">
		<!-- svelte-ignore a11y_media_has_caption -->
		<video
			bind:this={video}
			{src}
			playsinline
			preload="auto"
			class="absolute inset-0 h-full w-full object-contain"
			class:mirror
			bind:currentTime={current}
			bind:duration
			bind:paused
			onloadedmetadata={() => {
				video.preservesPitch = true;
				video.currentTime = startAt;
			}}
			onclick={wake}
			onpointermove={wake}
		></video>

		<div class="controls" class:hidden-controls={!shown}>
			<div class="top flex items-center gap-2 p-3">
				<button type="button" class="btn" aria-label="Close" onclick={close}>✕</button>
				<button
					type="button"
					class="btn ml-auto"
					aria-pressed={mirror}
					class:on={mirror}
					onclick={() => onchoose({ mirror: !mirror })}>Mirror</button
				>
				<span class="flex gap-1" role="group" aria-label="Speed">
					{#each VIDEO_RATES as r (r)}
						<button
							type="button"
							class="btn"
							aria-pressed={rate === r}
							class:on={rate === r}
							onclick={() => onchoose({ rate: r })}>{r}×</button
						>
					{/each}
				</span>
			</div>

			<div class="bottom p-3">
				<div class="flex items-center gap-2 text-[12px] tabular-nums">
					<span>{spotTime(current * 1000)}</span>
					<div class="relative flex-1">
						<input
							type="range"
							class="w-full"
							aria-label="Position"
							min="0"
							max={Number.isFinite(duration) ? duration : 0}
							step="0.01"
							value={current}
							oninput={(e) => (video.currentTime = Number(e.currentTarget.value))}
						/>
					</div>
					<span>{Number.isFinite(duration) ? spotTime(duration * 1000) : '–'}</span>
				</div>
				<div class="mt-2 flex items-center justify-center gap-2">
					<button type="button" class="btn" onclick={() => nudge(-1)}>−1s</button>
					<button type="button" class="btn big" onclick={toggle}>{paused ? 'Play' : 'Pause'}</button
					>
					<button type="button" class="btn" onclick={() => nudge(1)}>+1s</button>
				</div>
			</div>
		</div>
	</div>
</dialog>

<style>
	.player {
		margin: 0;
		width: 100vw;
		height: 100dvh;
		max-width: none;
		max-height: none;
		padding: 0;
		border: 0;
		background: black;
	}
	.player::backdrop {
		background: black;
	}
	/* Learn it facing the teacher, as in a studio mirror. */
	.mirror {
		transform: scaleX(-1);
	}
	.controls {
		position: absolute;
		inset: 0;
		display: flex;
		flex-direction: column;
		justify-content: space-between;
		pointer-events: none;
		transition: opacity 200ms;
	}
	.controls > * {
		pointer-events: auto;
	}
	.hidden-controls {
		opacity: 0;
	}
	.hidden-controls > * {
		pointer-events: none;
	}
	.top {
		padding-top: max(env(safe-area-inset-top), 12px);
		background: linear-gradient(rgb(0 0 0 / 0.6), transparent);
	}
	.bottom {
		padding-bottom: max(env(safe-area-inset-bottom), 12px);
		background: linear-gradient(transparent, rgb(0 0 0 / 0.7));
	}
	.btn {
		height: 2.5rem;
		min-width: 2.75rem;
		padding: 0 0.6rem;
		border-radius: 0.5rem;
		border: 1px solid rgb(255 255 255 / 0.35);
		font-size: 13px;
	}
	.btn.on {
		background: white;
		color: black;
	}
	.btn.big {
		min-width: 5rem;
		font-weight: 600;
	}
</style>
