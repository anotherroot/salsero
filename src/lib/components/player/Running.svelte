<script lang="ts">
	import { clock } from '$lib/format';
	import type { CountPattern, Speed } from '$lib/labels';
	import type { Dance } from '$lib/dances/dances';
	import type { PlayerHandle } from '$lib/scheduler/attach';
	import type { CalledFigure } from '$lib/types';
	import { stageSize } from '$lib/player/view';
	import BandButton from '$lib/components/ui/BandButton.svelte';
	import Badge from '$lib/components/ui/Badge.svelte';
	import BottomBar from '$lib/components/ui/BottomBar.svelte';
	import Icon from '$lib/components/ui/Icon.svelte';
	import Slider from '$lib/components/ui/Slider.svelte';
	import { SECTION_LABEL, button } from '$lib/components/ui/styles';
	import CountChips from './CountChips.svelte';
	import SongProgress from './SongProgress.svelte';
	import StageCount from './StageCount.svelte';

	interface Props {
		player: PlayerHandle;
		beats: number[];
		counts: number[];
		figures: CalledFigure[];
		/** The figure most recently called, or null before the first call. */
		calledFigureId: number | null;
		/**
		 * A routine's slots as they are actually danced, each a list of the figure
		 * ids that may be called there. Empty without a routine, when nothing is
		 * called.
		 */
		slots: { figureIds: number[]; note: string | null }[];
		/** Which of `slots` the run is on, or null before the first call. */
		activeSlot: number | null;
		song: { id: number; title: string; audioFile: string | null } | null;
		/** The song's `<audio>` element, rendered by the page so it exists before Play is pressed. */
		audio: HTMLAudioElement | undefined;
		speed: Speed;
		/** Where the voice slider starts, carried over from the setup screen. */
		initialVoiceVolume: number;
		/** The count pattern in force. Owned by the page, so the logged set matches. */
		count: CountPattern;
		/** Which patterns this run's picker may offer — see the comment below. */
		dance: Dance;
		/** The band's title: the song's, or "Practice". */
		title: string;
		/** The run's settings on the band, from `runSubtitle`. */
		subtitle: string | undefined;
		/** Where the band's back ends up once the run is saved or not ("Back to Music"). */
		backLabel: string;
		/** The band's back: stops the run, and the page asks whether to save it. */
		onback: () => void;
		oncount: (pattern: CountPattern) => void;
		onstop: () => void;
	}

	let {
		player,
		beats,
		counts,
		figures,
		calledFigureId,
		slots,
		activeSlot,
		song,
		audio,
		speed,
		initialVoiceVolume,
		count,
		dance,
		title,
		subtitle,
		backLabel,
		onback,
		oncount,
		onstop
	}: Props = $props();

	let paused = $state(false);
	let voiceVolume = $state(initialVoiceVolume);
	/** Polled rather than read once: nothing else in this component re-renders on its own each tick. */
	let elapsed = $state(0);

	$effect(() => {
		const t = setInterval(() => (elapsed = player.songTime()), 250);
		return () => clearInterval(t);
	});

	// Pitch-corrected playback at slower speeds — a 0.7× salsa without this sounds drunk.
	$effect(() => {
		if (!audio) return;
		audio.playbackRate = speed;
		audio.preservesPitch = true;
	});

	const calledName = $derived(
		calledFigureId !== null ? (figures.find((f) => f.id === calledFigureId)?.name ?? null) : null
	);

	const nameOf = (id: number) => figures.find((f) => f.id === id)?.name ?? `#${id}`;

	/** The slot list and its rows, so the active one can be scrolled to as the run moves. */
	let slotList: HTMLOListElement | undefined = $state();
	let slotEls = $state<(HTMLLIElement | undefined)[]>([]);

	/*
	 * Put the active slot at the TOP of its scroller rather than the middle: what
	 * you need mid-figure is the one being called and the ones coming after it,
	 * and centring spends half the visible list on steps already danced.
	 *
	 * The list's own `scrollTop`, not `scrollIntoView`: that would also scroll
	 * the sheet the list sits in and push the seek bar out of sight. The `ol`
	 * is `relative`, so a row's `offsetTop` is measured from the list's top.
	 */
	$effect(() => {
		if (activeSlot === null || !slotList) return;
		const row = slotEls[activeSlot];
		if (!row) return;
		const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
		slotList.scrollTo({ top: row.offsetTop, behavior: still ? 'auto' : 'smooth' });
	});

	function togglePause() {
		if (paused) {
			void player.resume();
			paused = false;
		} else {
			// Never stop()/start() here: that re-fetches the clips and throws away
			// the figures already planned. pause()/resume() hold the run in place.
			player.pause();
			paused = true;
		}
	}

	// Soft danger, as tall as Pause, so the two never get confused mid-dance.
	// Built with replace(): a colour appended after button() loses to its own.
	const STOP = button('danger', 'lg')
		.replace('bg-danger text-on-danger', 'bg-danger-soft text-danger')
		.replace('px-7', 'pr-6 pl-5');
</script>

<!--
	The whole viewport, in the 560 px column: the band turned into the stage
	above, a sheet that scrolls under it, the transport pinned at the bottom.
	The column's transform makes the BottomBar's `fixed` relative to the
	column, which is what keeps it as wide as the column. Nothing here scrolls
	the page, so there is no slim band: the stage never scrolls away.
