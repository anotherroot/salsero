<script lang="ts">
	import { onMount, tick, untrack } from 'svelte';
	import { beatIndexAt } from '$lib/beatgrid/beatgrid';
	import { sheetStack } from '$lib/sheets/history.svelte';
	import { clock } from '$lib/format';
	import type { CountPattern, Speed } from '$lib/labels';
	import type { Dance } from '$lib/dances/dances';
	import type { PlayerHandle } from '$lib/scheduler/attach';
	import type { CalledFigure } from '$lib/types';
	import { desk } from '$lib/nav/desk.svelte';
	import {
		ROUTINE_VIEWS,
		routineHeading,
		routinePlace,
		runTitleCompact,
		slotTone,
		stageDigit,
		stageSize,
		stepDone,
		stepMarks,
		type RoutineView
	} from '$lib/player/view';
	import BandButton from '$lib/components/ui/BandButton.svelte';
	import Badge from '$lib/components/ui/Badge.svelte';
	import BottomBar from '$lib/components/ui/BottomBar.svelte';
	import Icon from '$lib/components/ui/Icon.svelte';
	import Segmented from '$lib/components/ui/Segmented.svelte';
	import Slider from '$lib/components/ui/Slider.svelte';
	import { CLIP, SECTION_LABEL, button, iconButton } from '$lib/components/ui/styles';
	import { RUN_STOP as STOP } from './styles';
	import CountChips from './CountChips.svelte';
	import SongProgress from './SongProgress.svelte';
	import StageCount from './StageCount.svelte';

	interface Props {
		player: PlayerHandle;
		beats: number[];
		counts: number[];
		figures: CalledFigure[];
		/** The routine's figure on now, from its "1"; null before the first one starts. */
		nowFigureId: number | null;
		/**
		 * A routine's slots as they are actually danced, each a list of the figure
		 * ids that may be danced there. Empty without a routine.
		 */
		slots: { figureIds: number[]; note: string | null }[];
		/** Which of `slots` the run is on, or null before the first figure starts. */
		activeSlot: number | null;
		/** Song time of that figure's "1", for the marks under it; null before the first. */
		stepAt: number | null;
		/** That figure's length in counts. */
		stepLength: number;
		/** Follow: the list moves with the music and a tap starts the run there. Still: it stays put. */
		view: RoutineView;
		onview: (view: RoutineView) => void;
		/** A tap on a slot in Follow: the page moves the run there (`jumpTo`). */
		onjump: (slot: number) => void;
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
		/** The voice slider moved: the page keeps it on this phone. */
		onvolume?: (volume: number) => void;
	}

	let {
		player,
		beats,
		counts,
		figures,
		nowFigureId,
		slots,
		activeSlot,
		stepAt,
		stepLength,
		view,
		onview,
		onjump,
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
		onstop,
		onvolume
	}: Props = $props();

	let paused = $state(false);
	// The setup's volume, read once: from here on the slider is the source.
	let voiceVolume = $state(untrack(() => initialVoiceVolume));
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

	const follow = $derived(view === 'follow');
	/**
	 * The row lit, in Follow only. Before the first figure starts it is the first
	 * slot rather than nothing: the list has to say where the routine is about to
	 * start, or it reads as dead for the lead-in. Still lights nothing.
	 */
	const lit = $derived(follow && slots.length > 0 ? (activeSlot ?? 0) : null);
	/** The band's line under the count: the figure on now, in Follow. Still moves nothing. */
	const nowName = $derived(
		follow && nowFigureId !== null
			? (figures.find((f) => f.id === nowFigureId)?.name ?? null)
			: null
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
		if (lit === null || !slotList) return;
		const row = slotEls[lit];
		if (!row) return;
		slotList.scrollTo({ top: row.offsetTop, behavior: motion() });
	});

	const motion = (): ScrollBehavior =>
		window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';

	/*
	 * The full-screen routine (phone): the list in large type, to read from a few
	 * metres away. It holds a history entry like a sheet (`sheetStack`), so Back
	 * closes it rather than ending the run. Stop and Pause stay on top of it.
	 */
	let full = $state(false);
	let fullKey: number | null = null;
	let fullList: HTMLOListElement | undefined = $state();
	let fullEls = $state<(HTMLLIElement | undefined)[]>([]);
	let expandBtn: HTMLButtonElement | undefined = $state();
	let fullBox: HTMLDivElement | undefined = $state();

	async function openFull() {
		full = true;
		fullKey = sheetStack.open({
			tryLeave: (leave) => leave(),
			close: () => {
				fullKey = null;
				full = false;
				void tick().then(() => expandBtn?.focus({ preventScroll: true }));
			}
		});
		await tick();
		fullBox?.querySelector<HTMLElement>('[data-focus="routine-close"]')?.focus();
	}

	function closeFull() {
		if (fullKey !== null) sheetStack.requestClose(fullKey);
		else full = false;
	}

	// The run ending (Stop, the song's end) unmounts this with the layer open: its entry goes too.
	$effect(() => () => {
		if (fullKey !== null) sheetStack.closedByOwner(fullKey);
	});

	/* The lit row near the top, the one before it still in sight. */
	$effect(() => {
		if (!full || lit === null || !fullList) return;
		const row = fullEls[lit];
		if (!row) return;
		const before = fullEls[lit - 1];
		fullList.scrollTo({
			top: Math.max(0, before ? before.offsetTop : row.offsetTop - 8),
			behavior: motion()
		});
	});

	/* The layer's own count and the marks under the figure: read every frame, like StageCount. */
	let liveCount = $state<number | null>(null);
	let liveTime = $state(0);
	$effect(() => {
		if (!full) return;
		let frame = 0;
		const loop = () => {
			liveTime = player.songTime();
			const i = beatIndexAt(beats, liveTime);
			liveCount = i >= 0 ? (counts[i] ?? null) : null;
			frame = requestAnimationFrame(loop);
		};
		frame = requestAnimationFrame(loop);
		return () => cancelAnimationFrame(frame);
	});
	const marks = $derived(stepMarks(stepLength));
	const done = $derived(stepAt === null ? 0 : stepDone(beats, stepAt, liveTime, marks));

	/** A tap on a row in Follow: the run moves there. Still: rows are only to read. */
	function jump(i: number) {
		if (follow) onjump(i);
	}

	/*
	 * Play's button is gone once this mounts, so focus would fall to <body>.
	 * Pause is the next thing a keyboard or screen-reader user wants.
	 */
	let pauseBtn: HTMLButtonElement | undefined = $state();
	onMount(() => pauseBtn?.focus({ preventScroll: true }));

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
</script>

