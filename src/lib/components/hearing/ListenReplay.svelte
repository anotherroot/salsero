<script lang="ts">
	import { onDestroy, onMount, untrack } from 'svelte';
	import { beatIndexAt } from '$lib/beatgrid/beatgrid';
	import { button } from '$lib/components/ui/styles';
	import { PATTERN_EIGHTS } from '$lib/hearing/drops';
	import type { Grid } from '$lib/hearing/judge';
	import {
		cueHorizon,
		cueStart,
		cuesBetween,
		stepBeat,
		type ReplayPlan
	} from '$lib/hearing/replay';
	import { totalDelayMs } from '$lib/player/sound-delay';
	import type { CircleState, FinishedDrop } from '$lib/hearing/round';
	import { posLabel } from '$lib/hearing/words';
	import { t } from '$lib/i18n/catalog';
	import type { PlayerHandle } from '$lib/scheduler/attach';
	import { timeline } from '$lib/scheduler/scheduler';
	import ListenShell from './ListenShell.svelte';
	import PatternRows from './PatternRows.svelte';
	import { STAGE_SIGN } from './styles';

	/**
	 * A drop again (spec 1b.7): the song from two beats before it to the end of
	 * its two eights, the count big on the band, the circles taking their colours
	 * as the playhead passes them, your taps appearing above them where they fell.
	 * A high tick on each of your taps and a low knock on each target beat. The
	 * page made the player inside the ▶ tap and seeked to `plan.from`.
	 */
	interface Props {
		player: PlayerHandle;
		audio: HTMLAudioElement;
		grid: Grid;
		plan: ReplayPlan;
		drop: FinishedDrop;
		positions: number[];
		n: number;
		subtitle: string;
		onback: () => void;
	}

	let { player, audio, grid, plan, drop, positions, n, subtitle, onback }: Props = $props();
	const w = $derived(t().hearing.replay);
	/** How far ahead the ticks are scheduled on the audio clock. */
	const AHEAD_S = 0.15;

	// The page seeked to the plan's start; a new replay mounts this anew.
	let now = $state(untrack(() => plan.from));
	let playing = $state(true);
	let slow = $state(false);
	let raf = 0;
	let ctx: AudioContext | null = null;
	/** Cues up to here are scheduled already. */
	let scheduled = untrack(() => plan.from);

	const tl = $derived(timeline(grid));
	const eightStart = $derived(
		drop.answer.eight === null ? plan.from : grid.beats[tl.starts[drop.answer.eight]]
	);
	/** A song time as a place on the two rows: which row, and where on the 1–8 line. */
	function place(at: number): { row: number; pos: number } | null {
		const i = beatIndexAt(grid.beats, at);
		if (i < 0 || drop.answer.eight === null) return null;
		const row = tl.eights[i] - drop.answer.eight;
		if (row < 0 || row >= PATTERN_EIGHTS) return null;
		const len = i + 1 < grid.beats.length ? grid.beats[i + 1] - grid.beats[i] : 0.5;
		return { row, pos: grid.counts[i] + (at - grid.beats[i]) / len };
	}

	const rows = $derived.by((): Record<number, CircleState>[] => {
		const out: Record<number, CircleState>[] = [{}, {}];
		for (const b of drop.answer.beats)
			out[b.row][b.pos] = b.state === 'skip' ? 'skip' : now >= b.at ? b.state : 'future';
		return out;
	});
	const matched = $derived(
		new Set(drop.answer.beats.flatMap((b) => (b.offset === null ? [] : [b.at + b.offset])))
	);
	const marks = $derived(
		drop.answer.taps.flatMap((at) => {
			const p = at <= now ? place(at) : null;
			return p ? [{ ...p, stray: ![...matched].some((m) => Math.abs(m - at) < 1e-6) }] : [];
		})
	);
	const head = $derived(now >= eightStart ? place(now) : null);
	const count = $derived.by(() => {
		const i = beatIndexAt(grid.beats, now);
		return i >= 0 ? grid.counts[i] : '–';
	});
	const said = $derived.by(() => {
		const b = drop.answer.beats
			.filter((x) => x.state !== 'skip' && now >= x.at && now - x.at < 0.6)
			.at(-1);
		if (!b) return ' ';
		if (b.state === 'miss') return `${posLabel(b.pos)} · ${w.missed}`;
		if (b.state === 'spot') return `${posLabel(b.pos)} · ${w.onTime}`;
		return `${posLabel(b.pos)} · ${w.close} · ${Math.round(Math.abs(b.offset ?? 0) * 1000)} ms`;
	});

	function tone(at: number, freq: number, gain: number, len: number) {
		if (!ctx) return;
		const o = ctx.createOscillator();
		const g = ctx.createGain();
		o.frequency.value = freq;
		g.gain.setValueAtTime(0, at);
		g.gain.linearRampToValueAtTime(gain, at + 0.004);
		g.gain.exponentialRampToValueAtTime(0.0008, at + len);
		o.connect(g).connect(ctx.destination);
		o.start(at);
		o.stop(at + len + 0.02);
	}

	function frame() {
		now = player.songTime();
		if (playing && ctx) {
			// `songTime()` is the time heard: a tick must leave the speaker that much early.
			const d = player.soundDelay();
			const delayS = totalDelayMs(d.reportedMs, d.correctionMs) / 1000;
			const rate = audio.playbackRate || 1;
			const horizon = cueHorizon(now, AHEAD_S, delayS, rate);
			for (const c of cuesBetween(plan, scheduled, horizon)) {
				const at = Math.max(ctx.currentTime, cueStart(ctx.currentTime, c.at, now, rate, delayS));
				if (c.kind === 'tap') tone(at, 2600, 0.2, 0.03);
				else tone(at, 520, 0.3, 0.09);
			}
			scheduled = Math.max(scheduled, horizon);
		}
		if (playing && now >= plan.to) {
			player.pause();
			playing = false;
		}
		raf = requestAnimationFrame(frame);
	}

	function seek(t: number) {
		player.pause();
		playing = false;
		const to = Math.max(plan.from, Math.min(plan.to, t));
		player.seek(to);
		now = to;
		scheduled = to;
	}

	function toggle() {
		if (playing) {
			player.pause();
			playing = false;
			return;
		}
		if (now >= plan.to - 0.01) seek(plan.from);
		scheduled = now;
		playing = true;
		void ctx?.resume();
		void player.resume();
	}

	function toggleSlow() {
		slow = !slow;
		audio.playbackRate = slow ? 0.75 : 1;
	}

	onMount(() => {
		ctx = new AudioContext();
		void ctx.resume();
		raf = requestAnimationFrame(frame);
	});
	onDestroy(() => {
		if (raf) cancelAnimationFrame(raf);
		void ctx?.close();
		ctx = null;
		if (typeof window !== 'undefined') audio.playbackRate = 1;
	});
