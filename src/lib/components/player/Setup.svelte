<script lang="ts" module>
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
	import { CALL_EVERY, CLAVE_PATTERNS, PHRASE_PATTERNS, SPEEDS } from '$lib/labels';
	import type { PhrasePattern } from '$lib/labels';
	import type { Dance } from '$lib/dances/dances';
	import { bpmOf } from '$lib/beatgrid/beatgrid';
	import { playState, setupSubtitle, voiceKind } from '$lib/player/view';
	import { myCountHref } from '$lib/voice/back';
	import Screen from '$lib/components/ui/Screen.svelte';
	import BandButton from '$lib/components/ui/BandButton.svelte';
	import Segmented from '$lib/components/ui/Segmented.svelte';
	import Stepper from '$lib/components/ui/Stepper.svelte';
	import Slider from '$lib/components/ui/Slider.svelte';
	import Banner from '$lib/components/ui/Banner.svelte';
	import Spinner from '$lib/components/ui/Spinner.svelte';
	import Icon from '$lib/components/ui/Icon.svelte';
	import BottomBar from '$lib/components/ui/BottomBar.svelte';
	import { CHIP, FIELD_ERROR, GROUP, ROW, SECTION_LABEL, button } from '$lib/components/ui/styles';
	import CountChips from './CountChips.svelte';
	import ClaveChips from './ClaveChips.svelte';
	import SongPicker from './SongPicker.svelte';
	import SongProgress from './SongProgress.svelte';
	import SpeedChips from './SpeedChips.svelte';
	import { stopSample } from '$lib/songs/sample-player.svelte';

	interface Props {
		/** This dance's ready songs, for the picker. Without any, only the count is offered. */
		songs: PickerSong[];
		/** Owned by the page, which loads the picked song and mounts its `<audio>`. */
		source: 'song' | 'count';
		songId: number | null;
		/** The picked song's grid has loaded, so Play can start it without waiting. */
		songReady: boolean;
		songError: string | null;
		/** The picked song's element, for the progress bar before Play. */
		audio: HTMLAudioElement | undefined;
		/** The exercise's remembered count-only tempo, which beats this browser's. */
		rememberedBpm: number | null;
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
		/** True while the player is starting, so Play cannot be tapped a second time. */
		starting: boolean;
		/** Where the band's Back goes: where Practice was opened from. */
		back: { href: string; label: string };
		/** Every recorded take, for whether the Voice row says Built-in or Yours. */
		takes: CountTakeRow[];
		/** The picked song's grid beats, for its tempo; null until they have loaded. */
		songBeats: number[] | null;
		/** Set when the last Play threw. Fixed words here; the page logs the error. */
		startError: string | null;
	}

	let {
		songs,
		source = $bindable(),
		songId = $bindable(),
		songReady,
		songError,
		audio,
		rememberedBpm,
		songGone,
		defaultBpm,
		dance,
		routine = null,
		onplay,
		starting,
		back,
		takes,
		songBeats,
		startError
	}: Props = $props();

	// Keyed per dance so the two dances keep separate saved settings — without
	// this, opening the other dance's player would silently overwrite (on the
	// first render's persist effect) whatever the first dance had saved, before
	// the user touched anything. Salsa's slug IS 'salsa', so this key is
	// unchanged for salsa and every already-stored setting survives untouched;
	// bachata simply gets its own key, `'bachata.player'`.
	//
	// `$derived`, not a plain `const`: `/[dance]/player` is ONE route, and
	// SvelteKit reuses this component across a param change rather than
	// remounting it (see the comment at `[dance]/songs/+page.svelte:11-16`) —
	// a plain `const` would freeze at whichever dance first mounted the
	// component. `loadStored()` and the persist `$effect` below both read
	// through this same binding, so they never disagree about which key is
	// current.
	const STORAGE_KEY = $derived(`${dance.slug}.player`);

	/**
	 * Deliberately `unknown`, not `Partial<PlayerSettings>`: this is arbitrary
	 * JSON from a previous version of the app or a hand-edited browser store, and
	 * typing it as our own settings would let TypeScript wave it through. Every
	 * field below has to prove itself.
	 *
	 * Wrapped in try/catch: private-mode Safari throws on any localStorage access.
	 */
	function loadStored(): Record<string, unknown> {
		try {
			const raw = localStorage.getItem(STORAGE_KEY);
			const parsed: unknown = raw ? JSON.parse(raw) : null;
			return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {};
		} catch {
			return {};
		}
	}

	const stored = loadStored();

	/** A stored value only survives if it is still one of the allowed ones. */
	function pick<T>(value: unknown, allowed: readonly T[], fallback: T): T {
		return (allowed as readonly unknown[]).includes(value) ? (value as T) : fallback;
	}
	const num = (value: unknown, min: number, max: number, fallback: number) =>
		typeof value === 'number' && value >= min && value <= max ? value : fallback;

	// The stored `source` is no longer read back: the page decides it, from
	// `?song=` or the exercise's own memory.
	let bpm = $state(rememberedBpm ?? num(stored.bpm, 60, 300, defaultBpm));
	// `count` and `clave` need to do two things at once: start from a value
	// that depends on `dance` (through `pick`, below) AND stay editable by the
	// pickers afterwards. A plain `$state` can only do the second — its
	// initializer runs once, so a direct `dance` read inside it goes stale the
	// same way `STORAGE_KEY` did. Splitting each into a `$derived` (tracks
	// `dance`) plus an override `$state` (tracks the user's own tap) gets both:
	// the override is `undefined` until the picker is touched, so the derived
	// default keeps following `dance` right up until then.
	//
	// Through `pick`, for the same reason as the clave default below: an
	// unrecognised pattern reaches COUNT_POSITIONS[...] as undefined and
	// `for…of undefined` throws inside the scheduling tick. `true` is what a
	// store written before patterns existed holds, and it means salsa.
	let countOverride = $state<CountPattern | undefined>(undefined);
	const count = $derived(
		countOverride ??
			(stored.count === true
				? 'salsa'
				: stored.count === false
					? 'off'
					: pick(stored.count, dance.countPatterns, dance.defaultCountPattern))
	);
	// `null` is a legitimate choice ("clave off"), so the override needs a
	// third state — `undefined` — to mean "not touched yet"; `clave ===
	// undefined` would otherwise be indistinguishable from "off".
	//
	// An unrecognised clave would reach CLAVE_POSITIONS[...] as undefined and
	// throw inside the 25 ms scheduling tick — which never surfaces as an error
	// the user sees, just a player that plays nothing at all. A dance without
	// clave (bachata) must never restore one from a store written while in
	// salsa — the store is per-browser, not per-dance.
	let claveOverride = $state<ClavePattern | null | undefined>(undefined);
	const clave = $derived(
		claveOverride !== undefined
			? claveOverride
			: dance.clave
				? pick(stored.clave, [...CLAVE_PATTERNS, null], null)
				: null
	);
	let callEvery = $state<CallEvery | null>(pick(stored.callEvery, [...CALL_EVERY, null], 2));
	let speed = $state<Speed>(pick(stored.speed, SPEEDS, 1));
	let voiceVolume = $state(num(stored.voiceVolume, 0, 1, 1));

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
		try {
			localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
		} catch {
			// Private mode, or storage full — settings just don't persist.
		}
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
	const SOURCES = [
		{ value: 'count', label: 'Count only' },
		{ value: 'song', label: 'A song' }
	];

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
	const backHref = $derived(resolve(back.href as `/${string}`));

	/** A control's visible label; the control carries the same name for a screen reader. */
	const LABEL = `${SECTION_LABEL} pt-2`;

	/**
	 * Starting… keeps the accent, as the board's loading button does: it is busy,
	 * not unavailable. Still `disabled`, so a second tap cannot build a second player.
	 */
	const PLAY = button('primary', 'lg', true);
	const PLAY_BUSY = PLAY.replace('disabled:bg-disabled-bg disabled:text-disabled-ink', '');
