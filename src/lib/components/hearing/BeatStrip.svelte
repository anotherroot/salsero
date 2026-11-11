<script lang="ts">
	import type { EightRow } from '$lib/hearing/judge';

	/**
	 * The round's taps on the count: one row per eight, the counts 1–8 across,
	 * the target counts marked, each tap a dot where it landed (spot on, close,
	 * or on another count). A long song scrolls inside its own box.
	 */
	interface Props {
		rows: EightRow[];
		positions: number[];
		/** A beat's length in seconds, to place a tap between two counts. */
		beatS: number;
		label: string;
	}

	let { rows, positions, beatS, label }: Props = $props();

	const W = 340;
	const LEFT = 26;
	const ROW = 20;
	const TOP = 16;
	const cw = (W - LEFT - 6) / 8;
	const x = (pos: number, offset: number) =>
		LEFT + (pos - 1) * cw + cw / 2 + (beatS > 0 ? (offset / beatS) * cw : 0);
	const h = $derived(TOP + rows.length * ROW + 4);
</script>

<div class="max-h-[340px] overflow-y-auto rounded-2xl bg-surface px-2 py-2">
	<svg viewBox="0 0 {W} {h}" width="100%" role="img" aria-label={label}>
		{#each [1, 2, 3, 4, 5, 6, 7, 8] as c (c)}
			<text
				x={LEFT + (c - 1) * cw + cw / 2}
				y="11"
				text-anchor="middle"
				font-size="11"
				class={positions.includes(c) ? 'fill-ink font-bold' : 'fill-muted'}>{c}</text
			>
		{/each}
		{#each rows as row, r (row.eight)}
			{@const y = TOP + r * ROW + ROW / 2}
			<text x="0" y={y + 4} font-size="10" class="fill-muted">{r + 1}</text>
			{#each positions as p (p)}
				<line
					x1={x(p, 0)}
					x2={x(p, 0)}
					y1={y - 6}
					y2={y + 6}
					stroke-width="1.5"
					class="stroke-field-line"
				/>
			{/each}
			{#each row.matches as m (m.expected.at)}
				{#if m.offset === null}
					<circle
						cx={x(m.expected.pos, 0)}
						cy={y}
						r="4"
						fill="none"
						stroke-width="1.5"
						class="stroke-danger"
					/>
				{:else}
					<circle
						cx={x(m.expected.pos, m.offset)}
						cy={y}
						r="5"
						class={m.mark === 'spot' ? 'fill-done' : 'fill-warn'}
					/>
				{/if}
			{/each}
			<!-- By place: two fingers in one touch can land on the same instant. -->
			{#each row.extras as e, i (i)}
				<circle cx={x(e.count, e.offset)} cy={y} r="5" class="fill-danger" />
			{/each}
		{/each}
	</svg>
</div>
