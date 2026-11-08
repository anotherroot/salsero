<script lang="ts">
	import { beatIndexAt } from '$lib/beatgrid/beatgrid';
	import { isQuiet, type QuietRange } from '$lib/scheduler/quiet';
	import { stageDigit, stageDots } from '$lib/player/view';
	import { t } from '$lib/i18n/catalog';

	interface Props {
		/** Polled every animation frame; null when there is no position yet. */
		time: () => number | null;
		beats: number[];
		counts: number[];
		paused: boolean;
		/** A song's count-off sections (`quietRanges`): a dash and eight alike dots there. */
		quiet?: QuietRange[];
	}

	let { time, beats, counts, paused, quiet = [] }: Props = $props();
	let off = $state(false);
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
			off = t !== null && isQuiet(quiet, t);
			frame = requestAnimationFrame(tick);
		};
		frame = requestAnimationFrame(tick);
		return () => cancelAnimationFrame(frame);
	});

	const count = $derived(index >= 0 ? (counts[index] ?? null) : null);
	const digit = $derived(stageDigit(count, paused, off));
	const dots = $derived(stageDots(count, paused, off));

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
<div
	class="flex min-h-0 w-full flex-1 flex-col items-center gap-3 desk:flex-none desk:gap-[26px]"
	aria-live="off"
>
	<!-- The count fills the band's free room (one-player design): the box is a size container. -->
	<span class="stage-box flex min-h-0 w-full flex-1 items-center justify-center desk:flex-none">
		<span
			role="img"
			aria-label={digit.text === '–'
				? t().player.countNotStarted
				: t().player.countDigit(digit.text)}
			class="stage flex items-center justify-center"
		>
			<span
				class="flex size-full items-center justify-center font-display leading-none font-extrabold tracking-[-0.03em] tabular-nums {digit.disc
					? 'rounded-full bg-band-ink text-band shadow-[0_10px_30px_rgb(0_0_0/0.22)]'
					: digit.dim
						? 'text-band-ink/75'
						: 'text-band-ink'}">{digit.text}</span
			>
		</span>
	</span>
	<span class="flex h-4 flex-none items-center gap-2.5 desk:h-[22px] desk:gap-4" aria-hidden="true">
		{#each dots as d (d.n)}
			<span
				class="flex-none rounded-full {d.size === 16
					? 'size-4 desk:size-[22px]'
					: 'size-2.5 desk:size-3.5'} {DOT_TONE[d.tone]}"
			></span>
		{/each}
	</span>
</div>

<style>
	/* The box takes the band's free height; the digit is the largest square that fits it. */
	.stage-box {
		container-type: size;
	}
	.stage {
		--stage: min(100cqw - 8px, 100cqh);
		width: var(--stage);
		height: var(--stage);
		font-size: calc(var(--stage) * 0.82);
	}
	/* The desktop's stage has the whole left side: a fixed size, as before. */
	@media (width >= 1024px) {
		.stage-box {
			container-type: normal;
		}
		.stage {
			--stage: min(240px, 34dvh);
		}
	}
</style>
