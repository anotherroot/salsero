<!-- src/lib/components/ui/VideoPlayer.svelte -->
<script lang="ts">
	import { onMount } from 'svelte';
	import { VIDEO_RATES, type VideoRate } from '$lib/video-prefs';
	import { MAX_SPOT_LABEL } from '$lib/limits';
	import { loopTarget, msOf, sortSpots, spotLabel, spotTime, step } from '$lib/video/spots';
	import { fetchSpots, patchSpot, postSpot, removeSpot } from '$lib/video/spots-api';
	import type { Spot, SpotOwner } from '$lib/types';

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

	let { src, owner, startAt, mirror, rate, onchoose, onclose }: Props = $props();

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

	let spots = $state<Spot[]>([]);
	let loop = $state<Spot | null>(null);
	/** Milliseconds: the start of a section whose end has not been tapped yet. */
	let pendingStart = $state<number | null>(null);
	let panel = $state(false);
	let renaming = $state<number | null>(null);
	let note = $state<string | null>(null);

	let noteTimer: ReturnType<typeof setTimeout> | undefined;
	function flash(text: string) {
		note = text;
		clearTimeout(noteTimer);
		noteTimer = setTimeout(() => (note = null), 2500);
	}

	onMount(() => {
		fetchSpots(owner).then(
			(s) => (spots = sortSpots(s)),
			() => flash("Couldn't load spots")
		);
	});

	async function save(input: { startMs: number; endMs: number | null; label: string | null }) {
		try {
			const spot = await postSpot(owner, input);
			spots = sortSpots([...spots, spot]);
			flash(`Saved ${spotLabel(spot)}`);
			return true;
		} catch {
			flash("Couldn't save");
			return false;
		}
	}

	function mark() {
		void save({ startMs: msOf(video.currentTime), endMs: null, label: null });
	}

	/** First tap remembers the start; the second saves the section. */
	async function section() {
		const now = msOf(video.currentTime);
		if (pendingStart === null) {
			pendingStart = now;
			flash(`Section from ${spotTime(now)}…`);
			return;
		}
		if (now <= pendingStart) {
			flash('Play past the start, then end the section');
			return;
		}
		if (await save({ startMs: pendingStart, endMs: now, label: null })) pendingStart = null;
	}

	function go(spot: Spot) {
		video.currentTime = spot.startMs / 1000;
		if (spot.endMs !== null) loop = spot;
		panel = false;
	}

	async function rename(spot: Spot, label: string) {
		if (renaming !== spot.id) return;
		renaming = null;
		const clean = label.trim() || null;
		if (clean === spot.label) return;
		try {
			const next = await patchSpot(spot.id, clean);
			spots = spots.map((s) => (s.id === next.id ? next : s));
			if (loop?.id === next.id) loop = next;
		} catch {
			flash("Couldn't save");
		}
	}

	async function remove(spot: Spot) {
		try {
			await removeSpot(spot.id);
			spots = spots.filter((s) => s.id !== spot.id);
			if (loop?.id === spot.id) loop = null;
		} catch {
			flash("Couldn't save");
		}
	}

	/*
	 * The loop is checked every animation frame, not on `timeupdate`: that fires
	 * about four times a second, which overshoots a section's end by up to a
	 * quarter-second at 1×. A frame is the finest a seek can be noticed at.
	 */
	$effect(() => {
		if (paused || !loop) return;
		const l = loop;
		let frame = requestAnimationFrame(function tick() {
			const to = loopTarget(video.currentTime, l);
			if (to !== null) video.currentTime = to;
			frame = requestAnimationFrame(tick);
		});
		return () => cancelAnimationFrame(frame);
	});

	/** A section that ends at (or rounds past) the last frame: the frame check never sees it. */
	function onended() {
		if (!loop) return;
		video.currentTime = loop.startMs / 1000;
		void video.play();
	}

	/* Controls fade while playing and come back on a tap or a mouse move. */
	let hideTimer: ReturnType<typeof setTimeout> | undefined;
	function wake() {
		shown = true;
		clearTimeout(hideTimer);
		if (!paused && !panel) hideTimer = setTimeout(() => (shown = false), 3000);
	}
	$effect(() => {
		void paused;
		void panel;
		wake();
		return () => clearTimeout(hideTimer);
	});

	function onkeydown(e: KeyboardEvent) {
		if (e.target instanceof HTMLInputElement && e.target.type === 'text') return;
		const handled: Record<string, () => void> = {
			' ': toggle,
			ArrowLeft: () => nudge(-1),
			ArrowRight: () => nudge(1),
			m: mark,
			M: mark,
			s: () => void section(),
			S: () => void section(),
			l: () => (loop = null),
			L: () => (loop = null)
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
			{onended}
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
				{#if loop}
					<div class="mb-2 flex justify-center">
						<span class="chip">
							Looping {spotLabel(loop)}
							<button type="button" aria-label="Stop looping" onclick={() => (loop = null)}
								>✕</button
							>
						</span>
					</div>
				{/if}
				<div class="flex items-center gap-2 text-[12px] tabular-nums">
					<span>{spotTime(current * 1000)}</span>
					<div class="relative flex-1">
						{#if Number.isFinite(duration) && duration > 0}
							{#each spots as s (s.id)}
								{@const left = (s.startMs / 1000 / duration) * 100}
								{#if s.endMs === null}
									<span class="tick" style:left="{left}%"></span>
								{:else}
									<span
										class="band"
										class:active={loop?.id === s.id}
										style:left="{left}%"
										style:width="{Math.min(
											100 - left,
											((s.endMs - s.startMs) / 1000 / duration) * 100
										)}%"
									></span>
								{/if}
							{/each}
						{/if}
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
				<div class="mt-2 flex flex-wrap items-center justify-center gap-2">
					<button type="button" class="btn" onclick={() => nudge(-1)}>−1s</button>
					<button type="button" class="btn big" onclick={toggle}>{paused ? 'Play' : 'Pause'}</button
					>
					<button type="button" class="btn" onclick={() => nudge(1)}>+1s</button>
					<button type="button" class="btn" onclick={mark}>Mark</button>
					<button type="button" class="btn" class:on={pendingStart !== null} onclick={section}
						>{pendingStart === null ? 'Section' : 'End section'}</button
					>
					<button type="button" class="btn" aria-expanded={panel} onclick={() => (panel = !panel)}
						>Spots ({spots.length})</button
					>
				</div>
			</div>
		</div>

		{#if note}
			<p class="note" role="status">{note}</p>
		{/if}

		{#if panel}
			<div class="panel" aria-label="Spots">
				<div class="mb-2 flex items-center justify-between">
					<h2 class="text-[15px] font-semibold">Spots</h2>
					<button type="button" class="btn" aria-label="Close spots" onclick={() => (panel = false)}
						>✕</button
					>
				</div>
				{#if spots.length === 0}
					<p class="text-[13px] opacity-70">
						Nothing marked yet. Mark saves this moment; Section saves a stretch to loop.
					</p>
				{/if}
				<ul class="flex flex-col gap-1">
					{#each spots as s (s.id)}
						<li class="flex items-center gap-2">
							{#if renaming === s.id}
								<!-- svelte-ignore a11y_autofocus -->
								<input
									type="text"
									class="flex-1 rounded-md bg-white/10 px-2 py-1.5 text-[14px]"
									maxlength={MAX_SPOT_LABEL}
									value={s.label ?? ''}
									placeholder={spotLabel({ ...s, label: null })}
									autofocus
									onkeydown={(e) => {
										if (e.key === 'Enter') void rename(s, e.currentTarget.value);
										if (e.key === 'Escape') {
											e.preventDefault();
											e.stopPropagation();
											renaming = null;
										}
									}}
									onblur={(e) => void rename(s, e.currentTarget.value)}
								/>
							{:else}
								<button
									type="button"
									class="flex-1 rounded-md px-2 py-2 text-left text-[14px] hover:bg-white/10"
									class:font-semibold={loop?.id === s.id}
									onclick={() => go(s)}
								>
									{s.endMs === null ? '•' : '⟲'}
									{spotLabel(s)}
									{#if s.label}<span class="ml-1 text-[12px] opacity-60"
											>{spotLabel({ ...s, label: null })}</span
										>{/if}
								</button>
								<button type="button" class="btn" onclick={() => (renaming = s.id)}>Rename</button>
								<button
									type="button"
									class="btn"
									aria-label="Delete {spotLabel(s)}"
									onclick={() => remove(s)}>✕</button
								>
							{/if}
						</li>
					{/each}
				</ul>
			</div>
		{/if}
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
	.tick,
	.band {
		position: absolute;
		top: 50%;
		pointer-events: none;
		transform: translateY(-50%);
	}
	.tick {
		width: 2px;
		height: 14px;
		margin-left: -1px;
		background: white;
	}
	.band {
		height: 10px;
		border-radius: 3px;
		background: rgb(255 255 255 / 0.3);
	}
	.band.active {
		background: rgb(255 255 255 / 0.6);
	}
	.chip {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.25rem 0.5rem 0.25rem 0.75rem;
		border-radius: 999px;
		background: rgb(255 255 255 / 0.9);
		color: black;
		font-size: 13px;
	}
	.note {
		position: absolute;
		top: 4.5rem;
		left: 50%;
		transform: translateX(-50%);
		padding: 0.4rem 0.8rem;
		border-radius: 0.5rem;
		background: rgb(0 0 0 / 0.8);
		font-size: 13px;
	}
	.panel {
		position: absolute;
		inset: auto 0 0 0;
		max-height: 60%;
		overflow-y: auto;
		padding: 1rem;
		padding-bottom: max(env(safe-area-inset-bottom), 1rem);
		background: rgb(0 0 0 / 0.92);
	}
	@media (min-width: 640px) {
		.panel {
			inset: 0 0 0 auto;
			width: 20rem;
			max-height: none;
		}
	}
</style>
