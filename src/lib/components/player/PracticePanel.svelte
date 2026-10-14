<!-- src/lib/components/player/PracticePanel.svelte -->
<script lang="ts">
	import { onDestroy } from 'svelte';
	import CountChips from './CountChips.svelte';
	import ClaveChips from './ClaveChips.svelte';
	import SongProgress from './SongProgress.svelte';
	import SourcePicker from './SourcePicker.svelte';
	import { loadSongGrid } from './songGrid.svelte';
	import LiveCount from '$lib/components/songs/LiveCount.svelte';
	import { CHIP, LABEL } from '$lib/components/ui/styles';
	import { createPlayer, type PlayerHandle } from '$lib/scheduler/attach';
	import { syntheticGrid, UNIFORM_FLOW, type Flow } from '$lib/scheduler/scheduler';
	import type { ClavePattern, CountPattern, Speed } from '$lib/labels';
	import {
		CUE_EVERY,
		DEFAULT_PRACTICE_BPM,
		hourOfBars,
		parsePracticeConfig,
		practiceStart,
		practiceSummary,
		type CueEvery
	} from '$lib/exercises/practice';
	import { rememberPractice } from '$lib/exercises/practice-api';
	import { STOPPED, elapsedMs, pauseWatch, startWatch } from '$lib/exercises/stopwatch';
	import { clock } from '$lib/format';
	import type { Dance } from '$lib/dances/dances';
	import type { CountTakeRow, ExerciseItem } from '$lib/types';

	interface Props {
		dance: Dance;
		exercise: ExerciseItem;
		/** This dance's ready songs. */
		songs: { id: number; title: string }[];
		takes: CountTakeRow[];
		/** The figure to call on cue — the figure popup only. */
		cue: { figureId: number; say: string; eights: number } | null;
		/** After every stop, with the total so far: fills Minutes and the set's run. */
		onrun: (run: { durationS: number; playerJson: string }) => void;
		/** True while a run is playing or paused, so the popup guards against closing. */
		onactive: (active: boolean) => void;
	}

	let { dance, exercise, songs, takes, cue, onrun, onactive }: Props = $props();

	// Seeded once from what the exercise remembers. The popup remounts this
	// component after every logged set, so "once" is per set, which is right.
	const remembered = parsePracticeConfig(exercise.practiceJson, dance);
	const start = practiceStart(
		exercise,
		songs.map((s) => s.id)
	);
	const songGone = start.songGone;

	let source = $state<'count' | 'song'>(start.source);
	let songId = $state<number | null>(start.songId);
	let bpm = $state(exercise.countBpm ?? DEFAULT_PRACTICE_BPM);
	let count = $state<CountPattern>(remembered.count);
	let clave = $state<ClavePattern | null>(remembered.clave);
	let speed = $state<Speed>(remembered.speed);
	let callEvery = $state<CueEvery | null>(cue ? remembered.callEvery : null);
	let voiceVolume = $state(1);
	let expanded = $state(songGone);

	const song = loadSongGrid(
		() => dance.slug,
		() => (source === 'song' ? songId : null)
	);
	const grid = $derived(song.grid);
	let audio: HTMLAudioElement | undefined = $state();

	let player = $state<PlayerHandle | null>(null);
	let runGrid = $state<{ beats: number[]; counts: number[] } | null>(null);
	let paused = $state(false);
	let starting = $state(false);
	let startError = $state<string | null>(null);
	let watch = $state(STOPPED);
	let now = $state(Date.now());
	let calls = 0;
	/** Set by `onDestroy`, read after `await handle.start()` resolves — see `play()`. */
	let destroyed = false;

	const songTitle = $derived(songs.find((s) => s.id === songId)?.title ?? null);
	const summary = $derived(
		practiceSummary(
			{ mode: source, bpm, songTitle, config: { count, clave, speed, callEvery } },
			dance
		)
	);
	const canPlay = $derived(source === 'count' ? bpm >= 60 && bpm <= 300 : grid !== null);

	// The elapsed clock on screen; the stopwatch itself needs no timer.
	$effect(() => {
		if (!player || paused) return;
		const t = setInterval(() => (now = Date.now()), 250);
		return () => clearInterval(t);
	});

	// Also true while starting: `start()` awaits clip decoding and can take a
	// moment, and the Sheet must stay guarded for that whole stretch, not just
	// once a player exists.
	$effect(() => onactive(starting || player !== null));

	/**
	 * Runs inside the Play tap. Everything up to `handle.start()` is synchronous
	 * on purpose: iOS unlocks audio only from a real gesture, and an `await`
	 * before it would forfeit that. `starting` stops a second impatient tap from
	 * building a second, unreachable player (the player page's own lesson).
	 */
	async function play() {
		if (starting || player || !canPlay) return;
		starting = true;
		startError = null;
		// Read `grid` and `audio` into locals once: they are reactive state, and
		// narrowing a `$state` field does not survive into the closures below —
		// a `const` local does.
		const g0 = grid;
		const el = audio;
		// Svelte 5 clears `bind:this` to `null` (not `undefined`) on unmount, so
		// the two must be checked the same way.
		const useSong = source === 'song' && g0 != null && el != null;
		const g =
			useSong && g0 ? { beats: g0.beats, counts: g0.counts } : syntheticGrid(bpm, hourOfBars(bpm));
		if (useSong && el) {
			// Set before start: the scheduler reads the element's rate to map song
			// time onto the audio clock from its very first tick.
			el.playbackRate = speed;
			el.preservesPitch = true;
		}
		// One figure, spaced by its own length, so a two-eight figure is never
		// called over itself. `pickFigure` returns the only id of a one-figure pool.
		const activeCue = cue;
		const flow: Flow = activeCue
			? { pick: UNIFORM_FLOW.pick, eights: () => activeCue.eights }
			: UNIFORM_FLOW;
		const handle = createPlayer({
			audio: useSong && el ? el : null,
			grid: g,
			toggles: {
				count,
				clave: dance.clave ? clave : null,
				callEvery: cue && callEvery ? callEvery : null
			},
			pool: cue && callEvery ? [cue.figureId] : [],
			flow,
			sayOf: () => cue?.say ?? '',
			voiceVolume,
			// Only the chosen pattern's takes: a salsa recording must never stand in
			// for a son count, whose words fall on different beats.
			takes: takes.filter((t) => t.pattern === count),
			onCall: () => {
				calls += 1;
			},
			onEnd: () => stop()
		});
		try {
			await handle.start();
		} catch (e) {
			startError = e instanceof Error ? e.message : 'Could not start the count.';
			starting = false;
			return;
		}
		// The popup can close mid-`start()` — decoding clips takes a moment, and
		// while starting `player` is still null, so nothing else stops this
		// handle. Left unchecked, its AudioContext, wake lock and 25 ms interval
		// would keep running with no reference anywhere to stop them.
		if (destroyed) {
			handle.stop();
			starting = false;
			return;
		}
		player = handle;
		runGrid = g;
		paused = false;
		watch = startWatch(watch, Date.now());
		starting = false;
		rememberPractice(dance.slug, exercise.id, {
			source,
			songId,
			bpm,
			config: { count, clave, speed, callEvery }
		});
	}

	/**
	 * Running, the player moves the music and drops what it queued for the old
	 * spot. Stopped, the element alone moves, and the next ▶ starts from there.
	 */
	function seek(t: number) {
		if (player) player.seek(t);
		else if (audio) audio.currentTime = t;
	}

	function pause() {
		player?.pause();
		paused = true;
		watch = pauseWatch(watch, Date.now());
	}

	async function resume() {
		await player?.resume();
		paused = false;
		watch = startWatch(watch, Date.now());
	}

	function stop() {
		if (!player) return;
		player.stop();
		player = null;
		runGrid = null;
		paused = false;
		watch = pauseWatch(watch, Date.now());
		onrun({
			durationS: Math.round(elapsedMs(watch, Date.now()) / 1000),
			playerJson: JSON.stringify({
				source,
				songId: source === 'song' ? songId : null,
				bpm: source === 'count' ? bpm : null,
				speed: source === 'song' ? speed : 1,
				count,
				clave: dance.clave ? clave : null,
				callEvery: cue ? callEvery : null,
				calls
			})
		});
	}

	// Closing the popup, or leaving the page, must never leave an AudioContext
	// or a screen wake lock running. `destroyed` also catches a start() still
	// in flight when that happens — `player` alone is not enough, see `play()`.
	onDestroy(() => {
		destroyed = true;
		player?.stop();
	});
	$effect(() => {
		const onUnload = () => player?.stop();
		window.addEventListener('beforeunload', onUnload);
		return () => window.removeEventListener('beforeunload', onUnload);
	});
