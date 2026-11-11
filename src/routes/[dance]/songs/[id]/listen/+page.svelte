<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import { resolve } from '$app/paths';
	import { goBack } from '$lib/nav/trail.svelte';
	import { median } from '$lib/beatgrid/beatgrid';
	import { button } from '$lib/components/ui/styles';
	import Icon from '$lib/components/ui/Icon.svelte';
	import DropRun from '$lib/components/hearing/DropRun.svelte';
	import ListenReplay from '$lib/components/hearing/ListenReplay.svelte';
	import ListenSetup from '$lib/components/hearing/ListenSetup.svelte';
	import ListenShell from '$lib/components/hearing/ListenShell.svelte';
	import ResultB from '$lib/components/hearing/ResultB.svelte';
	import TapAlongRun from '$lib/components/hearing/TapAlongRun.svelte';
	import TapCheck from '$lib/components/hearing/TapCheck.svelte';
	import { fullVolume } from '$lib/components/hearing/fade';
	import { DROPS, dropStarts } from '$lib/hearing/drops';
	import { replayPlan, type ReplayPlan } from '$lib/hearing/replay';
	import { roundSpan, songParts, type FinishedDrop, type RoundKind } from '$lib/hearing/round';
	import { loadTapDelay } from '$lib/hearing/tap-delay';
	import {
		loadOwnCounts,
		saveOwnCounts,
		targetPositions,
		targetsFor,
		type TargetId
	} from '$lib/hearing/targets';
	import { targetLabel } from '$lib/hearing/words';
	import { t } from '$lib/i18n/catalog';
	import type { ClavePattern } from '$lib/labels';
	import { loadDelayCorrection } from '$lib/player/sound-delay';
	import { createPlayer, type PlayerHandle } from '$lib/scheduler/attach';
	import { quietRanges } from '$lib/scheduler/quiet';
	import { syntheticGrid } from '$lib/scheduler/scheduler';
	import { placeSections, sectionName } from '$lib/songs/sections';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	const w = $derived(t().hearing);

	const grid = $derived({ beats: data.grid.beats, counts: data.grid.counts });
	const placed = $derived(placeSections(data.grid.sections, grid.beats, grid.counts));
	const quiet = $derived(quietRanges(data.grid.sections, grid.beats, grid.counts));
	const parts = $derived(songParts(placed));
	const beatS = $derived(
		grid.beats.length > 1 ? median(grid.beats.slice(1).map((b, i) => b - grid.beats[i])) : 0.5
	);
	const songHref = $derived(resolve(`/${data.dance.slug}/songs/${data.song.id}`));

	// The round's choices.
	let kind = $state<RoundKind>('tapAlong');
	let target = $state<TargetId>('one');
	let clave = $state<ClavePattern>('2-3');
	let part = $state<number | null>(null);
	let own = $state<number[]>([3]);
	const positions = $derived(targetPositions(target, target === 'clave' ? clave : null, own));
	const runSubtitle = $derived(`${data.song.title} · ${targetLabel(target, own)}`);

	let view = $state<'setup' | 'check' | 'run' | 'result' | 'replay'>('setup');
	/** Null until read in the browser, and while never checked. */
	let tapDelayMs = $state<number | null>(null);
	/** Skipped the check this visit: rounds run with 0 and nothing is stored. */
	let skipped = false;
	/** Where the check goes when it is done: back to the setup, or on into the round. */
	let afterCheck: 'setup' | 'run' = 'setup';

	onMount(() => {
		tapDelayMs = loadTapDelay();
		own = loadOwnCounts();
	});

	let audio = $state<HTMLAudioElement>();
	let player = $state.raw<PlayerHandle | null>(null);
	let runKind = $state<RoundKind>('tapAlong');
	let starts = $state.raw<number[]>([]);
	let span = $state.raw({ play: 0, judgeFrom: 0, to: Infinity });
	let drops = $state.raw<FinishedDrop[]>([]);
	let replayAt = $state(0);
	let plan = $state.raw<ReplayPlan | null>(null);

	/** The song with the count off and no voice: the person finds the count. */
	function songPlayer(el: HTMLAudioElement): PlayerHandle {
		return createPlayer({
			audio: el,
			grid,
			toggles: { count: 'off', clave: null },
			quiet,
			voiceVolume: 0,
			delayCorrectionMs: loadDelayCorrection(),
			onStep: () => {},
			onEnd: () => {}
		});
	}

	/** Starts `handle` inside the current tap; a start that a Stop or Back overtook is dropped. */
	function startPlayer(handle: PlayerHandle, onFail: () => void) {
		player = handle;
		handle.start().catch((e) => {
			if (player !== handle) return;
			console.error(e);
			stopPlayer();
			onFail();
		});
	}

	function stopPlayer() {
		player?.stop();
		player = null;
	}

	/** Hear the clave: two eights of the count with the clave on, at the song's tempo. Runs inside the tap. */
	let hearing: PlayerHandle | null = null;
	function hearClave() {
		hearing?.stop();
		const handle = createPlayer({
			audio: null,
			grid: syntheticGrid(Math.round(60 / beatS), 2),
			toggles: { count: 'all', clave },
			voiceVolume: 1,
			delayCorrectionMs: loadDelayCorrection(),
			onStep: () => {},
			onEnd: () => {
				handle.stop();
				if (hearing === handle) hearing = null;
			}
		});
		hearing = handle;
		handle.start().catch((e) => console.error(e));
	}

	/** The Start tap: the check first on a browser never checked, else the round. */
	function begin() {
		if (tapDelayMs === null && !skipped) {
			afterCheck = 'run';
			view = 'check';
			return;
		}
		startRound();
	}

	/** Runs inside a tap: nothing is awaited before `start()` (iOS keeps the audio locked otherwise). */
	function startRound() {
		const el = audio;
		if (!el) return;
		hearing?.stop();
		if (target === 'own') saveOwnCounts(own);
		runKind = kind;
		if (kind === 'tapAlong') {
			span = roundSpan(part === null ? null : parts[part], data.grid.startS, beatS);
			el.currentTime = span.play;
		} else {
			starts = dropStarts(grid, quiet, { count: DROPS, from: data.grid.startS, rand: Math.random });
			if (starts.length === 0) return;
			el.currentTime = starts[0];
		}
		fullVolume(el);
		startPlayer(songPlayer(el), () => (view = 'setup'));
		view = 'run';
	}

	/** The round is over (its end, Stop): the result, or the setup when nothing was finished. */
	function finish(list: FinishedDrop[]) {
		stopPlayer();
		drops = list;
		view = list.length ? 'result' : 'setup';
	}

	/** ▶ on a drop: its music again, inside the tap. */
	function replay(i: number) {
		const el = audio;
		if (!el) return;
		const p = replayPlan(
			grid,
			drops[i].answer,
			Number.isFinite(el.duration) ? el.duration : Infinity
		);
		if (!p) return;
		plan = p;
		replayAt = i;
		el.currentTime = p.from;
		fullVolume(el);
		startPlayer(songPlayer(el), () => (view = 'result'));
		view = 'replay';
	}

	function leave() {
		stopPlayer();
		// Back through history, as the player does: a new entry would bring Back to this page again.
		void goBack({ href: songHref, label: data.song.title }, { replace: true });
	}

	onDestroy(() => {
		stopPlayer();
		hearing?.stop();
	});