<!--
	The whole viewport, in the 560 px column: the band turned into the stage
	above, a sheet that scrolls under it, the transport pinned at the bottom.
	The column's transform makes the BottomBar's `fixed` relative to the
	column, which is what keeps it as wide as the column. Nothing here scrolls
	the page, so there is no slim band: the stage never scrolls away.

	On the desktop (desktop spec, "Practice"): the column is the whole window on
	the band, its transform still there (so the BottomBar is placed in window
	coordinates). The header is the band row, the ‹ and the title where Setup's
	band row has them; the stage is the band under it, left of a 520 px sheet
	that holds the seek bar, the whole routine and the Voice card, Stop and
	Pause pinned at its foot. It sits over the frame's sheet corners
	(`SheetCorner`, z-30): the sheet's top-right corner is square.
-->
<div
	class="run-col fixed inset-y-0 left-1/2 z-10 flex w-full max-w-[560px] -translate-x-1/2 flex-col desk:left-0 desk:z-[31] desk:max-w-none desk:translate-x-0 desk:bg-band"
>
	<header
		class="run-head flex flex-none flex-col gap-1.5 bg-band desk:grid desk:h-(--band-row-h) desk:grid-cols-[max-content_minmax(0,max-content)_minmax(0,1fr)] desk:content-center desk:items-center desk:gap-0"
		style="--focus-ring: var(--color-band-ink)"
	>
		<div class="-ml-[10px] flex min-w-0 items-center gap-1 desk:contents">
			<!-- Its name is the action; where it ends up is the hover hint. -->
			<span class="flex-none desk:mr-[14px]" title={backLabel}>
				<BandButton icon="back" label="Stop and go back" onclick={onback} />
			</span>
			<h1
				class="min-w-0 truncate font-display text-[30px] leading-[1.1] font-extrabold tracking-[-0.015em] text-band-ink desk:self-baseline {runTitleCompact(
					title
				)
					? 'desk:text-[30px]'
					: 'desk:text-[46px] desk:leading-[1.05] desk:tracking-[-0.02em]'}"
			>
				{title}
			</h1>
		</div>
		{#if subtitle}
			<span
				class="truncate pl-[38px] text-[15px] font-semibold text-band-small desk:ml-[14px] desk:min-w-0 desk:self-baseline desk:pl-0"
				>{subtitle}</span
			>
		{/if}

		<div
			class="run-stage mt-2 flex flex-col items-center gap-2.5 desk:absolute desk:top-(--band-row-h) desk:right-[520px] desk:bottom-0 desk:left-0 desk:mt-0 desk:justify-center-safe desk:gap-[22px] desk:px-8 desk:pb-10 desk:*:shrink-0"
		>
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
					class="run-call line-clamp-2 min-h-9 text-center font-display text-[min(32px,8.2vw)] leading-[1.1] font-extrabold tracking-[-0.01em] text-balance text-band-ink desk:min-h-[52px] desk:text-[44px] desk:leading-[1.15]"
				>
					{nowName ?? ''}
				</p>
			{/if}
			{#if paused}
				<span
					class="inline-flex h-[30px] items-center gap-1.5 rounded-full pr-3.5 pl-2.5 text-[14px] font-extrabold text-band-small tabular-nums ring-[1.5px] ring-band-ink ring-inset desk:h-9 desk:gap-2 desk:pr-4 desk:pl-3 desk:text-[16px] desk:[&_svg]:size-[18px]"
				>
					<Icon name="pause" size={16} filled />Paused · {clock(elapsed)}
				</span>
			{:else}
				<span
					class="flex h-[30px] items-center text-[16px] font-bold text-band-small tabular-nums desk:h-9 desk:text-[20px]"
					>{clock(elapsed)}</span
				>
			{/if}
		</div>
	</header>

	<!--
		The sheet clips and an inner box scrolls: a desktop browser's classic
		scrollbar on the rounded box itself ran straight up through the 28 px
		curve, so an overflowing sheet showed a square top corner.
	-->
	<div
		class="run-sheet -mt-7 flex min-h-0 flex-1 flex-col overflow-hidden rounded-t-[28px] bg-ground desk:fixed desk:top-(--band-row-h) desk:right-0 desk:bottom-0 desk:mt-0 desk:w-[520px] desk:rounded-tl-[28px] desk:rounded-tr-none"
	>
		<div class="run-scroll flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 pt-4 pb-[112px]">
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
				<!-- Where in the routine the run is; Follow or Still on the desktop, the full-screen list on the phone. -->
				<div class="flex min-h-9 flex-none items-center gap-2">
					<h2 class="{SECTION_LABEL} min-w-0 flex-1 truncate">
						{routineHeading(lit, slots.length)}
					</h2>
					<div class="hidden w-[170px] flex-none desk:block">
						<Segmented
							compact
							items={ROUTINE_VIEWS}
							value={view}
							name="runView"
							label="Routine"
							onchange={onview}
						/>
					</div>
					<button
						bind:this={expandBtn}
						type="button"
						class="{iconButton('tonal')} -my-1 desk:hidden"
						aria-label="Show the routine full screen"
						onclick={openFull}
					>
						<Icon name="expand" size={20} />
					</button>
				</div>
				<ol
					bind:this={slotList}
					aria-label="Routine"
					class="slots relative max-h-[130px] flex-none overflow-y-auto rounded-2xl bg-surface"
				>
					{#each slots as slot, i (i)}
						{@const tone = slotTone(i, lit)}
						{@const on = tone === 'now'}
						<li
							bind:this={slotEls[i]}
							aria-current={on ? 'step' : undefined}
							class="border-b border-hairline {i === slots.length - 1 ? 'desk:border-b-0' : ''} {on
								? 'bg-accent-soft'
								: ''}"
						>
							{#if follow}
								<button
									type="button"
									class="focus-inset flex min-h-12 w-full cursor-pointer items-center gap-3 py-1.5 pr-3.5 pl-3.5 text-left"
									aria-label="Start from {i + 1}, {slot.figureIds.map(nameOf).join(' or ')}"
									onclick={() => jump(i)}
								>
									{@render slotRow(slot, i, tone)}
								</button>
							{:else}
								<div class="flex min-h-12 items-center gap-3 py-1.5 pr-3.5 pl-3.5">
									{@render slotRow(slot, i, tone)}
								</div>
							{/if}
						</li>
					{/each}
					<!-- Room to scroll the last row to the top (list height 130 - a 48 px row), so the mask never fades the active one. -->
					<li aria-hidden="true" class="slots-pad flex-none"></li>
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
				<div class="{CLIP} rounded-2xl bg-surface">
					<div class="py-1.5 pl-3 desk:pr-3">
						<CountChips
							patterns={dance.countPatterns}
							value={count}
							onchange={oncount}
							name="runCount"
							label="Voice count"
							scroll={(!!song || slots.length > 0) && !desk.current}
						/>
					</div>
					<div class="border-t border-hairline px-4 py-1">
						<Slider
							label="Voice volume"
							bind:value={voiceVolume}
							oninput={() => {
								player.setVoiceVolume(voiceVolume);
								onvolume?.(voiceVolume);
							}}
						/>
					</div>
				</div>
			</section>
		</div>
	</div>

	{#if full}
		<!--
			The full-screen routine: the count on a short band strip, the list in
			large type. Under the run bar (z-20), so Stop and Pause stay where they are.
		-->
		<div
			bind:this={fullBox}
			class="run-full fixed inset-0 z-[15] flex flex-col bg-ground desk:hidden"
			role="dialog"
			aria-label="Routine"
			tabindex="-1"
			onkeydown={(e) => {
				if (e.key === 'Escape') closeFull();
			}}
		>
			<div
				class="flex flex-none items-center gap-2.5 bg-band pr-4 pb-10 pl-2.5 text-band-ink"
				style="padding-top: calc(12px + var(--safe-top)); --focus-ring: var(--color-band-ink)"
			>
				<BandButton
					icon="close"
					label="Close the full-screen routine"
					onclick={closeFull}
					focusKey="routine-close"
				/>
				<span
					class="w-9 flex-none text-center font-display text-[42px] leading-none font-extrabold tabular-nums"
					aria-hidden="true">{stageDigit(liveCount, paused).text}</span
				>
				<span
					class="min-w-0 flex-1 text-[13px] leading-tight font-bold text-band-small tabular-nums"
				>
					{routinePlace(lit, slots.length)}<br />{clock(elapsed)}
				</span>
				<div class="flex-none">
					<Segmented
						compact
						onBand
						items={ROUTINE_VIEWS}
						value={view}
						name="fullView"
						label="Routine"
						onchange={onview}
					/>
				</div>
			</div>
			<ol
				bind:this={fullList}
				aria-label="Routine"
				class="relative -mt-7 min-h-0 flex-1 overflow-y-auto rounded-t-[28px] bg-ground px-2.5 pt-3 pb-[112px]"
			>
				{#each slots as slot, i (i)}
					{@const tone = slotTone(i, lit)}
					{@const on = tone === 'now'}
					<li bind:this={fullEls[i]} aria-current={on ? 'step' : undefined}>
						{#if follow}
							<button
								type="button"
								class="focus-inset flex w-full cursor-pointer flex-wrap items-center gap-x-3 rounded-xl px-3 py-2.5 text-left {on
									? 'bg-accent-soft'
									: ''}"
								aria-label="Start from {i + 1}, {slot.figureIds.map(nameOf).join(' or ')}"
								onclick={() => jump(i)}
							>
								{@render bigRow(slot, i, tone)}
							</button>
						{:else}
							<div class="flex flex-wrap items-center gap-x-3 px-3 py-2.5">
								{@render bigRow(slot, i, tone)}
							</div>
						{/if}
					</li>
				{/each}
			</ol>
		</div>
	{/if}

	<BottomBar fade class="run-bar">
		<div class="flex gap-2.5">
			<button type="button" class={STOP} onclick={onstop}>
				<Icon name="stop" size={22} filled />Stop
			</button>
			<div class="flex min-w-0 flex-1">
				<button
					bind:this={pauseBtn}
					type="button"
					class={button('primary', 'lg', true)}
					onclick={togglePause}
				>
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

{#snippet slotRow(slot: { figureIds: number[]; note: string | null }, i: number, tone: string)}
	{@const on = tone === 'now'}
	<span
		class="w-[18px] flex-none text-[13px] font-extrabold tabular-nums {on
			? 'text-accent-text'
			: 'text-muted'}">{i + 1}</span
	>
	<span
		class="min-w-0 flex-1 text-[15px] leading-[1.3] {on
			? 'font-extrabold text-accent-text'
			: tone === 'past'
				? 'font-semibold text-ink-2 desk:text-muted'
				: 'font-semibold text-ink-2'}"
	>
		{slot.figureIds.map(nameOf).join('  /  ')}
		{#if slot.note}
			<!-- The note is the reason the slot was written down — "hand change
			     here" is no use on the routine page while you are dancing. -->
			<span class="block text-[12px] font-semibold {on ? 'text-accent-text' : 'text-muted'}"
				>{slot.note}</span
			>
		{/if}
	</span>
	{#if on}<Badge tone="accent" solid>Now</Badge>{/if}
{/snippet}

{#snippet bigRow(slot: { figureIds: number[]; note: string | null }, i: number, tone: string)}
	{@const on = tone === 'now'}
	<span
		class="w-7 flex-none text-[16px] font-extrabold tabular-nums {on
			? 'text-accent-text'
			: tone === 'past'
				? 'text-muted/60'
				: 'text-muted'}">{i + 1}</span
	>
	<span
		class="min-w-0 flex-1 font-display leading-[1.15] {on
			? 'text-[26px] font-extrabold text-accent-text'
			: tone === 'past'
				? 'text-[20px] font-bold text-muted/60'
				: 'text-[20px] font-bold text-ink-2'}"
	>
		{slot.figureIds.map(nameOf).join('  /  ')}
		{#if slot.note}
			<span
				class="block font-sans text-[13px] font-semibold {on ? 'text-accent-text' : 'text-muted'}"
				>{slot.note}</span
			>
		{/if}
	</span>
	{#if on}
		<!-- Where in the figure the run is: a mark per count (per 8-count past 16). -->
		<span class="mt-2 flex w-full gap-1 pl-10" aria-hidden="true">
			{#each Array.from({ length: marks.marks }, (_, k) => k) as k (k)}
				<span class="h-[3px] flex-1 rounded-full {k < done ? 'bg-accent' : 'bg-accent/25'}"></span>
			{/each}
		</span>
	{/if}
{/snippet}

<style>
	/* The phone's band padding, here rather than inline so the desktop's band row can replace it. */
	.run-head {
		padding: calc(22px + var(--safe-top)) 20px 50px;
	}

	.slots {
		-webkit-mask-image: linear-gradient(#000 70%, transparent);
		mask-image: linear-gradient(#000 70%, transparent);
	}

	.slots-pad {
		height: 82px;
	}

	/* A short phone: a smaller list and a tighter foot, so the "Now" row clears the transport's fade. */
	@media (max-height: 700px) {
		.slots {
			max-height: 100px;
		}
		.slots-pad {
			height: 52px; /* 100 - 48 */
		}
		.run-scroll {
			padding-bottom: 96px;
		}
	}

	/*
	 * A landscape phone: two halves. The stage is the left, the sheet the right
	 * (overlapping the band from the side as it does from below in portrait),
	 * the transport at the foot of the right half. Never on the desktop, which
	 * has its own split (below); no phone is 1024 wide.
	 */
	@media (orientation: landscape) and (max-height: 520px) and (width < 1024px) {
		.run-col {
			max-width: 900px;
			flex-direction: row;
		}
		.run-head {
			flex: 0 0 50%;
			padding-top: calc(14px + var(--safe-top)) !important;
			padding-bottom: 22px !important;
			padding-left: max(20px, var(--safe-left)) !important;
		}
		.run-head > span {
			flex: none;
		}
		.run-call {
			font-size: 24px;
			min-height: 0;
		}
		.run-stage {
			margin-block: auto;
		}
		.run-sheet {
			margin-top: 0;
			margin-left: -28px;
			border-radius: 28px 0 0 28px;
		}
		.run-scroll {
			padding-bottom: 112px;
		}
		.run-col :global(.run-bar) {
			left: 50%;
			padding-right: max(16px, var(--safe-right));
		}
	}

	/*
	 * The desktop: the band row (the ‹ at x 18, as Setup's), the stage under it
	 * on the band, the sheet a 520 px column on the right. Last, so it outranks
	 * the short-phone block on a short window.
	 */
	@media (width >= 1024px) {
		/* The run bar spans the sheet: its `left` is this (`BottomBar`), the column its containing block. */
		.run-col {
			--pane-left: calc(100% - 520px);
		}
		.run-head {
			padding: 0 40px 0 18px;
		}
		/* 124 at the foot: 20 of the sheet's own, and the run bar (28 fade + a 64 button + 12). */
		.run-scroll {
			padding: 24px 28px 124px;
			gap: 8px;
		}
		/* The whole routine; a long one shrinks the list, which scrolls itself, never the Voice card away. */
		.slots {
			flex: 0 1 auto;
			min-height: 48px;
			max-height: none;
			-webkit-mask-image: none;
			mask-image: none;
		}
		.slots-pad {
			display: none;
		}
		/* Stop and Pause line up with the sheet's 28 px sides. */
		.run-col :global(.run-bar) {
			padding-inline: 28px;
		}
	}
</style>
