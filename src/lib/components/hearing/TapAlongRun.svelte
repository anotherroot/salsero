<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import Icon from '$lib/components/ui/Icon.svelte';
	import { RUN_STOP } from '$lib/components/player/styles';
	import type { DropAnswer, DropBeat } from '$lib/hearing/drops';
	import { expectedTaps, matchTaps, type Grid } from '$lib/hearing/judge';
	import { tapRow, type FinishedDrop } from '$lib/hearing/round';
	import { tapSongTime } from '$lib/hearing/tap-delay';
	import { t } from '$lib/i18n/catalog';
	import type { PlayerHandle } from '$lib/scheduler/attach';
	import type { QuietRange } from '$lib/scheduler/quiet';
	import { sectionName, type Placed } from '$lib/songs/sections';
	import ListenShell from './ListenShell.svelte';
	import PatternRows from './PatternRows.svelte';
	import TapPad from './TapPad.svelte';
	import { BAR_SHARED } from './styles';

	/**
	 * A Tap along round (spec 1b.1–1b.2): the count hidden, one row of the
	 * target that fills in order and empties every time it is full, nothing about
	 * how close until the result. The page made the player inside the Start tap.
	 */
	interface Props {
		player: PlayerHandle;
		audio: HTMLAudioElement;
		grid: Grid;
		quiet: QuietRange[];
		sections: Placed[];
		positions: number[];
		/** Where the music plays from, where judging starts, where the round ends (`roundSpan`). */
		span: { play: number; judgeFrom: number; to: number };
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
		quiet,
		sections,
		positions,
		span,
		tapDelayMs,
		title,
		subtitle,
		padLabel,
		onfinish,
		onleave
	}: Props = $props();
	const w = $derived(t().hearing);
	const WAKE_MS = 1100;

	let taps: number[] = [];
	let fill = $state(0);
	let locked = $state(true);
	let bounce = $state(0);
	let pop = $state<{ row: number; pos: number; key: number } | null>(null);
	let popKey = 0;
	let refill = $state(0);
	let now = $state(0);
	let raf = 0;
	let wake: ReturnType<typeof setTimeout> | undefined;

	/** A row just filled shows full until the next tap, or a moment later. */
	let full = $state(false);
	let emptyLater: ReturnType<typeof setTimeout> | undefined;
	const row = $derived(tapRow(positions, fill, full));
	function empty() {
		clearTimeout(emptyLater);
		if (!full) return;
		full = false;
		// The full row empties, sliding back in.
		refill++;
	}
	const part = $derived(sections.findLast((s) => s.t <= now) ?? null);

	function wakeLater() {
		clearTimeout(wake);
		locked = true;
		wake = setTimeout(() => {
			locked = false;
			bounce++;
		}, WAKE_MS);
	}

	function tap(timeStamp: number) {
		if (locked) return;
		taps.push(
			tapSongTime(player.songTime(), performance.now() - timeStamp, tapDelayMs, audio.playbackRate)
		);
		empty();
		fill++;
		const k = (fill - 1) % positions.length;
		pop = { row: 0, pos: positions[k], key: ++popKey };
		if (fill % positions.length === 0) {
			full = true;
			emptyLater = setTimeout(empty, 300);
		}
	}

	function reset() {
		taps = [];
		fill = 0;
		full = false;
		clearTimeout(emptyLater);
		player.seek(span.play);
		wakeLater();
	}

	/** The round as the result shows it: one entry per part of the song. */
	function finish() {
		const end = Math.min(span.to, player.songTime());
		const expected = expectedTaps(grid, positions, span.judgeFrom, end, quiet);
		const { matches } = matchTaps(grid, expected, taps);
		const byPart: Record<string, { at: number; beats: DropBeat[] }> = {};
		for (const m of matches) {
			const owner = sections.findLast((s) => s.t <= m.expected.at);
			const key = owner ? `${owner.index}` : '';
			const group = (byPart[key] ??= { at: m.expected.at, beats: [] });
			group.beats.push({
				row: 0,
				pos: m.expected.pos,
				at: m.expected.at,
				state: m.mark === 'missed' ? 'miss' : m.mark,
				offset: m.offset
			});
		}
		const drops: FinishedDrop[] = Object.entries(byPart).map(([key, g]) => {
			const owner = sections.find((s) => `${s.index}` === key);
			const spot = g.beats.filter((b) => b.state === 'spot').length;
			const close = g.beats.filter((b) => b.state === 'close').length;
			const answer: DropAnswer = {
				start: g.at,
				tap: null,
				hit: spot + close === g.beats.length,
				offset: null,
				count: null,
				listened: null,
				hits: spot + close,
				of: g.beats.length,
				spot,
				close,
				beats: g.beats,
				eight: null,
				taps: []
			};
			return {
				answer,
				restarts: 0,
				skipped: false,
				listenEights: 0,
				section: owner ? sectionName(owner) : ''
			};
		});
		onfinish(drops);
	}

	function frame() {
		now = player.songTime();
		const songOver = Number.isFinite(audio.duration) && now >= audio.duration - 0.05;
		if (now >= span.to || songOver) return finish();
		raf = requestAnimationFrame(frame);
	}

	onMount(() => {
		wakeLater();
		raf = requestAnimationFrame(frame);
	});
	onDestroy(() => {
		if (raf) cancelAnimationFrame(raf);
		clearTimeout(wake);
		clearTimeout(emptyLater);
	});
</script>

<ListenShell {title} {subtitle} backLabel={w.back} onback={onleave}>
	{#snippet stage()}
		<span class="text-band-ink opacity-60"><Icon name="ear" size={72} /></span>
		<p class="text-[15px] font-semibold text-band-small">{w.hidden}</p>
		{#if part}
			<p class="text-[15px] font-extrabold text-band-ink">{sectionName(part)}</p>
		{/if}
	{/snippet}
	{#key refill}
		<div class="slide-in">
			<PatternRows {positions} rows={[row]} labels={['']} {pop} label={padLabel} />
		</div>
	{/key}
	<TapPad
		label={padLabel}
		sub={locked ? w.listenFirst : w.anywhere}
		{locked}
		{bounce}
		ontap={tap}
	/>
	{#snippet bar()}
		<div class="flex gap-2.5">
			<button type="button" class={RUN_STOP} onclick={finish}>
				<Icon name="stop" size={22} filled />{w.stop}
			</button>
			<button type="button" class={BAR_SHARED} onclick={reset}>↺ {w.reset}</button>
		</div>
	{/snippet}
</ListenShell>

<style>
	.slide-in {
		animation: slide-in 0.4s cubic-bezier(0.2, 0.9, 0.3, 1);
	}
	@keyframes slide-in {
		from {
			opacity: 0;
			transform: translateX(28px);
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.slide-in {
			animation: none;
		}
	}
</style>
