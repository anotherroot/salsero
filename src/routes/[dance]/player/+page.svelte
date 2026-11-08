<script lang="ts">
	import { onDestroy, tick, untrack } from 'svelte';
	import { entryState } from '$lib/sheets/history.svelte';
	import { page } from '$app/state';
	import { backFor, goBack } from '$lib/nav/trail.svelte';
	import Running from '$lib/components/player/Running.svelte';
	import SaveSetSheet from '$lib/components/player/SaveSetSheet.svelte';
	import Setup, { type PlayerSettings } from '$lib/components/player/Setup.svelte';
	import { loadSongGrid } from '$lib/components/player/songGrid.svelte';
	import { practiceOf } from '$lib/exercises/practice';
	import { practiceSaver } from '$lib/exercises/practice-api';
	import {
		loadRoutineView,
		saveRoutineView,
		savePhonePractice
	} from '$lib/exercises/phone-practice';
	import { figureById } from '$lib/graph/graph';
	import type { Speed } from '$lib/labels';
	import { createPlayer, type PlayerHandle } from '$lib/scheduler/attach';
	import { routinePlan } from '$lib/routines/plan';
	import { flatten } from '$lib/routines/routines';
	import { syntheticGrid } from '$lib/scheduler/scheduler';
	import { exerciseLine, runSubtitle, runSummary, type RoutineView } from '$lib/player/view';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let mode = $state<'setup' | 'running' | 'done'>('setup');

	// Where the load says to start, overridden by the picker. Writable
	// `$derived` rather than `$state`: this route is reused across a param
	// change (another dance, another `?song=`), and then the start must follow.
	let source = $derived(data.start.source);
	let songId = $derived(data.start.songId);
	// What the exercise remembers as this page knows it (loaded, or last posted at Play).
	// What the exercise remembers, kept as settings change (`practiceSaver`).
	// One saver per exercise: keyed on its id, so newer data for the same
	// exercise only resets what it knows, and a waiting change is flushed when
	// the exercise changes under this reused route, or the page goes.
	const exerciseId = $derived(data.exercise?.id ?? null);
	const saver = $derived(
		exerciseId === null
			? null
			: practiceSaver(
					data.dance.slug,
					exerciseId,
					untrack(() => (data.exercise ? practiceOf(data.exercise, data.dance) : null))
				)
	);
	$effect(() => {
		const loaded = data.exercise ? practiceOf(data.exercise, data.dance) : null;
		untrack(() => saver?.reset(loaded));
	});
	$effect(() => {
		const s = saver;
		if (!s) return;
		const flush = () => s.flush();
		window.addEventListener('pagehide', flush);
		return () => {
			window.removeEventListener('pagehide', flush);
			s.flush();
		};
	});

	/**
	 * Keep a choice on the exercise. A run's song is the one it plays: one that
	 * did not load ran on the count.
	 */
	function keep(s: Pick<PlayerSettings, 'source' | 'bpm' | 'count' | 'clave' | 'speed'>) {
		saver?.change({
			source: s.source,
			songId,
			bpm: s.bpm,
			config: { count: s.count, clave: s.clave, speed: s.speed }
		});
	}
	const song = loadSongGrid(
		() => data.dance.slug,
		() => (source === 'song' ? songId : null)
	);
	const picked = $derived(
		source === 'song' && songId !== null && song.grid
			? {
					id: songId,
					title: data.songs.find((s) => s.id === songId)?.title ?? '',
					audioFile: song.grid.audioFile
				}
			: null
	);
	let audio: HTMLAudioElement | undefined = $state();
	let player = $state<PlayerHandle | null>(null);
	let speed = $state<Speed>(1);
	/** The routine's figure on now, from its "1": the step the player last reported. */
	let nowFigureId = $state<number | null>(null);
	/** Which of `dancedSlots` the run is on, or null before the first figure starts. */
	let activeSlot = $state<number | null>(null);
	/** Song time of the figure's "1", for the bar under it. */
	let stepAt = $state<number | null>(null);
	let dancedIds = $state<number[]>([]);
	/**
	 * Follow or Still, this phone's choice for this routine. Writable `$derived`:
	 * the route is reused across `?routine=`, and then it must follow.
	 */
	let routineView = $derived<RoutineView>(
		data.routine ? loadRoutineView(data.dance.slug, data.routine.id) : 'follow'
	);
	function setView(v: RoutineView) {
		routineView = v;
		if (data.routine) saveRoutineView(data.dance.slug, data.routine.id, v);
	}

	/**
	 * The routine as it is actually danced: children spliced in, slots the graph
	 * cannot answer for dropped. This is exactly what `routinePlan` walks, so a
	 * step's `slot` indexes it — which is why the list shown while running is
	 * this rather than the routine's own slot rows.
	 */
	const dancedSlots = $derived(
		data.routine
			? flatten(data.graph, data.routine.shape).map((s) => ({
					figureIds: s.figureIds,
					note: s.note ?? null
				}))
			: []
	);
	/** The figure on now's length in counts, for the marks under it. */
	const nowLength = $derived(
		nowFigureId === null ? 8 : (figureById(data.graph, nowFigureId)?.length ?? 8)
	);
	/** The settings the run started with, so a count changed mid-run is kept with the rest. */
	let runSettings: PlayerSettings | null = null;
	let finalElapsed = $state(0);
	/** The last Play threw. The screen says so in fixed words; the console has the error. */
	let startError = $state(false);
	let starting = $state(false);
	let voiceVolume = $state(1);
	/** The grid the running player was actually built with — song or synthetic. */
	let runningGrid = $state<{ beats: number[]; counts: number[] } | null>(null);
	/** The song the running player was built with, or null for count only. */
	let runningSong = $state<{ id: number; title: string; audioFile: string } | null>(null);
	/** The count-only tempo of the run, for `player_json`. */
	let runningBpm = $state<number | null>(null);
	/**
	 * The toggles the run is running with, for `player_json` at the end. The
	 * count pattern can be changed mid-run, so this is the pattern in force when
	 * the run ENDS — which is the one that describes most of it.
	 */
	let runToggles = $state<{
		count: PlayerSettings['count'];
		clave: PlayerSettings['clave'];
	} | null>(null);

	/**
	 * How many danced figures to spell out. A long routine run starts one every
	 * few seconds, so the raw list grows without bound; the summary is only ever
	 * read back by a person looking at what a session was. `figures` keeps the
	 * true total, so capping the list loses nothing that matters.
	 */
	const MAX_DANCED = 250;

	const runJson = $derived(
		JSON.stringify({
			// The popup's panel logs the same three, so a set says what it was danced to.
			source: runningSong ? 'song' : 'count',
			songId: runningSong?.id ?? null,
			bpm: runningBpm,
			speed,
			count: runToggles?.count ?? 'off',
			clave: runToggles?.clave ?? null,
			...(data.routine
				? { routineView, figures: dancedIds.length, danced: dancedIds.slice(-MAX_DANCED) }
				: {})
		})
	);

	/** Set when the run ended through the band's back, so Save this run then leaves. */
	let leaving = $state(false);

	/** `leave`: the band's back ended the run, not Stop or the song's end. */
	function finish(leave = false) {
		if (!player) return;
		leaving = leave;
		dancedIds = player.danced();
		finalElapsed = player.songTime();
		player.stop();
		player = null;
		mode = 'done';
	}

	/**
	 * Runs directly inside the Play button's click handler (see Setup.svelte).
	 * iOS only unlocks audio from a real user gesture, so nothing may be
	 * awaited before `player.start()` — creating the player and starting it
	 * happen first, synchronously, in this same call.
	 */
	async function handlePlay(settings: PlayerSettings) {
		// Starting takes a moment — resuming the context, then fetching and
		// decoding seven clips. The Play button stays on screen for all of it, so
		// without this a second impatient tap builds a SECOND player: the first is
		// the only one `player` holds, and the orphan keeps its own context,
		// interval and wake lock, counting out of phase with nothing able to stop
		// it short of reloading the page.
		if (starting) return;
		starting = true;
		try {
			await start(settings);
		} finally {
			starting = false;
		}
	}

	async function start(settings: PlayerSettings) {
		startError = false;
		speed = settings.speed;
		voiceVolume = settings.voiceVolume;
		runToggles = { count: settings.count, clave: settings.clave };
		// Read once, like the shape below: `picked` and `song` are reactive.
		const g0 = settings.source === 'song' ? song.grid : null;
		const el = audio;
		const useSong = g0 != null && el != null;
		const grid =
			useSong && g0 ? { beats: g0.beats, counts: g0.counts } : syntheticGrid(settings.bpm, 400);
		const runSong = useSong ? picked : null;
		// The run's speed on the element BEFORE the player is built: it picks
		// the voice's takes for the grid's tempo times `audio.playbackRate`, and
		// Running only sets the rate once it mounts — after start. Without this
		// the first run at 0.8× chose takes for 1×, and a later run the last
		// run's speed. Synchronous, so nothing is awaited before start().
		if (useSong && el) {
			el.playbackRate = settings.speed;
			el.preservesPitch = true;
		}

		// Read once, before the closure below is built: the planner runs inside
		// the 25 ms tick for the whole run, and a reactive read in there would
		// throw inside the audio loop if this route were ever reused for a URL
		// without `?routine=` — a silent failure repeating forty times a second.
		// No shape means no planner: the run is count and clave only.
		const shape = data.routine?.shape ?? null;
		const graph = data.graph;

		const handle = createPlayer({
			audio: useSong && el ? el : null,
			grid,
			toggles: { count: settings.count, clave: settings.clave },
			planner: shape
				? (plan, through, rand, from) => routinePlan(plan, shape, graph, through, rand, from)
				: undefined,
			// Only the chosen pattern's takes: a salsa recording must never stand in
			// for a son run, whose words fall on different counts entirely.
			takes: data.takes.filter((t) => t.pattern === settings.count),
			voiceVolume: settings.voiceVolume,
			onStep: (step, at) => {
				nowFigureId = step.figureId;
				activeSlot = step.slot;
				stepAt = at;
			},
			onEnd: () => finish()
		});

		try {
			await handle.start();
		} catch (e) {
			// The screen says "Could not start the player." in fixed words;
			// what was thrown is for whoever opens the console.
			console.error(e);
			startError = true;
			return;
		}
		player = handle;
		runningGrid = grid;
		runningSong = runSong;
		runningBpm = runSong ? null : settings.bpm;
		// Keep what the run plays on the exercise at once, not in a moment: the
		// run is what "last time" means. Only a change from what the page knows
		// is posted (`practiceToPost`).
		runSettings = { ...settings, source: useSong ? 'song' : 'count' };
		keep(runSettings);
		saver?.flush();
		nowFigureId = null;
		activeSlot = null;
		stepAt = null;
		mode = 'running';
	}

	let setup: ReturnType<typeof Setup> | undefined = $state();

	function handleStop() {
		finish();
	}

	/**
	 * Save this run closed without saving: a run ended by the band's back then
	 * goes where Back goes; Stop and the song's end come back to setup.
	 */
	async function closeSave() {
		const leave = leaving;
		leaving = false;
		mode = 'setup';
		if (!leave) {
			// The sheet that held focus is gone: put it on Play, not <body>.
			await tick();
			setup?.focusPlay();
			return;
		}
		await leaveRun();
	}

	/** Save this run logged the run: however it ended, leave as the band's back would. */
	async function saved() {
		leaving = false;
		mode = 'setup';
		await leaveRun();
	}

	/** The sheet has been told to go (`mode` is off 'done'): once it has, go to the opener. */
	async function leaveRun() {
		// The sheet's form is guarded, so a navigation while it is mounted
		// would ask "Unsaved changes" about the run: unmount it first, then leave.
		await tick();
		// The sheet's own history entry is still on top of the player's: let its
		// Back land first, then replace the player with where Back goes, so one
		// browser Back from there reaches the page before the player.
		if (entryState().sheets) {
			await new Promise<void>((done) => {
				const t = setTimeout(done, 600);
				window.addEventListener(
					'popstate',
					() => {
						clearTimeout(t);
						done();
					},
					{ once: true }
				);
			});
		}
		await goBack(data.back, { replace: true });
	}

	// A navigation away or a tab close must not leave an AudioContext or a
	// screen wake lock running.
	onDestroy(() => player?.stop());
	$effect(() => {
		const onUnload = () => player?.stop();
		window.addEventListener('beforeunload', onUnload);
		return () => window.removeEventListener('beforeunload', onUnload);
	});
