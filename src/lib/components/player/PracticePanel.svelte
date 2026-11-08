<!-- src/lib/components/player/PracticePanel.svelte -->
<script lang="ts">
	import { onDestroy, untrack } from 'svelte';
	import CountChips from './CountChips.svelte';
	import ClaveChips from './ClaveChips.svelte';
	import SongProgress from './SongProgress.svelte';
	import SourcePicker from './SourcePicker.svelte';
	import { loadSongGrid } from './songGrid.svelte';
	import { stopSample } from '$lib/songs/sample-player.svelte';
	import { holdReloadWhile } from '$lib/nav/fresh.svelte';
	import LiveCount from '$lib/components/songs/LiveCount.svelte';
	import Banner from '$lib/components/ui/Banner.svelte';
	import Icon from '$lib/components/ui/Icon.svelte';
	import Slider from '$lib/components/ui/Slider.svelte';
	import Spinner from '$lib/components/ui/Spinner.svelte';
	import { CHIP, PLAY_ROUND as PLAY, button } from '$lib/components/ui/styles';
	import { createPlayer, type PlayerHandle } from '$lib/scheduler/attach';
	import { syntheticGrid, UNIFORM_FLOW, type Flow } from '$lib/scheduler/scheduler';
	import type { ClavePattern, CountPattern, Speed } from '$lib/labels';
	import {
		CUE_EVERY,
		DEFAULT_PRACTICE_BPM,
		hourOfBars,
		parsePracticeConfig,
		practiceOf,
		practiceStart,
		practiceSummary,
		parsePhonePractice,
		practiceSeed,
		type CueEvery
	} from '$lib/exercises/practice';
	import { practiceSaver } from '$lib/exercises/practice-api';
	import { loadPhonePractice, savePhonePractice } from '$lib/exercises/phone-practice';
	import { STOPPED, elapsedMs, pauseWatch, startWatch } from '$lib/exercises/stopwatch';
	import { clock } from '$lib/format';
	import type { Dance } from '$lib/dances/dances';
	import type { CountTakeRow, ExerciseItem, PickerSong } from '$lib/types';

	interface Props {
		dance: Dance;
		exercise: ExerciseItem;
		/** This dance's ready songs: the person's own and their groups' shared ones (`songChoices`). */
		songs: PickerSong[];
		takes: CountTakeRow[];
		/** The figure to call on cue — the figure popup only. */
		cue: { figureId: number; say: string; eights: number } | null;
		/** After every stop, with the total so far: fills Minutes and the set's run. */
		onrun: (run: { durationS: number; playerJson: string }) => void;
		/** True while a run is playing or paused, so the popup guards against closing. */
		onactive: (active: boolean) => void;
	}

	let { dance, exercise, songs, takes, cue, onrun, onactive }: Props = $props();

	/** A group's label: 13/700 muted, 4 px over its control. */
	const GROUP_LABEL = 'mb-1 block text-[13px] font-bold text-muted';

	// Seeded once, on purpose (`untrack`): the popup remounts this component
	// after every logged set, so "once" is per set, which is right. Following
	// the props live would undo the user's own picks whenever the page reloads
	// its data. The exercise's own memory, else this phone's (`practiceSeed`).
	const seed = untrack(() => {
		const remembered = parsePracticeConfig(exercise.practiceJson, dance);
		const phone = parsePhonePractice(loadPhonePractice(dance.slug), dance);
		return {
			remembered,
			start: practiceStart(
				exercise,
				songs.map((s) => s.id)
			),
			settings: practiceSeed(practiceOf(exercise, dance), phone, dance, DEFAULT_PRACTICE_BPM),
			voiceVolume: phone.voiceVolume ?? 1,
			callEvery: cue ? remembered.callEvery : null
		};
	});
	const songGone = seed.start.songGone;

	let source = $state<'count' | 'song'>(seed.start.source);
	let songId = $state<number | null>(seed.start.songId);
	let bpm = $state(seed.settings.bpm);
	let count = $state<CountPattern>(seed.settings.count);
	let clave = $state<ClavePattern | null>(seed.settings.clave);
	let speed = $state<Speed>(seed.settings.speed);
	let callEvery = $state<CueEvery | null>(seed.callEvery);
	let voiceVolume = $state(seed.voiceVolume);
	// What the exercise remembers, kept as settings change: posted only when it
	// differs from what the page knows, which newer data replaces.
	const saver = untrack(() => practiceSaver(dance.slug, exercise.id, practiceOf(exercise, dance)));
	$effect(() => {
		const loaded = practiceOf(exercise, dance);
		untrack(() => saver.reset(loaded));
	});
	/** Without a cue the run calls nothing; the remembered cue stays as it was. */
	const choice = () => ({
		source,
		songId,
		bpm,
		config: { count, clave, speed, callEvery: cue ? callEvery : seed.remembered.callEvery }
	});
	// Every change is kept at once, on the exercise and on this phone. Not on
	// the first run, which only reads what was seeded.
	let primed = false;
	$effect(() => {
		const c = choice();
		if (!primed) {
			primed = true;
			return;
		}
		untrack(() => {
			saver.change(c);
			savePhonePractice(dance.slug, {
				bpm: c.bpm,
				count: c.config.count,
				clave: c.config.clave,
				speed: c.config.speed
			});
		});
	});
	$effect(() => {
		const flush = () => saver.flush();
		window.addEventListener('pagehide', flush);
		return () => window.removeEventListener('pagehide', flush);
	});
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
	// A deploy does not reload the page under a run either (`$lib/nav/fresh.ts`).
	holdReloadWhile(() => starting || player !== null);

	/**
	 * Runs inside the Play tap. Everything up to `handle.start()` is synchronous
	 * on purpose: iOS unlocks audio only from a real gesture, and an `await`
	 * before it would forfeit that. `starting` stops a second impatient tap from
	 * building a second, unreachable player (the player page's own lesson).
	 */
	async function play() {
		// A sample must never play under a run.
		stopSample();
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
		// The run is what "last time" means: kept at once, not in a moment.
		saver.change(choice());
		saver.flush();
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
		stopSample();
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
		saver.flush();
		player?.stop();
	});
	$effect(() => {
		const onUnload = () => player?.stop();
		window.addEventListener('beforeunload', onUnload);
		return () => window.removeEventListener('beforeunload', onUnload);
	});
