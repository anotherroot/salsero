<script lang="ts" module>
	import type { CallEvery, ClavePattern, Speed } from '$lib/labels';

	export interface PlayerSettings {
		/** Ignored for count-only practice (no song to play). */
		source: 'song' | 'count';
		bpm: number;
		count: boolean;
		clave: ClavePattern | null;
		callEvery: CallEvery | null;
		speed: Speed;
		voiceVolume: number;
		figureIds: number[];
	}
</script>

<script lang="ts">
	import { CALL_EVERY, CLAVE_PATTERNS, SPEEDS } from '$lib/labels';
	import type { CallableFigure } from '$lib/types';

	interface Props {
		song: { id: number; title: string; audioFile: string | null } | null;
		defaultBpm: number;
		figures: CallableFigure[];
		onplay: (settings: PlayerSettings) => void;
	}

	let { song, defaultBpm, figures, onplay }: Props = $props();

	const STORAGE_KEY = 'salsa.player';
	const allIds = figures.map((f) => f.id);

	/** Wrapped in try/catch: private-mode Safari throws on any localStorage access. */
	function loadStored(): Partial<PlayerSettings> {
		try {
			const raw = localStorage.getItem(STORAGE_KEY);
			return raw ? (JSON.parse(raw) as Partial<PlayerSettings>) : {};
		} catch {
			return {};
		}
	}

	const stored = loadStored();

	let source = $state<'song' | 'count'>(song ? (stored.source ?? 'song') : 'count');
	let bpm = $state(
		typeof stored.bpm === 'number' && stored.bpm >= 60 && stored.bpm <= 300
			? stored.bpm
			: defaultBpm
	);
	let count = $state(stored.count ?? true);
	let clave = $state<ClavePattern | null>(stored.clave ?? null);
	let callEvery = $state<CallEvery | null>(stored.callEvery ?? 2);
	let speed = $state<Speed>(
		typeof stored.speed === 'number' && (SPEEDS as readonly number[]).includes(stored.speed)
			? stored.speed
			: 1
	);
	let voiceVolume = $state(
		typeof stored.voiceVolume === 'number' ? Math.min(1, Math.max(0, stored.voiceVolume)) : 1
	);
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

	<label
		class="flex h-11 items-center justify-between rounded-lg border border-rule bg-raised px-3"
	>
		<span class="text-[15px]">Voice count</span>
		<input
			type="checkbox"
			checked={count}
			onchange={(e) => (count = e.currentTarget.checked)}
			class="size-5"
		/>
	</label>

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
		class="h-14 w-full rounded-2xl bg-accent text-[18px] font-bold text-accent-ink"
		onclick={play}
	>
		Play
	</button>
</div>
