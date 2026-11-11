<script lang="ts">
	import type { CircleState } from '$lib/hearing/round';
	import { posLabel } from '$lib/hearing/words';

	/**
	 * The target on the eight: a thin line with the counts 1–8 under it, a
	 * circle for each target position with its name inside, one row per eight
	 * (spec 1b.1). The next circle is larger and pulses; `pop` replays a circle's
	 * pop (a tap filled it, or its colour arrived). The replay adds a playhead
	 * (`head`) and the taps that fell (`marks`).
	 */
	interface Props {
		positions: number[];
		rows: Record<number, CircleState>[];
		labels: string[];
		/** `key` changes on every pop, so the same circle can pop again. */
		pop?: { row: number; pos: number; key: number } | null;
		head?: { row: number; pos: number } | null;
		/**
		 * Where taps fell (look A, spec 1c.6): a small mark over the line; `tie` is
		 * the position of the circle it counted for, joined by a thin line in
		 * `tieState`'s colour. A stray tap (counted for nothing) is red.
		 */
		marks?: { row: number; pos: number; stray: boolean; tie?: number; tieState?: CircleState }[];
		/** Per row, positions in place of `positions` (a judged drop's, in the music's count). */
		rowPositions?: (number[] | undefined)[];
		/** Per row, a word over a circle (what the person counted: "you 1"). */
		over?: (Record<number, string> | undefined)[];
		/**
		 * Room above the circles for the tap marks and "you N" (a judged drop): the
		 * word sits over the mark, never under it. Fixed for a screen, so the rows
		 * do not jump when the first mark appears.
		 */
		room?: boolean;
		/** The accessible name of the whole drawing. */
		label: string;
	}

	let {
		positions,
		rows,
		labels,
		pop = null,
		head = null,
		marks = [],
		rowPositions = [],
		over = [],
		room = false,
		label
	}: Props = $props();

	const W = 280;
	const LEFT = 16;
	/** The circles' centre: lower when there is room for marks and words above them. */
	const CY = $derived(room ? 34 : 18);
	const x = (p: number) => LEFT + ((p - 1) / 7) * (W - LEFT - 14);
	const COUNTS = [1, 2, 3, 4, 5, 6, 7, 8];
	const FILL: Record<CircleState, string> = {
		future: 'fill-surface stroke-ink-2',
		next: 'fill-surface stroke-accent',
		filled: 'fill-accent stroke-accent',
		skip: 'fill-field stroke-track',
		spot: 'fill-done stroke-done',
		close: 'fill-warn stroke-warn',
		miss: 'fill-surface stroke-danger',
		shifted: 'fill-easy stroke-easy'
	};
	const TEXT: Record<CircleState, string> = {
		future: 'fill-ink-2',
		next: 'fill-ink-2',
		filled: 'fill-on-accent',
		skip: 'fill-disabled-ink',
		spot: 'fill-on-done',
		close: 'fill-on-accent',
		miss: 'fill-danger',
		shifted: 'fill-surface'
	};
	const TIE: Partial<Record<CircleState, string>> = {
		spot: 'stroke-done',
		close: 'stroke-warn',
		shifted: 'stroke-easy'
	};
</script>

<div
	class="flex flex-col gap-0.5 rounded-2xl bg-surface px-2.5 pt-2 pb-1"
	role="img"
	aria-label={label}
>
	{#each rows as row, r (r)}
		<svg
			viewBox="0 0 {W} {CY + 28}"
			class="block h-auto w-full overflow-visible"
			aria-hidden="true"
		>
			{#if labels[r]}
				<text x="0" y="6" class="fill-muted text-[9.5px] font-bold">{labels[r]}</text>
			{/if}
			{#each COUNTS as c (c)}
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
			{#each rowPositions[r] ?? positions as p (p)}
				{@const st = row[p] ?? 'future'}
				{@const popping = pop !== null && pop.row === r && pop.pos === p}
				{#key popping ? pop?.key : -1}
					<g class:pop={popping} class:faded={st === 'skip'}>
						{#if st === 'next'}<circle
								cx={x(p)}
								cy={CY}
								r="12"
								class="pulse fill-none stroke-accent"
								stroke-width="1.5"
							/>{/if}
						<circle
							cx={x(p)}
							cy={CY}
							r="10.5"
							class="burst fill-none {FILL[st]}"
							stroke-width="2"
						/>
						<circle
							cx={x(p)}
							cy={CY}
							r={st === 'next' ? 12 : 9.5}
							class="ring {FILL[st]}"
							stroke-width={st === 'next' ? 2.2 : 1.6}
							stroke-dasharray={st === 'miss' ? '3 2.5' : undefined}
						/>
						<text
							x={x(p)}
							y={CY + 0.5}
							text-anchor="middle"
							dominant-baseline="central"
							class="text-[8.5px] font-extrabold {TEXT[st]}">{posLabel(p)}</text
						>
						{#if over[r]?.[p]}
							<text
								x={x(p)}
								y={CY - 22}
								text-anchor="middle"
								class="fill-easy text-[7.5px] font-extrabold">{over[r]?.[p]}</text
							>
						{/if}
					</g>
				{/key}
			{/each}
			{#each marks.filter((m) => m.row === r) as m, i (i)}
				{#if m.tie !== undefined && m.tieState && TIE[m.tieState]}
					<line
						x1={x(m.pos)}
						x2={x(m.tie)}
						y1={CY - 13}
						y2={CY - 9}
						stroke-width="1.5"
						class={TIE[m.tieState]}
					/>
				{/if}
				<path
					d="M{x(m.pos)} {CY - 13} l-3.5 -6 h7 z"
					class={m.stray ? 'fill-danger' : 'fill-ink'}
				/>
			{/each}
			{#if head && head.row === r}
				<line
					x1={x(head.pos)}
					x2={x(head.pos)}
					y1="0"
					y2={CY + 14}
					stroke-width="2"
					class="stroke-accent"
				/>
			{/if}
		</svg>
	{/each}
</div>

<style>
	.ring,
	.burst,
	.pulse {
		transform-box: fill-box;
		transform-origin: center;
	}
	.burst {
		opacity: 0;
	}
	.faded {
		opacity: 0.35;
	}
	.pulse {
		animation: pulse 1.4s ease-out infinite;
	}
	.pop .ring {
		animation: pop 0.42s cubic-bezier(0.2, 1.6, 0.4, 1);
	}
	.pop .burst {
		animation: burst 0.5s ease-out;
	}
	@keyframes pop {
		0% {
			transform: scale(0.55);
		}
		60% {
			transform: scale(1.25);
		}
		100% {
			transform: scale(1);
		}
	}
	@keyframes burst {
		0% {
			opacity: 0.8;
			transform: scale(1);
		}
		100% {
			opacity: 0;
			transform: scale(2.4);
		}
	}
	@keyframes pulse {
		0% {
			opacity: 0.6;
			transform: scale(1);
		}
		100% {
			opacity: 0;
			transform: scale(1.9);
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.pulse,
		.pop .ring,
		.pop .burst {
			animation: none;
		}
	}
</style>
