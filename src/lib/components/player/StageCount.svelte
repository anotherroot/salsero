<script lang="ts">
	import { beatIndexAt } from '$lib/beatgrid/beatgrid';
	import { stageDigit, stageDots } from '$lib/player/view';

	interface Props {
		/** Polled every animation frame; null when there is no position yet. */
		time: () => number | null;
		beats: number[];
		counts: number[];
		/** The digit box's side in px, before the viewport cap. */
		size: number;
		paused: boolean;
	}

	let { time, beats, counts, size, paused }: Props = $props();
	let index = $state(-1);

	/*
	 * The same loop as LiveCount: read the playhead every animation frame.
	 * `timeupdate` fires only ~4 times a second, far too coarse to show a
	 * count that changes 3 times a second.
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

	const count = $derived(index >= 0 ? (counts[index] ?? null) : null);
	const digit = $derived(stageDigit(count, paused));
	const dots = $derived(stageDots(count, paused));

	/*
	 * Raised for a phone in sunlight: beat is ≥ 3.4:1 on three bands, quiet
	 * ≥ 2.2:1. The light salsa band cannot reach 3:1 without beat outshining
	 * held (cream itself is 4.3:1 there), so it gets 2.2 and 1.7, up from 1.7 and 1.3.
	 * Decorative (aria-hidden): the digit carries the count.
	 */
	const DOT_TONE = {
		now: 'bg-band-ink',
		held: 'bg-band-ink/60',
		beat: 'bg-band-ink/55',
		quiet: 'bg-band-ink/36'
	} as const;
</script>

<!--
	Cream only: the band is the background, and accent on it fails contrast.
	The 1 is what you look for across a room, so it flips to a cream disc
	with the number in the band's colour.
-->
<div class="flex flex-col items-center gap-3" aria-live="off">
	<span
		role="img"
		aria-label={digit.text === '–' ? 'Count not started' : `Count ${digit.text}`}
		class="stage flex items-center justify-center"
		style="--size: {size}px"
	>
		<span
			class="flex size-full items-center justify-center font-display leading-none font-extrabold tracking-[-0.03em] tabular-nums {digit.disc
				? 'rounded-full bg-band-ink text-band shadow-[0_10px_30px_rgb(0_0_0/0.22)]'
				: digit.dim
					? 'text-band-ink/75'
					: 'text-band-ink'}">{digit.text}</span
		>
	</span>
	<span class="flex h-4 items-center gap-2.5" aria-hidden="true">
		{#each dots as d (d.n)}
			<span
				class="flex-none rounded-full {d.size === 16 ? 'size-4' : 'size-2.5'} {DOT_TONE[d.tone]}"
			></span>
		{/each}
	</span>
</div>

<style>
	.stage {
		--stage: min(var(--size), 30dvh);
		width: var(--stage);
		height: var(--stage);
		font-size: calc(var(--stage) * 0.82);
	}
	/* A landscape phone has the whole left half, but little height. */
	@media (orientation: landscape) and (max-height: 520px) {
		.stage {
			--stage: min(var(--size), 46dvh);
		}
	}
</style>
