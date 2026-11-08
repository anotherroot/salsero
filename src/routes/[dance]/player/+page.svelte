<script lang="ts">
	import { onDestroy, tick } from 'svelte';
	import { entryState } from '$lib/sheets/history.svelte';
	import { page } from '$app/state';
	import { backFor, goBack } from '$lib/nav/trail.svelte';
	import Running from '$lib/components/player/Running.svelte';
	import SaveSetSheet from '$lib/components/player/SaveSetSheet.svelte';
	import Setup, { type PlayerSettings } from '$lib/components/player/Setup.svelte';
	import { loadSongGrid } from '$lib/components/player/songGrid.svelte';
	import { parsePracticeConfig, practiceOf } from '$lib/exercises/practice';
	import { rememberPractice } from '$lib/exercises/practice-api';
	import type { Speed } from '$lib/labels';
	import { createPlayer, type PlayerHandle } from '$lib/scheduler/attach';
	import { routinePlan } from '$lib/routines/plan';
	import { flatten, slotAt } from '$lib/routines/routines';
	import { syntheticGrid } from '$lib/scheduler/scheduler';
	import { exerciseLine, runSubtitle, runSummary } from '$lib/player/view';
	import { announceSaved } from '$lib/exercises/saved.svelte';
	import { savedMessage } from '$lib/exercises/done-view';
	import type { DoneResult } from '$lib/types';
	import { t } from '$lib/i18n/catalog';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let mode = $state<'setup' | 'running' | 'done'>('setup');

	// Where the load says to start, overridden by the picker. Writable
	// `$derived` rather than `$state`: this route is reused across a param
	// change (another dance, another `?song=`), and then the start must follow.
	let source = $derived(data.start.source);
	let songId = $derived(data.start.songId);
	// What the exercise remembers as this page knows it (loaded, or last posted at Play).
	let known = $derived(data.exercise ? practiceOf(data.exercise, data.dance) : null);
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
	let calledFigureId = $state<number | null>(null);
	/** Where the last call sat in the plan, so a routine run can say which slot it is on. */
	let calledIndex = $state<number | null>(null);
	let calledIds = $state<number[]>([]);

	/**
	 * The routine as it is actually danced: children spliced in, slots the graph
	 * cannot answer for dropped. This is exactly what `routinePlan` walks, which
	 * is why `calledIndex % length` is the slot the run is on — and why the list
	 * shown while running is this rather than the routine's own slot rows.
	 */
	const dancedSlots = $derived(
		data.routine
			? flatten(data.graph, data.routine.shape).map((s) => ({
					figureIds: s.figureIds,
					note: s.note ?? null
				}))
			: []
	);
	const activeSlot = $derived(slotAt(calledIndex, dancedSlots.length));
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
		callEvery: PlayerSettings['callEvery'];
	} | null>(null);

	/**
	 * How many called figures to spell out. A long routine run calls one every few
	 * seconds, so the raw list grows without bound; the summary is only ever read
	 * back by a person looking at what a session was. `calls` keeps the true
	 * total, so capping the list loses nothing that matters.
	 */
	const MAX_CALLED = 250;

	const runJson = $derived(
		JSON.stringify({
			// The exercise page's panel logs the same three, so a set says what it was danced to.
			source: runningSong ? 'song' : 'count',
			songId: runningSong?.id ?? null,
			bpm: runningBpm,
			speed,
			count: runToggles?.count ?? 'off',
			clave: runToggles?.clave ?? null,
			callEvery: runToggles?.callEvery ?? null,
			calls: calledIds.length,
			called: calledIds.slice(-MAX_CALLED)
		})
	);

	function sayOf(id: number): string {
		// The routine's figures, by id: a variation is said as its figure.
		return data.callNames.find((f) => f.id === id)?.say ?? '';
	}

	/** Set when the run ended through the band's back, so Save this run then leaves. */
	let leaving = $state(false);

	/** `leave`: the band's back ended the run, not Stop or the song's end. */
	function finish(leave = false) {
		if (!player) return;
		leaving = leave;
		calledIds = player.called();
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
		runToggles = { count: settings.count, clave: settings.clave, callEvery: settings.callEvery };
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
		// No shape means no planner and no pool: the run is count and clave only.
		const shape = data.routine?.shape ?? null;
		const pool = data.routine?.figureIds ?? [];
		const graph = data.graph;

		const handle = createPlayer({
			audio: useSong && el ? el : null,
			grid,
			toggles: { count: settings.count, clave: settings.clave, callEvery: settings.callEvery },
			pool,
			planner: shape
				? (plan, every, through, rand) => routinePlan(plan, shape, graph, every, through, rand)
				: undefined,
			// Only the chosen pattern's takes: a salsa recording must never stand in
			// for a son run, whose words fall on different counts entirely.
			takes: data.takes.filter((t) => t.pattern === settings.count),
			sayOf,
			voiceVolume: settings.voiceVolume,
			onCall: (id, index) => {
				calledFigureId = id;
				calledIndex = index;
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
		// Remember the choices on the exercise, as the exercise page's panel does, so the
		// next run for it opens on the same song. Its call interval is the
		// panel's and is kept as it was: the two players offer different ones.
		// Only a change from what the page knows is posted (`practiceToPost`).
		if (data.exercise) {
			const kept = parsePracticeConfig(data.exercise.practiceJson, data.dance);
			known = rememberPractice(
				data.dance.slug,
				data.exercise.id,
				{
					source: useSong ? 'song' : 'count',
					songId,
					bpm: settings.bpm,
					config: { ...kept, count: settings.count, clave: settings.clave, speed: settings.speed }
				},
				known
			);
		}
		calledFigureId = null;
		calledIndex = null;
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

	/**
	 * Save this run logged the run: however it ended, leave as the band's back
	 * would, with "Saved · back in 12 days · Undo" on the screen it lands on.
	 */
	async function saved(r: DoneResult) {
		announceSaved({
			dance: data.dance.slug,
			message: savedMessage(r.backDays ?? 1),
			undo: { setId: r.setId, before: r.before }
		});
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

<svelte:head><title>{t().player.pageTitle(data.dance.label)}</title></svelte:head>

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
		rememberedBpm={data.start.bpm}
		songGone={data.start.songGone}
		defaultBpm={data.bpm}
		dance={data.dance}
		routine={data.routine}
		onplay={handlePlay}
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
			{calledFigureId}
			slots={dancedSlots}
			{activeSlot}
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
			}}
			onstop={handleStop}
			title={runningSong?.title ?? t().player.title}
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
		summary={runSummary(
			finalElapsed,
			data.routine !== null && runToggles?.callEvery != null ? calledIds.length : null
		)}
		durationS={finalElapsed}
		run={runJson}
		fail={form && 'message' in form && form.message !== undefined ? form : null}
		onclose={closeSave}
		onsaved={saved}
	/>
{/if}
