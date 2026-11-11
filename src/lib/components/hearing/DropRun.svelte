<script lang="ts">
	import { onDestroy, onMount, untrack } from 'svelte';
	import Icon from '$lib/components/ui/Icon.svelte';
	import { RUN_STOP } from '$lib/components/player/styles';
	import { dropWindow, judgeDropPattern, type DropAnswer } from '$lib/hearing/drops';
	import type { Grid } from '$lib/hearing/judge';
	import type { CircleState, FinishedDrop } from '$lib/hearing/round';
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
	import { sectionName, type Placed } from '$lib/songs/sections';
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
		audio: HTMLAudioElement;
		grid: Grid;
		sections: Placed[];
		positions: number[];
		beatS: number;
		starts: number[];
		tapDelayMs: number;
		title: string;
		subtitle: string;
		padLabel: string;
		onfinish: (drops: FinishedDrop[]) => void;
		onleave: () => void;
	}

	let {
		player,
		audio,
		grid,
		sections,
		positions,
		beatS,
		starts,
		tapDelayMs,
		title,
		subtitle,
		padLabel,
		onfinish,
		onleave
	}: Props = $props();
	const w = $derived(t().hearing);

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
	const rules = $derived({ eightS, gapS: longestGapBeats(positions) * beatS, winS: WIN_S });

	let index = $state(0);
	// The first spot: the page seeked there; a new round mounts this anew.
	let spot = $state<Spot>(newSpot(untrack(() => starts[0])));
	let locked = $state(true);
	let bounce = $state(0);
	let pop = $state<{ row: number; pos: number; key: number } | null>(null);
	let popKey = 0;
	let line = $state('');
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
	function later(ms: number, fn: () => void) {
		const id = setTimeout(() => {
			timers = timers.filter((x) => x !== id);
			fn();
		}, ms);
		timers.push(id);
	}

	const rows = $derived.by((): Record<number, CircleState>[] => {
		const out: Record<number, CircleState>[] = [{}, {}];
		const n = positions.length;
		positions.forEach((p, i) => {
			for (let r = 0; r < 2; r++) {
				const k = r * n + i;
				out[r][p] = k < spot.fill ? 'filled' : k === spot.fill && !judged ? 'next' : 'future';
			}
		});
		if (judged) {
			// The colours arrive one by one, in the order of the eight.
			judged.beats.slice(0, shown).forEach((b) => (out[b.row][b.pos] = b.state));
		}
		return out;
	});

	/** A spot's music from its start; the pad wakes once it plays. */
	function play(why: string) {
		locked = true;
		line = why;
		big = '?';
		player.seek(spot.start);
		void player.resume();
		later(WAKE_MS, () => {
			if (spot.phase === 'over') return;
			locked = false;
			bounce++;
			line = w.listen;
		});
	}

	function frame() {
		const now = player.songTime();
		if (spot.phase !== 'over') {
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
		spot = tapSpot(spot, at, spot.first === null ? dropWindow(grid, at) : null, circles);
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
		if (spot.phase === 'over') return;
		const wasSkippable = canSkip(spot);
		spot = restartSpot(spot);
		if (canSkip(spot) && !wasSkippable) skipBounce++;
		locked = true;
		player.pause();
		slide = 'out';
		later(SLIDE_MS, () => {
			slide = 'in';
			play(why);
		});
	}

	function sectionAt(at: number): string {
		const s = sections.findLast((x) => x.t <= at);
		return s ? sectionName(s) : '';
	}

	function end() {
		const answer = judgeDropPattern(grid, positions, spot.start, spot.taps);
		spot = endSpot(spot);
		locked = true;
		judged = answer;
		shown = 0;
		big = `${answer.hits}/${answer.of}`;
		line = spot.restarts ? w.restartsLine(spot.restarts) : w.firstTry;
		answer.beats.forEach((b, i) =>
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
			section: sectionAt(spot.window?.from ?? spot.start)
		});
		later(answer.beats.length * REVEAL_STEP_MS + HOLD_MS, next);
	}

	function skip() {
		if (!canSkip(spot)) return;
		spot = skipSpot(spot);
		finished.push({
			answer: judgeDropPattern(grid, positions, spot.start, []),
			restarts: spot.restarts,
			skipped: true,
			listenEights: 0,
			section: sectionAt(spot.start)
		});
		next();
	}

	/** The old spot slides away; the next slides in, or the round is over. */
	function next() {
		player.pause();
		slide = 'out';
		later(SLIDE_MS, () => {
			if (index + 1 >= starts.length) return onfinish(finished);
			index++;
			judged = null;
			pop = null;
			spot = newSpot(starts[index]);
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
			line = w.listen;
		});
		line = w.listening;
		raf = requestAnimationFrame(frame);
	});

	onDestroy(() => {
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
			{rows}
			labels={[w.eightRow(1), w.eightRow(2)]}
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
				disabled={spot.phase === 'over'}
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
