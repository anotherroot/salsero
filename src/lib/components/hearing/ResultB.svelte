<script lang="ts">
	import { button, GROUP } from '$lib/components/ui/styles';
	import type { FinishedDrop, RoundKind } from '$lib/hearing/round';
	import { roundScore, scoreDrop } from '$lib/hearing/score';
	import { stackDepth, stackDots } from '$lib/hearing/stack';
	import { verdictOf } from '$lib/hearing/verdict';
	import { posName } from '$lib/hearing/words';
	import { t } from '$lib/i18n/catalog';
	import ListenShell from './ListenShell.svelte';
	import ListenStack from './ListenStack.svelte';

	/**
	 * Result B (spec 1b.6, the user's pick): the score on the band with what made
	 * it, every tap over one eight, one sentence on what to work on, and the drops
	 * (▶ replays one) or, for a tap-along round, the song's parts.
	 */
	interface Props {
		drops: FinishedDrop[];
		kind: RoundKind;
		positions: number[];
		beatS: number;
		subtitle: string;
		onreplay: (i: number) => void;
		onagain: () => void;
		ondone: () => void;
	}

	let { drops, kind, positions, beatS, subtitle, onreplay, onagain, ondone }: Props = $props();
	const w = $derived(t().hearing);

	const scores = $derived(
		drops.map((d) =>
			scoreDrop({
				spot: d.answer.spot,
				close: d.answer.close,
				of: d.answer.of,
				restarts: d.restarts,
				listenEights: d.listenEights,
				skipped: d.skipped
			})
		)
	);
	const total = $derived(roundScore(scores));
	const counted = $derived(drops.flatMap((d) => d.answer.beats.filter((b) => b.state !== 'skip')));
	const dots = $derived(stackDots(counted, beatS));
	const hit = $derived(drops.reduce((s, d) => s + d.answer.hits, 0));
	const of = $derived(drops.reduce((s, d) => s + d.answer.of, 0));
	const restarts = $derived(drops.reduce((s, d) => s + d.restarts, 0));
	const listened = $derived(drops.filter((d) => !d.skipped && d.answer.listened !== null));
	const line = $derived(
		kind === 'tapAlong'
			? w.score.onBeat(hit, of)
			: [
					w.score.onBeat(hit, of),
					w.restartsLine(restarts),
					...(listened.length
						? [
								w.score.findEach(
									listened.reduce((s, d) => s + (d.answer.listened ?? 0), 0) / listened.length
								)
							]
						: [])
				].join(' · ')
	);
	const verdict = $derived(verdictOf(counted, positions));
	const verdictText = $derived.by(() => {
		const v = w.score.verdict;
		if (verdict.kind === 'late') return [v.late(posName(verdict.pos)), v.offSub(verdict.ms)];
		if (verdict.kind === 'early') return [v.early(posName(verdict.pos)), v.offSub(verdict.ms)];
		if (verdict.kind === 'missed')
			return [v.missed(posName(verdict.pos)), v.missedSub(verdict.misses, verdict.of)];
		return [v.onTime, v.onTimeSub];
	});
</script>

<ListenShell title={w.result.title} {subtitle} backLabel={w.back} onback={ondone} scroll>
	{#snippet stage()}
		<p class="font-display text-[44px] leading-none font-extrabold text-band-ink tabular-nums">
			{w.score.title(total.score)}
		</p>
		<p class="text-[13px] font-semibold text-band-small">{line}</p>
	{/snippet}
	<div class="grid grid-cols-3 divide-x divide-hairline rounded-2xl bg-surface">
		{#each [[total.timing, w.score.timing], [-total.restartsLoss, w.score.restarts], [-total.listenLoss, w.score.listening]] as [n, label] (label)}
			<div class="px-3 py-2">
				<p class="font-display text-[20px] font-extrabold text-ink tabular-nums">
					{Number(n) < 0 ? `−${-Number(n)}` : n}
				</p>
				<p class="text-[11px] text-muted">{label}</p>
			</div>
		{/each}
	</div>
	<ListenStack {positions} {dots} depth={stackDepth(dots)} />
	<div class="rounded-2xl bg-surface px-3.5 py-2.5">
		<p class="font-display text-[18px] leading-tight font-extrabold text-ink">{verdictText[0]}</p>
		<p class="mt-0.5 text-[12.5px] text-muted">{verdictText[1]}</p>
	</div>
	<ul class={GROUP}>
		{#each drops as d, i (i)}
			<li class="flex min-h-12 items-center gap-3 px-4 py-1.5">
				<span class="min-w-0 flex-1 truncate text-[15px] font-bold text-ink">
					{kind === 'tapAlong'
						? d.section || w.score.dropRow(i + 1, '')
						: w.score.dropRow(i + 1, d.section)}
				</span>
				<span class="text-[13px] text-muted tabular-nums">
					{d.skipped
						? w.score.skipped
						: kind === 'tapAlong'
							? w.score.counted(d.answer.hits, d.answer.of)
							: `${w.score.counted(d.answer.hits, d.answer.of)} · ${w.restartsLine(d.restarts)}`}
				</span>
				{#if kind === 'dropped' && !d.skipped && d.answer.eight !== null}
					<button
						type="button"
						class="{button('secondary', 'sm')} flex-none"
						aria-label={w.score.replayDrop(i + 1)}
						onclick={() => onreplay(i)}>▶</button
					>
				{/if}
			</li>
		{/each}
	</ul>
	{#snippet bar()}
		<div class="flex gap-2.5">
			<button type="button" class={button('secondary', 'lg')} onclick={onagain}>{w.again}</button>
			<div class="flex min-w-0 flex-1">
				<button type="button" class={button('primary', 'lg', true)} onclick={ondone}
					>{w.done}</button
				>
			</div>
		</div>
	{/snippet}
</ListenShell>