</script>

{#snippet voiceRow()}
	<a class="{ROW.replace('min-h-14', 'min-h-[58px]')} inset-focus" href={voiceHref}>
		<span class="flex min-w-0 flex-1 flex-col gap-0.5">
			<span class="text-[16px] font-bold text-ink">Voice</span>
			<span class="text-[13px] text-muted">Record your own count</span>
		</span>
		<span class="text-[16px] whitespace-nowrap text-muted">{voice}</span>
		<span class="text-chevron"><Icon name="chevron-right" size={20} /></span>
	</a>
{/snippet}

<Screen title="Practice" subtitle={setupSubtitle(routine)}>
	{#snippet left()}
		<BandButton icon="back" label={back.label} href={backHref} />
	{/snippet}
	{#snippet extra()}
		{#if songs.length > 0}
			<Segmented
				onBand
				name="player-source"
				label="Source"
				items={SOURCES}
				bind:value={() => source, (v) => (source = v === 'song' ? 'song' : 'count')}
			/>
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

<BottomBar fade>
	{#if ps.why}
		<p class="mb-2 text-center text-[13px] font-bold text-muted">{ps.why}</p>
	{/if}
	<button
		type="button"
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

<style>
	/*
	 * The Voice row fills its group edge to edge, and the group clips: the app's
	 * focus ring would be cut off outside it, so it goes inside here. A scoped
	 * rule, because utilities lose to the global one.
	 */
	.inset-focus:focus-visible {
		outline-offset: -2px;
	}
</style>
