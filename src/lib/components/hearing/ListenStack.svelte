<script lang="ts">
	import type { StackDot } from '$lib/hearing/stack';
	import { posLabel } from '$lib/hearing/words';
	import { t } from '$lib/i18n/catalog';

	/**
	 * All your eights, on top of each other (spec 1b.6): top to bottom inside the
	 * card, the title, the target's circles with the counts under them, then every
	 * tap below its circle, left or right by how early or late it was, a faint line
	 * marking the beat. Nothing is drawn outside the card.
	 */
	interface Props {
		positions: number[];
		dots: StackDot[];
		depth: number;
	}

	let { positions, dots, depth }: Props = $props();
	const w = $derived(t().hearing.score);

	const W = 280;
	const LEFT = 16;
	const UNIT = (W - LEFT - 14) / 7;
	const CY = 30;
	const TOP = 70;
	const STEP = 6;
	const x = (p: number) => LEFT + (p - 1) * UNIT;
	const H = $derived(TOP + depth * STEP + 18);
</script>

<div class="rounded-2xl bg-surface px-2.5 pt-2 pb-1">
	<svg viewBox="0 0 {W} {H}" class="block h-auto w-full" role="img" aria-label={w.stackLabel}>
		<text x="0" y="10" class="fill-muted text-[9.5px] font-bold">{w.stackTitle}</text>
		{#each [1, 2, 3, 4, 5, 6, 7, 8] as c (c)}
			<line
				x1={x(c)}
				x2={x(c)}
				y1={CY + 12}
				y2={CY + 17}
				stroke-width="1.5"
				class={c === 1 ? 'stroke-muted' : 'stroke-track'}
			/>
			<text x={x(c)} y={CY + 26} text-anchor="middle" class="fill-muted text-[9px]">{c}</text>
		{/each}
		{#each positions as p (p)}
			<line
				x1={x(p)}
				x2={x(p)}
				y1={TOP - 6}
				y2={TOP + depth * STEP}
				stroke-width="1.2"
				class="stroke-track"
			/>
			<circle cx={x(p)} cy={CY} r="9.5" stroke-width="1.6" class="fill-surface stroke-ink-2" />
			<text
				x={x(p)}
				y={CY + 0.5}
				text-anchor="middle"
				dominant-baseline="central"
				class="fill-ink-2 text-[8.5px] font-extrabold">{posLabel(p)}</text
			>
		{/each}
		{#each dots as d, i (i)}
			<circle
				cx={x(d.pos) + d.dx * UNIT}
				cy={TOP + d.row * STEP}
				r="2.6"
				class={d.state === 'spot' ? 'fill-done' : 'fill-warn'}
			/>
		{/each}
		<text x={LEFT} y={TOP + depth * STEP + 12} class="fill-muted text-[8.5px]">{w.early}</text>
		<text x={W - 4} y={TOP + depth * STEP + 12} text-anchor="end" class="fill-muted text-[8.5px]"
			>{w.late}</text
		>
	</svg>
</div>