</script>

<svelte:head><title>{w.pageTitle(data.dance.label)}</title></svelte:head>

<!-- Mounted from the first render: `createPlayer` needs the element inside the Start tap. -->
<audio bind:this={audio} src="/audio/{data.grid.audioFile}" preload="auto" hidden></audio>

{#if view === 'check'}
	<TapCheck
		subtitle={data.song.title}
		onback={() => (view = 'setup')}
		ondone={(ms) => {
			if (ms === null) skipped = true;
			else tapDelayMs = ms;
			view = 'setup';
			if (afterCheck === 'run') {
				afterCheck = 'setup';
				startRound();
			}
		}}
	/>
{:else if view === 'setup'}
	<ListenShell title={w.card.title} subtitle={data.song.title} backLabel={w.back} onback={leave}>
		{#snippet stage()}
			<span class="text-band-ink"><Icon name="ear" size={56} /></span>
			<p class="max-w-[300px] text-[15px] font-semibold text-band-small">{w.kindSub[kind]}</p>
		{/snippet}
		<ListenSetup
			bind:kind
			bind:target
			bind:clave
			bind:own
			bind:part
			targets={targetsFor(data.dance)}
			parts={parts.map((p) => sectionName(p))}
			{tapDelayMs}
			onhearclave={hearClave}
			oncheck={() => {
				afterCheck = 'setup';
				view = 'check';
			}}
		/>
		{#snippet bar()}
			<button
				type="button"
				class={button('primary', 'lg', true)}
				disabled={positions.length === 0}
				onclick={begin}
			>
				<Icon name="play" size={22} filled />{w.setup.start}
			</button>
		{/snippet}
	</ListenShell>
{:else if view === 'run' && player && audio}
	{#if runKind === 'dropped'}
		<DropRun
			{player}
			{audio}
			{grid}
			sections={placed}
			{positions}
			{beatS}
			{starts}
			tapDelayMs={tapDelayMs ?? 0}
			title={w.kinds.dropped}
			subtitle={runSubtitle}
			padLabel={w.tapOn[target]}
			onfinish={finish}
			onleave={leave}
		/>
	{:else}
		<TapAlongRun
			{player}
			{audio}
			{grid}
			{quiet}
			sections={placed}
			{positions}
			{span}
			tapDelayMs={tapDelayMs ?? 0}
			title={w.kinds.tapAlong}
			subtitle={runSubtitle}
			padLabel={w.tapOn[target]}
			onfinish={finish}
			onleave={leave}
		/>
	{/if}
{:else if view === 'result'}
	<ResultB
		{drops}
		kind={runKind}
		{positions}
		{beatS}
		subtitle="{data.song.title} · {w.kinds[runKind]} · {targetLabel(target, own)}"
		onreplay={replay}
		onagain={begin}
		ondone={leave}
	/>
{:else if view === 'replay' && player && audio && plan}
	<ListenReplay
		{player}
		{audio}
		{grid}
		{plan}
		drop={drops[replayAt]}
		{positions}
		n={replayAt + 1}
		subtitle={runSubtitle}
		onback={() => {
			stopPlayer();
			view = 'result';
		}}
	/>
{/if}