</script>

<svelte:head><title>Practice · {data.dance.label}</title></svelte:head>

<!--
	Always mounted whenever there is a song, from the very first render, so
	`audio` is a real element before Play is ever pressed — `createPlayer`
	needs it at that moment, not after the screen switches to "running".
	Always hidden, with no browser controls: the app's own SongProgress seeks,
	and the device's volume keys set the song's level.
-->
{#if picked}
	<audio bind:this={audio} src="/audio/{picked.audioFile}" preload="auto" hidden></audio>
{/if}

<!-- Save this run is a sheet: it draws over the setup it returns to. -->
{#if mode !== 'running'}
	<Setup
		bind:this={setup}
		songs={data.songs}
		bind:source
		bind:songId
		songReady={picked !== null}
		songError={song.error}
		{audio}
		remembered={saver?.known ?? null}
		songGone={data.start.songGone}
		defaultBpm={data.bpm}
		dance={data.dance}
		routine={data.routine}
		view={routineView}
		onview={setView}
		onplay={handlePlay}
		onchange={keep}
		{starting}
		back={data.back}
		takes={data.takes}
		songBeats={song.grid?.beats ?? null}
		{startError}
	/>
{/if}

{#if mode === 'running' && player && runningGrid}
	<main>
		<Running
			{player}
			beats={runningGrid.beats}
			counts={runningGrid.counts}
			figures={data.callNames}
			{nowFigureId}
			slots={dancedSlots}
			{activeSlot}
			{stepAt}
			stepLength={nowLength}
			view={routineView}
			onview={setView}
			onjump={(slot) => player?.jumpTo(slot)}
			song={runningSong}
			{audio}
			{speed}
			initialVoiceVolume={voiceVolume}
			count={runToggles?.count ?? 'salsa'}
			dance={data.dance}
			oncount={(p) => {
				if (!runToggles) return;
				runToggles = { ...runToggles, count: p };
				player?.setToggles(runToggles);
				savePhonePractice(data.dance.slug, { count: p });
				if (runSettings) {
					runSettings = { ...runSettings, count: p };
					keep(runSettings);
				}
			}}
			onstop={handleStop}
			onvolume={(v) => savePhonePractice(data.dance.slug, { voiceVolume: v })}
			title={runningSong?.title ?? 'Practice'}
			subtitle={runSubtitle(
				{
					routine: data.routine?.name ?? null,
					song: !!runningSong,
					speed,
					bpm: runningBpm,
					clave: runToggles?.clave ?? null
				},
				data.dance
			)}
			backLabel={backFor(page.url.pathname, data.back).label}
			onback={() => finish(true)}
		/>
	</main>
{:else if mode === 'done'}
	<SaveSetSheet
		exercise={data.exercise && {
			id: data.exercise.id,
			name: data.exercise.name,
			line: exerciseLine({
				source: data.exercise.source,
				state: data.schedule,
				today: data.today
			})
		}}
		exercises={data.exercises}
		summary={runSummary(finalElapsed, data.routine !== null ? dancedIds.length : null)}
		durationS={finalElapsed}
		run={runJson}
		fail={form && 'message' in form ? form : null}
		onclose={closeSave}
		onsaved={saved}
	/>
{/if}
