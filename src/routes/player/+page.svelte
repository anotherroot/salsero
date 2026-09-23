<script lang="ts">
	import { onDestroy } from 'svelte';
	import { resolve } from '$app/paths';
	import Running from '$lib/components/player/Running.svelte';
	import SaveSetSheet from '$lib/components/player/SaveSetSheet.svelte';
	import Setup, { type PlayerSettings } from '$lib/components/player/Setup.svelte';
	import type { Speed } from '$lib/labels';
	import { createPlayer, type PlayerHandle } from '$lib/scheduler/attach';
	import { syntheticGrid } from '$lib/scheduler/scheduler';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let mode = $state<'setup' | 'running' | 'done'>('setup');
	let audio: HTMLAudioElement | undefined = $state();
	let player = $state<PlayerHandle | null>(null);
	let speed = $state<Speed>(1);
	let calledFigureId = $state<number | null>(null);
	let calledIds = $state<number[]>([]);
	let finalElapsed = $state(0);
	let startError = $state<string | null>(null);
	/** The grid the running player was actually built with — song or synthetic. */
	let runningGrid = $state<{ beats: number[]; counts: number[] } | null>(null);
	/** The toggles the run was actually started with, for `player_json` at the end. */
	let runToggles = $state<{
		count: boolean;
		clave: PlayerSettings['clave'];
		callEvery: PlayerSettings['callEvery'];
	} | null>(null);

	/**
	 * How many called figures to spell out. A long drill calls one every few
	 * seconds, so the raw list grows without bound; the summary is only ever read
	 * back by a person looking at what a session was. `calls` keeps the true
	 * total, so capping the list loses nothing that matters.
	 */
	const MAX_CALLED = 250;

	const runJson = $derived(
		JSON.stringify({
			speed,
			count: runToggles?.count ?? false,
			clave: runToggles?.clave ?? null,
			callEvery: runToggles?.callEvery ?? null,
			calls: calledIds.length,
			called: calledIds.slice(-MAX_CALLED)
		})
	);

	function sayOf(id: number): string {
		return data.figures.find((f) => f.id === id)?.say ?? '';
	}

	function finish() {
		if (!player) return;
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
		startError = null;
		speed = settings.speed;
		runToggles = { count: settings.count, clave: settings.clave, callEvery: settings.callEvery };
		const grid =
			data.song && data.grid && settings.source === 'song'
				? data.grid
				: syntheticGrid(settings.bpm, 400);

		const handle = createPlayer({
			audio: data.song && settings.source === 'song' ? (audio ?? null) : null,
			grid,
			toggles: { count: settings.count, clave: settings.clave, callEvery: settings.callEvery },
			pool: settings.figureIds,
			sayOf,
			voiceVolume: settings.voiceVolume,
			onCall: (id) => (calledFigureId = id),
			onEnd: () => finish()
		});

		try {
			await handle.start();
		} catch (e) {
			startError = e instanceof Error ? e.message : 'Could not start the player.';
			return;
		}
		player = handle;
		runningGrid = grid;
		calledFigureId = null;
		mode = 'running';
	}

	function handleStop() {
		finish();
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

<svelte:head><title>Player · Salsa</title></svelte:head>

<header
	class="sticky top-0 z-20 flex items-center gap-2 border-b border-line bg-plane/95 px-2 py-2 backdrop-blur"
	style="padding-top: max(env(safe-area-inset-top), 0.5rem)"
>
	<a
		href={resolve('/')}
		class="grid size-11 place-items-center rounded-full text-[22px] text-ink-2"
		aria-label="Back to Today">‹</a
	>
	<h1 class="min-w-0 flex-1 truncate text-[17px] font-semibold">
		{data.song?.title ?? 'Practice'}
	</h1>
</header>

<main class="space-y-4 px-4 pt-4 pb-4">
	{#if startError}
		<p class="rounded-lg bg-danger/10 px-3 py-2 text-[13px] text-danger" role="alert">
			{startError}
		</p>
	{/if}

	<!--
		Always mounted whenever there is a song, from the very first render, so
		`audio` is a real element before Play is ever pressed — `createPlayer`
		needs it at that moment, not after the screen switches to "running".
		Hidden until then; `controls` stays on so seeking works while running.
	-->
	{#if data.song}
		<audio
			bind:this={audio}
			src="/audio/{data.song.audioFile}"
			controls
			preload="auto"
			class="w-full {mode === 'running' ? '' : 'hidden'}"
		></audio>
	{/if}

	{#if mode === 'setup'}
		<Setup
			song={data.song}
			defaultBpm={data.bpm ?? 180}
			figures={data.figures}
			onplay={handlePlay}
		/>
	{:else if mode === 'running' && player && runningGrid}
		<Running
			{player}
			beats={runningGrid.beats}
			counts={runningGrid.counts}
			figures={data.figures}
			{calledFigureId}
			song={data.song}
			{audio}
			{speed}
			onstop={handleStop}
		/>
	{:else if mode === 'done'}
		<SaveSetSheet
			exercise={data.exercise && { id: data.exercise.id, name: data.exercise.name }}
			exercises={data.exercises}
			durationS={finalElapsed}
			calledCount={calledIds.length}
			run={runJson}
			fail={form && 'message' in form ? form : null}
			onclose={() => (mode = 'setup')}
		/>
	{/if}
</main>