</script>

<ListenShell title={w.title(n)} {subtitle} backLabel={w.back} {onback}>
	{#snippet stage()}
		<span class={STAGE_SIGN}>{count}</span>
		<p class="text-[15px] font-extrabold text-band-ink">{w.countOn}</p>
		<p class="min-h-[1.4em] text-[15px] font-semibold text-band-small">{said}</p>
	{/snippet}
	<PatternRows
		{positions}
		{rows}
		labels={[t().hearing.eightRow(1), t().hearing.eightRow(2)]}
		{head}
		{marks}
		label={w.title(n)}
	/>
	<div class="flex flex-wrap gap-x-3 gap-y-1 px-1 text-[11.5px] text-muted">
		<span>▼ {w.yourTap}</span>
		<span class="text-done">● {w.onTime}</span>
		<span class="text-warn">● {w.close}</span>
		<span class="text-danger">◌ {w.missed}</span>
		<span class="text-accent-text">│ {w.now}</span>
	</div>
	{#snippet bar()}
		<div class="flex gap-2">
			<button
				type="button"
				class={button('secondary', 'lg')}
				aria-label={w.slower}
				aria-pressed={slow}
				onclick={toggleSlow}>{slow ? '0.75×' : '1×'}</button
			>
			<button
				type="button"
				class={button('secondary', 'lg')}
				aria-label={w.prev}
				onclick={() => seek(stepBeat(grid, now, -1))}>‹</button
			>
			<div class="flex min-w-0 flex-1">
				<button type="button" class={button('primary', 'lg', true)} onclick={toggle}
					>{playing ? w.pause : w.play}</button
				>
			</div>
			<button
				type="button"
				class={button('secondary', 'lg')}
				aria-label={w.next}
				onclick={() => seek(stepBeat(grid, now, 1))}>›</button
			>
		</div>
	{/snippet}
</ListenShell>
