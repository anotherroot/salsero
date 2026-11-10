<script lang="ts">
	import { beatIndexAt } from '$lib/beatgrid/beatgrid';
	import { countInAt, leadLook, type Lead } from '$lib/songs/count-in';

	interface Props {
		/** Polled every animation frame; null when there is no position yet. */
		time: () => number | null;
		beats: number[];
		counts: number[];
		/** A count-off section or a lead: a dash for the number, the dots lit for the beats left. */
		off?: boolean;
		/** Beats left in a count-off section or a lead. */
		left?: number;
		/** The song's leads: the dash shrinks, then 5 6 7 8 grow, faint, on the coming tempo. */
		leads?: Lead[];
	}

	let { time, beats, counts, off = false, left = 0, leads = [] }: Props = $props();
	let index = $state(-1);
	/** The count-in's count (5–8) on now, or null. */
	let ghost = $state<number | null>(null);
	/** The lead's size (`leadLook`); 1 outside a lead. */
	let scale = $state(1);

	/*
	 * Read the playhead every animation frame. `timeupdate` fires only ~4 times
	 * a second, far too coarse to show a count that changes 3 times a second.
	 */
	$effect(() => {
		let frame = 0;
		const tick = () => {
			const t = time();
			index = t === null ? -1 : beatIndexAt(beats, t);
			const c = t === null ? null : countInAt(leads, t);
			ghost = c?.n ?? null;
			scale = leadLook(c)?.scale ?? 1;
			frame = requestAnimationFrame(tick);
		};
		frame = requestAnimationFrame(tick);
		return () => cancelAnimationFrame(frame);
	});

	const count = $derived(ghost ?? (index >= 0 && !off ? counts[index] : null));
</script>

<div class="flex flex-col items-center gap-3 pt-1.5 pb-1 text-center" aria-live="off">
	<div
		style:scale={scale === 1 ? undefined : scale}
		class="font-display text-[88px] leading-none font-extrabold tracking-[-0.02em] tabular-nums transition-[scale] duration-200 ease-arrive motion-reduce:transition-none {ghost !==
		null
			? 'text-ink-2/40'
			: count === null
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
			<!-- The count-in: its four dots faint, the one on now held. -->
			<span
				class="size-3 rounded-full {ghost !== null
					? n === ghost
						? 'bg-ink-2'
						: n >= 5
							? 'bg-field-line'
							: 'bg-hairline'
					: off
						? n <= left
							? 'bg-ink-2'
							: 'bg-field-line'
						: n === count
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
