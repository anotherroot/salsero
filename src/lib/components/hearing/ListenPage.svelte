<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import { goBack } from '$lib/nav/trail.svelte';
	import { median } from '$lib/beatgrid/beatgrid';
	import { button } from '$lib/components/ui/styles';
	import Icon from '$lib/components/ui/Icon.svelte';
	import DropRun from './DropRun.svelte';
	import ListenReplay from './ListenReplay.svelte';
	import ListenSetup from './ListenSetup.svelte';
	import ListenShell from './ListenShell.svelte';
	import ResultB from './ResultB.svelte';
	import TapAlongRun from './TapAlongRun.svelte';
	import TapCheck from './TapCheck.svelte';
	import { fullVolume } from './fade';
	import { hearingRound, type HearingRound, type HearingSettings } from '$lib/hearing/drill';
	import { DROPS, mixStarts, type MixedStart } from '$lib/hearing/drops';
	import { replayPlan, type ReplayPlan } from '$lib/hearing/replay';
	import {
		roundSpan,
		songParts,
		type DropRig,
		type FinishedDrop,
		type RoundKind
	} from '$lib/hearing/round';
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
	import type { Dance } from '$lib/dances/dances';
	import type { ClavePattern } from '$lib/labels';
	import { loadDelayCorrection } from '$lib/player/sound-delay';
	import { createPlayer, type PlayerHandle } from '$lib/scheduler/attach';
	import { quietRanges } from '$lib/scheduler/quiet';
	import { syntheticGrid } from '$lib/scheduler/scheduler';
	import { placeSections, sectionName } from '$lib/songs/sections';
	import type { SongGrid } from '$lib/types';

	/**
	 * The listening player (spec 2026-11-10): the setup, the tap delay check, a
	 * round, its result and a drop's replay, over one song (a song's page) or a
	 * hearing drill's several (phase 2: each spot in a random one of them, a
	 * tap-along round on one picked at random).
	 *
	 * `settings` null: the person picks the round (the song page). Given: the
	 * drill's round runs as set, and `ondone` gets what Done saves.
	 */
	interface Props {
		dance: Dance;
		songs: { id: number; title: string; grid: SongGrid }[];
		settings?: HearingSettings | null;
		/** The round was changed for this once (a link from Spremeni). */
		changed?: boolean;
		/** The setup's title, and the run's subtitle's first part. */
		title: string;
		name: string;
		backHref: string;
		backLabel: string;
		/** A drill's Done: the round to save. Absent, Done goes back. */
		ondone?: (round: HearingRound) => void;
	}

	let {
		dance,
		songs,
		settings = null,
		changed = false,
		title,
		name,
		backHref,
		backLabel,
		ondone
	}: Props = $props();
	const w = $derived(t().hearing);

	/** Each song as a round plays it. The element is bound below. */
	const rigsOf = $derived(
		songs.map((s) => {
			const grid = { beats: s.grid.beats, counts: s.grid.counts };
			const sections = placeSections(s.grid.sections, grid.beats, grid.counts);
			const beats = grid.beats;
			return {
				grid,
				sections,
				quiet: quietRanges(s.grid.sections, grid.beats, grid.counts),
				beatS: beats.length > 1 ? median(beats.slice(1).map((b, i) => b - beats[i])) : 0.5,
				startS: s.grid.startS
			};
		})
	);
	let audios = $state<HTMLAudioElement[]>([]);
	const rigs = $derived<DropRig[]>(rigsOf.map((r, i) => ({ ...r, audio: audios[i] })));
	const parts = $derived(songParts(rigsOf[0]?.sections ?? []));

	// The round's choices: the drill's, or picked in the setup.
	let kind = $state<RoundKind>('tapAlong');
	let target = $state<TargetId>('one');
	let clave = $state<ClavePattern>('2-3');
	let part = $state<number | null>(null);
	let own = $state<number[]>([3]);
	const positions = $derived(targetPositions(target, target === 'clave' ? clave : null, own));
	const runSubtitle = $derived(`${name} · ${targetLabel(target, own)}`);
	const dropCount = $derived(settings?.drops ?? DROPS);

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
		if (settings) {
			kind = settings.kind;
			target = settings.target;
			if (settings.clave) clave = settings.clave;
			if (settings.positions) own = [...settings.positions];
		}
	});

	let player = $state.raw<PlayerHandle | null>(null);
	let runKind = $state<RoundKind>('tapAlong');
	/** The song a tap-along round plays (an index into `songs`). */
	let cur = $state(0);
	let starts = $state.raw<MixedStart[]>([]);
	let span = $state.raw({ play: 0, judgeFrom: 0, to: Infinity });
	let drops = $state.raw<FinishedDrop[]>([]);
	let replayAt = $state(0);
	let plan = $state.raw<ReplayPlan | null>(null);

	/** A song with the count off and no voice: the person finds the count. */
	function songPlayer(i: number): PlayerHandle {
		return createPlayer({
			audio: audios[i],
			grid: rigsOf[i].grid,
			toggles: { count: 'off', clave: null },
			quiet: rigsOf[i].quiet,
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
			grid: syntheticGrid(Math.round(60 / (rigsOf[0]?.beatS ?? 0.5)), 2),
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

	/**
	 * iOS plays an element without a tap only once it played inside one: every
	 * other song of the round plays muted for a moment here, so a later spot can
	 * switch to it.
	 */
	function unlockOthers(first: number) {
		audios.forEach((el, i) => {
			if (i === first || !el) return;
			// Paused in the same tick: a pause that waited for playback could land after a
			// later spot switched to this song, and silence it.
			el.muted = true;
			const playing = el.play();
			el.pause();
			el.muted = false;
			playing?.catch(() => {});
		});
	}

	/** Runs inside a tap: nothing is awaited before `start()` (iOS keeps the audio locked otherwise). */
	function startRound() {
		hearing?.stop();
		stopPlayer();
		if (target === 'own' && !settings) saveOwnCounts(own);
		runKind = kind;
		let first: number;
		if (kind === 'tapAlong') {
			cur = Math.floor(Math.random() * songs.length);
			first = cur;
			const r = rigsOf[cur];
			span = roundSpan(part === null ? null : songParts(r.sections)[part], r.startS, r.beatS);
			if (!audios[cur]) return;
			audios[cur].currentTime = span.play;
		} else {
			starts = mixStarts(
				rigsOf.map((r) => ({ grid: r.grid, quiet: r.quiet, from: r.startS })),
				{ count: dropCount, rand: Math.random }
			);
			if (starts.length === 0) return;
			first = starts[0].song;
			if (!audios[first]) return;
			audios[first].currentTime = starts[0].at;
		}
		fullVolume(audios[first]);
		unlockOthers(first);
		startPlayer(songPlayer(first), () => (view = 'setup'));
		view = 'run';
	}

	/** The round is over (its end, Stop): the result, or the setup when nothing was finished. */
	function finish(list: FinishedDrop[]) {
		stopPlayer();
		drops = runKind === 'tapAlong' ? list.map((d) => ({ ...d, song: cur })) : list;
		view = list.length ? 'result' : 'setup';
	}

	/** ▶ on a drop: its music again, in its own song, inside the tap. */
	function replay(i: number) {
		const s = drops[i].song ?? 0;
		const el = audios[s];
		if (!el) return;
		const p = replayPlan(
			rigsOf[s].grid,
			drops[i].answer,
			Number.isFinite(el.duration) ? el.duration : Infinity
		);
		if (!p) return;
		plan = p;
		replayAt = i;
		el.currentTime = p.from;
		fullVolume(el);
		startPlayer(songPlayer(s), () => (view = 'result'));
		view = 'replay';
	}

	function leave() {
		stopPlayer();
		// Back through history, as the player does: a new entry would bring Back to this page again.
		void goBack({ href: backHref, label: backLabel }, { replace: true });
	}

	function done() {
		if (!ondone) return leave();
		stopPlayer();
		ondone(
			hearingRound(
				drops,
				{ kind: runKind, target, clave, positions: own },
				songs.map((s) => s.id),
				changed
			)
		);
	}

	onDestroy(() => {
		stopPlayer();
		hearing?.stop();
	});
</script>

<!-- Mounted from the first render: `createPlayer` needs the element inside the Start tap. -->
{#each songs as s, i (s.id)}
	<audio bind:this={audios[i]} src="/audio/{s.grid.audioFile}" preload="auto" hidden></audio>
{/each}

{#if view === 'check'}
	<TapCheck
		subtitle={name}
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
	<ListenShell {title} subtitle={name} backLabel={w.back} onback={leave}>
		{#snippet stage()}
			<span class="text-band-ink"><Icon name="ear" size={56} /></span>
			<p class="max-w-[300px] text-[15px] font-semibold text-band-small">{w.kindSub[kind]}</p>
		{/snippet}
		{#if !settings}
			<ListenSetup
				bind:kind
				bind:target
				bind:clave
				bind:own
				bind:part
				targets={targetsFor(dance)}
				parts={parts.map((p) => sectionName(p))}
				{tapDelayMs}
				onhearclave={hearClave}
				oncheck={() => {
					afterCheck = 'setup';
					view = 'check';
				}}
			/>
		{/if}
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
{:else if view === 'run' && player}
	{#if runKind === 'dropped'}
		<DropRun
			{player}
			{rigs}
			{positions}
			{starts}
			tapDelayMs={tapDelayMs ?? 0}
			title={w.kinds.dropped}
			subtitle={runSubtitle}
			padLabel={w.tapOn[target]}
			onfinish={finish}
			onleave={leave}
		/>
	{:else if audios[cur]}
		<TapAlongRun
			{player}
			audio={audios[cur]}
			grid={rigsOf[cur].grid}
			quiet={rigsOf[cur].quiet}
			sections={rigsOf[cur].sections}
			{positions}
			{span}
			tapDelayMs={tapDelayMs ?? 0}
			title={w.kinds.tapAlong}
			subtitle="{songs[cur].title} · {targetLabel(target, own)}"
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
		beatS={rigsOf.map((r) => r.beatS)}
		songTitles={songs.map((s) => s.title)}
		subtitle="{name} · {w.kinds[runKind]} · {targetLabel(target, own)}"
		onreplay={replay}
		onagain={begin}
		ondone={done}
	/>
{:else if view === 'replay' && player && plan && audios[drops[replayAt].song ?? 0]}
	<ListenReplay
		{player}
		audio={audios[drops[replayAt].song ?? 0]}
		grid={rigsOf[drops[replayAt].song ?? 0].grid}
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