</script>

<section
	aria-label="Practice"
	class="flex flex-none flex-col rounded-[18px] bg-surface pt-3 pr-3 pb-3.5 pl-4 {player && runGrid
		? 'gap-2.5'
		: 'gap-3'}"
>
	{#if player && runGrid}
		<LiveCount
			time={() => player?.songTime() ?? null}
			beats={runGrid.beats}
			counts={runGrid.counts}
		/>
		<p class="text-center text-[13px] font-bold text-muted tabular-nums">
			{clock(elapsedMs(watch, now) / 1000)} · {summary}
		</p>
		{#if source === 'song' && audio}
			<SongProgress {audio} onseek={seek} />
		{/if}
		<div class="grid grid-cols-2 gap-2">
			<button
				type="button"
				class={button('secondary', 'md', true)}
				onclick={() => (paused ? resume() : pause())}
			>
				<Icon name={paused ? 'play' : 'pause'} size={20} filled />
				{paused ? 'Resume' : 'Pause'}
			</button>
			<button type="button" class={button('primary', 'md', true)} onclick={stop}>
				<Icon name="stop" size={20} filled />
				Stop
			</button>
		</div>
		<div class="flex flex-col gap-0.5">
			<span class={GROUP_LABEL} aria-hidden="true">Voice volume</span>
			<Slider
				label="Voice volume"
				bind:value={voiceVolume}
				oninput={() => {
					player?.setVoiceVolume(voiceVolume);
					savePhonePractice(dance.slug, { voiceVolume });
				}}
			/>
		</div>
	{:else}
		<div class="flex items-center gap-2.5">
			<button
				type="button"
				class="flex min-h-12 min-w-0 flex-1 cursor-pointer items-center gap-2 text-left text-ink"
				aria-expanded={expanded}
				onclick={() => (expanded = !expanded)}
			>
				<span class="flex min-w-0 flex-1 flex-col gap-0.5">
					<span class="text-[13px] font-bold text-muted">Practise with</span>
					<span class="text-[15px] leading-[1.3] font-bold text-ink">{summary}</span>
				</span>
				<span class="text-muted">
					<Icon name={expanded ? 'chevron-up' : 'chevron-down'} size={20} />
				</span>
			</button>
			<button
				type="button"
				disabled={!canPlay}
				aria-label="Play"
				aria-busy={starting}
				class={PLAY}
				onclick={play}
			>
				{#if starting}<Spinner size={24} />{:else}<Icon name="play" size={24} filled />{/if}
			</button>
		</div>
		{#if source === 'song' && grid && audio}
			<!-- Before ▶ too: skip an intro, or rewind after a Stop left it mid-song. -->
			<SongProgress {audio} onseek={seek} />
		{/if}
		{#if watch.bankedMs > 0}
			<p
				class="flex items-center gap-2 rounded-xl bg-done-soft px-3 py-[9px] text-[13px] font-bold text-done tabular-nums"
			>
				<Icon name="clock" size={18} />
				{clock(elapsedMs(watch, Date.now()) / 1000)} practised — Play carries on
			</p>
		{/if}
		{#if songGone}
			<Banner kind="warning" title="Its song is not ready">Pick another, or use the count.</Banner>
		{/if}
		{#if startError}
			<Banner kind="error" title={startError} />
		{/if}

		{#if expanded}
			<div class="flex flex-col gap-3 border-t border-hairline pt-3">
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
					<legend class={GROUP_LABEL}>Voice count</legend>
					<CountChips
						label="Voice count"
						name="panel-count"
						patterns={dance.countPatterns}
						value={count}
						onchange={(p) => (count = p)}
					/>
				</fieldset>

				{#if dance.clave}
					<fieldset>
						<legend class={GROUP_LABEL}>Clave</legend>
						<ClaveChips
							label="Clave"
							name="panel-clave"
							value={clave}
							onchange={(c) => (clave = c)}
						/>
					</fieldset>
				{/if}

				{#if cue}
					<fieldset>
						<legend class={GROUP_LABEL}>Call it on cue</legend>
						<div class="flex flex-wrap gap-1.5">
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