-->
<div class="fixed inset-y-0 left-1/2 z-10 flex w-full max-w-[560px] -translate-x-1/2 flex-col">
	<header
		class="flex flex-none flex-col gap-1.5 bg-band"
		style="padding: calc(22px + env(safe-area-inset-top)) 20px 50px; --focus-ring: var(--color-band-ink)"
	>
		<div class="-ml-[10px] flex min-w-0 items-center gap-1">
			<!-- Its name is the action; where it ends up is the hover hint. -->
			<span class="flex-none" title={backLabel}>
				<BandButton icon="back" label="Stop and go back" onclick={onback} />
			</span>
			<h1
				class="min-w-0 truncate font-display text-[30px] leading-[1.1] font-extrabold tracking-[-0.015em] text-band-ink"
			>
				{title}
			</h1>
		</div>
		{#if subtitle}
			<span class="truncate pl-[38px] text-[15px] font-semibold text-band-small">{subtitle}</span>
		{/if}

		<div class="mt-2 flex flex-col items-center gap-2.5">
			<StageCount
				time={() => player.songTime()}
				{beats}
				{counts}
				size={stageSize(!!song, slots.length > 0)}
				{paused}
			/>
			{#if slots.length > 0}
				<!-- 32 px, a little less under 390 px wide: a long name
				     ("Dile que no con vuelta · Doble con mano") stays two whole lines at 360. -->
				<p
					aria-live="polite"
					class="line-clamp-2 min-h-9 text-center font-display text-[min(32px,8.2vw)] leading-[1.1] font-extrabold tracking-[-0.01em] text-balance text-band-ink"
				>
					{calledName ?? ''}
				</p>
			{/if}
			{#if paused}
				<span
					class="inline-flex h-[30px] items-center gap-1.5 rounded-full pr-3.5 pl-2.5 text-[14px] font-extrabold text-band-small tabular-nums ring-[1.5px] ring-band-ink ring-inset"
				>
					<Icon name="pause" size={16} filled />Paused · {clock(elapsed)}
				</span>
			{:else}
				<span class="flex h-[30px] items-center text-[16px] font-bold text-band-small tabular-nums"
					>{clock(elapsed)}</span
				>
			{/if}
		</div>
	</header>

	<div
		class="-mt-7 flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto rounded-t-[28px] bg-ground px-4 pt-4 pb-[112px]"
	>
		{#if song}
			<!-- The app's own bar: the `<audio>` has no controls. It seeks once, on
			     release — each seek clears the count already queued. -->
			<SongProgress {audio} onseek={(t) => player.seek(t)} />
		{/if}

		{#if slots.length > 0}
			<!--
				A routine run shows the whole sequence, with the current slot at the top
				of its own scroller: the figure being called is already on the band in
				large type, so what this adds is what comes NEXT and how far through you are.
			-->
			<ol
				bind:this={slotList}
				aria-label="Routine"
				class="slots relative max-h-[130px] flex-none overflow-y-auto rounded-2xl bg-surface"
			>
				{#each slots as slot, i (i)}
					{@const on = i === activeSlot}
					<li
						bind:this={slotEls[i]}
						aria-current={on ? 'step' : undefined}
						class="flex min-h-12 items-center gap-3 border-b border-hairline py-1.5 pr-3.5 pl-3.5 {on
							? 'bg-accent-soft'
							: ''}"
					>
						<span
							class="w-[18px] flex-none text-[13px] font-extrabold tabular-nums {on
								? 'text-accent-text'
								: 'text-muted'}">{i + 1}</span
						>
						<span
							class="min-w-0 flex-1 text-[15px] leading-[1.3] {on
								? 'font-extrabold text-accent-text'
								: 'font-semibold text-ink-2'}"
						>
							{slot.figureIds.map(nameOf).join('  /  ')}
							{#if slot.note}
								<!-- The note is the reason the slot was written down — "hand change
								     here" is no use on the routine page while you are dancing. -->
								<span
									class="block text-[12px] font-semibold {on ? 'text-accent-text' : 'text-muted'}"
									>{slot.note}</span
								>
							{/if}
						</span>
						{#if on}<Badge tone="accent" solid>Now</Badge>{/if}
					</li>
				{/each}
			</ol>
		{/if}

		<!--
			Both of these are adjustable DURING the run on purpose. Whether the voice
			sits right against the music is only knowable once the music is playing,
			and a song that turns out too fast to count every beat wants the pattern
			thinned THEN — stopping to change it would end the run and lose the plan.

			`dance.countPatterns`, not the global `COUNT_PATTERNS`, for the same
			reason Setup's picker does: bachata has no 'son' count.
		-->
		<section class="flex flex-none flex-col gap-2" aria-labelledby="run-voice">
			<h2 id="run-voice" class={SECTION_LABEL}>Voice</h2>
			<div class="overflow-hidden rounded-2xl bg-surface">
				<div class="py-1.5 pl-3">
					<CountChips
						patterns={dance.countPatterns}
						value={count}
						onchange={oncount}
						name="runCount"
						label="Voice count"
						scroll={!!song || slots.length > 0}
					/>
				</div>
				<div class="border-t border-hairline px-4 py-1">
					<Slider
						label="Voice volume"
						bind:value={voiceVolume}
						oninput={() => player.setVoiceVolume(voiceVolume)}
					/>
				</div>
			</div>
		</section>
	</div>

	<BottomBar fade>
		<div class="flex gap-2.5">
			<button type="button" class={STOP} onclick={onstop}>
				<Icon name="stop" size={22} filled />Stop
			</button>
			<div class="flex min-w-0 flex-1">
				<button type="button" class={button('primary', 'lg', true)} onclick={togglePause}>
					{#if paused}
						<Icon name="play" size={22} filled />Resume
					{:else}
						<Icon name="pause" size={22} filled />Pause
					{/if}
				</button>
			</div>
		</div>
	</BottomBar>
</div>

<style>
	.slots {
		-webkit-mask-image: linear-gradient(#000 70%, transparent);
		mask-image: linear-gradient(#000 70%, transparent);
	}
</style>
