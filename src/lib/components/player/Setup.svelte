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
		figureIds: number[];
	}
</script>

<script lang="ts">
	import { resolve } from '$app/paths';
	import { CALL_EVERY, CLAVE_PATTERNS, COUNT_PATTERN_LABEL, SPEEDS } from '$lib/labels';
	import type { Dance } from '$lib/dances/dances';
	import type { CallableFigure } from '$lib/types';

	interface Props {
		song: { id: number; title: string; audioFile: string | null } | null;
		defaultBpm: number;
		figures: CallableFigure[];
		dance: Dance;
		onplay: (settings: PlayerSettings) => void;
		/** True while the player is starting, so Play cannot be tapped a second time. */
		starting: boolean;
	}

	let { song, defaultBpm, figures, dance, onplay, starting }: Props = $props();

	const STORAGE_KEY = 'salsa.player';
	const allIds = figures.map((f) => f.id);

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
	// Through `pick`, like the clave below and for the same reason: an
	// unrecognised pattern reaches COUNT_POSITIONS[...] as undefined and
	// `for…of undefined` throws inside the scheduling tick. `true` is what a
	// store written before patterns existed holds, and it means salsa.
	let count = $state<CountPattern>(
		stored.count === true
			? 'salsa'
			: stored.count === false
				? 'off'
				: pick(stored.count, dance.countPatterns, dance.defaultCountPattern)
	);
	// An unrecognised clave would reach CLAVE_POSITIONS[...] as undefined and
	// throw inside the 25 ms scheduling tick — which never surfaces as an error
	// the user sees, just a player that plays nothing at all. A dance without
	// clave (bachata) must never restore one from a store written while in
	// salsa — the store is per-browser, not per-dance.
	let clave = $state<ClavePattern | null>(
		dance.clave ? pick(stored.clave, [...CLAVE_PATTERNS, null], null) : null
	);
	let callEvery = $state<CallEvery | null>(pick(stored.callEvery, [...CALL_EVERY, null], 2));
	let speed = $state<Speed>(pick(stored.speed, SPEEDS, 1));
	let voiceVolume = $state(num(stored.voiceVolume, 0, 1, 1));
	let figureIds = $state<number[]>(
		Array.isArray(stored.figureIds) ? stored.figureIds.filter((id) => allIds.includes(id)) : allIds
	);

	$effect(() => {
		const settings: PlayerSettings = {
			source,
			bpm,
			count,
			clave,
			callEvery,
			speed,
			voiceVolume,
			figureIds
		};
		try {
			localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
		} catch {
			// Private mode, or storage full — settings just don't persist.
		}
	});

	function play() {
		onplay({ source, bpm, count, clave, callEvery, speed, voiceVolume, figureIds });
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
		<!--
			Wraps rather than sharing one row: seven options do not fit at 375 px,
			and a fast song needs the sparse ones to be as reachable as salsa.
		-->
		<div class="flex flex-wrap gap-2">
			{#each dance.countPatterns as p (p)}
				<label class="{chip} min-w-[5.5rem] grow-0 basis-auto px-3">
					<input
						type="radio"
						name="count"
						checked={count === p}
						onchange={() => (count = p)}
						class="sr-only"
					/>
					{COUNT_PATTERN_LABEL[p]}
				</label>
			{/each}
		</div>
		<a href={resolve('/voice')} class="mt-2 inline-block text-[13px] text-accent underline">
			Use my own voice
		</a>
	</fieldset>

	{#if dance.clave}
		<fieldset>
			<legend class={label}>Clave</legend>
			<div class="flex gap-2">
				<label class={chip}>
					<input
						type="radio"
						name="clave"
						checked={clave === null}
						onchange={() => (clave = null)}
						class="sr-only"
					/>
					Off
				</label>
				{#each CLAVE_PATTERNS as c (c)}
					<label class={chip}>
						<input
							type="radio"
							name="clave"
							checked={clave === c}
							onchange={() => (clave = c)}
							class="sr-only"
						/>
						{c}
					</label>
				{/each}
			</div>
		</fieldset>
	{/if}

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

	<section>
		<div class="mb-2 flex items-center justify-between">
			<span class={label}>Figures ({figureIds.length}/{figures.length})</span>
			<div class="flex gap-3">
				<button type="button" class="text-[13px] text-accent" onclick={() => (figureIds = allIds)}
					>All</button
				>
				<button type="button" class="text-[13px] text-accent" onclick={() => (figureIds = [])}
					>None</button
				>
			</div>
		</div>
		{#if figures.length === 0}
			<p class="text-[13px] text-muted">No callable figures yet — mark one as callable first.</p>
		{:else}
			<ul class="space-y-1.5">
				{#each figures as f (f.id)}
					<li>
						<label
							class="flex h-11 items-center gap-2.5 rounded-lg border border-rule bg-raised px-3"
						>
							<input
								type="checkbox"
								checked={figureIds.includes(f.id)}
								onchange={(e) =>
									(figureIds = e.currentTarget.checked
										? [...figureIds, f.id]
										: figureIds.filter((id) => id !== f.id))}
								class="size-5"
							/>
							<span class="truncate text-[14px]">{f.name}</span>
						</label>
					</li>
				{/each}
			</ul>
		{/if}
	</section>

	<button
		type="button"
		disabled={starting}
		class="h-14 w-full rounded-2xl bg-accent text-[18px] font-bold text-accent-ink disabled:opacity-60"
		onclick={play}
	>
		{starting ? 'Starting…' : 'Play'}
	</button>
</div>
