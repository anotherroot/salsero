<script lang="ts">
	import { onDestroy, onMount, tick, untrack } from 'svelte';
	import { beforeNavigate, invalidateAll, replaceState } from '$app/navigation';
	import { entryState } from '$lib/sheets/history.svelte';
	import { page } from '$app/state';
	import { backFor, goBack } from '$lib/nav/trail.svelte';
	import Running from '$lib/components/player/Running.svelte';
	import Setup, { type PlayerSettings } from '$lib/components/player/Setup.svelte';
	import { loadSongGrid } from '$lib/components/player/songGrid.svelte';
	import { practiceOf } from '$lib/exercises/practice';
	import { practiceSaver, reloadAfterLeave } from '$lib/exercises/practice-api';
	import {
		loadRoutineView,
		saveRoutineView,
		savePhonePractice
	} from '$lib/exercises/phone-practice';
	import { figureById } from '$lib/graph/graph';
	import type { Speed } from '$lib/labels';
	import { createPlayer, type PlayerHandle } from '$lib/scheduler/attach';
	import { quietRanges } from '$lib/scheduler/quiet';
	import { countInCues, leadsOf } from '$lib/songs/count-in';
	import { placeSections, type Placed } from '$lib/songs/sections';
	import { playFrom } from '$lib/songs/music-start';
	import { routinePlan } from '$lib/routines/plan';
	import { flatten } from '$lib/routines/routines';
	import { syntheticGrid } from '$lib/scheduler/scheduler';
	import { mayAutoPlay, runSubtitle, runTitle, type RoutineView } from '$lib/player/view';
	import { loadDelayCorrection } from '$lib/player/sound-delay';
	import { typeOf } from '$lib/exercises/kinds';
	import { t } from '$lib/i18n/catalog';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let mode = $state<'setup' | 'running'>('setup');

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
	// Leaving for another page (Setup's Back, the browser's Back): the page it
	// lands on loads before this one is torn down, so a teardown flush would land
	// after that load and the Practise card would still name the old choice.
	// Flush now, and once both the post and the page have landed, load it again.
	beforeNavigate((nav) => {
		const s = saver;
		if (!s) return;
		// Leaving the app: the post goes out (keepalive); nothing is left to reload.
		if (nav.type === 'leave') {
			void s.flush();
			return;
		}
		void reloadAfterLeave(s.flush(), nav.complete, invalidateAll);
	});
	$effect(() => {
		const s = saver;
		if (!s) return;
		const flush = () => void s.flush();
		window.addEventListener('pagehide', flush);
		return () => {
			window.removeEventListener('pagehide', flush);
			void s.flush();
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
	/** The last Play threw. The screen says so in fixed words; the console has the error. */
	let startError = $state(false);
	let starting = $state(false);
	let voiceVolume = $state(1);
	/** The grid the running player was actually built with — song or synthetic. */
	/** The running song's sections, placed on its 1s: the band says where the run is. */
	let runningSections = $state<Placed[]>([]);
	let runningGrid = $state<{ beats: number[]; counts: number[] } | null>(null);
	/** The song the running player was built with, or null for count only. */
	let runningSong = $state<{ id: number; title: string; audioFile: string } | null>(null);
	/** The count-only tempo of the run, for the band. */
	let runningBpm = $state<number | null>(null);
	/** The toggles the run is running with; the count can change mid-run. */
	let runToggles = $state<{
		count: PlayerSettings['count'];
		clave: PlayerSettings['clave'];
	} | null>(null);

	/**
	 * The run ends and nothing is saved (the player logs nothing; Done on the
	 * exercise page does). `leave`: the band's back ended it, so go where Back
	 * goes; Stop and the song's end come back to setup, focus on Play.
	 */
	async function finish(leave = false) {
		if (!player) return;
		player.stop();
		player = null;
		mode = 'setup';
		await tick();
		if (leave) await leaveRun();
		else setup?.focusPlay();
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
			// Where the music starts (the song page's start): a song at 0:00 seeks there first.
			const from = g0 ? playFrom(el.currentTime, g0.startS, el.duration) : null;
			if (from !== null) el.currentTime = from;
		}
		// A song's sections with the count off, and its leads, play with no count and no clave;
		// a lead counts in 5 6 7 8 on the coming tempo (`$lib/songs/count-in`).
		const songSections = useSong && g0 ? g0.sections : [];

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
			quiet: quietRanges(songSections, grid.beats, grid.counts),
			countIn: countInCues(
				leadsOf(placeSections(songSections, grid.beats, grid.counts), grid.beats)
			),
			planner: shape
				? (plan, through, rand, from) => routinePlan(plan, shape, graph, through, rand, from)
				: undefined,
			// Only the chosen pattern's takes: a salsa recording must never stand in
			// for a son run, whose words fall on different counts entirely.
			takes: data.takes.filter((t) => t.pattern === settings.count),
			voiceVolume: settings.voiceVolume,
			delayCorrectionMs: loadDelayCorrection(),
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
		runningSections = placeSections(songSections, grid.beats, grid.counts);
		runningSong = runSong;
		runningBpm = runSong ? null : settings.bpm;
		// Keep what the run plays on the exercise at once, not in a moment: the
		// run is what "last time" means. Only a change from what the page knows
		// is posted (`practiceToPost`).
		runSettings = { ...settings, source: useSong ? 'song' : 'count' };
		keep(runSettings);
		void saver?.flush();
		nowFigureId = null;
		activeSlot = null;
		stepAt = null;
		mode = 'running';
	}

	/** What the run is for, first in the band's subtitle: a lesson's review is none of the three. */
	const runKind = $derived.by(() => {
		if (!data.exercise) return data.routine ? ('routine' as const) : null;
		const type = typeOf(data.exercise);
		// A hearing drill plays in its own listening player, never here.
		return type === 'lesson' || type === 'hearing' ? null : type;
	});

	let setup: ReturnType<typeof Setup> | undefined = $state();

	/*
	 * `?play=1` (the exercise page's ▶): start as soon as Play can, once. The
	 * param is dropped first, so Back or a reload never starts a run by itself.
	 * A song waits for its grid; one that fails leaves Setup as it is. If the
	 * browser will not start audio without a tap here, Play's own error shows.
	 */
	let autoPlay = $state(false);
	onMount(() => {
		if (page.url.searchParams.get('play') !== '1') return;
		// Without a tap in this page (a new tab, a reload) the browser would hold
		// the audio pending: then ▶ only opens Setup.
		autoPlay = mayAutoPlay(
			(navigator as Navigator & { userActivation?: { hasBeenActive: boolean } }).userActivation
		);
		const url = new URL(page.url);
		url.searchParams.delete('play');
		replaceState(url, page.state);
	});
	$effect(() => {
		if (!autoPlay || !setup || mode !== 'setup' || starting) return;
		if (source === 'song' && song.error) autoPlay = false;
		else if (source === 'count' || picked) {
			autoPlay = false;
			setup.playNow();
		}
	});

	function handleStop() {
		finish();
	}

	/** Go to the opener. */
	async function leaveRun() {
		// A layer of the run (the routine full screen) held a history entry: let its
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
		title={data.exercise?.name ?? t().player.title}
		details={data.details}
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
			details={data.details}
			sections={runningSections}
			clave={runToggles?.clave ?? null}
			onclave={(c) => {
				if (!runToggles) return;
				runToggles = { ...runToggles, clave: c };
				player?.setToggles(runToggles);
				savePhonePractice(data.dance.slug, { clave: c });
				if (runSettings) {
					runSettings = { ...runSettings, clave: c };
					keep(runSettings);
				}
			}}
			figureDetails={data.figureDetails}
			routineNotes={data.routine?.notes ?? null}
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
			title={runTitle({
				exercise: data.exercise?.name ?? null,
				routine: data.routine?.name ?? null,
				song: runningSong?.title ?? null
			})}
			subtitle={runSubtitle(
				{
					kind: runKind,
					songInTitle: !data.exercise && !data.routine,
					song: runningSong && {
						title: runningSong.title,
						bpm: data.songs.find((x) => x.id === runningSong?.id)?.bpm ?? null
					},
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
{/if}
