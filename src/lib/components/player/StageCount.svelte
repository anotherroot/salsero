<script lang="ts">
	import { beatIndexAt } from '$lib/beatgrid/beatgrid';
	import { isQuiet, type QuietRange } from '$lib/scheduler/quiet';
	import { countInAt, type Lead } from '$lib/songs/count-in';
	import { stageDigit, stageDots } from '$lib/player/view';
	import { t } from '$lib/i18n/catalog';
	import { beatPulse, stepMs } from '$lib/motion/beat-pulse';

	interface Props {
		/** Polled every animation frame; null when there is no position yet. */
		time: () => number | null;
		beats: number[];
		counts: number[];
		paused: boolean;
		/** A song's count-off sections (`quietRanges`): a dash and eight alike dots there. */
		quiet?: QuietRange[];
		/** A song's leads (`leadsOf`): 5 6 7 8 there, faint, on the coming tempo. */
		leads?: Lead[];
	}

	let { time, beats, counts, paused, quiet = [], leads = [] }: Props = $props();
	let off = $state(false);
	let index = $state(-1);
	/** The count-in's count (5–8) on now, or null. */
	let ghost = $state<number | null>(null);
	// The count on the beat (motion round 1): each plain step pushes the digit, every count alike.
	const pulse = beatPulse();
	let digitEl = $state<HTMLElement>();
	/** How long a dot takes to grow: 40 % of a beat, 110 ms at most. */
	let dotMs = $state(110);

	/*
	 * The same loop as LiveCount: read the playhead every animation frame.
	 * `timeupdate` fires only ~4 times a second, far too coarse to show a
	 * count that changes 3 times a second.
	 */
	$effect(() => {
		let frame = 0;
		const tick = () => {
			const t = time();
			const c = t === null ? null : countInAt(leads, t);
			ghost = c?.n ?? null;
			// A count-in beat's index counts back from the 1, so the 1 pushes as the next beat.
			index = ghost !== null && c ? c.index : t === null ? -1 : beatIndexAt(beats, t);
			off = ghost === null && t !== null && isQuiet(quiet, t);
			pulse(digitEl, index, ghost ?? (index >= 0 ? (counts[index] ?? null) : null), paused, off);
			const step = stepMs();
			const ms = Math.round(Math.min(110, 0.4 * (step ?? 333)));
			if (ms !== dotMs) dotMs = ms;
			frame = requestAnimationFrame(tick);
		};
		frame = requestAnimationFrame(tick);
		return () => cancelAnimationFrame(frame);
	});

	const count = $derived(ghost ?? (index >= 0 ? (counts[index] ?? null) : null));
	const digit = $derived(stageDigit(count, paused, off, ghost !== null));
	const dots = $derived(stageDots(count, paused, off, ghost !== null));

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
	The 1 looks like every other count (the user's call; it was a cream disc).
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
				bind:this={digitEl}
				class="flex size-full items-center justify-center font-display leading-none font-extrabold tracking-[-0.03em] tabular-nums transition-[scale] duration-150 ease-arrive motion-reduce:transition-none {digit.ghost
					? 'scale-[.78] text-band-ink/40'
					: digit.dim
						? 'text-band-ink/75'
						: 'text-band-ink'}">{digit.text}</span
			>
		</span>
	</span>
	<span class="flex h-4 flex-none items-center gap-1 desk:h-[22px] desk:gap-2" aria-hidden="true">
		{#each dots as d (d.n)}
			<!-- Every dot is the big size; a small one is scaled down, so the lit one grows (transform only). -->
			<span
				class="size-4 flex-none rounded-full transition-[scale] ease-arrive motion-reduce:transition-none desk:size-[22px] {d.size ===
				16
					? ''
					: 'scale-[.625] desk:scale-[.636]'} {DOT_TONE[d.tone]}"
				style:transition-duration="{dotMs}ms"
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
