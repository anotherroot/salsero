<!-- src/lib/components/player/Running.svelte -->
<script lang="ts">
	import { onMount, tick, untrack } from 'svelte';
	import { clock } from '$lib/format';
	import { beatIndexAt } from '$lib/beatgrid/beatgrid';
	import { CLAVE_NAME, type ClavePattern } from '$lib/labels';
	import {
		aheadLine,
		aheadOf,
		sectionIndexAt,
		sectionName,
		type Placed
	} from '$lib/songs/sections';
	import { leadAhead, leadsOf } from '$lib/songs/count-in';
	import { quietOf } from '$lib/scheduler/quiet';
	import type { CountPattern, Speed } from '$lib/labels';
	import type { Dance } from '$lib/dances/dances';
	import type { PlayerHandle } from '$lib/scheduler/attach';
	import type { CalledFigure, RunDetails } from '$lib/types';
	import {
		aboutPreview,
		aboutShown,
		hasDetails,
		routinePlace,
		routinePreview,
		routineViews,
		slotDetails,
		slotTone,
		stepDone,
		stepMarks,
		voicePreview,
		type RoutineView
	} from '$lib/player/view';
	import BandButton from '$lib/components/ui/BandButton.svelte';
	import BottomBar from '$lib/components/ui/BottomBar.svelte';
	import Icon from '$lib/components/ui/Icon.svelte';
	import Segmented from '$lib/components/ui/Segmented.svelte';
	import Slider from '$lib/components/ui/Slider.svelte';
	import Stepper from '$lib/components/ui/Stepper.svelte';
	import {
		DELAY_MAX_MS,
		DELAY_STEP_MS,
		correctionFor,
		saveDelayCorrection,
		totalDelayMs
	} from '$lib/player/sound-delay';
	import { CLIP, button, iconButton } from '$lib/components/ui/styles';
	import { t } from '$lib/i18n/catalog';
	import { RUN_STOP as STOP } from './styles';
	import ClaveChips from './ClaveChips.svelte';
	import CountChips from './CountChips.svelte';
	import DetailsBody from './DetailsBody.svelte';
	import { pauseForVideo, releaseSound, videoSound } from '$lib/player/video-sound.svelte';
	import RunLayer from './RunLayer.svelte';
	import RunRows, { type RunRow, type RunRowKey } from './RunRows.svelte';
	import SongProgress from './SongProgress.svelte';
	import StageCount from './StageCount.svelte';
	import { callMoves } from '$lib/player/beat-motion';
	import { stepMs } from '$lib/motion/beat-pulse';
	import { desk } from '$lib/nav/desk.svelte';
	import { ghost } from '$lib/motion/ghost';
	import { MS, play, reducedMotion } from '$lib/motion/motion';

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
		/** The exercise's About, when it has one (a drill, a figure exercise). */
		details: RunDetails | null;
		/** A routine's figures' About, by figure id: only those that have one. */
		figureDetails: Record<number, RunDetails>;
		/** The routine's own notes, over its full-screen list. */
		routineNotes: string | null;
		/** The song's sections, placed on its 1s: the band names the one playing and the next. */
		sections: Placed[];
		/** The clave in force, changed from the Voice layer. Owned by the page. */
		clave: ClavePattern | null;
		onclave: (clave: ClavePattern | null) => void;
		song: { id: number; title: string; audioFile: string | null } | null;
		/** The song's `<audio>` element, rendered by the page so it exists before Play is pressed. */
		audio: HTMLAudioElement | undefined;
		speed: Speed;
		/** Where the voice slider starts, carried over from the setup screen. */
		initialVoiceVolume: number;
		/** The count pattern in force. Owned by the page. */
		count: CountPattern;
		/** Which patterns this run's picker may offer — see the comment below. */
		dance: Dance;
		/** The band's title: the exercise, the routine, the song, or Count only (`runTitle`). */
		title: string;
		/** The run's settings on the band, from `runSubtitle`. */
		subtitle: string | undefined;
		/** Where the band's back ends up ("Back to Music"). */
		backLabel: string;
		/** The band's back: stops the run and leaves. */
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
		details,
		figureDetails,
		routineNotes,
		sections,
		clave,
		onclave,
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

	/*
	 * The count's wait for the sound (Voice layer): what the phone reports, read
	 * while the layer is open (headphones come and go), and the person's own
	 * correction on top. The Stepper shows the whole wait.
	 */
	let delay = $state(untrack(() => player.soundDelay()));
	const delayTotal = $derived(totalDelayMs(delay.reportedMs, delay.correctionMs));
	$effect(() => {
		if (layer !== 'voice') return;
		delay = player.soundDelay();
		const t = setInterval(() => (delay = player.soundDelay()), 500);
		return () => clearInterval(t);
	});
	function setDelay(total: number) {
		const correctionMs = correctionFor(total, delay.reportedMs);
		player.setDelayCorrection(correctionMs);
		saveDelayCorrection(correctionMs);
		delay = { ...delay, correctionMs };
	}

	// Pitch-corrected playback at slower speeds — a 0.7× salsa without this sounds drunk.
	$effect(() => {
		if (!audio) return;
		audio.playbackRate = speed;
		audio.preservesPitch = true;
	});

	const w = $derived(t().player);

	/* A song's sections: the one playing (a count-off one is quiet) and what comes next. */
	const sectionBeat = $derived(sections.length > 0 ? beatIndexAt(beats, elapsed) : -1);
	const sectionNow = $derived(
		sections.length > 0 ? (sections[sectionIndexAt(sections, sectionBeat)] ?? null) : null
	);
	/** The count-off sections' spans and the leads: the count shows a dash there, its dots all alike. */
	const quietSpans = $derived(quietOf(sections, beats));
	/** Before the main beat: a dash, then 5 6 7 8 faint on the coming tempo (`$lib/songs/count-in`). */
	const leads = $derived(leadsOf(sections, beats));
	// In a lead the next section counts down in its own tempo, not the lead's loose beats.
	const sectionNext = $derived(
		sections.length > 0
			? (leadAhead(leads, elapsed) ?? aheadOf(sections, counts, sectionBeat))
			: null
	);
	const follow = $derived(view === 'follow');
	/**
	 * The slot lit, in Follow only. Before the first figure starts it is the first
	 * slot rather than nothing: the run has to say where it is about to start, or
	 * it reads as dead for the lead-in. Still lights nothing.
	 */
	const lit = $derived(follow && slots.length > 0 ? (activeSlot ?? 0) : null);
	const nameOf = (id: number) => figures.find((f) => f.id === id)?.name ?? `#${id}`;
	/** The figure lit: the one danced now, else the first slot's first before the run reaches it. */
	const litFigure = $derived(
		lit === null ? null : (nowFigureId ?? slots[lit]?.figureIds[0] ?? null)
	);
	/** Under the count, in Follow: the figure on now, and the next slot's. */
	const nowName = $derived(litFigure === null ? null : nameOf(litFigure));
	const nextName = $derived(
		lit !== null && lit + 1 < slots.length ? slots[lit + 1].figureIds.map(nameOf).join(' / ') : null
	);

	/*
	 * A new figure on its 1: Next rises and grows into the call, the old call lifts
	 * away (motion round 1). Only when the call becomes what Next said: a seek or a
	 * jump back changes them at once. Nothing waits: the words are already new.
	 */
	let callEl = $state<HTMLElement>();
	let nextEl = $state<HTMLElement>();
	let calls: { now: string | null; next: string | null } = { now: null, next: null };
	let rise: { dy: number; k: number; ms: number } | null = null;
	$effect.pre(() => {
		const now = nowName;
		untrack(() => {
			// Not under an open layer (Routine, About, Voice cover the stage on the phone):
			// its ghost would flash over the layer.
			if (
				!callMoves(calls, now) ||
				!callEl ||
				!nextEl ||
				reducedMotion() ||
				(layer !== null && !desk.current)
			)
				return;
			const c = callEl.getBoundingClientRect();
			const n = nextEl.getBoundingClientRect();
			const ms = Math.min(MS.long, 1.4 * (stepMs() ?? 333));
			rise = {
				dy: n.top + n.height / 2 - (c.top + c.height / 2),
				k:
					parseFloat(getComputedStyle(nextEl).fontSize) /
					parseFloat(getComputedStyle(callEl).fontSize),
				ms
			};
			play(
				ghost(callEl, null),
				[
					{ opacity: 1, transform: 'none' },
					{ opacity: 0, transform: 'translateY(-24px)' }
				],
				{ duration: ms * 0.7, fill: 'forwards' }
			);
		});
	});
	$effect(() => {
		const now = nowName;
		const next = nextName;
		untrack(() => {
			calls = { now, next };
			const r = rise;
			rise = null;
			if (!r || !callEl || !nextEl) return;
			play(
				callEl,
				[
					{ opacity: 0.7, transform: `translateY(${r.dy}px) scale(${r.k})` },
					{ opacity: 1, transform: 'none' }
				],
				{ duration: r.ms }
			);
			play(
				nextEl,
				[
					{ opacity: 0, transform: 'translateY(8px)' },
					{ opacity: 0, offset: 0.4 },
					{ opacity: 1, transform: 'none' }
				],
				{ duration: r.ms }
			);
		});
	});

	/** About: the exercise's; in a routine, the lit figure's (Follow only). */
	const about = $derived(
		slots.length > 0
			? litFigure === null
				? null
				: (figureDetails[litFigure] ?? null)
			: hasDetails(details)
				? details
				: null
	);

	const rows = $derived.by((): RunRow[] => {
		const out: RunRow[] = [];
		if (slots.length > 0)
			out.push({
				key: 'routine',
				title: w.routine,
				preview: routinePreview(lit, slots.length, view),
				icon: 'list'
			});
		if (about)
			out.push({
				key: 'about',
				title: slots.length > 0 && litFigure !== null ? w.aboutOf(nameOf(litFigure)) : w.about,
				preview: aboutPreview(about),
				icon: 'notes'
			});
		out.push({
			key: 'voice',
			title: w.voice,
			preview: voicePreview(count, voiceVolume),
			icon: 'speaker'
		});
		return out;
	});

	/* The layers: one open at a time from the rows; Back or ✕ closes it. */
	let layer = $state<RunRowKey | null>(null);
	let rowsEl: ReturnType<typeof RunRows> | undefined = $state();
	function closeLayer() {
		const was = layer;
		layer = null;
		if (was) void tick().then(() => rowsEl?.focusRow(was));
	}
	/*
	 * About in a routine stays on the figure that was lit when it opened: the run
	 * moves on every few seconds, faster than anyone reads. Only the row follows.
	 */
	let pinned = $state<number | null>(null);
	function openRow(key: RunRowKey) {
		pinned = key === 'about' ? litFigure : null;
		layer = key;
	}
	const shown = $derived(aboutShown({ routine: slots.length > 0, pinned, details, figureDetails }));

	const motion = (): ScrollBehavior =>
		window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';

	/* The routine layer's list: the lit row near the top, the one before it still in sight. */
	let fullList: HTMLOListElement | undefined = $state();
	let fullEls = $state<(HTMLLIElement | undefined)[]>([]);
	$effect(() => {
		if (layer !== 'routine' || lit === null || !fullList) return;
		const row = fullEls[lit];
		if (!row) return;
		const before = fullEls[lit - 1];
		fullList.scrollTo({
			top: Math.max(0, before ? before.offsetTop : row.offsetTop - 8),
			behavior: motion()
		});
	});

	/* The marks under the lit figure in the routine layer: read every frame while it is open. */
	let liveTime = $state(0);
	$effect(() => {
		if (layer !== 'routine') return;
		let frame = 0;
		const loop = () => {
			liveTime = player.songTime();
			frame = requestAnimationFrame(loop);
		};
		frame = requestAnimationFrame(loop);
		return () => cancelAnimationFrame(frame);
	});
	const marks = $derived(stepMarks(stepLength));
	const done = $derived(stepAt === null ? 0 : stepDone(beats, stepAt, liveTime, marks));

	/** A tap on a row in Follow: the run moves there. */
	function jump(i: number) {
		if (follow) onjump(i);
	}

	/*
	 * A slot's details, over the routine list: its ⓘ in Follow (a tap jumps), a
	 * tap in Still (a tap does nothing else there). ✕ or Back returns to the list.
	 */
	let figureSlot = $state<number | null>(null);
	const slotName = (i: number) => slots[i]?.figureIds.map(nameOf).join(' / ') ?? '';
	function closeFigure() {
		const was = figureSlot;
		figureSlot = null;
		if (was === null) return;
		void tick().then(() =>
			fullList
				?.querySelector<HTMLElement>(`[data-slot-about="${was}"]`)
				?.focus({ preventScroll: true })
		);
	}
	// The list closing (Back from it, Stop) takes the figure over it along.
	$effect(() => {
		if (layer !== 'routine' && figureSlot !== null) untrack(() => (figureSlot = null));
	});

	/*
	 * Play's button is gone once this mounts, so focus would fall to <body>.
	 * Pause is the next thing a keyboard or screen-reader user wants.
	 */
	let pauseBtn: HTMLButtonElement | undefined = $state();
	onMount(() => pauseBtn?.focus({ preventScroll: true }));

	// A video in About took the sound: the run pauses, and waits for Resume.
	$effect(() => {
		const key = videoSound.key;
		untrack(() => {
			if (pauseForVideo(key, paused)) {
				player.pause();
				paused = true;
			}
		});
	});

	function togglePause() {
		if (paused) {
			// Resume gives the sound back to the music: the video goes quiet.
			releaseSound(videoSound.key ?? '');
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
	The whole viewport, in the 560 px column (one-player design, B2): the band
	takes every pixel the controls do not use and the count fills it; under it
	a sheet with the seek bar (a song) and the rows — Routine, About, Voice —
	each opening a full-screen layer; Stop and Pause pinned at the bottom. The
	column's transform makes the BottomBar's and the layers' `fixed` relative
	to the column. Nothing here scrolls the page.

	On the desktop (desktop spec, "Practice"): the column is the whole window on
	the band. The header is the band row, the ‹ and the title where Setup's
	band row has them; the stage is the band under it, left of a 520 px sheet
	that holds the seek bar and the rows, Stop and Pause pinned at its foot; a
	row's layer opens in that column.
-->
<div
	class="run-col fixed inset-y-0 left-1/2 z-10 flex w-full max-w-[560px] -translate-x-1/2 flex-col desk:left-0 desk:z-[31] desk:max-w-none desk:translate-x-0 desk:bg-band"
>
	<header
		class="run-head flex min-h-0 flex-1 flex-col gap-1.5 bg-band desk:grid desk:h-(--band-row-h) desk:flex-none desk:grid-cols-[max-content_minmax(0,max-content)_minmax(0,1fr)] desk:content-center desk:items-center desk:gap-0"
		style="--focus-ring: var(--color-band-ink)"
	>
		<div class="-ml-[10px] flex min-w-0 items-center gap-1 desk:contents">
			<!-- Its name is the action; where it ends up is the hover hint. -->
			<span class="flex-none desk:mr-[14px]" title={backLabel}>
				<BandButton icon="back" label={w.stopAndBack} onclick={onback} />
			</span>
			<h1
				class="min-w-0 truncate font-display text-[26px] leading-[1.1] font-extrabold tracking-[-0.015em] text-band-ink desk:self-baseline desk:text-[30px]"
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
			class="run-stage mt-2 flex min-h-0 flex-1 flex-col items-center gap-2.5 desk:absolute desk:top-(--band-row-h) desk:right-[520px] desk:bottom-0 desk:left-0 desk:mt-0 desk:justify-center-safe desk:gap-[22px] desk:px-8 desk:pb-10"
		>
			<StageCount
				time={() => player.songTime()}
				{beats}
				{counts}
				{paused}
				quiet={quietSpans}
				{leads}
			/>
			{#if lit !== null}
				<!-- 32 px, a little less under 390 px wide: a long name stays two whole lines at 360. -->
				<p
					bind:this={callEl}
					aria-live="polite"
					class="run-call line-clamp-2 min-h-[2.2em] flex-none text-center font-display text-[min(32px,8.2vw)] leading-[1.1] font-extrabold tracking-[-0.01em] text-balance text-band-ink desk:text-[44px] desk:leading-[1.15]"
				>
					{nowName ?? ''}
				</p>
				<!-- Always there, empty on the last slot: the count keeps its size. -->
				<p
					bind:this={nextEl}
					class="run-next line-clamp-1 min-h-[1.4em] flex-none text-center text-[15px] font-semibold text-band-small desk:text-[18px]"
				>
					{nextName ? w.next(nextName) : ''}
				</p>
			{/if}
			{#if sections.length > 0}
				<!-- The song's section: its name (quiet: no count), and the next one coming. -->
				<div class="flex flex-none flex-col items-center gap-1" aria-live="polite">
					<span
						class="inline-flex h-[30px] items-center gap-1.5 rounded-full bg-band-ink/15 px-3.5 text-[15px] font-extrabold text-band-ink desk:h-9 desk:text-[17px]"
					>
						{#if sectionNow?.countOff}<Icon name="mute" size={16} />{/if}
						{sectionNow ? sectionName(sectionNow) : '–'}
						{#if sectionNow?.countOff}<span class="font-semibold text-band-small"
								>· {t().songs.page.listen.countOff}</span
							>{/if}
					</span>
					<span class="min-h-[1.3em] text-[13px] font-semibold text-band-small desk:text-[15px]"
						>{sectionNext ? aheadLine(sectionNext) : ''}</span
					>
				</div>
			{/if}
			{#if paused}
				<span
					class="inline-flex h-[30px] flex-none items-center gap-1.5 rounded-full pr-3.5 pl-2.5 text-[14px] font-extrabold text-band-small tabular-nums ring-[1.5px] ring-band-ink ring-inset desk:h-9 desk:gap-2 desk:pr-4 desk:pl-3 desk:text-[16px] desk:[&_svg]:size-[18px]"
				>
					<Icon name="pause" size={16} filled />{w.paused(clock(elapsed))}
				</span>
			{:else}
				<span
					class="flex h-[30px] flex-none items-center text-[16px] font-bold text-band-small tabular-nums desk:h-9 desk:text-[20px]"
					>{clock(elapsed)}</span
				>
			{/if}
		</div>
	</header>

	<div
		class="run-sheet -mt-7 flex flex-none flex-col rounded-t-[28px] bg-ground desk:fixed desk:top-(--band-row-h) desk:right-0 desk:bottom-0 desk:mt-0 desk:w-[520px] desk:rounded-tl-[28px] desk:rounded-tr-none {layer !==
		null
			? 'desk:invisible'
			: ''}"
	>
		<div class="run-scroll flex flex-col gap-3 px-4 pt-4 pb-[100px]">
			{#if song}
				<!-- The app's own bar: the `<audio>` has no controls. It seeks once, on
				     release — each seek clears the count already queued. -->
				<SongProgress {audio} onseek={(t) => player.seek(t)} />
			{/if}
			<!-- A routine in Follow keeps room for three rows: About comes and goes with the
			     lit figure, and the count must not change size under it. -->
			<div class={slots.length > 0 && follow ? 'min-h-[194px]' : ''}>
				<RunRows bind:this={rowsEl} {rows} onopen={openRow} />
			</div>
		</div>
	</div>

	{#if layer === 'voice'}
		<!--
			Both are adjustable DURING the run on purpose: whether the voice sits right
			against the music is only knowable once it plays. `dance.countPatterns`, not
			the global list: bachata has no 'son' count.
		-->
		<RunLayer
			label={w.voice}
			{title}
			{player}
			{beats}
			{counts}
			{paused}
			quiet={quietSpans}
			{leads}
			closeLabel={w.closeLayer}
			onclose={closeLayer}
		>
			<div class="flex flex-col gap-3">
				<h2 class="px-1 font-display text-[22px] leading-[1.15] font-extrabold text-ink">
					{w.voice}
				</h2>
				<div class="{CLIP} rounded-2xl bg-surface">
					<div class="px-3 py-2">
						<CountChips
							patterns={dance.countPatterns}
							value={count}
							onchange={oncount}
							name="runCount"
							label={t().exercise.panel.voiceCount}
							scroll={false}
						/>
					</div>
					{#if dance.clave}
						<div class="flex flex-col gap-1.5 border-t border-hairline px-3 py-2.5">
							<span class="px-1 text-[13px] font-bold text-muted" aria-hidden="true"
								>{CLAVE_NAME}</span
							>
							<ClaveChips label={CLAVE_NAME} value={clave} onchange={onclave} name="runClave" />
						</div>
					{/if}
					<div class="border-t border-hairline px-4 py-1">
						<Slider
							label={t().exercise.panel.voiceVolume}
							bind:value={voiceVolume}
							oninput={() => {
								player.setVoiceVolume(voiceVolume);
								onvolume?.(voiceVolume);
							}}
						/>
					</div>
					<div class="border-t border-hairline px-4 py-2.5">
						<Stepper
							value={delayTotal}
							min={0}
							max={DELAY_MAX_MS}
							step={DELAY_STEP_MS}
							label={w.countDelay}
							unit={w.ms}
							minusLabel={w.countEarlier}
							plusLabel={w.countLater}
							onchange={setDelay}
						/>
					</div>
				</div>
				<p class="px-1 text-[13px] text-muted">{w.countDelayNote(delay.reportedMs)}</p>
			</div>
		</RunLayer>
	{:else if layer === 'about' && shown}
		<RunLayer
			label={w.about}
			title={shown.heading}
			{player}
			{beats}
			{counts}
			{paused}
			quiet={quietSpans}
			{leads}
			closeLabel={w.closeLayer}
			onclose={closeLayer}
		>
			<DetailsBody details={shown} musicPaused={paused} onresume={togglePause} />
		</RunLayer>
	{:else if layer === 'routine'}
		<!-- The full-screen routine: the list in large type, to read from a few metres away. -->
		<RunLayer
			label={w.routine}
			{title}
			place={routinePlace(lit, slots.length)}
			{player}
			{beats}
			{counts}
			{paused}
			quiet={quietSpans}
			{leads}
			closeLabel={w.closeFull}
			onclose={closeLayer}
		>
			{#snippet strip()}
				<Segmented
					compact
					onBand
					items={routineViews()}
					value={view}
					name="fullView"
					label={w.routine}
					onchange={onview}
				/>
			{/snippet}
			{#if routineNotes}
				<p class="px-1 pb-3 text-[15px] leading-[1.45] whitespace-pre-line text-ink-2">
					{routineNotes}
				</p>
			{/if}
			<ol bind:this={fullList} aria-label={w.routine} class="relative -mx-1.5 flex flex-col">
				{#each slots as slot, i (i)}
					{@const tone = slotTone(i, lit)}
					{@const on = tone === 'now'}
					<li bind:this={fullEls[i]} aria-current={on ? 'step' : undefined} class="relative">
						{#if follow}
							<button
								type="button"
								class="focus-inset flex w-full cursor-pointer flex-wrap items-center gap-x-3 rounded-xl py-2.5 pr-14 pl-3 text-left {on
									? 'bg-accent-soft'
									: ''}"
								aria-label={w.startFrom(i + 1, slot.figureIds.map(nameOf).join(` ${w.or} `))}
								onclick={() => jump(i)}
							>
								{@render bigRow(slot, i, tone)}
							</button>
							<button
								type="button"
								data-slot-about={i}
								class="{iconButton('bare', 'muted')} absolute top-1 right-1"
								aria-label={w.aboutOf(slotName(i))}
								aria-haspopup="dialog"
								onclick={() => (figureSlot = i)}
							>
								<Icon name="info" size={22} />
							</button>
						{:else}
							<button
								type="button"
								data-slot-about={i}
								class="focus-inset flex w-full cursor-pointer flex-wrap items-center gap-x-3 rounded-xl px-3 py-2.5 text-left active:bg-step"
								aria-label={w.aboutOf(slotName(i))}
								aria-haspopup="dialog"
								onclick={() => (figureSlot = i)}
							>
								{@render bigRow(slot, i, tone)}
							</button>
						{/if}
					</li>
				{/each}
			</ol>
		</RunLayer>
	{/if}

	{#if layer === 'routine' && figureSlot !== null}
		<RunLayer
			over
			label={w.about}
			title={slotName(figureSlot)}
			place={w.routinePlace(figureSlot + 1, slots.length)}
			{player}
			{beats}
			{counts}
			{paused}
			quiet={quietSpans}
			{leads}
			closeLabel={w.closeLayer}
			onclose={closeFigure}
		>
			<div class="flex flex-col gap-8">
				{#each slotDetails(slots[figureSlot]?.figureIds ?? [], figureDetails, nameOf) as d, k (k)}
					<!-- One "Music paused" strip for the layer: over the first figure. -->
					<DetailsBody
						details={d}
						musicPaused={paused}
						onresume={k === 0 ? togglePause : undefined}
					/>
				{/each}
			</div>
		</RunLayer>
	{/if}

	<BottomBar class="run-bar">
		<div class="flex gap-2.5">
			<button type="button" class={STOP} onclick={onstop}>
				<Icon name="stop" size={22} filled />{t().exercise.panel.stop}
			</button>
			<div class="flex min-w-0 flex-1">
				<button
					bind:this={pauseBtn}
					type="button"
					class={button('primary', 'lg', true)}
					onclick={togglePause}
				>
					{#if paused}
						<Icon name="play" size={22} filled />{t().exercise.panel.resume}
					{:else}
						<Icon name="pause" size={22} filled />{t().exercise.panel.pause}
					{/if}
				</button>
			</div>
		</div>
	</BottomBar>
</div>

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
			<!-- The note is the reason the slot was written down — "hand change here". -->
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
		padding: calc(22px + var(--safe-top)) 20px 44px;
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
		}
		.run-sheet {
			flex: 1 1 0;
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
	 * on the band, the sheet a 520 px column on the right.
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
		/* Stop and Pause line up with the sheet's 28 px sides. */
		.run-col :global(.run-bar) {
			padding-inline: 28px;
		}
	}
</style>
