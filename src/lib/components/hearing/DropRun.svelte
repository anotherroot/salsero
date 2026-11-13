<script lang="ts">
	import { onDestroy, onMount, untrack } from 'svelte';
	import Icon from '$lib/components/ui/Icon.svelte';
	import { RUN_STOP } from '$lib/components/player/styles';
	import {
		countKeep,
		dropWindow,
		judgeDropPattern,
		type DropAnswer,
		type MixedStart
	} from '$lib/hearing/drops';
	import { judgedRows } from '$lib/hearing/rows';
	import { shownShift } from '$lib/hearing/score';
	import { posLabel } from '$lib/hearing/words';
	import { fadeTo, fullVolume } from './fade';
	import type { CircleState, DropRig, FinishedDrop } from '$lib/hearing/round';
	import {
		canSkip,
		endSpot,
		longestGapBeats,
		newSpot,
		restartSpot,
		skipSpot,
		stepSpot,
		tapSpot,
		type Spot
	} from '$lib/hearing/spot';
	import { tapSongTime } from '$lib/hearing/tap-delay';
	import { WIN_S } from '$lib/hearing/judge';
	import { t } from '$lib/i18n/catalog';
	import type { PlayerHandle } from '$lib/scheduler/attach';
	import { sectionName } from '$lib/songs/sections';
	import ListenShell from './ListenShell.svelte';
	import PatternRows from './PatternRows.svelte';
	import TapPad from './TapPad.svelte';
	import { BAR_SHARED, STAGE_SIGN } from './styles';

	/**
	 * A Dropped in round (spec 1b.2–1b.4): spot after spot, each listened to,
	 * tapped for two eights with no hint of how close, started over or skipped,
	 * then its colours, then the slide to the next. The page made the player
	 * inside the Start tap and seeked to the first spot.
	 */
	interface Props {
		player: PlayerHandle;
		/** The round's songs (one, or a hearing drill's several): each spot plays its own. */
		rigs: DropRig[];
		positions: number[];
		/** The spots, each in its song (`mixStarts`). */
		starts: MixedStart[];
		tapDelayMs: number;
		title: string;
		subtitle: string;
		padLabel: string;
		onfinish: (drops: FinishedDrop[]) => void;
		onleave: () => void;
	}

	let {
		player,
		rigs,
		positions,
		starts,
		tapDelayMs,
		title,
		subtitle,
		padLabel,
		onfinish,
		onleave
	}: Props = $props();
	const w = $derived(t().hearing);

	let index = $state(0);
	// The spot's song: what it plays, judges against and names its section from.
	const rig = $derived(rigs[starts[index].song]);
	const audio = $derived(rig.audio);
	const grid = $derived(rig.grid);
	const sections = $derived(rig.sections);
	const beatS = $derived(rig.beatS);

	/** The pad wakes this long after a spot's music starts. */
	const WAKE_MS = 1100;
	/** Between two circles taking their colours. */
	const REVEAL_STEP_MS = 70;
	/** How long the drop's result stays before the slide. */
	const HOLD_MS = 1400;
	/** The slide out, and the slide in. */
	const SLIDE_MS = 450;

	const circles = $derived(positions.length * 2);
	const eightS = $derived(8 * beatS);
	// lagS: the tap delay and the touch's lag (~80 ms), in song time, so an on-time last tap still counts.
	const rules = $derived({
		eightS,
		gapS: longestGapBeats(positions) * beatS,
		winS: WIN_S,
		beatS,
		lagS: ((tapDelayMs + 80) / 1000) * (audio.playbackRate || 1)
	});

	// The first spot: the page seeked there; a new round mounts this anew.
	let spot = $state<Spot>(newSpot(untrack(() => starts[0].at)));
	let locked = $state(true);
	let bounce = $state(0);
	let pop = $state<{ row: number; pos: number; key: number } | null>(null);
	let popKey = 0;
	let line = $state('');
	/** Under the line after a drop counted off: the verdict and a tip. */
	let tip = $state('');
	let big = $state('?');
	let slide = $state<'' | 'out' | 'in'>('in');
	/** The judged drop while its colours arrive; `shown` of its beats are coloured so far. */
	let judged = $state<DropAnswer | null>(null);
	let shown = $state(0);
	let skipBounce = $state(0);
	let finished: FinishedDrop[] = [];
	let raf = 0;
	/** Every timer still to run: cleared when the round goes. */
	let timers: ReturnType<typeof setTimeout>[] = [];
	/**
	 * The attempt a timer belongs to: a start-over, a Skip, the end of a spot and
	 * the move to the next each start a new one, and a timer from an older attempt
	 * does nothing (it would seek, play or unlock the wrong spot).
	 */
	let attempt = 0;
	/** A start-over is under way (sliding, seeking): no other one, and the rules wait. */
	let restarting = $state(false);
	function later(ms: number, fn: () => void) {
		const mine = attempt;
		const id = setTimeout(() => {
			timers = timers.filter((x) => x !== id);
			if (mine === attempt) fn();
		}, ms);
		timers.push(id);
	}

	/** While tapping: the person's two eights, filled in order, nothing about how close. */
	const tapping = $derived.by((): Record<number, CircleState>[] => {
		const out: Record<number, CircleState>[] = [{}, {}];
		const n = positions.length;
		positions.forEach((p, i) => {
			for (let r = 0; r < 2; r++) {
				const k = r * n + i;
				out[r][p] = k < spot.fill ? 'filled' : k === spot.fill ? 'next' : 'future';
			}
		});
		return out;
	});
	/** The judged beats in the order they come, for the colours arriving one by one. */
	const order = $derived(judged ? [...judged.beats].sort((a, b) => a.at - b.at) : []);
	/** After the drop: the music's eights it ran over, revealed up to the `shown`th beat (spec 1c.4, 1c.6). */
	const view = $derived.by(() => {
		if (!judged) return null;
		const until = shown >= order.length ? Infinity : shown > 0 ? order[shown - 1].at : -Infinity;
		return judgedRows(grid, judged, positions, until);
	});
	/** Before the first tap: the first tap says where the person starts, so the round says where to start. */
	const startOn = $derived(w.count.startOn(posLabel(Math.min(...positions))));
	const rowLabels = $derived(
		(view?.rows.length ? view.rows : [0, 1]).map((_, i) => w.eightRow(i + 1))
	);

	/** A spot's music from its start, fading in; the pad wakes once it plays. */
	function play(why: string) {
		locked = true;
		line = why;
		tip = '';
		big = '?';
		player.seek(spot.start);
		try {
			audio.volume = 0;
		} catch {
			// Read-only volume (iOS): it starts at full.
		}
		void player.resume();
		void fadeTo(audio, 1);
		later(WAKE_MS, () => {
			if (spot.phase === 'over') return;
			locked = false;
			bounce++;
			line = startOn;
		});
	}

	function frame() {
		const now = player.songTime();
		if (spot.phase !== 'over' && !restarting) {
			const step = stepSpot(spot, now, rules);
			const songOver = Number.isFinite(audio.duration) && now >= audio.duration - 0.05;
			if (step === 'restart' && !songOver)
				restart(spot.phase === 'listening' ? w.startOver.noTap : w.startOver.stopped);
			else if (step === 'end' || songOver) end();
		}
		raf = requestAnimationFrame(frame);
	}

	function tap(timeStamp: number) {
		if (locked || spot.phase === 'over') return;
		const at = tapSongTime(
			player.songTime(),
			performance.now() - timeStamp,
			tapDelayMs,
			audio.playbackRate
		);
		const before = spot.fill;
		spot = tapSpot(spot, at, spot.first === null ? dropWindow(grid, at, positions) : null, circles);
		line = w.keepTapping;
		if (spot.fill > before) {
			const k = spot.fill - 1;
			pop = {
				row: Math.floor(k / positions.length),
				pos: positions[k % positions.length],
				key: ++popKey
			};
		}
	}

	function restart(why: string) {
		if (spot.phase === 'over' || restarting) return;
		attempt++;
		restarting = true;
		const wasSkippable = canSkip(spot);
		spot = restartSpot(spot);
		if (canSkip(spot) && !wasSkippable) skipBounce++;
		locked = true;
		// The rules wait while `restarting`: the old place, still playing as it fades, starts nothing over.
		void fadeTo(audio, 0);
		slide = 'out';
		later(SLIDE_MS, () => {
			player.pause();
			player.seek(spot.start);
			restarting = false;
			slide = 'in';
			play(why);
		});
	}

	function sectionAt(at: number): string {
		const s = sections.findLast((x) => x.t <= at);
		return s ? sectionName(s) : '';
	}

	function end() {
		attempt++;
		const answer = judgeDropPattern(grid, positions, spot.start, spot.taps);
		spot = endSpot(spot);
		locked = true;
		judged = answer;
		shown = 0;
		big = `${answer.hits}/${answer.of}`;
		const keeps = Math.round(countKeep(answer.shift) * 100);
		line = answer.shift
			? `${w.count.off(shownShift(answer.shift))} · ${w.count.keeps(keeps)}`
			: spot.restarts
				? w.restartsLine(spot.restarts)
				: w.firstTry;
		const first = Math.min(...positions);
		tip = answer.shift
			? `${w.count.verdict(posLabel(first), posLabel(((first - 1 + answer.shift) % 8) + 1))}. ${
					answer.shift === 4 ? w.count.tip4 : answer.shift % 2 ? w.count.tip1 : w.count.tip2
				}`
			: '';
		[...answer.beats]
			.sort((a, b) => a.at - b.at)
			.forEach((b, i) =>
				later((i + 1) * REVEAL_STEP_MS, () => {
					shown = i + 1;
					pop = { row: b.row, pos: b.pos, key: ++popKey };
				})
			);
		finished.push({
			answer,
			restarts: spot.restarts,
			skipped: false,
			listenEights: (answer.listened ?? 0) / eightS,
			section: sectionAt(spot.window?.from ?? spot.start),
			song: starts[index].song
		});
		later(answer.beats.length * REVEAL_STEP_MS + HOLD_MS, next);
	}

	function skip() {
		if (!canSkip(spot)) return;
		attempt++;
		restarting = false;
		spot = skipSpot(spot);
		finished.push({
			answer: judgeDropPattern(grid, positions, spot.start, []),
			restarts: spot.restarts,
			skipped: true,
			listenEights: 0,
			section: sectionAt(spot.start),
			song: starts[index].song
		});
		next();
	}

	/** The old spot slides away; the next slides in, or the round is over. */
	function next() {
		attempt++;
		void fadeTo(audio, 0);
		slide = 'out';
		later(SLIDE_MS, () => {
			player.pause();
			if (index + 1 >= starts.length) return onfinish(finished);
			const was = starts[index].song;
			index++;
			judged = null;
			pop = null;
			// Another song: the player swaps to its element, held, then `play` seeks there.
			if (starts[index].song !== was) {
				const r = rigs[starts[index].song];
				player.setSong({ audio: r.audio, grid: r.grid, quiet: r.quiet });
			}
			spot = newSpot(starts[index].at);
			slide = 'in';
			play(w.listening);
		});
	}

	onMount(() => {
		// The page started the player at the first spot, inside the Start tap.
		later(WAKE_MS, () => {
			if (spot.phase === 'over' || index !== 0) return;
			locked = false;
			bounce++;
			line = startOn;
		});
		line = w.listening;
		raf = requestAnimationFrame(frame);
	});

	onDestroy(() => {
		if (typeof window !== 'undefined') for (const r of rigs) fullVolume(r.audio);
		if (raf) cancelAnimationFrame(raf);
		timers.forEach((id) => clearTimeout(id));
	});