</script>

<section class="rounded-xl border border-line bg-raised p-3">
	{#if player && runGrid}
		<LiveCount
			time={() => player?.songTime() ?? null}
			beats={runGrid.beats}
			counts={runGrid.counts}
		/>
		<p class="mt-1 text-center text-[13px] text-muted tabular-nums">
			{clock(elapsedMs(watch, now) / 1000)} · {summary}
		</p>
		{#if source === 'song' && audio}
			<div class="mt-1"><SongProgress {audio} onseek={seek} /></div>
		{/if}
		<div class="mt-3 flex gap-2">
			<button
				type="button"
				class="h-12 flex-1 rounded-xl border border-rule text-[15px] font-medium"
				onclick={() => (paused ? resume() : pause())}>{paused ? 'Resume' : 'Pause'}</button
			>
			<button
				type="button"
				class="h-12 flex-1 rounded-xl bg-accent text-[15px] font-semibold text-accent-ink"
				onclick={stop}>Stop</button
			>
		</div>
		<label class="mt-3 block">
			<span class={LABEL}>Voice volume</span>
			<input
				type="range"
				min="0"
				max="1"
				step="0.05"
				bind:value={voiceVolume}
				oninput={() => player?.setVoiceVolume(voiceVolume)}
				class="w-full"
			/>
		</label>
	{:else}
		<div class="flex items-center gap-2">
			<button
				type="button"
				class="min-w-0 flex-1 text-left"
				aria-expanded={expanded}
				onclick={() => (expanded = !expanded)}
			>
				<span class="block text-[12px] text-muted">Practise with</span>
				<span class="block truncate text-[14px] font-medium">{summary}</span>
			</button>
			<button
				type="button"
				disabled={starting || !canPlay}
				aria-label="Play"
				class="grid size-12 place-items-center rounded-full bg-accent text-[20px] text-accent-ink disabled:opacity-50"
				onclick={play}>{starting ? '…' : '▶'}</button
			>
		</div>
		{#if source === 'song' && grid && audio}
			<!-- Before ▶ too: skip an intro, or rewind after a Stop left it mid-song. -->
			<div class="mt-1"><SongProgress {audio} onseek={seek} /></div>
		{/if}
		{#if watch.bankedMs > 0}
			<p class="mt-2 text-[12px] text-muted">
				{clock(elapsedMs(watch, Date.now()) / 1000)} practised — ▶ carries on.
			</p>
		{/if}
		{#if songGone}
			<p class="mt-2 rounded-lg bg-plane px-3 py-2 text-[13px] text-muted">
				Its song is not ready — pick another, or use the count.
			</p>
		{/if}
		{#if startError}
			<p class="mt-2 text-[13px] text-danger" role="alert">{startError}</p>
		{/if}

		{#if expanded}
			<div class="mt-3 space-y-4">
				<SourcePicker
					name="panel"
					{songs}
					bind:source
					bind:songId
					bind:speed
					bind:bpm
					error={song.error}
				/>

				<fieldset>
					<legend class={LABEL}>Voice count</legend>
					<CountChips
						name="panel-count"
						patterns={dance.countPatterns}
						value={count}
						onchange={(p) => (count = p)}
					/>
				</fieldset>

				{#if dance.clave}
					<fieldset>
						<legend class={LABEL}>Clave</legend>
						<ClaveChips name="panel-clave" value={clave} onchange={(c) => (clave = c)} />
					</fieldset>
				{/if}

				{#if cue}
					<fieldset>
						<legend class={LABEL}>Call it on cue</legend>
						<div class="flex gap-2">
							<label class={CHIP}>
								<input
									type="radio"
									name="panel-cue"
									checked={callEvery === null}
									onchange={() => (callEvery = null)}
									class="sr-only"
								/>
								Off
							</label>
							{#each CUE_EVERY as n (n)}
								<label class={CHIP}>
									<input
										type="radio"
										name="panel-cue"
										checked={callEvery === n}
										onchange={() => (callEvery = n)}
										class="sr-only"
									/>
									Every {n}
								</label>
							{/each}
						</div>
					</fieldset>
				{/if}
			</div>
		{/if}
	{/if}

	{#if source === 'song' && grid}
		<!-- Mounted before Play, with its src, so the tap only has to call start(). -->
		<audio bind:this={audio} src="/audio/{grid.audioFile}" preload="auto"></audio>
	{/if}
</section>
