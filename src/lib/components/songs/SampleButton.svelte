<script lang="ts">
	import type { SampleSong } from '$lib/types';
	import { SAMPLE_LENGTH_S } from '$lib/songs/sample';
	import { playSample, sampling, stopSample } from '$lib/songs/sample-player.svelte';

	/*
	 * ▶ plays a 15 s sample of the song, ■ stops it; the ring fills over the
	 * sample. Sits on a row's right edge, split off by its left border.
	 */
	let { song, class: klass = '' }: { song: SampleSong; class?: string } = $props();

	const on = $derived(sampling.id === song.id);
</script>

<button
	type="button"
	aria-label={on ? 'Stop the sample' : 'Play a sample'}
	aria-pressed={on}
	onclick={() => (on ? stopSample() : playSample(song))}
	class="grid w-[52px] flex-none place-items-center border-l border-line text-accent focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent {klass}"
>
	<span class="relative grid size-8 place-items-center">
		<svg viewBox="0 0 32 32" class="absolute inset-0 -rotate-90" aria-hidden="true">
			<circle cx="16" cy="16" r="14" fill="none" stroke-width="2.5" class="stroke-line" />
			{#if on}
				{#key sampling.nonce}
					<circle
						cx="16"
						cy="16"
						r="14"
						fill="none"
						stroke-width="2.5"
						class="run stroke-accent"
						style:animation-duration="{SAMPLE_LENGTH_S}s"
					/>
				{/key}
			{/if}
		</svg>
		<!-- U+FE0E keeps ▶ a text glyph where it would otherwise become an emoji. -->
		<span class="text-[11px] leading-none" aria-hidden="true">{on ? '■' : '▶︎'}</span>
	</span>
</button>

<style>
	/* 2π × 14 ≈ 88: the circle's length, so the offset runs from empty to full. */
	.run {
		stroke-dasharray: 88;
		stroke-dashoffset: 88;
		animation-name: fill;
		animation-timing-function: linear;
		animation-fill-mode: forwards;
	}

	@keyframes fill {
		to {
			stroke-dashoffset: 0;
		}
	}

	/* No movement: a still arc says "sampling" alongside the ■. */
	@media (prefers-reduced-motion: reduce) {
		.run {
			animation: none;
			stroke-dashoffset: 30;
		}
	}
</style>