</script>

<ListenShell {title} {subtitle} backLabel={w.back} onback={onleave}>
	{#snippet stage()}
		<div
			class="flex flex-col items-center gap-2"
			class:slide-out={slide === 'out'}
			class:slide-in={slide === 'in'}
		>
			<span class="{STAGE_SIGN} {judged ? '' : 'opacity-40'}">{big}</span>
			<p class="text-[15px] font-extrabold text-band-ink">{w.drop(index + 1, starts.length)}</p>
			<p
				class="min-h-[1.4em] max-w-[300px] text-[15px] font-semibold text-band-small"
				aria-live="polite"
			>
				{line}
			</p>
			{#if tip}
				<p class="max-w-[300px] text-[13px] font-semibold text-band-small">{tip}</p>
			{/if}
		</div>
		<div class="flex gap-1.5" aria-hidden="true">
			{#each starts, i (i)}
				<span
					class="size-[7px] rounded-full {i < finished.length
						? finished[i].skipped
							? 'ring-[1.5px] ring-band-small ring-inset'
							: 'bg-band-ink'
						: i === index
							? 'scale-150 bg-band-ink'
							: 'bg-band-ink/30'}"
				></span>
			{/each}
		</div>
	{/snippet}
	<div class:slide-out={slide === 'out'} class:slide-in={slide === 'in'}>
		<PatternRows
			{positions}
			rows={view ? view.rows.map((r) => r.states) : tapping}
			rowPositions={view ? view.rows.map((r) => r.positions) : []}
			over={view
				? view.rows.map((r) =>
						Object.fromEntries(
							Object.entries(r.yours).map(([p, y]) => [p, w.count.you(posLabel(y))])
						)
					)
				: []}
			marks={view?.marks ?? []}
			room={view !== null}
			labels={rowLabels}
			{pop}
			label={padLabel}
		/>
	</div>
	<TapPad
		label={padLabel}
		sub={locked ? (judged ? w.nextSpot : w.listenFirst) : w.anywhere}
		{locked}
		{bounce}
		ontap={tap}
	/>
	{#snippet bar()}
		<div class="flex gap-2.5">
			<button type="button" class={RUN_STOP} onclick={() => onfinish(finished)}>
				<Icon name="stop" size={22} filled />{w.stop}
			</button>
			<button
				type="button"
				class={BAR_SHARED}
				disabled={spot.phase === 'over' || restarting}
				onclick={() => restart(w.startOver.reset)}>↺ {w.reset}</button
			>
			{#if canSkip(spot)}
				{#key skipBounce}
					<button type="button" class="{BAR_SHARED} skip-in" onclick={skip}>{w.skip}</button>
				{/key}
			{/if}
		</div>
	{/snippet}
</ListenShell>

<style>
	.slide-out {
		animation: slide-out 0.45s ease forwards;
	}
	.slide-in {
		animation: slide-in 0.5s cubic-bezier(0.2, 0.9, 0.3, 1);
	}
	.skip-in {
		animation: skip-in 0.45s cubic-bezier(0.2, 1.5, 0.4, 1);
	}
	@keyframes slide-out {
		to {
			opacity: 0;
			transform: translateX(-36px);
		}
	}
	@keyframes slide-in {
		from {
			opacity: 0;
			transform: translateX(36px);
		}
	}
	@keyframes skip-in {
		0% {
			transform: scale(0.8);
		}
		60% {
			transform: scale(1.06);
		}
		100% {
			transform: scale(1);
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.slide-out,
		.slide-in,
		.skip-in {
			animation: none;
		}
		.slide-out {
			opacity: 0;
		}
	}
</style>
