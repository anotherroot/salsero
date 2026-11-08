<script lang="ts" module>
	import { untrack } from 'svelte';
	import type { CallEvery, ClavePattern, CountPattern, Speed } from '$lib/labels';

	export interface PlayerSettings {
		source: 'song' | 'count';
		bpm: number;
		count: CountPattern;
		clave: ClavePattern | null;
		callEvery: CallEvery | null;
		speed: Speed;
		voiceVolume: number;
	}
</script>

<script lang="ts">
	import type { CountTakeRow, PickerSong } from '$lib/types';
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import { CALL_EVERY, PHRASE_PATTERNS } from '$lib/labels';
	import type { PhrasePattern } from '$lib/labels';
	import type { Dance } from '$lib/dances/dances';
	import { bpmOf } from '$lib/beatgrid/beatgrid';
	import { parsePhonePractice, practiceSeed, type PracticeInput } from '$lib/exercises/practice';
	import { loadPhonePractice, savePhonePractice } from '$lib/exercises/phone-practice';
	import { RUN_SOURCES, playState, setupSubtitle, voiceKind } from '$lib/player/view';
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
	import { stopSample } from '$lib/songs/sample-player.svelte';

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
		 * Set when the run is a routine: its name and how many figures it can
		 * call, for the band's subtitle. Null for a count-and-clave run, which
		 * calls nothing and so offers no Calls setting.
		 */
		routine?: { name: string; figureIds: number[] } | null;
		onplay: (settings: PlayerSettings) => void;
		/** A setting changed (not on mount): the page keeps it on the exercise. */
		onchange?: (settings: PlayerSettings) => void;
		/** True while the player is starting, so Play cannot be tapped a second time. */
		starting: boolean;
		/** Where the band's Back goes: where Practice was opened from. */
		back: { href: string; label: string };
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
		onplay,
		onchange,
		starting,
		back,
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

	/** A stored value only survives if it is still one of the allowed ones. */
	function pick<T>(value: unknown, allowed: readonly T[], fallback: T): T {
		return (allowed as readonly unknown[]).includes(value) ? (value as T) : fallback;
	}

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
	let callEvery = $state<CallEvery | null>(
		untrack(() => pick(stored.callEvery, [...CALL_EVERY, null], 2))
	);
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
			callEvery,
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
		// A sample must never play under a run.
		stopSample();
		// The stored choice survives a run without a routine: it is what the next
		// routine run starts from.
		onplay({
			source,
			bpm,
			count,
			clave,
			callEvery: routine ? callEvery : null,
			speed,
			voiceVolume
		});
	}

	const uid = $props.id();
	let playBtn: HTMLButtonElement | undefined = $state();
	/**
	 * Back from a refused or abandoned save: keyboard focus lands on Play, not
	 * <body>. Play can be disabled (no song picked, or it failed to load), and a
	 * disabled button takes no focus: then the screen's heading does.
	 */
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
			<span class="text-[16px] font-bold text-ink">Voice</span>
			<span class="text-[13px] text-muted">Record your own count</span>
		</span>
		<span class="text-[16px] whitespace-nowrap text-muted">{voice}</span>
		<span class="text-chevron"><Icon name="chevron-right" size={20} /></span>
	</a>
{/snippet}

<Screen width="song" title="Practice" subtitle={setupSubtitle(routine)}>
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
					label="Source"
					items={RUN_SOURCES}
					bind:value={() => source, (v) => (source = v === 'song' ? 'song' : 'count')}
				/>
			</div>
		{/if}
	{/snippet}

	<div class="flex flex-col gap-2 pb-32">
		{#if startError}
			<Banner kind="error" title="Could not start the player."
				>Nothing is playing. Tap Play to try again.</Banner
			>
		{/if}
		{#if songGone}
			<Banner kind="info" title="Its song is not ready">Pick another, or use the count.</Banner>
		{/if}

		{#if source === 'count'}
			<div class={GROUP}>
				<div class="py-3 pr-3 pl-4">
					<Stepper label="Tempo" unit="BPM" min={60} max={300} step={5} bind:value={bpm} />
				</div>
				{@render voiceRow()}
			</div>
		{:else}
			<span class={LABEL} id="{uid}-song">Song</span>
			<SongPicker variant="card" {songs} bind:songId labelId="{uid}-song" invalid={!!songError}>
				{#if songReady && audio}
					<!-- Before Play too: skip an intro, or rewind after a Stop left it mid-song. -->
					<div class="pr-2 pl-1">
						<SongProgress
							{audio}
							onseek={(t) => {
								if (audio) audio.currentTime = t;
							}}
						/>
					</div>
				{:else if songId !== null && !songReady && !songError}
					<div class="flex items-center gap-2.5 px-4 py-3 text-[13px] font-semibold text-muted">
						<Spinner size={18} />Loading the beat grid…
					</div>
				{/if}
			</SongPicker>
			{#if songError}
				<p class={FIELD_ERROR} role="alert"><Icon name="warning" size={16} />{songError}</p>
			{/if}
			<span class={LABEL} aria-hidden="true">Speed</span>
			<SpeedChips name="player-speed" value={speed} onchange={(s) => (speed = s)} />
		{/if}

		<!-- Only a routine calls figures; without one the run is count and clave. -->
		{#if routine}
			<span class={LABEL} aria-hidden="true">Calls · a figure every 1, 2 or 4 eights</span>
			<div role="radiogroup" aria-label="Calls" class="flex flex-wrap gap-x-2 gap-y-1">
				<label class={CHIP}>
					<input
						type="radio"
						name="callEvery"
						checked={callEvery === null}
						onchange={() => (callEvery = null)}
						class="sr-only"
					/>
					Off
				</label>
				{#each CALL_EVERY as n (n)}
					<label class={CHIP}>
						<input
							type="radio"
							name="callEvery"
							checked={callEvery === n}
							onchange={() => (callEvery = n)}
							class="sr-only"
						/>
						Every {n}
					</label>
				{/each}
			</div>
		{/if}

		<span class={LABEL} aria-hidden="true">Voice count</span>
		<CountChips
			label="Voice count"
			patterns={dance.countPatterns}
			value={count}
			onchange={(p) => (countOverride = p)}
		/>

		{#if dance.clave}
			<span class={LABEL} aria-hidden="true">Clave</span>
			<ClaveChips label="Clave" value={clave} onchange={(c) => (claveOverride = c)} />
		{/if}

		{#if source === 'song'}
			<div class="{GROUP} mt-2">{@render voiceRow()}</div>
		{/if}

		<span class={LABEL} aria-hidden="true">Voice volume</span>
		<div class="rounded-2xl bg-surface px-4 py-2">
			<Slider label="Voice volume" bind:value={voiceVolume} />
		</div>
	</div>
</Screen>

<BottomBar fade width="song">
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
			<Spinner size={22} />Starting…
		{:else}
			<Icon name="play" size={22} filled />Play
		{/if}
	</button>
</BottomBar>
