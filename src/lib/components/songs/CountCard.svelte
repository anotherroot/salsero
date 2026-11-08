<script lang="ts">
	import { beatIndexAt } from '$lib/beatgrid/beatgrid';
	import LiveCount from '$lib/components/songs/LiveCount.svelte';
	import Icon from '$lib/components/ui/Icon.svelte';
	import SeekBar from '$lib/components/ui/SeekBar.svelte';
	import { PLAY_ROUND } from '$lib/components/ui/styles';
	import { t } from '$lib/i18n/catalog';
	import { listenLines } from '$lib/songs/listen';
	import { MUSIC_START_MIN_S } from '$lib/songs/music-start';
	import type { Placed } from '$lib/songs/sections';

	/*
	 * The listening page's card (spec 2026-11-08, "Listening"): the section
	 * playing, the count, what comes next with a pip per eight, then play and
	 * the seek bar with the section starts on it. Minimal on purpose: no grid,
	 * no 1s, nothing that changes the song.
	 */
	let {
		now,
		paused,
		played,
		duration,
		beats,
		counts,
		sections,
		anchors,
		startS,
		time,
		ontoggle,
		onseek
	}: {
		/** The playhead, in seconds. */
		now: number;
		paused: boolean;
		/** The song has played: before that the count is a guess, as a tap there would be. */
		played: boolean;
		duration: number;
		beats: number[];
		counts: number[];
		sections: Placed[];
		/** How many 1s the person set. */
		anchors: number;
		startS: number;
		/** The playhead for the count, polled every frame; null before play. */
		time: () => number | null;
		ontoggle: () => void;
		onseek: (s: number) => void;
	} = $props();

	const lines = $derived(
		listenLines({
			placed: sections,
			counts,
			beat: played ? beatIndexAt(beats, now) : -1,
			anchors,
			startS,
			played
		})
	);
</script>

<section class="flex flex-none flex-col gap-3 rounded-[22px] bg-surface px-4 pt-3.5 pb-4">
	{#if lines.name}
		<p class="text-center text-[13px] font-extrabold tracking-[0.08em] text-muted uppercase">
			{lines.name}
		</p>
	{/if}
	<LiveCount {time} {beats} {counts} off={lines.off} left={lines.left} />
	{#if lines.ahead}
		<p
			class="flex items-center justify-center gap-2 text-[15px] font-bold text-ink-2"
			aria-live="polite"
		>
			<span aria-hidden="true">→</span>{lines.ahead}
			{#if lines.pips > 0}
				<span class="flex gap-1" aria-hidden="true">
					{#each Array.from({ length: lines.pips }, (_, i) => i) as i (i)}
						<span class="size-1.5 rounded-full bg-ink-2"></span>
					{/each}
				</span>
			{/if}
		</p>
	{/if}
	<div class="flex items-center gap-3.5">
		<button
			type="button"
			class={PLAY_ROUND}
			aria-label={paused ? t().songs.page.listen.play : t().songs.page.listen.pause}
			onclick={ontoggle}
		>
			<Icon name={paused ? 'play' : 'pause'} filled />
		</button>
		<div class="min-w-0 flex-1 pt-3.5">
			<SeekBar
				label={t().songs.page.listen.position}
				value={now}
				{duration}
				ticks={sections.map((s) => s.t)}
				quietUntil={startS >= MUSIC_START_MIN_S ? startS : 0}
				{onseek}
			/>
		</div>
	</div>
</section>
{#if lines.startLine}
	<p class="px-3 text-center text-[13px] leading-[1.45] text-muted">{lines.startLine}</p>
{:else if lines.hint}
	<p class="px-3 text-center text-[13px] leading-[1.45] text-muted">{t().songs.page.listen.hint}</p>
{/if}
