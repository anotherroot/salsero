<script lang="ts" module>
	import { tick, untrack } from 'svelte';
	import type { ClavePattern, CountPattern, Speed } from '$lib/labels';

	export interface PlayerSettings {
		source: 'song' | 'count';
		bpm: number;
		count: CountPattern;
		clave: ClavePattern | null;
		speed: Speed;
		voiceVolume: number;
	}
</script>

<script lang="ts">
	import type { CountTakeRow, PickerSong } from '$lib/types';
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import { CLAVE_NAME, PHRASE_PATTERNS } from '$lib/labels';
	import { t } from '$lib/i18n/catalog';
	import { routineViews, type RoutineView } from '$lib/player/view';
	import type { PhrasePattern } from '$lib/labels';
	import type { Dance } from '$lib/dances/dances';
	import { bpmOf } from '$lib/beatgrid/beatgrid';
	import { parsePhonePractice, practiceSeed, type PracticeInput } from '$lib/exercises/practice';
	import { loadPhonePractice, savePhonePractice } from '$lib/exercises/phone-practice';
	import {
		aboutPreview,
		hasDetails,
		runSources,
		playState,
		setupSubtitle,
		voiceKind
	} from '$lib/player/view';
	import type { RunDetails } from '$lib/types';
	import DetailsBody from './DetailsBody.svelte';
	import RunLayer from './RunLayer.svelte';
	import RunRows from './RunRows.svelte';
	import { myCountHref } from '$lib/voice/back';
	import Screen from '$lib/components/ui/Screen.svelte';
	import BackButton from '$lib/components/shell/BackButton.svelte';
	import Segmented from '$lib/components/ui/Segmented.svelte';
	import Stepper from '$lib/components/ui/Stepper.svelte';
	import Slider from '$lib/components/ui/Slider.svelte';
	import Banner from '$lib/components/ui/Banner.svelte';
	import Spinner from '$lib/components/ui/Spinner.svelte';
	import Icon from '$lib/components/ui/Icon.svelte';
	import BottomBar from '$lib/components/ui/BottomBar.svelte';
	import { CHIP, FIELD_ERROR, GROUP, SECTION_LABEL } from '$lib/components/ui/styles';
	import {
		SETUP_PLAY as PLAY,
		SETUP_PLAY_BUSY as PLAY_BUSY,
		SETUP_VOICE_ROW as VOICE_ROW
	} from './styles';
	import CountChips from './CountChips.svelte';
	import ClaveChips from './ClaveChips.svelte';
	import SongPicker from './SongPicker.svelte';
	import SongProgress from './SongProgress.svelte';
	import SpeedChips from './SpeedChips.svelte';
	import { sampling, stopSample } from '$lib/songs/sample-player.svelte';
	import { releaseSound, videoSound } from '$lib/player/video-sound.svelte';

	interface Props {
		/** This dance's ready songs (own and the groups' shared), for the picker. Without any, only the count is offered. */
		songs: PickerSong[];
		/** Owned by the page, which loads the picked song and mounts its `<audio>`. */
		source: 'song' | 'count';
		songId: number | null;
		/** The picked song's grid has loaded, so Play can start it without waiting. */
		songReady: boolean;
		songError: string | null;
		/** The picked song's element, for the progress bar before Play. */
		audio: HTMLAudioElement | undefined;
		/**
		 * What the exercise remembers (`practiceOf`), which beats this phone's; null
		 * without an exercise or for one never practised. Read when this mounts.
		 */
		remembered: PracticeInput | null;
		/** Shown when the exercise's remembered song can no longer be played. */
		songGone: boolean;
		defaultBpm: number;
		dance: Dance;
		/**
		 * Set when the run is a routine: its name and its figures, for the band's
		 * subtitle. Null for a count-and-clave run, which has no Routine row.
		 */
		routine?: { name: string; figureIds: number[] } | null;
		/** How a routine's list behaves in the run: it moves with the music, or stays put. The page owns it. */
		view?: RoutineView;
		onview?: (view: RoutineView) => void;
		onplay: (settings: PlayerSettings) => void;
		/** A setting changed (not on mount): the page keeps it on the exercise. */
		onchange?: (settings: PlayerSettings) => void;
		/** True while the player is starting, so Play cannot be tapped a second time. */
		starting: boolean;
		/** Where the band's Back goes: where Practice was opened from. */
		back: { href: string; label: string };
		/** The band's title: the exercise's name, or "Practice" without one. */
		title: string;
		/** The exercise's About, when it has one: a row above the settings opens it. */
		details: RunDetails | null;
		/** Every recorded take, for whether the Voice row says Built-in or Yours. */
		takes: CountTakeRow[];
		/** The picked song's grid beats, for its tempo; null until they have loaded. */
		songBeats: number[] | null;
		/** The last Play threw. Fixed words here; the page logs the error. */
		startError: boolean;
	}

	let {
		songs,
		source = $bindable(),
		songId = $bindable(),
		songReady,
		songError,
		audio,
		remembered,
		songGone,
		defaultBpm,
		dance,
		routine = null,
		view = 'follow',
		onview,
		onplay,
		onchange,
		starting,
		back,
		title,
		details,
		takes,
		songBeats,
		startError
	}: Props = $props();

	// What this phone last used, per dance (`phone-practice.ts`). `$derived`, not
	// a plain `const`: `/[dance]/player` is ONE route, and SvelteKit reuses this
	// component across a param change rather than remounting it (see the comment
	// at `[dance]/songs/+page.svelte:11-16`), so a `const` would freeze at
	// whichever dance first mounted it.
	const stored = $derived(loadPhonePractice(dance.slug));
	/**
	 * Where the settings start: the exercise's own memory, else this phone's,
	 * else the defaults (`practiceSeed`). Every stored value proves itself there:
	 * an unrecognised count or clave would throw inside the 25 ms scheduling tick,
	 * a player that plays nothing at all.
	 */
	const seed = $derived(
		practiceSeed(remembered, parsePhonePractice(stored, dance), dance, defaultBpm)
	);

	// The stored `source` is no longer read back: the page decides it, from
	// `?song=` or the exercise's own memory.
	// Seeds, read once: the Stepper and the chips own them after that.
	let bpm = $state(untrack(() => seed.bpm));
	let speed = $state<Speed>(untrack(() => seed.speed));
	// `count` and `clave` need to do two things at once: start from a value
	// that depends on `dance` AND stay editable by the pickers afterwards. A
	// `$derived` (tracks the seed) plus an override `$state` (tracks the user's
	// own tap) gets both: the override is `undefined` until the picker is
	// touched, so the seed keeps following `dance` right up until then.
	// `null` is a legitimate clave ("off"), so `undefined` means "not touched".
	let countOverride = $state<CountPattern | undefined>(undefined);
	const count = $derived(countOverride ?? seed.count);
	let claveOverride = $state<ClavePattern | null | undefined>(undefined);
	const clave = $derived(claveOverride !== undefined ? claveOverride : seed.clave);
	let voiceVolume = $state(untrack(() => parsePhonePractice(stored, dance).voiceVolume ?? 1));

	// Every change is kept at once: on this phone, and through `onchange` on
	// the exercise. Not on the first run, which only reads what was seeded: an
	// untouched page writes nothing back.
	let primed = false;
	$effect(() => {
		const settings: PlayerSettings = {
			source,
			bpm,
			count,
			clave,
			speed,
			voiceVolume
		};
		void songId;
		if (!primed) {
			primed = true;
			return;
		}
		untrack(() => {
			savePhonePractice(dance.slug, settings);
			onchange?.(settings);
		});
	});

	function play() {
		// A sample must never play under a run, nor a video aloud (it would pause it at once).
		stopSample();
		releaseSound(videoSound.key ?? '');
		onplay({ source, bpm, count, clave, speed, voiceVolume });
	}

	// Nothing runs in Setup, but a song sample can: a video played with sound
	// stops it, and a sample started takes the sound back from the video.
	$effect(() => {
		if (videoSound.key !== null) untrack(() => stopSample());
	});
	$effect(() => {
		if (sampling.id !== null) untrack(() => releaseSound(videoSound.key ?? ''));
	});

	let aboutOpen = $state(false);
	let aboutRow: ReturnType<typeof RunRows> | undefined = $state();
	function closeAbout() {
		aboutOpen = false;
		void tick().then(() => aboutRow?.focusRow('about'));
	}

	const uid = $props.id();
	let playBtn: HTMLButtonElement | undefined = $state();
	/**
	 * After a run ends: keyboard focus lands on Play, not <body>. Play can be disabled (no song picked, or it failed to load), and a
	 * disabled button takes no focus: then the screen's heading does.
	 */
	/**
	 * Play now, as a tap on Play would, with the settings shown (the exercise
	 * page's ▶). Nothing when Play is disabled: the page waits until it is not.
	 */
	export function playNow() {
		if (playBtn && !playBtn.disabled) play();
	}

	export function focusPlay() {
		if (playBtn && !playBtn.disabled) {
			playBtn.focus({ preventScroll: true });
			return;
		}
		const heading = document.querySelector<HTMLElement>('h1');
		if (heading) {
			heading.tabIndex = -1;
			heading.focus({ preventScroll: true });
		}
	}

	const w = $derived(t().player);
	const panel = $derived(t().exercise.panel);
	const ps = $derived(playState({ source, songId, ready: songReady, error: songError, starting }));

	/**
	 * The tempo the run would count at, for Built-in or Yours: the stepper's,
	 * or the song's grid at this speed. Null (Built-in) while the grid loads.
	 */
	const tempo = $derived.by(() => {
		if (source === 'count') return bpm;
		const songBpm = songBeats ? bpmOf(songBeats) : null;
		return songBpm === null ? null : songBpm * speed;
	});
	const voice = $derived(voiceKind(takes, count, tempo));
	/** My count records only the phrase patterns; a sparse one opens on its own default. */
	const phrase = $derived(
		(PHRASE_PATTERNS as readonly string[]).includes(count) ? (count as PhrasePattern) : undefined
	);
	// Both are app paths built from known parts (`/voice…`, `/<dance>/…`); resolve() wants that said.
	const voiceHref = $derived(
		resolve(myCountHref(page.url.pathname + page.url.search, phrase) as `/${string}`)
	);

	/** A control's visible label; the control carries the same name for a screen reader. */
	const LABEL = `${SECTION_LABEL} pt-2`;
