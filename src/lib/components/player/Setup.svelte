<script lang="ts" module>
	import type { CallEvery, ClavePattern, CountPattern, Speed } from '$lib/labels';

	export interface PlayerSettings {
		/** Ignored for count-only practice (no song to play). */
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
	import { resolve } from '$app/paths';
	import { CALL_EVERY, CLAVE_PATTERNS, SPEEDS } from '$lib/labels';
	import type { Dance } from '$lib/dances/dances';
	import CountChips from './CountChips.svelte';
	import ClaveChips from './ClaveChips.svelte';

	interface Props {
		song: { id: number; title: string; audioFile: string | null } | null;
		defaultBpm: number;
		dance: Dance;
		/**
		 * Set when the run is a routine: its name and how many figures it can
		 * call, for one line of summary. Null for a count-and-clave run, which
		 * calls nothing and so offers no Calls setting.
		 */
		routine?: { name: string; figureIds: number[] } | null;
		onplay: (settings: PlayerSettings) => void;
		/** True while the player is starting, so Play cannot be tapped a second time. */
		starting: boolean;
	}

	let { song, defaultBpm, dance, routine = null, onplay, starting }: Props = $props();

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

	let source = $state<'song' | 'count'>(
		song ? pick(stored.source, ['song', 'count'] as const, 'song') : 'count'
	);
	let bpm = $state(num(stored.bpm, 60, 300, defaultBpm));
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

	const field =
		'w-full rounded-lg border border-rule bg-raised px-3 py-2.5 text-[15px] outline-none focus:border-accent';
	const label = 'mb-1 block text-[12px] font-medium text-ink-2';
	const chip =
		'flex h-11 flex-1 cursor-pointer items-center justify-center rounded-lg border text-[14px] has-checked:border-accent has-checked:bg-accent has-checked:text-accent-ink border-rule bg-raised text-ink-2 has-focus-visible:outline-2 has-focus-visible:outline-accent';
</script>

<div class="space-y-5">
	{#if song}
		<fieldset>
			<legend class={label}>Source</legend>
			<div class="flex gap-2">
				<label class={chip}>
					<input
						type="radio"
						name="source"
						checked={source === 'song'}
						onchange={() => (source = 'song')}
						class="sr-only"
					/>
					This song
				</label>
				<label class={chip}>
					<input
						type="radio"
						name="source"
						checked={source === 'count'}
						onchange={() => (source = 'count')}
						class="sr-only"
					/>
					Count only
				</label>
			</div>
		</fieldset>
	{/if}

	{#if source === 'count'}
		<label class="block">
			<span class={label}>BPM</span>
			<input type="number" min="60" max="300" bind:value={bpm} class={field} />
		</label>
	{/if}

	<fieldset>
		<legend class={label}>Voice count</legend>
		<CountChips
			patterns={dance.countPatterns}
			value={count}
			onchange={(p) => (countOverride = p)}
		/>
		<a href={resolve('/voice')} class="mt-2 inline-block text-[13px] text-accent underline">
			Use my own voice
		</a>
	</fieldset>

	{#if dance.clave}
		<fieldset>
			<legend class={label}>Clave</legend>
			<ClaveChips value={clave} onchange={(c) => (claveOverride = c)} />
		</fieldset>
	{/if}

	<!-- Only a routine calls figures; without one the run is count and clave. -->
	{#if routine}
		<fieldset>
			<legend class={label}>Calls</legend>
			<div class="flex gap-2">
				<label class={chip}>
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
					<label class={chip}>
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
		</fieldset>
	{/if}

	{#if song}
		<fieldset>
			<legend class={label}>Speed</legend>
			<div class="flex gap-2">
				{#each SPEEDS as s (s)}
					<label class={chip}>
						<input
							type="radio"
							name="speed"
							checked={speed === s}
							onchange={() => (speed = s)}
							class="sr-only"
						/>
						{s}×
					</label>
				{/each}
			</div>
		</fieldset>
	{/if}

	<label class="block">
		<span class={label}>Voice volume</span>
		<input type="range" min="0" max="1" step="0.05" bind:value={voiceVolume} class="w-full" />
	</label>

	{#if routine}
		<p class="rounded-lg border border-rule bg-raised px-3 py-2.5 text-[14px] text-ink-2">
			Routine: <span class="font-medium text-ink">{routine.name}</span>, {routine.figureIds.length}
			{routine.figureIds.length === 1 ? 'figure' : 'figures'}
		</p>
	{/if}

	<button
		type="button"
		disabled={starting}
		class="h-14 w-full rounded-2xl bg-accent text-[18px] font-bold text-accent-ink disabled:opacity-60"
		onclick={play}
	>
		{starting ? 'Starting…' : 'Play'}
	</button>
</div>
