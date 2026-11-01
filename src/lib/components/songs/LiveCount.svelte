<script lang="ts">
	import { beatIndexAt } from '$lib/beatgrid/beatgrid';

	interface Props {
		/** Polled every animation frame; null when there is no position yet. */
		time: () => number | null;
		beats: number[];
		counts: number[];
	}

	let { time, beats, counts }: Props = $props();
	let index = $state(-1);

	/*
	 * Read the playhead every animation frame. `timeupdate` fires only ~4 times
	 * a second, far too coarse to show a count that changes 3 times a second.
	 */
	$effect(() => {
		let frame = 0;
		const tick = () => {
			const t = time();
			index = t === null ? -1 : beatIndexAt(beats, t);
			frame = requestAnimationFrame(tick);
		};
		frame = requestAnimationFrame(tick);
		return () => cancelAnimationFrame(frame);
	});

	const count = $derived(index >= 0 ? counts[index] : null);
</script>

<div class="flex flex-col items-center gap-3 pt-1.5 pb-1 text-center" aria-live="off">
	<div
		class="font-display text-[88px] leading-none font-extrabold tracking-[-0.02em] tabular-nums {count ===
		null
			? 'text-muted'
			: count === 1
				? 'text-accent-text'
				: count === 5
					? 'text-ink'
					: 'text-ink-2'}"
	>
		{count ?? '–'}
	</div>
	<div class="flex justify-center gap-2" aria-hidden="true">
		{#each [1, 2, 3, 4, 5, 6, 7, 8] as n (n)}
			<span
				class="size-3 rounded-full {n === count
					? n === 1
						? 'bg-accent'
						: 'bg-ink'
					: n === 4 || n === 8
						? 'bg-hairline'
						: 'bg-field-line'}"
			></span>
		{/each}
	</div>
</div>