</script>

{#snippet voiceRow()}
	<a class={VOICE_ROW} href={voiceHref}>
		<span class="flex min-w-0 flex-1 flex-col gap-0.5">
			<span class="text-[16px] font-bold text-ink">{w.voice}</span>
			<span class="text-[13px] text-muted">{w.recordOwn}</span>
		</span>
		<span class="text-[16px] whitespace-nowrap text-muted">{voice}</span>
		<span class="text-chevron"><Icon name="chevron-right" size={20} /></span>
	</a>
{/snippet}

<Screen width="song" {title} subtitle={setupSubtitle(routine)}>
	{#snippet left()}
		<BackButton fallback={back} />
	{/snippet}
	{#snippet extra()}
		{#if songs.length > 0}
			<!-- The band row's toggle on the desktop: 340 wide, as the board draws it. -->
			<div class="desk:w-[340px]">
				<Segmented
					onBand
					name="player-source"
					label={panel.source}
					items={runSources()}
					bind:value={() => source, (v) => (source = v === 'song' ? 'song' : 'count')}
				/>
			</div>
		{/if}
	{/snippet}

	<div class="flex flex-col gap-2 pb-32">
		{#if hasDetails(details)}
			<!-- About before Play (one-player design): read up, then start. -->
			<div class="pb-2">
				<RunRows
					bind:this={aboutRow}
					rows={[{ key: 'about', title: w.about, preview: aboutPreview(details), icon: 'notes' }]}
					onopen={() => (aboutOpen = true)}
				/>
			</div>
		{/if}
		{#if startError}
			<Banner kind="error" title={w.couldNotStart}>{w.couldNotStartBody}</Banner>
		{/if}
		{#if songGone}
			<Banner kind="info" title={panel.songGone}>{panel.songGoneBody}</Banner>
		{/if}

		{#if source === 'count'}
			<div class={GROUP}>
				<div class="py-3 pr-3 pl-4">
					<Stepper label={panel.tempo} unit="BPM" min={60} max={300} step={5} bind:value={bpm} />
				</div>
				{@render voiceRow()}
			</div>
		{:else}
			<span class={LABEL} id="{uid}-song">{panel.song}</span>
			<SongPicker variant="card" {songs} bind:songId labelId="{uid}-song" invalid={!!songError}>
				{#if songReady && audio}
					<!-- Before Play too: skip an intro, or rewind after a Stop left it mid-song. -->
					<div class="pr-2 pl-1">
						<SongProgress
							{audio}
							onseek={(time) => {
								if (audio) audio.currentTime = time;
							}}
						/>
					</div>
				{:else if songId !== null && !songReady && !songError}
					<div class="flex items-center gap-2.5 px-4 py-3 text-[13px] font-semibold text-muted">
						<Spinner size={18} />{w.loadingGrid}
					</div>
				{/if}
			</SongPicker>
			{#if songError}
				<p class={FIELD_ERROR} role="alert"><Icon name="warning" size={16} />{songError}</p>
			{/if}
			<span class={LABEL} aria-hidden="true">{panel.speedLabel}</span>
			<SpeedChips name="player-speed" value={speed} onchange={(s) => (speed = s)} />
		{/if}

		<!-- Nothing is called (since 2026-11-08): a routine's figures are shown. Follow lights each
		     one in time with the music; Still leaves the list for you to read. -->
		{#if routine}
			<span class={LABEL} aria-hidden="true">{w.routine}</span>
			<div role="radiogroup" aria-label={w.routine} class="flex flex-wrap gap-x-2 gap-y-1">
				{#each routineViews() as v (v.value)}
					<label class={CHIP}>
						<input
							type="radio"
							name="routineView"
							checked={view === v.value}
							onchange={() => onview?.(v.value)}
							class="sr-only"
						/>
						{v.label}
					</label>
				{/each}
			</div>
		{/if}

		<span class={LABEL} aria-hidden="true">{panel.voiceCount}</span>
		<CountChips
			label={panel.voiceCount}
			patterns={dance.countPatterns}
			value={count}
			onchange={(p) => (countOverride = p)}
		/>

		{#if dance.clave}
			<span class={LABEL} aria-hidden="true">{CLAVE_NAME}</span>
			<ClaveChips label={CLAVE_NAME} value={clave} onchange={(c) => (claveOverride = c)} />
		{/if}

		{#if source === 'song'}
			<div class="{GROUP} mt-2">{@render voiceRow()}</div>
		{/if}

		<span class={LABEL} aria-hidden="true">{panel.voiceVolume}</span>
		<div class="rounded-2xl bg-surface px-4 py-2">
			<Slider label={panel.voiceVolume} bind:value={voiceVolume} />
		</div>
	</div>
</Screen>

<BottomBar width="song">
	{#if ps.why}
		<p class="mb-2 text-center text-[13px] font-bold text-muted">{ps.why}</p>
	{/if}
	<button
		type="button"
		bind:this={playBtn}
		class={ps.busy ? PLAY_BUSY : PLAY}
		disabled={ps.disabled}
		aria-busy={ps.busy}
		onclick={play}
	>
		{#if ps.busy}
			<Spinner size={22} />{ps.label}
		{:else}
			<Icon name="play" size={22} filled />{ps.label}
		{/if}
	</button>
</BottomBar>

{#if aboutOpen && hasDetails(details)}
	<RunLayer
		label={w.about}
		title={details.heading}
		player={null}
		closeLabel={w.closeLayer}
		onclose={closeAbout}
	>
		<DetailsBody {details} />
	</RunLayer>
{/if}
