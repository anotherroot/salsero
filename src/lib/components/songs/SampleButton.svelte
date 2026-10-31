<script lang="ts">
	import type { SampleSong } from '$lib/types';
	import { SAMPLE_LENGTH_S } from '$lib/songs/sample';
	import { playSample, sampling, stopSample } from '$lib/songs/sample-player.svelte';
	import Icon from '$lib/components/ui/Icon.svelte';

	/*
	 * ▶ plays a 15 s sample of the song, ■ stops it. A tonal disc on a 48 px
	 * hit area; while it samples, a ring around the disc fills over the 15 s.
	 * A sibling of a row's link, never inside it. `tinted`: the row behind is
	 * already accent-soft (the picked song), so the disc is the surface colour.
	 */
	let {
		song,
		name,
		tinted = false,
		class: klass = ''
	}: { song: SampleSong; name?: string; tinted?: boolean; class?: string } = $props();

	const on = $derived(sampling.id === song.id);
	const label = $derived(
		on ? 'Stop the sample' : name ? `Play a sample of ${name}` : 'Play a sample'
	);
</script>

<button
	type="button"
	aria-label={label}
	aria-pressed={on}
	onclick={() => (on ? stopSample() : playSample(song))}
	class="group flex size-12 flex-none cursor-pointer items-center justify-center rounded-full text-accent {klass}"
>
	<span
		class="relative flex size-[34px] items-center justify-center rounded-full group-active:brightness-90 {tinted
			? 'bg-surface'
			: 'bg-accent-soft'}"
	>
		{#if on}
			<svg
				viewBox="0 0 42 42"
				class="absolute -top-1 -left-1 size-[42px] -rotate-90"
				aria-hidden="true"
			>
				<circle cx="21" cy="21" r="19" fill="none" stroke-width="2.5" class="stroke-hairline" />
				{#key sampling.nonce}
					<circle
						cx="21"
						cy="21"
						r="19"
						fill="none"
						stroke-width="2.5"
						stroke-linecap="round"
						class="run stroke-accent"
						style:animation-duration="{SAMPLE_LENGTH_S}s"
					/>
				{/key}
			</svg>
			<Icon name="stop" size={13} filled />
		{:else}
			<span class="ml-0.5 flex"><Icon name="play" size={15} filled /></span>
		{/if}
	</span>
</button>

<style>
	/* 2π × 19 ≈ 119.4: the circle's length, so the offset runs from empty to full. */
	.run {
		stroke-dasharray: 119.4;
		stroke-dashoffset: 119.4;
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
			stroke-dashoffset: 79;
		}
	}
</style>
